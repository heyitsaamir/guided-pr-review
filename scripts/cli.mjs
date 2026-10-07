#!/usr/bin/env node
// guided-pr-review <pr-url|owner/repo#n> [--out dir]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fetchPr, parsePrRef } from './fetch-pr.mjs';
import { analyzeWithGateway, heuristicAnalysis, normalizeAnalysis, summarizeError, heuristicNotice, DEFAULT_MODEL } from './analyze.mjs';
import { renderHtml } from './render.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `guided-pr-review — turn a GitHub pull request into a guided walkthrough
(Overview · Guide · Diff) as a single self-contained HTML file.

Usage
  guided-pr-review <pr-url | owner/repo#number> [options]
  node scripts/cli.mjs <pr-url | owner/repo#number> [options]

Options
  -o, --out <dir>        Output directory (default: ./guided-review)
  -m, --model <id>       AI Gateway model (default: $GUIDED_REVIEW_MODEL or ${DEFAULT_MODEL})
      --no-ai            Skip the model; build a heuristic guide
      --analysis <file>  Use an existing analysis JSON instead of calling the model
      --pr-data <file>   Use saved PR data (from a previous --save-data) instead of gh
      --name <base>      Output file base name (default: owner-repo-number)
      --save-data        Also write <name>.pr.json with the fetched PR data
      --no-context       Don't fetch file contents (unmodified lines won't expand)
      --open             Open the result in your browser
  -q, --quiet            Only print the output path
  -h, --help             Show this help

Environment
  AI_GATEWAY_API_KEY     Vercel AI Gateway key. Without it (or if the call fails), a
                         heuristic guide is built and a warning banner is shown.
  GUIDED_REVIEW_MODEL    Default model id, e.g. anthropic/claude-sonnet-5.5
  GH_TOKEN               Optional; otherwise the gh CLI's login is used.

Examples
  guided-pr-review https://github.com/sindresorhus/ky/pull/760
  guided-pr-review vercel/next.js#12345 --out ./reviews --open
  guided-pr-review owner/repo#7 --no-ai
`;

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

async function main() {
  let args;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        out: { type: 'string', short: 'o' },
        model: { type: 'string', short: 'm' },
        'no-ai': { type: 'boolean' },
        analysis: { type: 'string' },
        'pr-data': { type: 'string' },
        name: { type: 'string' },
        'save-data': { type: 'boolean' },
        'no-context': { type: 'boolean' },
        open: { type: 'boolean' },
        quiet: { type: 'boolean', short: 'q' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    console.error(err.message + '\n\n' + HELP);
    process.exit(2);
  }
  const { values: o, positionals } = args;
  if (o.help || (!positionals.length && !o['pr-data'])) {
    process.stdout.write(HELP);
    process.exit(o.help ? 0 : 1);
  }

  loadDotEnv(resolve('.env'));
  loadDotEnv(join(ROOT, '.env'));
  const log = o.quiet ? () => {} : (m) => console.error(`\x1b[2m›\x1b[0m ${m}`);
  const warn = (m) => console.error(`\x1b[33m! warning:\x1b[0m ${m}`); // even with --quiet

  // 1. PR data
  let pr;
  if (o['pr-data']) {
    pr = JSON.parse(readFileSync(o['pr-data'], 'utf8'));
    log(`Loaded PR data from ${o['pr-data']}`);
  } else {
    pr = await fetchPr(parsePrRef(positionals[0]), { contents: !o['no-context'], log });
  }

  // 2. Analysis
  let analysis;
  const model = o.model || process.env.GUIDED_REVIEW_MODEL || DEFAULT_MODEL;
  if (o.analysis) {
    const raw = JSON.parse(readFileSync(o.analysis, 'utf8'));
    const gen = raw.generatedBy || raw.generator || { mode: 'fixture', reason: 'hand-written' }; // `generator` = older files
    analysis = normalizeAnalysis(raw, pr, { reason: null, model: null, ...gen });
    log(`Using analysis from ${o.analysis}`);
  } else if (o['no-ai']) {
    analysis = heuristicAnalysis(pr, { reason: 'no-ai-flag' });
  } else if (!process.env.AI_GATEWAY_API_KEY) {
    analysis = heuristicAnalysis(pr, { reason: 'missing-key' });
  } else {
    try {
      const raw = await analyzeWithGateway(pr, { model, log });
      analysis = normalizeAnalysis(raw, pr, { mode: 'ai', model });
    } catch (err) {
      analysis = heuristicAnalysis(pr, { reason: 'ai-error', model, error: summarizeError(err) });
    }
  }
  const notice = heuristicNotice(analysis.generatedBy);
  if (notice) warn(notice);

  // 3. Render
  const outDir = resolve(o.out || 'guided-review');
  mkdirSync(outDir, { recursive: true });
  const name = (o.name || `${pr.owner}-${pr.repo}-${pr.number}`).replace(/[^\w.-]+/g, '-');
  const htmlPath = join(outDir, `${name}-walkthrough.html`);
  writeFileSync(htmlPath, renderHtml(pr, analysis));
  const analysisPath = join(outDir, `${name}.json`);
  if (!o.analysis || resolve(o.analysis) !== analysisPath) writeFileSync(analysisPath, JSON.stringify(analysis, null, 2) + '\n');
  if (o['save-data']) writeFileSync(join(outDir, `${name}.pr.json`), JSON.stringify(pr, null, 2) + '\n');

  if (!o.quiet) {
    log(`${analysis.chapters.length} chapters · ${pr.files.length} files · ${analysis.generatedBy.mode}`);
    console.error(`\x1b[32m✓\x1b[0m Wrote ${htmlPath}`);
  } else {
    console.log(htmlPath);
  }
  if (o.open) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    execFile(cmd, [htmlPath]);
  }
}

main().catch((err) => {
  console.error(`\x1b[31m✗\x1b[0m ${err.message}`);
  process.exit(1);
});
