// A tiny, dependency-free syntax highlighter. Good enough for review-sized
// snippets; it tokenizes line by line and carries block-comment state.

export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const KW = {
  js: 'await async break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield as satisfies',
  ts: 'type interface enum implements declare namespace abstract readonly private protected public keyof infer is asserts unique override',
  lit: 'true false null undefined NaN Infinity None True False nil self',
  py: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
  rs: 'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return Self static struct super trait type unsafe use where while',
  rb: 'alias and begin break case class def defined do else elsif end ensure for if in module next not or redo rescue retry return super then undef unless until when while yield require',
  c: 'auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class namespace template typename public private protected virtual override new delete using bool',
  java: 'abstract boolean byte catch char class do double else enum extends final finally float for if implements import instanceof int interface long new package private protected public return short static super switch synchronized this throw throws try void volatile while val var fun when object companion data sealed open internal lateinit override suspend',
  swift: 'class deinit enum extension func import init let protocol struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch is rethrows throw throws try async await some any self Self public private internal fileprivate open static override mutating weak',
  sh: 'if then else elif fi for while do done case esac in function return local export set unset echo exit source',
  sql: 'select from where insert into values update set delete create table alter add drop index primary key foreign references not null default unique join left right inner outer on group by order having limit offset as and or begin commit',
};

const LANGS = {
  js: { kw: [KW.js, KW.lit], line: '//', block: true },
  ts: { kw: [KW.js, KW.ts, KW.lit], line: '//', block: true },
  py: { kw: [KW.py, KW.lit], line: '#', block: false },
  go: { kw: [KW.go, KW.lit], line: '//', block: true },
  rs: { kw: [KW.rs, KW.lit], line: '//', block: true },
  rb: { kw: [KW.rb, KW.lit], line: '#', block: false },
  c: { kw: [KW.c, KW.lit], line: '//', block: true },
  java: { kw: [KW.java, KW.lit], line: '//', block: true },
  swift: { kw: [KW.swift, KW.lit], line: '//', block: true },
  sh: { kw: [KW.sh, KW.lit], line: '#', block: false },
  sql: { kw: [KW.sql, KW.lit], line: '--', block: true, ci: true },
  yaml: { kw: [KW.lit], line: '#', block: false },
  css: { kw: [], line: null, block: true },
  json: { kw: [KW.lit], line: null, block: false },
};

const EXT = {
  js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'ts', tsx: 'ts', mts: 'ts', cts: 'ts',
  py: 'py', go: 'go', rs: 'rs', rb: 'rb', c: 'c', h: 'c', cc: 'c', cpp: 'c', hpp: 'c', cs: 'java', m: 'c', mm: 'c',
  java: 'java', kt: 'java', kts: 'java', scala: 'java', gradle: 'java', swift: 'swift', dart: 'java', php: 'js',
  sh: 'sh', bash: 'sh', zsh: 'sh', fish: 'sh', sql: 'sql', yml: 'yaml', yaml: 'yaml', toml: 'yaml',
  css: 'css', scss: 'css', less: 'css', json: 'json', jsonc: 'ts',
};

export function langFor(path) {
  const base = path.split('/').pop();
  if (/^(Dockerfile|Makefile)$/.test(base)) return 'sh';
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  if (ext === 'md' || ext === 'mdx') return 'md';
  return EXT[ext] || null;
}

const cache = new Map();
function compile(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const L = LANGS[lang];
  const kw = new Set(L.kw.join(' ').split(/\s+/).filter(Boolean).map((k) => (L.ci ? k.toLowerCase() : k)));
  const parts = [];
  if (L.block) parts.push('(?<bopen>\\/\\*)');
  if (L.line) parts.push(`(?<line>${L.line.replace(/[/#-]/g, '\\$&')}.*$)`);
  parts.push('(?<str>"(?:[^"\\\\]|\\\\.)*"?|\'(?:[^\'\\\\]|\\\\.)*\'?|`(?:[^`\\\\]|\\\\.)*`?)');
  parts.push('(?<num>\\b(?:0x[\\da-fA-F_]+|\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?n?)\\b)');
  parts.push('(?<id>[A-Za-z_$@][\\w$]*)');
  const re = new RegExp(parts.join('|'), 'g');
  const c = { L, kw, re };
  cache.set(lang, c);
  return c;
}

/** Highlight an array of lines; returns array of HTML strings. */
export function highlightLines(lines, lang) {
  if (lang === 'md') return lines.map(highlightMarkdown);
  if (!lang || !LANGS[lang]) return lines.map(escapeHtml);
  const { L, kw, re } = compile(lang);
  let inBlock = false;
  return lines.map((line) => {
    let out = '';
    let i = 0;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end < 0) return span('c', line);
      out += span('c', line.slice(0, end + 2));
      i = end + 2;
      inBlock = false;
    }
    re.lastIndex = i;
    let m;
    while ((m = re.exec(line))) {
      out += escapeHtml(line.slice(i, m.index));
      const g = m.groups;
      if (g.bopen) {
        const end = line.indexOf('*/', m.index + 2);
        if (end < 0) {
          out += span('c', line.slice(m.index));
          inBlock = true;
          i = line.length;
          break;
        }
        out += span('c', line.slice(m.index, end + 2));
        re.lastIndex = i = end + 2;
        continue;
      }
      if (g.line) out += span('c', g.line);
      else if (g.str) out += span('s', g.str);
      else if (g.num) out += span('n', g.num);
      else if (g.id) {
        const id = g.id;
        const next = line.slice(re.lastIndex).match(/^\s*(\(|<[\w\s,]*>\s*\()/);
        if (kw.has(L.ci ? id.toLowerCase() : id)) out += span('k', id);
        else if (id[0] === '@') out += span('t', id);
        else if (next) out += span('f', id);
        else if (/^[A-Z][a-z0-9]/.test(id) && lang !== 'sql') out += span('t', id);
        else if (lang === 'json' || lang === 'yaml') out += escapeHtml(id);
        else out += escapeHtml(id);
      }
      i = re.lastIndex;
    }
    out += escapeHtml(line.slice(i));
    return out;
  });
}

function highlightMarkdown(line) {
  if (/^\s*#{1,6}\s/.test(line)) return span('k', line);
  if (/^\s*```/.test(line)) return span('c', line);
  let s = escapeHtml(line);
  s = s.replace(/`([^`]+)`/g, '<span class="hs">`$1`</span>');
  s = s.replace(/(\*\*[^*]+\*\*)/g, '<span class="hk">$1</span>');
  s = s.replace(/(\[[^\]]+\]\([^)]+\))/g, '<span class="hf">$1</span>');
  s = s.replace(/^(\s*(?:[-*+]|\d+\.)\s)/, '<span class="hn">$1</span>');
  return s;
}

const span = (cls, text) => `<span class="h${cls}">${escapeHtml(text)}</span>`;
