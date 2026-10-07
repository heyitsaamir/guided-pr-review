// Turn fetched PR data into a guided-review analysis:
//   overviewSentence, steps, beforeAfter, chapters, orderedFiles
// Uses Vercel AI Gateway (OpenAI-compatible) when AI_GATEWAY_API_KEY is set,
// otherwise falls back to a deterministic heuristic guide.

import { parsePatch } from './lib/diff.mjs';

export const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5';

// ---------------------------------------------------------------------------
// File roles & ordering (ours): core → supporting → database → tests → docs → generated
// ---------------------------------------------------------------------------

export const ROLES = ['core', 'supporting', 'database', 'tests', 'docs', 'generated'];
export const ROLE_RANK = Object.fromEntries(ROLES.map((r, i) => [r, i]));

const GENERATED_RE = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|Gemfile\.lock|poetry\.lock|composer\.lock|go\.sum|Pipfile\.lock|uv\.lock|flake\.lock)$/,
  /(^|\/)(dist|build|out|vendor|__generated__|generated|gen)\//,
  /\.(min\.(js|css)|map|snap|pb\.go|lock)$/,
  /(_pb2\.py|\.g\.dart|\.generated\.\w+|\.d\.ts\.map)$/,
];
const TEST_RE = [
  /(^|\/)(test|tests|__tests__|spec|specs|e2e|cypress|playwright|testdata|fixtures?)\//i,
  /[._-](test|spec)\.\w+$/i,
  /(^|\/)test_[^/]+\.py$/,
  /_test\.(go|py|rb|exs?)$/,
];
const DB_RE = [
  /(^|\/)(migrations?|migrate|db\/migrate|alembic|prisma|schema|seeds?)\//i,
  /\.(sql|prisma)$/i,
  /(^|\/)schema\.(rb|graphql|gql)$/i,
];
const DOCS_RE = [/\.(md|mdx|rst|txt|adoc)$/i, /(^|\/)(docs?|documentation)\//i, /(^|\/)(LICENSE|CHANGELOG|AUTHORS|CODEOWNERS)(\.\w+)?$/i];
const SUPPORTING_RE = [
  /(^|\/)(types?|typings|utils?|helpers?|lib\/util|constants?|config|configs|scripts?|\.github|ci)\//i,
  /\.(json|ya?ml|toml|ini|cfg|gradle|xml|plist|podspec|env\.example)$/i,
  /(^|\/)(Dockerfile|Makefile|Procfile|\.gitignore|\.eslintrc.*|tsconfig.*|vite\.config.*|webpack\.config.*|babel\.config.*|jest\.config.*)$/i,
  /\.d\.ts$/,
];

export function classifyRole(path) {
  const t = (res) => res.some((re) => re.test(path));
  if (t(GENERATED_RE)) return 'generated';
  if (t(TEST_RE)) return 'tests';
  if (t(DB_RE)) return 'database';
  if (t(DOCS_RE)) return 'docs';
  if (t(SUPPORTING_RE)) return 'supporting';
  return 'core';
}

// ---------------------------------------------------------------------------
// Strict JSON schema the model must follow
// ---------------------------------------------------------------------------

const nullable = (type) => ({ type: [type, 'null'] });

export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overviewSentence', 'steps', 'beforeAfter', 'chapters', 'orderedFiles'],
  properties: {
    overviewSentence: { type: 'string', description: 'One sentence of product-level context: what this PR does and why.' },
    steps: {
      type: 'array',
      description: '2-5 numbered steps that tell the story of the change, in order.',
      items: { type: 'string' },
    },
    beforeAfter: {
      type: 'object',
      additionalProperties: false,
      required: ['caption', 'mode', 'lines', 'nodes'],
      properties: {
        caption: { type: 'string', description: 'Short grey caption, e.g. "How a blob read reaches the network".' },
        mode: { type: 'string', enum: ['annotated_diff', 'flow'] },
        lines: {
          type: 'array',
          description: 'For annotated_diff: 4-10 simplified pseudo-code lines. Empty for flow.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'indent', 'code', 'note', 'chapter'],
            properties: {
              kind: { type: 'string', enum: ['context', 'add', 'del'] },
              indent: { type: 'integer', description: 'Indent level (0-4).' },
              code: { type: 'string' },
              note: { ...nullable('string'), description: 'Grey callout, <= 10 words, or null.' },
              chapter: { ...nullable('integer'), description: '1-based chapter number this line belongs to, or null.' },
            },
          },
        },
        nodes: {
          type: 'array',
          description: 'For flow: 3-9 nodes in data-flow order. Empty for annotated_diff.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'label', 'change', 'chapter', 'branchOf', 'edgeLabel'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string', description: 'Function/component/module name, e.g. "useShareSend()".' },
              change: { type: 'string', enum: ['added', 'changed', 'unchanged', 'removed'] },
              chapter: nullable('integer'),
              branchOf: { ...nullable('string'), description: 'id of the node this branches off (side path), or null if on the main path.' },
              edgeLabel: { ...nullable('string'), description: 'Label on the incoming arrow, or null.' },
            },
          },
        },
      },
    },
    chapters: {
      type: 'array',
      description: 'Idea-sized chapters. Every changed file appears in exactly one chapter.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'paragraphs', 'files'],
        properties: {
          title: { type: 'string', description: 'Short imperative title, e.g. "Build the share extension".' },
          paragraphs: { type: 'array', items: { type: 'string' }, description: '1-2 plain-language paragraphs.' },
          files: { type: 'array', items: { type: 'string' }, description: 'Exact file paths from the PR.' },
        },
      },
    },
    orderedFiles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'role'],
        properties: {
          path: { type: 'string' },
          role: { type: 'string', enum: ROLES },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You write guided walkthroughs of GitHub pull requests for human reviewers.
A big diff shown in file order forces reviewers to jump between files to work out what the PR does. Your job is to do that work for them.

Produce:
1. overviewSentence — ONE sentence (<= 35 words) of product-level context: what changes for users/callers and why. No "This PR" filler if avoidable; plain words.
2. steps — 2 to 5 short numbered steps (<= 20 words each) that tell the story of how the change works, in the order a reader should understand it. Wrap identifiers in backticks.
3. beforeAfter — a tiny "show me" visual of the core behavior change:
   - mode "annotated_diff" for localized logic changes: 4-10 simplified pseudo-code lines (not a literal hunk) with kind context/add/del, an indent level, and short grey notes (<= 10 words) on changed lines explaining the effect. Tag changed lines with the chapter number that implements them.
   - mode "flow" when the PR adds or reroutes a pipeline across several units: 3-9 nodes in data-flow order, change = added/changed/unchanged/removed, chapter tags, optional side branches (branchOf) and arrow labels.
   - caption: a short phrase like "How a blob read reaches the network".
4. chapters — group files into idea-sized chapters a reviewer can check off one at a time. Title: short imperative phrase (<= 6 words). paragraphs: 1-2 plain-language paragraphs (2-4 sentences each) explaining what changed and why, with identifiers in backticks. Every changed file must appear in exactly one chapter, using exact paths.
5. orderedFiles — every file with a role: core | supporting | database | tests | docs | generated.

Ordering rules (important): the core change comes first. Supporting plumbing (types, config, utils) next. Database/migrations, then tests, then docs and generated files/lockfiles come LAST. Chapters must follow this order.

Write for a smart reviewer new to this codebase. Be concrete; never invent behavior that is not in the diff. Respond with JSON only.`;

const PATCH_BUDGET = 160_000;
const PER_FILE_BUDGET = 14_000;

export function buildUserPrompt(pr) {
  const header = [
    `Repository: ${pr.owner}/${pr.repo}`,
    `PR #${pr.number}: ${pr.title}`,
    `Author: ${pr.author?.login ?? 'unknown'} · +${pr.additions} -${pr.deletions} · ${pr.files.length} files`,
    '',
    'PR description:',
    truncate(pr.body || '(none)', 4000),
    '',
    'Changed files (path · status · +/- · heuristic role):',
    ...pr.files.map((f) => `- ${f.path} · ${f.status} · +${f.additions} -${f.deletions} · ${classifyRole(f.path)}`),
    '',
    'Patches:',
  ];
  let budget = PATCH_BUDGET;
  const patches = [];
  for (const f of pr.files) {
    const role = classifyRole(f.path);
    let body;
    if (!f.patch) body = '(binary or too large — no patch)';
    else if (role === 'generated') body = '(generated file — patch omitted)';
    else body = truncate(f.patch, Math.min(PER_FILE_BUDGET, Math.max(budget, 600)));
    budget -= body.length;
    patches.push(`### ${f.path}\n${body}`);
  }
  return header.join('\n') + '\n' + patches.join('\n\n');
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n) + `\n… [truncated ${s.length - n} chars]`;
}

// ---------------------------------------------------------------------------
// Gateway call
// ---------------------------------------------------------------------------

export async function analyzeWithGateway(pr, { apiKey = process.env.AI_GATEWAY_API_KEY, model = DEFAULT_MODEL, log = () => {} } = {}) {
  if (!apiKey) throw new Error('AI_GATEWAY_API_KEY is not set');
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(pr) },
  ];
  let responseFormat = { type: 'json_schema', json_schema: { name: 'guided_review', strict: true, schema: ANALYSIS_SCHEMA } };

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    log(`Calling AI Gateway (${model}), attempt ${attempt}`);
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 8000, response_format: responseFormat }),
    });
    const text = await res.text();
    if (!res.ok) {
      // Some providers reject json_schema; degrade to plain JSON mode once.
      if (res.status === 400 && responseFormat.type === 'json_schema' && /response_format|json_schema|schema/i.test(text)) {
        log('Model rejected json_schema; retrying with json_object + schema in prompt');
        responseFormat = { type: 'json_object' };
        messages[0] = { role: 'system', content: SYSTEM_PROMPT + '\n\nJSON schema:\n' + JSON.stringify(ANALYSIS_SCHEMA) };
        continue;
      }
      throw new Error(`AI Gateway error ${res.status}: ${text.slice(0, 500)}`);
    }
    const content = JSON.parse(text).choices?.[0]?.message?.content ?? '';
    try {
      const parsed = extractJson(content);
      const problems = validateShape(parsed);
      if (problems.length) throw new Error(problems.join('; '));
      return parsed;
    } catch (err) {
      lastErr = err;
      log(`Invalid model output: ${err.message}`);
      messages.push({ role: 'assistant', content }, { role: 'user', content: `That output was invalid (${err.message}). Reply again with only valid JSON matching the schema.` });
    }
  }
  throw new Error(`Model did not return valid JSON: ${lastErr?.message}`);
}

function extractJson(s) {
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no JSON object found');
  return JSON.parse(t.slice(start, end + 1));
}

function validateShape(a) {
  const p = [];
  if (typeof a?.overviewSentence !== 'string') p.push('overviewSentence missing');
  if (!Array.isArray(a?.steps)) p.push('steps missing');
  if (!Array.isArray(a?.chapters) || !a.chapters.length) p.push('chapters missing');
  if (!a?.beforeAfter || typeof a.beforeAfter !== 'object') p.push('beforeAfter missing');
  return p;
}

// ---------------------------------------------------------------------------
// Normalization — enforce invariants regardless of where the analysis came from
// ---------------------------------------------------------------------------

export function normalizeAnalysis(raw, pr, generator = {}) {
  const fileByPath = new Map(pr.files.map((f) => [f.path, f]));
  const modelRole = new Map((raw.orderedFiles || []).filter((f) => fileByPath.has(f.path)).map((f) => [f.path, f.role]));
  const roleOf = (path) => {
    const h = classifyRole(path);
    if (h === 'generated') return h; // never trust a model to promote a lockfile
    const m = modelRole.get(path);
    return ROLES.includes(m) ? m : h;
  };
  const modelOrder = new Map((raw.orderedFiles || []).map((f, i) => [f.path, i]));

  // 1. Chapters: keep known paths, each file once.
  const seen = new Set();
  let chapters = (raw.chapters || []).map((c, i) => {
    const files = (c.files || []).filter((p) => fileByPath.has(p) && !seen.has(p) && seen.add(p));
    return {
      originalIndex: i + 1,
      title: String(c.title || `Chapter ${i + 1}`).trim(),
      paragraphs: (c.paragraphs || []).map(String).filter(Boolean).slice(0, 2),
      files,
    };
  });

  // 2. Orphans get grouped by role into trailing chapters.
  const orphans = pr.files.map((f) => f.path).filter((p) => !seen.has(p));
  if (orphans.length) {
    const groups = groupBy(orphans, roleOf);
    for (const role of ROLES) {
      if (!groups[role]) continue;
      chapters.push({
        originalIndex: null,
        title: ORPHAN_TITLES[role],
        paragraphs: [`${groups[role].length === 1 ? 'This file was' : 'These files were'} not placed in a chapter by the analysis; ${ORPHAN_HINTS[role]}`],
        files: groups[role],
      });
    }
  }
  chapters = chapters.filter((c) => c.files.length);

  // 3. Within a chapter: role rank, then model order, then PR order.
  const prOrder = new Map(pr.files.map((f, i) => [f.path, i]));
  for (const c of chapters) {
    c.files.sort((a, b) => ROLE_RANK[roleOf(a)] - ROLE_RANK[roleOf(b)] || (modelOrder.get(a) ?? 1e9) - (modelOrder.get(b) ?? 1e9) || prOrder.get(a) - prOrder.get(b));
  }

  // 4. Chapter order: keep the narrative for core/supporting chapters, but push
  //    database → tests → docs → generated chapters to the end (stable).
  const chapterRank = (c) => Math.max(1, Math.min(...c.files.map((p) => ROLE_RANK[roleOf(p)])));
  chapters = chapters.map((c, i) => ({ c, i })).sort((a, b) => chapterRank(a.c) - chapterRank(b.c) || a.i - b.i).map(({ c }) => c);

  const remap = new Map();
  chapters.forEach((c, i) => {
    c.index = i + 1;
    if (c.originalIndex) remap.set(c.originalIndex, c.index);
  });
  const mapChapter = (n) => (n == null ? null : remap.get(n) ?? null);

  // 5. Before / after.
  const ba = raw.beforeAfter || {};
  const beforeAfter = {
    caption: String(ba.caption || '').trim(),
    mode: ba.mode === 'flow' ? 'flow' : 'annotated_diff',
    sourcePath: ba.sourcePath || null,
    lines: (ba.lines || []).slice(0, 14).map((l) => ({
      kind: ['add', 'del'].includes(l.kind) ? l.kind : 'context',
      indent: clamp(Number(l.indent) || 0, 0, 6),
      code: String(l.code ?? ''),
      note: l.note ? String(l.note) : null,
      chapter: mapChapter(l.chapter),
    })),
    nodes: (ba.nodes || []).slice(0, 12).map((n, i) => ({
      id: String(n.id ?? `n${i}`),
      label: String(n.label ?? ''),
      change: ['added', 'changed', 'removed'].includes(n.change) ? n.change : 'unchanged',
      chapter: mapChapter(n.chapter),
      branchOf: n.branchOf ? String(n.branchOf) : null,
      edgeLabel: n.edgeLabel ? String(n.edgeLabel) : null,
    })),
  };
  if (beforeAfter.mode === 'flow' && !beforeAfter.nodes.length) beforeAfter.mode = 'annotated_diff';
  if (beforeAfter.mode === 'annotated_diff' && !beforeAfter.lines.length) {
    Object.assign(beforeAfter, heuristicBeforeAfter(pr, chapters));
  }

  const orderedFiles = chapters.flatMap((c) =>
    c.files.map((p) => ({ path: p, role: roleOf(p), chapter: c.index, additions: fileByPath.get(p).additions, deletions: fileByPath.get(p).deletions })),
  );

  return {
    version: 1,
    generator: { mode: 'ai', ...generator },
    overviewSentence: String(raw.overviewSentence || pr.title).trim(),
    steps: (raw.steps || []).map(String).filter(Boolean).slice(0, 6),
    beforeAfter,
    chapters: chapters.map(({ index, title, paragraphs, files }) => ({ index, title, paragraphs, files })),
    orderedFiles,
  };
}

const ORPHAN_TITLES = {
  core: 'Remaining core changes',
  supporting: 'Supporting changes',
  database: 'Database and migrations',
  tests: 'Tests',
  docs: 'Documentation',
  generated: 'Generated files',
};
const ORPHAN_HINTS = {
  core: 'review them alongside the chapters above.',
  supporting: 'they mostly carry types, config or helpers for the main change.',
  database: 'check that migrations are reversible and match the code.',
  tests: 'check that they cover the behavior described above.',
  docs: 'skim them for accuracy against the code.',
  generated: 'they are produced by tooling and rarely need line-by-line review.',
};

// ---------------------------------------------------------------------------
// Heuristic fallback (no AI)
// ---------------------------------------------------------------------------

export function heuristicAnalysis(pr) {
  const byRole = groupBy(pr.files.map((f) => f.path), classifyRole);
  const chapters = [];
  for (const role of ROLES) {
    const paths = byRole[role];
    if (!paths) continue;
    if (role === 'core' || role === 'supporting') {
      const byDir = groupBy(paths, (p) => p.split('/').slice(0, -1).join('/') || '.');
      for (const [dir, files] of Object.entries(byDir)) {
        chapters.push({
          title: dir === '.' ? 'Top-level changes' : `Changes in ${lastSegments(dir)}`,
          paragraphs: [summarizeFiles(pr, files) + (role === 'supporting' ? ' Mostly types, config or helpers.' : '')],
          files,
        });
      }
    } else {
      chapters.push({ title: ORPHAN_TITLES[role], paragraphs: [summarizeFiles(pr, paths) + ' ' + cap(ORPHAN_HINTS[role])], files: paths });
    }
  }
  const names = (files) => files.map((p) => '`' + p.split('/').pop() + '`').join(', ');
  const raw = {
    overviewSentence: overviewFromBody(pr),
    steps: chapters.slice(0, 5).map((c) => `${c.title.replace(/\.$/, '')}: ${names(c.files.slice(0, 3))}${c.files.length > 3 ? ` and ${c.files.length - 3} more` : ''}.`),
    beforeAfter: { caption: '', mode: 'annotated_diff', lines: [], nodes: [] },
    chapters,
    orderedFiles: pr.files.map((f) => ({ path: f.path, role: classifyRole(f.path) })),
  };
  return normalizeAnalysis(raw, pr, { mode: 'heuristic', model: null });
}

const COMMENTISH = /^\s*(\/\/|\/\*|\*|#|--|<!--)/;

function heuristicBeforeAfter(pr, chapters) {
  // Pick the most central file, then its hunk with the most changed *code* lines,
  // and show a short window around the first real change.
  const chapterOf = new Map(chapters.flatMap((c) => c.files.map((p) => [p, c.index])));
  const withPatch = pr.files.filter((f) => f.patch);
  if (!withPatch.length) return { caption: 'No textual changes', lines: [] };
  const rank = (f) => ROLE_RANK[classifyRole(f.path)];
  const best = Math.min(...withPatch.map(rank));
  const file = withPatch.filter((f) => rank(f) === best).sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))[0];

  const isCode = (r) => r.type !== 'ctx' && r.text.trim() && !COMMENTISH.test(r.text);
  const hunk = parsePatch(file.patch).sort((a, b) => b.rows.filter(isCode).length - a.rows.filter(isCode).length)[0];
  const rows = hunk.rows.filter((r) => r.text.trim());
  let first = rows.findIndex(isCode);
  if (first < 0) first = rows.findIndex((r) => r.type !== 'ctx');
  const from = Math.max(0, first - 2);
  const window = rows.slice(from, from + 9);
  const ws = (t) => t.match(/^\s*/)[0].replace(/\t/g, '  ').length;
  const minIndent = Math.min(...window.map((r) => ws(r.text)));
  return {
    caption: `Where \`${file.path.split('/').pop()}\` changes`,
    sourcePath: file.path,
    lines: window.map((r) => {
      const kind = r.type === 'add' ? 'add' : r.type === 'del' ? 'del' : 'context';
      return { kind, indent: Math.round((ws(r.text) - minIndent) / 2), code: r.text.trim(), note: null, chapter: kind === 'context' ? null : chapterOf.get(file.path) ?? null };
    }),
  };
}

function summarizeFiles(pr, paths) {
  const fs = pr.files.filter((f) => paths.includes(f.path));
  const add = fs.reduce((s, f) => s + f.additions, 0);
  const del = fs.reduce((s, f) => s + f.deletions, 0);
  const added = fs.filter((f) => f.status === 'added').length;
  return `${fs.length} file${fs.length === 1 ? '' : 's'} (+${add} −${del})${added ? `, ${added} new` : ''}.`;
}

function overviewFromBody(pr) {
  const text = (pr.body || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => l.trim() && !/^\s*(#|[-*] \[|>|\||```)/.test(l))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const m = text.match(/^(.{40,280}?[.!?])(\s|$)/);
  if (m && !/^(fix(es|ed)?|close[sd]?|resolve[sd]?)\s+#\d+/i.test(m[1])) return m[1];
  const dirs = [...new Set(pr.files.map((f) => f.path.split('/').slice(0, -1).slice(-1)[0] || 'root'))].slice(0, 3);
  return `${pr.title.replace(/\.$/, '')}, touching ${pr.files.length} file${pr.files.length === 1 ? '' : 's'} across ${dirs.map((d) => '`' + d + '`').join(', ')}.`;
}

const lastSegments = (dir) => '`' + dir.split('/').slice(-2).join('/') + '`';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
function groupBy(arr, fn) {
  const out = {};
  for (const x of arr) (out[fn(x)] ||= []).push(x);
  return out;
}
