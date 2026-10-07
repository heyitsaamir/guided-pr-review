---
name: guided-pr-review
description: Turn a GitHub pull request into a guided walkthrough (Overview with before/after, chaptered Guide, and Diff) as one self-contained HTML page. Use when someone asks to explain, walk through, summarize for review, or "guide me through" a PR, or shares a PR URL / owner/repo#number and wants to understand it before reviewing.
---

# Guided PR review

Produces a single HTML file that reads a pull request the way a reviewer wants to read it:

- **Overview**: one sentence of context, the numbered steps the PR takes, and a **Before / after** card (annotated mini-diff or flow diagram) tagged with chapter numbers.
- **Guide**: files grouped into idea-sized chapters (`01 / N`), each with plain-language prose, its file list (+/−), real diffs with collapsed "N unmodified lines", and **Reviewed** checkboxes.
- **Diff**: `Files N` list plus every diff, ordered core → supporting → database → tests → docs → generated.

## When to use

- The user shares a PR link or `owner/repo#123` and asks what it does, how to review it, or for a walkthrough.
- A large PR needs to be read in a sensible order instead of file order.
- You want a shareable, offline artifact of a review guide.

Don't use it for posting review comments to GitHub; this skill only reads.

## Inputs

| Input | Form |
|---|---|
| PR reference (required) | `https://github.com/owner/repo/pull/123` or `owner/repo#123` |
| Output directory | `--out <dir>` (default `./guided-review`) |
| Model | `--model <gateway-model-id>` or `GUIDED_REVIEW_MODEL` |

Requirements: Node 18.17+, the GitHub CLI (`gh`) logged in (or `GH_TOKEN` set) with read access to the repo. For AI chapters and prose, set `AI_GATEWAY_API_KEY` (Vercel AI Gateway). Without it, the skill still produces a heuristic guide.

## How to run

From this skill's folder:

```bash
node scripts/cli.mjs <pr-url | owner/repo#n> --out ./guided-review
```

Useful flags:

- `--open` opens the result in the default browser.
- `--no-ai` forces the heuristic guide (no network call to a model).
- `--save-data` also writes the fetched PR data (`<name>.pr.json`) so you can re-render offline with `--pr-data`.
- `--analysis <file>` renders from an existing analysis JSON, e.g. one you edited by hand.

Output: `<out>/<owner>-<repo>-<n>-walkthrough.html` plus `<owner>-<repo>-<n>.json` (the analysis).

## Steps for the agent

1. Resolve the PR reference from the user's message. If it is ambiguous (no repo), ask for it.
2. Run the CLI. If `AI_GATEWAY_API_KEY` is missing, mention that the guide is heuristic and how to enable AI.
3. Report the output path. Summarize in chat: the overview sentence, the chapter titles in order, and anything the guide flags as risky or surprising.
4. If the user wants changes to the narrative (rename a chapter, move a file), edit the analysis JSON and re-render with `--pr-data <name>.pr.json --analysis <name>.json`. That's cheaper than calling the model again.

## Analysis JSON (contract)

```jsonc
{
  "overviewSentence": "string",
  "steps": ["string"],
  "beforeAfter": {
    "caption": "How X reaches Y",
    "mode": "annotated_diff | flow",
    "lines": [{ "kind": "context|add|del", "indent": 0, "code": "…", "note": "…|null", "chapter": 1 }],
    "nodes": [{ "id": "a", "label": "fn()", "change": "added|changed|unchanged|removed", "chapter": 1, "branchOf": null, "edgeLabel": null }]
  },
  "chapters": [{ "title": "Imperative title", "paragraphs": ["…"], "files": ["exact/path.ts"] }],
  "orderedFiles": [{ "path": "exact/path.ts", "role": "core|supporting|database|tests|docs|generated" }]
}
```

Wrap identifiers in backticks in any prose field; they render as inline code. The renderer enforces that every file lands in exactly one chapter and that peripheral chapters come last.
