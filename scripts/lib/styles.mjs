// Stylesheet for the walkthrough page. Soft, light, generous whitespace;
// pastel diff colors; pill tabs; rounded cards.
export const CSS = String.raw`
:root {
  --bg: #fafaf8;
  --card: #ffffff;
  --card-soft: #fcfcfb;
  --line: #ecebe7;
  --line-strong: #e1e0db;
  --text: #1b1b19;
  --text-2: #4a4a46;
  --muted: #8b8a85;
  --faint: #b3b2ac;
  --pill: #efefec;
  --pill-hover: #f4f4f1;
  --add: #2e8a46;
  --add-strong: #3c9a52;
  --add-bg: #eef7ef;
  --add-bg-strong: #dcefdf;
  --add-node: #f1f8f1;
  --del: #c4473b;
  --del-strong: #d0574b;
  --del-bg: #fcf0ee;
  --del-bg-strong: #f7dcd8;
  --code-bg: #f3f3f0;
  --accent: #2e8a46;
  --focus: #9fc9a8;
  --radius: 14px;
  --radius-sm: 9px;
  --shadow: 0 1px 2px rgba(20, 20, 15, .04), 0 4px 18px rgba(20, 20, 15, .035);
  --sans: "Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace;
  --maxw: 1200px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 76px; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.6 var(--sans); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  font-feature-settings: "cv11", "ss01";
}
a { color: inherit; }
button { font: inherit; color: inherit; }
code, .mono, .diff, .ad, .node, .chip, .stat { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
code, .mono { font-family: var(--mono); font-size: .86em; }
.ic {
  font-family: var(--mono); font-size: .82em; background: var(--code-bg); border: 1px solid #ebebe7;
  padding: .08em .38em; border-radius: 5px; color: #3a3a36; white-space: nowrap;
}
.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 32px; }

/* ── Top bar ─────────────────────────────────────────── */
.topbar {
  position: sticky; top: 0; z-index: 20;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px);
  border-bottom: 1px solid transparent; transition: border-color .2s;
}
.topbar.scrolled { border-bottom-color: var(--line); }
.topbar .wrap { display: flex; align-items: center; gap: 16px; height: 60px; }
.tabs { display: flex; gap: 4px; }
.tab {
  border: 0; background: transparent; padding: 6px 13px; border-radius: 9px; cursor: pointer;
  color: var(--muted); font-size: 14.5px; font-weight: 500; letter-spacing: -.005em; transition: background .15s, color .15s;
}
.tab:hover { color: var(--text-2); background: var(--pill-hover); }
.tab[aria-selected="true"] { color: var(--text); background: var(--card); box-shadow: 0 0 0 1px var(--line), 0 1px 2px rgba(0,0,0,.04); }
.tab .count { color: var(--faint); font-weight: 500; margin-left: 4px; font-size: 13px; }
.topbar .spacer { flex: 1; }
.top-title { color: var(--muted); font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 420px; opacity: 0; transition: opacity .2s; }
.topbar.scrolled .top-title { opacity: 1; }
.progress { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 13px; white-space: nowrap; }
.progress .bar { width: 84px; height: 5px; border-radius: 9px; background: var(--pill); overflow: hidden; }
.progress .bar i { display: block; height: 100%; width: 0; background: var(--add-strong); border-radius: 9px; transition: width .35s cubic-bezier(.2,.8,.2,1); }
.progress b { color: var(--text-2); font-weight: 600; font-variant-numeric: tabular-nums; }

/* ── Panels ──────────────────────────────────────────── */
.panel { display: none; padding: 34px 0 120px; animation: fade .25s ease; }
.panel.active { display: block; }
@keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.pr-head { margin-bottom: 40px; }
.pr-title .ic { font-size: .78em; padding: .05em .32em; vertical-align: .06em; }
.pr-title { font-size: 27px; line-height: 1.25; font-weight: 600; letter-spacing: -.022em; margin: 0 0 10px; text-wrap: balance; }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0; color: var(--muted); font-size: 14px; }
.meta > * + *::before { content: ""; display: inline-block; width: 1px; height: 13px; background: var(--line-strong); margin: 0 11px; vertical-align: -1px; }
.meta .author { display: inline-flex; align-items: center; gap: 7px; color: var(--text-2); }
.avatar { width: 18px; height: 18px; border-radius: 50%; background: var(--pill); object-fit: cover; }
.meta a { text-decoration: none; }
.meta a:hover { color: var(--text-2); text-decoration: underline; text-underline-offset: 3px; }
.state { display: inline-flex; align-items: center; gap: 6px; }
.state i { width: 7px; height: 7px; border-radius: 50%; background: var(--faint); display: inline-block; }
.state.merged i { background: #8a63d2; } .state.open i { background: var(--add-strong); }
.plus { color: var(--add); font-variant-numeric: tabular-nums; }
.minus { color: var(--del); font-variant-numeric: tabular-nums; }
.stat { font-family: var(--mono); font-size: 12.5px; font-weight: 500; white-space: nowrap; }
.stat .minus { margin-left: 6px; }

/* ── Overview ────────────────────────────────────────── */
.ov { display: grid; grid-template-columns: minmax(0, 37fr) minmax(0, 63fr); gap: 48px; align-items: start; }
.ov h2, .section-h { font-size: 21px; font-weight: 600; letter-spacing: -.016em; margin: 0 0 16px; }
.ov .sentence { color: var(--text-2); font-size: 15.5px; line-height: 1.7; margin: 0 0 18px; text-wrap: pretty; }
.steps { margin: 0; padding: 0; list-style: none; counter-reset: s; }
.steps li { counter-increment: s; position: relative; padding-left: 26px; margin: 0 0 11px; color: var(--text-2); line-height: 1.65; text-wrap: pretty; }
.steps li::before { content: counter(s) "."; position: absolute; left: 2px; top: 0; color: var(--muted); font-variant-numeric: tabular-nums; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
.ba-head { display: flex; align-items: center; gap: 10px; padding: 13px 18px 13px 14px; cursor: pointer; user-select: none; border-bottom: 1px solid var(--line); }
.ba.collapsed .ba-head { border-bottom-color: transparent; }
.ba.collapsed .ba-body { display: none; }
.chev { width: 16px; height: 16px; color: var(--muted); transition: transform .2s; flex: none; }
.collapsed .chev { transform: rotate(-90deg); }
.ba-head .ba-t { font-weight: 500; font-size: 15px; }
.ba-head .stat { margin-left: auto; font-size: 13.5px; }
.ba-cap { color: var(--muted); font-size: 14px; padding: 14px 20px 6px; }
.ba-body { padding-bottom: 10px; }

/* annotated mini-diff */
.ad { font-family: var(--mono); font-size: 13.4px; line-height: 1.5; padding: 4px 0 6px; }
.ad-row { display: grid; grid-template-columns: 3px 26px minmax(0, 1fr) auto; align-items: center; min-height: 29px; padding-right: 14px; }
.ad-row .bar { align-self: stretch; }
.ad-row .sg { text-align: center; color: var(--muted); }
.ad-row .code { white-space: pre; overflow: hidden; text-overflow: ellipsis; padding: 3px 0; }
.ad-row .code .note { font-family: var(--sans); font-size: 13.4px; color: var(--muted); margin-left: 14px; white-space: normal; }
.ad-row.add { background: var(--add-bg); } .ad-row.add .bar { background: var(--add-strong); } .ad-row.add .sg { color: var(--add); }
.ad-row.del { background: var(--del-bg); } .ad-row.del .bar { background: var(--del-strong); } .ad-row.del .sg { color: var(--del); }
.ad-row.del .code > .c-txt { text-decoration: line-through; text-decoration-color: rgba(196, 71, 59, .35); }
.chip {
  display: inline-flex; align-items: center; justify-content: center; min-width: 25px; height: 19px; padding: 0 5px;
  font: 500 11px/1 var(--mono); color: var(--muted); border: 1px solid var(--line-strong); border-radius: 5px; background: var(--card);
  cursor: pointer; transition: all .15s; font-variant-numeric: tabular-nums;
}
.chip:hover { color: var(--text); border-color: var(--faint); box-shadow: 0 1px 2px rgba(0,0,0,.05); }

/* flow diagram */
.flow { position: relative; margin: 10px 20px 14px; min-height: 60px; }
.flow svg.edges { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.flow svg.edges path { fill: none; stroke: #c9c8c2; stroke-width: 1.2; }
.flow svg.edges text { font: 12px var(--sans); fill: var(--muted); }
.node {
  position: absolute; display: inline-flex; align-items: center; gap: 9px; height: 38px; padding: 0 12px;
  font: 500 13.4px var(--mono); white-space: nowrap; background: var(--card); border: 1px solid var(--line); border-radius: 8px;
}
.node.added, .node.changed { background: var(--add-node); border-color: #d6e9d8; box-shadow: inset 3px 0 0 var(--add-strong); padding-left: 15px; }
.node.changed { background: #f6f8ee; border-color: #e2e8cf; box-shadow: inset 3px 0 0 #9bb252; }
.node.removed { background: var(--del-bg); border-color: #f0d6d2; box-shadow: inset 3px 0 0 var(--del-strong); padding-left: 15px; }
.node.removed .nl { text-decoration: line-through; text-decoration-color: rgba(196,71,59,.4); }
.node .sg { color: var(--add); margin-right: -3px; }
.node.removed .sg { color: var(--del); }
.node.unchanged { color: var(--text-2); }
.flow.pending .node { position: static; margin: 4px; }

/* chapter index (ours) */
.toc { margin-top: 64px; }
.toc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.toc-item {
  display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 16px 18px; cursor: pointer;
  background: var(--card); border: 1px solid var(--line); border-radius: 12px; transition: border-color .15s, box-shadow .15s, transform .15s;
}
.toc-item:hover { border-color: var(--line-strong); box-shadow: var(--shadow); transform: translateY(-1px); }
.toc-item .n { font: 500 12px var(--mono); color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
.toc-item .ttl { font-weight: 600; font-size: 15px; letter-spacing: -.01em; line-height: 1.35; }
.toc-item .sub { color: var(--muted); font-size: 13px; }
.toc-item.done { background: var(--card-soft); }
.toc-item.done .ttl { color: var(--muted); }
.check-dot { width: 15px; height: 15px; border-radius: 50%; border: 1.3px solid var(--line-strong); display: inline-flex; align-items: center; justify-content: center; }
.done .check-dot { background: var(--add-strong); border-color: var(--add-strong); }
.done .check-dot::after { content: ""; width: 6px; height: 3.5px; border: 1.6px solid #fff; border-top: 0; border-right: 0; transform: rotate(-45deg) translate(.5px, -.5px); }

/* ── Guide ───────────────────────────────────────────── */
.guide-intro { display: flex; align-items: baseline; gap: 14px; margin-bottom: 8px; }
.chapter { display: grid; grid-template-columns: minmax(0, 37fr) minmax(0, 63fr); gap: 40px; padding: 56px 0; border-top: 1px solid transparent; }
.chapter + .chapter { border-top-color: var(--line); }
.chapter:first-of-type { padding-top: 24px; }
.ch-side { position: sticky; top: 84px; align-self: start; }
.ch-title { font-size: 21px; font-weight: 600; letter-spacing: -.017em; line-height: 1.3; margin: 0 0 6px; text-wrap: balance; }
.ch-meta { display: flex; align-items: center; gap: 14px; color: var(--muted); font-size: 13.5px; margin-bottom: 18px; }
.ch-num { font-variant-numeric: tabular-nums; }
.ch-prose p { color: var(--text-2); margin: 0 0 14px; line-height: 1.7; text-wrap: pretty; }
.ch-files { list-style: none; margin: 22px 0 0; padding: 0; }
.ch-nav { display: flex; gap: 8px; margin-top: 22px; }
.ghost {
  border: 1px solid var(--line); background: var(--card); color: var(--text-2); padding: 5px 11px; border-radius: 8px; cursor: pointer;
  font-size: 13px; display: inline-flex; align-items: center; gap: 6px; transition: border-color .15s, background .15s;
}
.ghost:hover { border-color: var(--line-strong); background: var(--pill-hover); }
.ghost kbd { font: 11px var(--mono); color: var(--faint); }
.chapter.done .ch-title { color: var(--muted); }

/* checkbox */
.rv { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; user-select: none; color: var(--muted); font-size: 13.5px; }
.rv input { appearance: none; -webkit-appearance: none; margin: 0; width: 15px; height: 15px; border: 1.3px solid var(--line-strong); border-radius: 4px; background: var(--card); display: grid; place-content: center; cursor: pointer; transition: all .15s; }
.rv input::after { content: ""; width: 7px; height: 4px; border: 1.7px solid #fff; border-top: 0; border-right: 0; transform: rotate(-45deg) translate(1px, -1px) scale(0); transition: transform .15s; }
.rv input:checked { background: var(--add-strong); border-color: var(--add-strong); }
.rv input:checked::after { transform: rotate(-45deg) translate(1px, -1px) scale(1); }
.rv input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.rv:hover input { border-color: var(--faint); }

/* file rows */
.frow { display: grid; grid-template-columns: 16px auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 4px 6px; margin: 0 -6px; border-radius: 7px; cursor: pointer; font-size: 14px; min-height: 30px; }
.frow:hover { background: var(--pill-hover); }
.frow .nm { font-weight: 500; white-space: nowrap; color: var(--text); }
.frow .pth { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13.5px; }
.frow.reviewed .nm { color: var(--muted); }
.frow .stat { font-size: 12.5px; }
.fi { width: 15px; height: 15px; flex: none; display: block; }
.role { font: 500 10.5px var(--sans); text-transform: uppercase; letter-spacing: .05em; color: var(--faint); margin-left: 6px; }

/* ── File diff cards ─────────────────────────────────── */
.fstack { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.fcard { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: clip; box-shadow: 0 1px 2px rgba(20,20,15,.03); scroll-margin-top: 84px; }
.fhead { display: flex; align-items: center; gap: 9px; padding: 0 14px 0 10px; height: 46px; border-bottom: 1px solid var(--line); background: var(--card); position: sticky; top: 60px; z-index: 2; }
.fcard.collapsed .fhead { border-bottom-color: transparent; }
.fcard.collapsed .fbody { display: none; }
.fhead .tog { border: 0; background: transparent; padding: 4px; border-radius: 6px; cursor: pointer; display: grid; place-items: center; }
.fhead .tog:hover { background: var(--pill-hover); }
.fhead .nm { font-weight: 500; font-size: 14px; white-space: nowrap; }
.fhead .pth { color: var(--muted); font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
.fhead .status { color: var(--muted); font-size: 12.5px; }
.fhead .status.added { color: var(--add); } .fhead .status.removed { color: var(--del); }
.fhead .rv { margin-left: 6px; }
.fhead .gh { color: var(--faint); display: grid; place-items: center; padding: 4px; border-radius: 6px; }
.fhead .gh:hover { color: var(--text-2); background: var(--pill-hover); }
.fnote { padding: 18px 20px; color: var(--muted); font-size: 13.5px; display: flex; align-items: center; gap: 12px; }

.diff { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 12.8px; line-height: 1.6; table-layout: fixed; }
.diff col.ln { width: 46px; } .diff col.sg { width: 22px; }
.diff td { padding: 0; vertical-align: top; }
.diff .ln { color: var(--faint); text-align: right; padding: 0 10px 0 0; user-select: none; font-variant-numeric: tabular-nums; font-size: 12px; }
.diff .sg { color: var(--faint); user-select: none; text-align: center; }
.diff .cd { white-space: pre; overflow: hidden; padding-right: 16px; color: #2a2a27; tab-size: 4; }
.diff-scroll { overflow-x: auto; }
.diff tr.add { background: var(--add-bg); } .diff tr.add .sg { color: var(--add); } .diff tr.add .ln { color: #8ab394; background: #e6f3e8; }
.diff tr.del { background: var(--del-bg); } .diff tr.del .sg { color: var(--del); } .diff tr.del .ln { color: #c99b95; background: #f9e7e4; }
.diff tr.add .cd { box-shadow: none; }
.diff tr.add td:first-child { box-shadow: inset 3px 0 0 var(--add-strong); }
.diff tr.del td:first-child { box-shadow: inset 3px 0 0 var(--del-strong); }
.diff tr.hunk td { padding: 6px 0; }
.diff tr.gap td { padding: 0; }
.gapbtn {
  display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; border: 0; background: #f7f7f5; color: var(--muted);
  font: 12.5px var(--sans); padding: 7px 0; cursor: pointer; border-top: 1px solid #f0efeb; border-bottom: 1px solid #f0efeb;
}
.gapbtn:hover { color: var(--text-2); background: #f2f2ef; }
.gapbtn[disabled] { cursor: default; } .gapbtn[disabled]:hover { color: var(--muted); background: #f7f7f5; }
.gapbtn svg { width: 12px; height: 12px; }
tbody.gaprows { display: none; }
tbody.gaprows.open { display: table-row-group; }
tr.gap.first .gapbtn { border-top: 0; }
tr.gap.last .gapbtn { border-bottom: 0; }
.sect { color: var(--faint); font-family: var(--sans); font-size: 12px; margin-left: 6px; }

/* syntax */
.hk { color: #7b3fc4; } .hs { color: #0f6b80; } .hn { color: #b5541c; } .hc { color: #9c9b95; font-style: italic; } .hf { color: #2457b8; } .ht { color: #a8641a; }

/* ── Diff tab ────────────────────────────────────────── */
.files-h { display: flex; align-items: baseline; gap: 9px; font-size: 15px; color: var(--text-2); margin: 0 0 14px; font-weight: 500; }
.files-h .num { color: var(--muted); font-weight: 400; }
.files-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 56px; row-gap: 2px; margin-bottom: 56px; }
.all-diffs { display: flex; flex-direction: column; gap: 18px; }
.legend { display: flex; flex-wrap: wrap; gap: 16px; color: var(--muted); font-size: 12.5px; margin: -4px 0 18px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }

/* footer */
.foot { border-top: 1px solid var(--line); padding: 26px 0 40px; color: var(--faint); font-size: 12.5px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.foot a { color: var(--muted); }
.kbd-help { color: var(--faint); }
.kbd-help kbd { font: 11px var(--mono); border: 1px solid var(--line-strong); border-bottom-width: 2px; padding: 0 4px; border-radius: 4px; color: var(--muted); background: var(--card); }

.flash { animation: flash 1.2s ease; }
@keyframes flash { 0%, 30% { box-shadow: 0 0 0 3px #cfe6d4; } 100% { box-shadow: 0 0 0 0 transparent; } }

/* no-AI banner (outside the tab panels, so it shows on every tab) */
.no-ai {
  display: flex; align-items: flex-start; gap: 10px; margin: 8px 0 0; padding: 11px 15px;
  background: #fff6db; border: 1px solid #f0d58a; border-radius: var(--radius-sm);
  color: #6b4a00; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere;
}
.no-ai svg { flex: none; margin-top: 1px; color: #b07800; }
.no-ai span { min-width: 0; }

@media (max-width: 960px) {
  .wrap { padding: 0 18px; }
  .ov, .chapter { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .ch-side { position: static; }
  .files-grid { grid-template-columns: minmax(0, 1fr); grid-auto-flow: row !important; grid-template-rows: none !important; }
  .toc-grid { grid-template-columns: minmax(0, 1fr); }
  .top-title { display: none; }
  .progress .bar { display: none; }
  .fhead { top: 60px; }
}
@media (max-width: 560px) {
  .pr-title { font-size: 22px; }
  .ic { white-space: normal; overflow-wrap: anywhere; }
  .meta > * + *::before { margin: 0 8px; }
  .ad-row .code .note { display: block; margin: 0 0 2px; }
  .progress span.lbl { display: none; }
}
@media print {
  .topbar { position: static; } .panel { display: block !important; } .fhead { position: static; }
}
`;
