// Render PR data + guided-review analysis into one self-contained HTML page
// with three tabs: Overview · Guide · Diff.
import { createHash } from 'node:crypto';
import { buildSegments, countRows } from './lib/diff.mjs';
import { escapeHtml as esc, highlightLines, langFor } from './lib/highlight.mjs';
import { fileIcon } from './lib/icons.mjs';
import { CSS } from './lib/styles.mjs';
import { CLIENT_JS } from './lib/client.mjs';
import { classifyRole, heuristicNotice } from './analyze.mjs';

const LARGE_DIFF_ROWS = 600;

const CHEVRON = `<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>`;
const EXPAND = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 4.8 6 2.5l2.5 2.3M3.5 7.2 6 9.5l2.5-2.3"/></svg>`;
const EXTERNAL = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/></svg>`;

const WARN = `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.8 14.6 13.5H1.4L8 1.8Z"/><path d="M8 6.3v3.2M8 11.6v.1"/></svg>`;

const INTERACTIVE_CSS = String.raw`
.gpr-comment {
  border: 1px solid var(--line); background: var(--card); color: var(--text-2); padding: 5px 11px; border-radius: 8px; cursor: pointer;
  font-size: 13px; transition: border-color .15s, background .15s;
}
.gpr-comment:hover { border-color: var(--line-strong); background: var(--pill-hover); }
.diff .cd { position: relative; }
.gpr-line-actions {
  position: absolute; top: 1px; right: 5px; display: flex; gap: 4px; padding-left: 18px;
  background: linear-gradient(90deg, transparent, var(--card) 18px); opacity: 0; transition: opacity .12s;
}
.diff tr.add .gpr-line-actions { background: linear-gradient(90deg, transparent, var(--add-bg) 18px); }
.diff tr.del .gpr-line-actions { background: linear-gradient(90deg, transparent, var(--del-bg) 18px); }
.diff tr:hover .gpr-line-actions, .gpr-line-actions:focus-within { opacity: 1; }
.gpr-line-actions button {
  border: 1px solid var(--line-strong); background: var(--card); color: var(--text-2); border-radius: 6px;
  padding: 1px 7px; font: 11.5px/19px var(--sans); cursor: pointer;
}
.gpr-line-actions button:hover { border-color: var(--faint); background: var(--pill-hover); }
.gpr-dialog {
  width: min(620px, calc(100vw - 32px)); color: var(--text); background: var(--card); border: 1px solid var(--line-strong);
  border-radius: 12px; box-shadow: 0 16px 50px rgba(20,20,15,.2); padding: 20px;
}
.gpr-dialog::backdrop { background: rgba(20,20,15,.42); }
.gpr-dialog h3 { margin: 0 0 12px; font-size: 18px; }
.gpr-dialog textarea {
  width: 100%; min-height: 96px; resize: vertical; padding: 10px 12px; color: var(--text); background: var(--card-soft);
  border: 1px solid var(--line-strong); border-radius: 8px; font: 14px/1.5 var(--sans);
}
.gpr-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.gpr-answer { max-height: 360px; overflow: auto; margin-top: 12px; padding: 12px; white-space: pre-wrap; background: var(--code-bg); border-radius: 8px; }
.gpr-toast {
  position: fixed; right: 18px; bottom: 18px; z-index: 50; max-width: 420px; padding: 10px 14px; color: #fff; background: #24292f;
  border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.22); opacity: 0; transform: translateY(10px); transition: .18s; pointer-events: none;
}
.gpr-toast.show { opacity: 1; transform: none; }
@media (max-width: 560px) { .gpr-line-actions { position: static; opacity: 1; display: inline-flex; margin-left: 12px; background: transparent !important; } }
`;

const INTERACTIVE_JS = String.raw`
(() => {
  const D = JSON.parse(document.getElementById('gpr-data').textContent);
  const lines = D.lines || [];
  let selected = null;
  const askDialog = document.getElementById('gpr-ask-dialog');
  const commentDialog = document.getElementById('gpr-comment-dialog');
  const prDialog = document.getElementById('gpr-pr-dialog');
  const toast = document.getElementById('gpr-toast');
  const notify = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  };
  const post = async (path, body) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  };
  document.addEventListener('click', (event) => {
    const ask = event.target.closest('[data-gpr-ask]');
    const comment = event.target.closest('[data-gpr-comment]');
    if (ask) {
      selected = lines[Number(ask.dataset.gprAsk)];
      document.getElementById('gpr-answer').hidden = true;
      askDialog.showModal();
    }
    if (comment) {
      selected = lines[Number(comment.dataset.gprComment)];
      document.getElementById('gpr-comment-text').value = '';
      commentDialog.showModal();
    }
  });
  document.getElementById('gpr-pr-comment').addEventListener('click', () => {
    document.getElementById('gpr-pr-text').value = '';
    prDialog.showModal();
  });
  document.getElementById('gpr-ask-submit').addEventListener('click', async (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Asking…';
    try {
      const result = await post('/ask', { ...selected, question: document.getElementById('gpr-ask-text').value });
      const answer = document.getElementById('gpr-answer');
      answer.textContent = result.answer;
      answer.hidden = false;
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; button.textContent = 'Ask Copilot'; }
  });
  document.getElementById('gpr-comment-submit').addEventListener('click', async (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Posting…';
    try {
      await post('/comment/line', { ...selected, body: document.getElementById('gpr-comment-text').value });
      commentDialog.close();
      notify('Inline comment posted');
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; button.textContent = 'Post comment'; }
  });
  document.getElementById('gpr-pr-submit').addEventListener('click', async (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Posting…';
    try {
      await post('/comment/pr', { body: document.getElementById('gpr-pr-text').value });
      prDialog.close();
      notify('PR comment posted');
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; button.textContent = 'Post comment'; }
  });
})();
`;

/** Escape, then turn `code` spans into inline code pills. */
export function inline(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code class="ic">$1</code>');
}

const pad2 = (n) => String(n).padStart(2, '0');
const splitPath = (p) => {
  const i = p.lastIndexOf('/');
  return i < 0 ? { name: p, dir: '' } : { name: p.slice(i + 1), dir: p.slice(0, i + 1) };
};

function stat(add, del, { always = false } = {}) {
  const parts = [];
  if (add || always) parts.push(`<span class="plus">+${add}</span>`);
  if (del) parts.push(`<span class="minus">−${del}</span>`);
  return `<span class="stat">${parts.join('')}</span>`;
}

export function renderHtml(pr, analysis, opts = {}) {
  const files = pr.files.map((f, i) => ({ ...f, id: `f${i}` }));
  const byPath = new Map(files.map((f) => [f.path, f]));
  const roleOf = new Map(analysis.orderedFiles.map((f) => [f.path, f.role]));
  const role = (p) => roleOf.get(p) || classifyRole(p);
  const ordered = analysis.orderedFiles.map((f) => byPath.get(f.path)).filter(Boolean);
  const chapters = analysis.chapters.map((c) => ({ ...c, fileObjs: c.files.map((p) => byPath.get(p)).filter(Boolean) }));
  const N = chapters.length;
  let gapSeq = 0;
  const interactionLines = [];

  // ── pieces ─────────────────────────────────────────
  const fileRow = (f, { showRole = false } = {}) => {
    const { name, dir } = splitPath(f.path);
    return `<div class="frow" data-file="${f.id}" title="${esc(f.path)}">${fileIcon(f.path)}<span class="nm">${esc(name)}</span><span class="pth">${esc(dir)}${showRole ? `<span class="role">${role(f.path)}</span>` : ''}</span>${stat(f.additions, f.deletions)}</div>`;
  };

  const diffRows = (rows, lang, path, interactive = false) => {
    const html = highlightLines(rows.map((r) => r.text), lang);
    return rows
      .map((r, i) => {
        const sign = r.type === 'add' ? '+' : r.type === 'del' ? '−' : '';
        let actions = '';
        if (interactive) {
          const key = interactionLines.length;
          const side = r.type === 'del' ? 'LEFT' : 'RIGHT';
          const line = r.type === 'del' ? r.old : r.new;
          const context = rows.slice(Math.max(0, i - 3), i + 4).map((row) => `${row.type === 'add' ? '+' : row.type === 'del' ? '-' : ' '} ${row.text}`).join('\n');
          interactionLines.push({ path, side, line, code: r.text, context });
          actions = `<span class="gpr-line-actions"><button data-gpr-ask="${key}">Ask</button><button data-gpr-comment="${key}">Comment</button></span>`;
        }
        return `<tr class="${r.type}"><td class="ln">${r.old ?? ''}</td><td class="ln">${r.new ?? ''}</td><td class="sg">${sign}</td><td class="cd">${html[i] || ' '}${actions}</td></tr>`;
      })
      .join('');
  };

  const diffTable = (f, segs = buildSegments(f)) => {
    if (!segs.length) return `<div class="fbody"><div class="fnote">${f.patch === null ? 'Binary file or diff too large to display.' : f.status === 'renamed' ? `Renamed from <code class="ic">${esc(f.previousPath || '')}</code> without changes.` : 'No textual changes.'}</div></div>`;
    const lang = langFor(f.path);
    const body = segs
      .map((s, i) => {
        if (s.kind === 'hunk') return `<tbody>${diffRows(s.rows, lang, f.path, opts.interactive)}</tbody>`;
        const id = `g${++gapSeq}`;
        const pos = i === 0 ? ' first' : i === segs.length - 1 ? ' last' : '';
        const label = `${s.count} unmodified line${s.count === 1 ? '' : 's'}`;
        if (!s.rows) return `<tbody><tr class="gap${pos}"><td colspan="4"><button class="gapbtn" disabled>${label}</button></td></tr></tbody>`;
        return `<tbody><tr class="gap${pos}"><td colspan="4"><button class="gapbtn" data-gap="${id}">${EXPAND}${label}</button></td></tr></tbody><tbody class="gaprows" data-gaprows="${id}">${diffRows(s.rows, lang, f.path)}</tbody>`;
      })
      .join('');
    return `<div class="fbody diff-scroll"><table class="diff"><colgroup><col class="ln"><col class="ln"><col class="sg"><col></colgroup>${body}</table></div>`;
  };

  const fileCard = (f) => {
    const { name, dir } = splitPath(f.path);
    const r = role(f.path);
    const segs = buildSegments(f);
    const rows = countRows(segs);
    const lazy = r === 'generated' || rows > LARGE_DIFF_ROWS;
    const status = f.status === 'added' ? '<span class="status added">added</span>' : f.status === 'removed' ? '<span class="status removed">deleted</span>' : f.status === 'renamed' ? '<span class="status">renamed</span>' : '';
    const ghUrl = pr.url ? `${pr.url}/files#diff-${sha256Hex(f.path)}` : null;
    const body = lazy
      ? `<div class="fbody"><div class="fnote">${r === 'generated' ? 'Generated file. Collapsed by default.' : `Large diff (${rows} lines). Collapsed by default.`}<button class="ghost" data-show-diff>Show diff</button></div></div><template>${diffTable(f, segs)}</template>`
      : diffTable(f, segs);
    return `<div class="fcard" data-file="${f.id}">
<div class="fhead"><button class="tog" aria-label="Collapse file">${CHEVRON}</button>${fileIcon(f.path)}<span class="nm">${esc(name)}</span><span class="pth">${esc(dir)}</span>${status}${stat(f.additions, f.deletions)}${ghUrl ? `<a class="gh" href="${ghUrl}" target="_blank" rel="noopener" title="Open on GitHub">${EXTERNAL}</a>` : ''}<label class="rv"><input type="checkbox" data-rv-file="${f.id}">Reviewed</label></div>
${body}</div>`;
  };

  const chip = (n) => (n ? `<span class="chip" data-goto-chapter="${n}" title="Chapter ${n}: ${esc(chapters[n - 1]?.title || '')}">${pad2(n)}</span>` : '');

  const beforeAfter = () => {
    const ba = analysis.beforeAfter;
    let badge, body;
    if (ba.mode === 'flow') {
      const changed = ba.nodes.filter((n) => n.change === 'added' || n.change === 'changed').length;
      const removed = ba.nodes.filter((n) => n.change === 'removed').length;
      badge = stat(changed, removed);
      body = `<div class="flow pending" id="flow-1">${ba.nodes
        .map((n) => {
          const sign = n.change === 'added' || n.change === 'changed' ? '<span class="sg">+</span>' : n.change === 'removed' ? '<span class="sg">−</span>' : '';
          return `<div class="node ${n.change}" data-id="${esc(n.id)}"${n.branchOf ? ` data-branch="${esc(n.branchOf)}"` : ''}${n.edgeLabel ? ` data-edge="${esc(n.edgeLabel)}"` : ''}>${sign}<span class="nl">${esc(n.label)}</span>${chip(n.chapter)}</div>`;
        })
        .join('')}</div>`;
    } else {
      const add = ba.lines.filter((l) => l.kind === 'add').length;
      const del = ba.lines.filter((l) => l.kind === 'del').length;
      badge = stat(add, del);
      const baLang = (ba.sourcePath && langFor(ba.sourcePath)) || 'ts';
      body = `<div class="ad">${ba.lines
        .map((l) => {
          const sign = l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : '';
          const indent = '  '.repeat(l.indent);
          return `<div class="ad-row ${l.kind}"><span class="bar"></span><span class="sg">${sign}</span><span class="code">${esc(indent)}<span class="c-txt">${highlightLines([l.code], baLang)[0]}</span>${l.note ? `<span class="note">${inline(l.note)}</span>` : ''}</span>${chip(l.chapter)}</div>`;
        })
        .join('')}</div>`;
    }
    return `<div class="card ba"><div class="ba-head">${CHEVRON}<span class="ba-t">Before / after</span>${badge}</div><div class="ba-body">${ba.caption ? `<div class="ba-cap">${inline(ba.caption)}</div>` : ''}${body}</div></div>`;
  };

  const meta = () => {
    const date = pr.mergedAt || pr.createdAt;
    const when = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const state = pr.state ? `<span class="state ${pr.state}"><i></i>${pr.state === 'merged' ? 'Merged' : pr.state === 'open' ? 'Open' : 'Closed'}${when ? ` ${when}` : ''}</span>` : '';
    return `<div class="meta"><span class="author">${pr.author?.avatarUrl ? `<img class="avatar" src="${esc(pr.author.avatarUrl)}&s=40" alt="" onerror="this.style.visibility='hidden'">` : ''}${esc(pr.author?.login || 'unknown')}</span><a href="${esc(pr.url || '#')}" target="_blank" rel="noopener">${esc(`${pr.owner}/${pr.repo}`)} #${pr.number}</a>${stat(pr.additions, pr.deletions, { always: true })}${state}</div>`;
  };
  const prHead = () => `<header class="pr-head"><h1 class="pr-title">${inline(pr.title)}</h1>${meta()}</header>`;

  // ── panels ─────────────────────────────────────────
  const overview = `<section class="panel" id="panel-overview">${prHead()}
<div class="ov"><div><h2>Overview</h2><p class="sentence">${inline(analysis.overviewSentence)}</p><ol class="steps">${analysis.steps.map((s) => `<li>${inline(s)}</li>`).join('')}</ol></div>
<div>${beforeAfter()}</div></div>
<div class="toc"><h2 class="section-h">In this guide</h2><div class="toc-grid">${chapters
    .map((c) => {
      const add = c.fileObjs.reduce((s, f) => s + f.additions, 0);
      const del = c.fileObjs.reduce((s, f) => s + f.deletions, 0);
      return `<button class="toc-item" data-goto-chapter="${c.index}"><span class="n"><span>${pad2(c.index)} / ${pad2(N)}</span><span class="check-dot"></span></span><span class="ttl">${inline(c.title)}</span><span class="sub">${c.fileObjs.length} file${c.fileObjs.length === 1 ? '' : 's'} · ${stat(add, del, { always: true })}</span></button>`;
    })
    .join('')}</div></div></section>`;

  const guide = `<section class="panel" id="panel-guide">${chapters
    .map(
      (c) => `<article class="chapter" id="chapter-${c.index}"><div class="ch-side">
<h2 class="ch-title">${inline(c.title)}</h2>
<div class="ch-meta"><span class="ch-num">${pad2(c.index)} / ${pad2(N)}</span><label class="rv"><input type="checkbox" data-rv-chapter="${c.index}">Reviewed</label></div>
<div class="ch-prose">${c.paragraphs.map((p) => `<p>${inline(p)}</p>`).join('')}</div>
<div class="ch-files">${c.fileObjs.map((f) => fileRow(f)).join('')}</div>
<div class="ch-nav">${c.index > 1 ? `<button class="ghost" data-step="${c.index - 1}">← Previous <kbd>k</kbd></button>` : ''}${c.index < N ? `<button class="ghost" data-step="${c.index + 1}">Next chapter <kbd>j</kbd></button>` : ''}</div>
</div><div class="fstack">${c.fileObjs.map(fileCard).join('')}</div></article>`,
    )
    .join('')}</section>`;

  const half = Math.ceil(ordered.length / 2);
  const diff = `<section class="panel" id="panel-diff">${prHead()}
<div class="files-h">Files <span class="num">${ordered.length}</span></div>
<div class="files-grid" style="grid-auto-flow: column; grid-template-rows: repeat(${half || 1}, auto)">${ordered.map((f) => fileRow(f)).join('')}</div>
<div class="all-diffs">${ordered.map(fileCard).join('')}</div></section>`;

  const gen = analysis.generatedBy || analysis.generator || {};
  const genLabel = gen.mode === 'ai' ? `AI analysis · ${esc(gen.model || 'default model')}` : gen.mode === 'copilot' ? 'GitHub Copilot analysis' : gen.mode === 'fixture' ? 'Checked-in fixture analysis' : 'Heuristic analysis (simple rules, no AI)';
  const notice = heuristicNotice(gen);
  const banner = notice
    ? `<div class="wrap"><div class="no-ai" role="status">${WARN}<span>${esc(notice)}</span></div></div>`
    : '';
  const data = {
    key: `${pr.owner}/${pr.repo}#${pr.number}@${(pr.headSha || '').slice(0, 12)}`,
    chapters: chapters.map((c) => ({ index: c.index, files: c.fileObjs.map((f) => f.id) })),
    ...(opts.interactive ? { lines: interactionLines } : {}),
  };

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pr.title)} · Guided review</title>
<meta name="description" content="${esc(analysis.overviewSentence)}">
<meta name="generator" content="guided-pr-review">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}${opts.interactive ? INTERACTIVE_CSS : ''}</style></head>
<body>
<nav class="topbar"><div class="wrap"><div class="tabs" role="tablist">
<button class="tab" role="tab" data-tab="overview" aria-selected="true">Overview</button>
<button class="tab" role="tab" data-tab="guide">Guide<span class="count">${N}</span></button>
<button class="tab" role="tab" data-tab="diff">Diff<span class="count">${files.length}</span></button>
</div><span class="top-title">${inline(pr.title)}</span><span class="spacer"></span>
<div class="progress" title="Chapters reviewed"><span class="bar"><i id="prog-bar"></i></span><span><b id="prog-n">0</b> / ${N} <span class="lbl">reviewed</span></span></div>${opts.interactive ? '<button class="gpr-comment" id="gpr-pr-comment">Comment on PR</button>' : ''}</div></nav>
${banner}
<main class="wrap">${overview}${guide}${diff}
<footer class="foot"><span>Generated by <a href="https://github.com/chasemc67/guided-pr-review">guided-pr-review</a> · ${genLabel}${opts.generatedAt ? ` · ${esc(opts.generatedAt)}` : ''}</span><span class="kbd-help"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> tabs · <kbd>j</kbd> <kbd>k</kbd> chapters</span></footer></main>
${opts.interactive ? `<dialog class="gpr-dialog" id="gpr-ask-dialog"><form method="dialog"><h3>Ask Copilot about this line</h3><textarea id="gpr-ask-text">What should I understand about this line?</textarea><div class="gpr-answer" id="gpr-answer" hidden></div><div class="gpr-dialog-actions"><button value="cancel">Close</button><button value="default" id="gpr-ask-submit">Ask Copilot</button></div></form></dialog>
<dialog class="gpr-dialog" id="gpr-comment-dialog"><form method="dialog"><h3>Comment on this PR line</h3><textarea id="gpr-comment-text" placeholder="Write an inline review comment…"></textarea><div class="gpr-dialog-actions"><button value="cancel">Cancel</button><button value="default" id="gpr-comment-submit">Post comment</button></div></form></dialog>
<dialog class="gpr-dialog" id="gpr-pr-dialog"><form method="dialog"><h3>Comment on this pull request</h3><textarea id="gpr-pr-text" placeholder="Write a general PR comment…"></textarea><div class="gpr-dialog-actions"><button value="cancel">Cancel</button><button value="default" id="gpr-pr-submit">Post comment</button></div></form></dialog>
<div class="gpr-toast" id="gpr-toast"></div>` : ''}
<script type="application/json" id="gpr-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>${CLIENT_JS}</script>
${opts.interactive ? `<script>${INTERACTIVE_JS}</script>` : ''}
</body></html>
`;
}

// GitHub's "Files changed" anchors are sha256(path) in hex.
function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex');
}
