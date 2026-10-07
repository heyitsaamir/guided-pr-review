# Build report: guided-pr-review

**Date:** 2026-10-06
**Repo:** https://github.com/chasemc67/guided-pr-review (public, branch `main`)
**Live samples (GitHub Pages):**
- https://chasemc67.github.io/guided-pr-review/samples/ky-760-walkthrough.html
- https://chasemc67.github.io/guided-pr-review/samples/ky-873-walkthrough.html

## How to run

```bash
git clone https://github.com/chasemc67/guided-pr-review.git && cd guided-pr-review
node scripts/cli.mjs --help
node scripts/cli.mjs https://github.com/owner/repo/pull/123 --open      # AI if AI_GATEWAY_API_KEY is set
node scripts/cli.mjs owner/repo#123 --no-ai                              # heuristic, no model
npm run sample                                                           # rebuild checked-in samples offline
```

Requirements: Node 18.17+ and `gh` logged in (or `GH_TOKEN`). No npm dependencies. Put `AI_GATEWAY_API_KEY` in `.env` (see `.env.example`). Default model: `anthropic/claude-sonnet-4.5`, via `https://ai-gateway.vercel.sh/v1/chat/completions` with a strict JSON schema.

## Sample paths

| File | What |
|---|---|
| `samples/ky-760-walkthrough.html` | Primary sample: sindresorhus/ky#760 "Add `retry.jitter` option", annotated-diff before/after, 4 chapters, 5 files |
| `samples/ky-760.json` | Fixture analysis (hand-written, model schema) |
| `samples/ky-760.pr.json` | Real PR data from `fetch-pr.mjs` |
| `samples/ky-873-walkthrough.html` (+ `.json`, `.pr.json`) | Second sample: ky#873 "Add QUERY method support", flow-diagram before/after, 10 files |
| `docs/*.png` | Screenshots used in the README |

## What was verified

- `node scripts/cli.mjs --help` works, and so does a fresh clone from GitHub.
- Live fetch path: `node scripts/cli.mjs https://github.com/sindresorhus/ky/pull/881 --no-ai` fetches the PR via `gh` and renders a heuristic guide.
- `npm run sample` is deterministic: it regenerates byte-identical HTML.
- Headless-Chrome interaction smoke test on the sample passed: tab switching, "N unmodified lines" expansion, chapter Reviewed cascading to files and progress, Guide↔Diff checkbox sync, keyboard tab switch, and flow node layout.
- Screenshots checked at 1440px and at the 500px minimum headless width (no horizontal overflow).
- Gateway path: a request with an invalid key reaches `ai-gateway.vercel.sh` and returns a clean 401 error message.
- **Not verified:** a successful AI-generated analysis. No `AI_GATEWAY_API_KEY` was available on this machine, so both samples use hand-written fixture analyses in the exact schema the model is asked to return. The first real run with a key is the main open risk, e.g. whether the chosen model accepts `json_schema` (there's a `json_object` fallback and a retry).
- Secret scan of tracked files found nothing. `.env`, `build-logs/` and `BUILD-PROMPT.md` are gitignored.

## How closely it matches Capy Guided Reviews

**Matches, from public screenshots/demo:**
- Tabs `Overview · Guide · Diff` as text pills; the selected tab gets a white rounded fill.
- Title + meta row (avatar · author · `#N` · `+A −D`) with thin dividers.
- Overview: heading, one context sentence, numbered steps on the left; a collapsible **Before / after** card on the right with a `+N −M` badge, grey caption, and either:
  - an annotated pseudo-diff: soft red/green rows with a colored left bar, `−`/`+` signs, grey inline callouts, and boxed `01` chapter tags; or
  - a flow diagram: rounded mono nodes, green left accent with `+` for new nodes, arrows wrapping to a second row, labeled side branches, and chapter tags.
- Guide chapters: bold title, `01 / 04` + **Reviewed** checkbox, 1–2 plain-language paragraphs with inline code pills, file list (icon · bold name · grey path · `+N −M`), and real diffs on the right. Diffs have two line-number columns, a soft green/red background, a `+` gutter, a file header with `… +N  Reviewed`, and collapsed "N unmodified lines" bars.
- Diff tab: title + meta, `Files N`, a two-column file list filled column-wise.
- Ordering: core first; database, tests and generated last.
- Visual tone: off-white background, lots of whitespace, rounded cards, Inter-style UI font with a mono for code.

**Where we diverged (labeled "(ours)" in the README):**
- The Overview section is its own first tab. In Capy's demo it sits at the top of the Guide, and the Overview tab looked like a PR summary. The prompt for this build asked for the Overview tab to open first with this content, so we followed that. The Guide holds only chapters.
- Added: "In this guide" chapter cards, a top-bar progress meter, Reviewed state saved in `localStorage`, chapter checkboxes that cascade to files and auto-advance, `1/2/3` and `j/k` shortcuts, file cards that collapse once reviewed, all diffs stacked under the Diff tab's list, "Open on GitHub" links, and expandable unmodified lines (real head-file content).
- Our own file icon set and syntax colors (approximations, not Capy assets).
- A "changed" node style (olive accent), distinct from "added" (green).
- An explicit 6-level role ladder (core → supporting → database → tests → docs → generated), plus normalization that forces lockfiles to `generated` and moves peripheral chapters last.
- Heuristic no-AI mode, editable analysis JSON, and a single offline HTML file.
- Generation runs through Vercel AI Gateway with a published JSON schema. Capy's models and prompts aren't public.

**Unknowns we couldn't match:** exact chapter navigation (scroll vs paging) and mobile layout in Capy's app, exact fonts/colors (estimated from compressed video frames), and how Capy picks flow vs annotated mode.

## Layout

```
SKILL.md  README.md  LICENSE  package.json  .env.example  .gitignore  index.html (Pages redirect)
scripts/cli.mjs  fetch-pr.mjs  analyze.mjs  render.mjs
scripts/lib/diff.mjs  highlight.mjs  icons.mjs  styles.mjs  client.mjs
samples/ky-760*.{html,json}  samples/ky-873*.{html,json}
docs/*.png
```

## Process notes

- The build session was interrupted twice by the host shell, and the work was resumed from what was on disk.
- A session guard required edits to be made in a git worktree, so the work was done on a `build` branch in `.claude/worktrees/build` (gitignored), pushed as `main`, and the local `main` was fast-forwarded to match.
