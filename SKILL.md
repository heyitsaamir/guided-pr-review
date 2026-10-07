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

Requirements: Node 18.17+ and GitHub CLI 2.48.0+ (`gh`) logged in (or `GH_TOKEN` set) with read access to the repo.

When this skill runs inside GitHub Copilot, Copilot is the analysis engine. Do not require or suggest `AI_GATEWAY_API_KEY`; that variable is only for people running the standalone CLI without an agent.

## How to run

From this skill's folder:

```bash
node scripts/cli.mjs <pr-url | owner/repo#n> --out ./guided-review
```

Useful flags:

- `--open` opens the result in the default browser.
- `--prepare` fetches PR data for the agent and exits without calling a model or rendering.
- `--no-ai` forces the heuristic guide (no network call to a model).
- `--save-data` also writes the fetched PR data (`<name>.pr.json`) so you can re-render offline with `--pr-data`.
- `--analysis <file>` renders from an existing analysis JSON, e.g. one you edited by hand.

Output: `<out>/<owner>-<repo>-<n>-walkthrough.html` plus `<owner>-<repo>-<n>.json` (the analysis).

## Steps for the agent

1. Resolve the PR reference from the user's message. If it is ambiguous (no repo), ask for it.
2. From this skill's folder, fetch the PR data without invoking an external model:

   ```bash
   node scripts/cli.mjs <pr-url | owner/repo#n> --out <output-dir> --prepare --quiet
   ```

   The command prints the path to `<name>.pr.json`.
3. Read the PR data and create `<name>.copilot.json` beside it using the contract below. Base every claim on the PR description, patches, and file contents. Include:

   ```json
   "generatedBy": {"mode": "copilot", "reason": null, "model": "github-copilot"}
   ```

4. Render the walkthrough without a gateway call:

   ```bash
   node scripts/cli.mjs --pr-data <name>.pr.json --analysis <name>.copilot.json --out <output-dir> --name <name>
   ```

   This writes the normalized `<name>.json` and `<name>-walkthrough.html`. Delete the temporary `<name>.copilot.json` after a successful render.
5. Open the interactive canvas using absolute paths:

   ```text
   open_canvas({
     canvasId: "guided-pr-review",
     instanceId: "guided-review-<owner>-<repo>-<number>",
     input: {
       prDataPath: "<absolute path to name.pr.json>",
       analysisPath: "<absolute path to name.json>"
     }
   })
   ```

   The canvas lets the user ask Copilot about any diff line, post inline review comments, and add a general PR comment.
6. Report the HTML path and mention that the interactive review is open. Summarize in chat: the overview sentence, the chapter titles in order, and anything risky or surprising.
7. If the user wants narrative changes, edit `<name>.json`, re-render with `--pr-data <name>.pr.json --analysis <name>.json`, then reopen the same canvas `instanceId` to refresh it.

## Analysis JSON (contract)

```jsonc
{
  "generatedBy": {"mode": "copilot", "reason": null, "model": "github-copilot"},
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
