// Browser-side behavior, inlined into the page as a <script>. Plain ES2020, no deps.
export const CLIENT_JS = String.raw`
(() => {
  const D = JSON.parse(document.getElementById('gpr-data').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const KEY = 'gpr:' + D.key;

  // ── Tabs ───────────────────────────────────────────
  const tabs = $$('.tab');
  function show(name, { push = true } = {}) {
    if (!$('#panel-' + name)) name = 'overview';
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
    if (push && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    if (name === 'overview') requestAnimationFrame(layoutFlows);
  }
  tabs.forEach((t) => t.addEventListener('click', () => { show(t.dataset.tab); window.scrollTo({ top: 0 }); }));
  const initial = (location.hash || '').slice(1).split(':')[0];
  show(['overview', 'guide', 'diff'].includes(initial) ? initial : 'overview', { push: false });

  const topbar = $('.topbar');
  const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  function goChapter(n) {
    show('guide');
    const el = document.getElementById('chapter-' + n);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); flash(el.querySelector('.ch-side')); }
  }
  function goFile(id, panel) {
    if (panel) show(panel);
    const scope = panel ? document.getElementById('panel-' + panel) : document;
    const el = scope.querySelector('.fcard[data-file="' + id + '"]');
    if (!el) return;
    el.classList.remove('collapsed');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    flash(el);
  }
  document.addEventListener('click', (e) => {
    const ch = e.target.closest('[data-goto-chapter]');
    if (ch) { e.preventDefault(); goChapter(ch.dataset.gotoChapter); return; }
    const fr = e.target.closest('.frow[data-file]');
    if (fr && !e.target.closest('input,label,a')) {
      goFile(fr.dataset.file, fr.closest('#panel-diff') ? 'diff' : fr.closest('#panel-overview') ? 'diff' : null);
    }
  });

  // ── Collapsibles ───────────────────────────────────
  $$('.ba-head').forEach((h) => h.addEventListener('click', () => { h.parentElement.classList.toggle('collapsed'); layoutFlows(); }));
  $$('.fhead .tog').forEach((b) => b.addEventListener('click', () => b.closest('.fcard').classList.toggle('collapsed')));
  // Gap ids repeat when a file is shown in both Guide and Diff, so resolve within the card.
  document.addEventListener('click', (e) => {
    const g = e.target.closest('.gapbtn:not([disabled])');
    if (g) {
      const rows = g.closest('.fcard').querySelector('[data-gaprows="' + g.dataset.gap + '"]');
      if (rows) { rows.classList.add('open'); g.closest('tbody').remove(); }
      return;
    }
    const s = e.target.closest('[data-show-diff]');
    if (s) {
      const card = s.closest('.fcard');
      const tpl = card.querySelector('template');
      if (tpl) card.querySelector('.fbody').replaceWith(tpl.content.cloneNode(true));
    }
  });

  // ── Reviewed state (per PR head, stored locally) ───
  let reviewed = new Set(store.get(KEY, []));
  function sync() {
    $$('input[data-rv-file]').forEach((i) => { i.checked = reviewed.has(i.dataset.rvFile); });
    $$('.frow[data-file]').forEach((r) => r.classList.toggle('reviewed', reviewed.has(r.dataset.file)));
    let done = 0;
    for (const c of D.chapters) {
      const all = c.files.length > 0 && c.files.every((f) => reviewed.has(f));
      if (all) done++;
      $$('input[data-rv-chapter="' + c.index + '"]').forEach((i) => {
        i.checked = all;
        i.indeterminate = !all && c.files.some((f) => reviewed.has(f));
      });
      const sec = document.getElementById('chapter-' + c.index);
      if (sec) sec.classList.toggle('done', all);
      $$('.toc-item[data-goto-chapter="' + c.index + '"]').forEach((t) => t.classList.toggle('done', all));
    }
    $('#prog-n').textContent = done;
    $('#prog-bar').style.width = (D.chapters.length ? (100 * done) / D.chapters.length : 0) + '%';
    store.set(KEY, Array.from(reviewed));
  }
  document.addEventListener('change', (e) => {
    const i = e.target;
    if (i.dataset.rvFile) {
      i.checked ? reviewed.add(i.dataset.rvFile) : reviewed.delete(i.dataset.rvFile);
      if (i.checked) $$('.fcard[data-file="' + i.dataset.rvFile + '"]').forEach((c) => c.classList.add('collapsed'));
      else $$('.fcard[data-file="' + i.dataset.rvFile + '"]').forEach((c) => c.classList.remove('collapsed'));
      sync();
    } else if (i.dataset.rvChapter) {
      const c = D.chapters.find((x) => String(x.index) === i.dataset.rvChapter);
      c.files.forEach((f) => (i.checked ? reviewed.add(f) : reviewed.delete(f)));
      $$('#chapter-' + c.index + ' .fcard').forEach((card) => card.classList.toggle('collapsed', i.checked));
      sync();
      if (i.checked && c.index < D.chapters.length) setTimeout(() => goChapter(c.index + 1), 260);
    }
  });
  sync();
  $$('.fcard[data-file]').forEach((c) => { if (reviewed.has(c.dataset.file)) c.classList.add('collapsed'); });

  // ── Keyboard: 1/2/3 tabs, j/k chapters ────────────
  function currentChapter() {
    const secs = $$('.chapter');
    let cur = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top < 140) cur = i; });
    return cur + 1;
  }
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === '1') show('overview'); else if (e.key === '2') show('guide'); else if (e.key === '3') show('diff');
    else if ($('#panel-guide.active') && (e.key === 'j' || e.key === 'k')) {
      const n = currentChapter() + (e.key === 'j' ? 1 : -1);
      if (n >= 1 && n <= D.chapters.length) goChapter(n);
    }
  });
  $$('[data-step]').forEach((b) => b.addEventListener('click', () => goChapter(b.dataset.step)));

  // ── Flow diagram layout ────────────────────────────
  function layoutFlows() { $$('.flow').forEach(layoutFlow); }
  function layoutFlow(box) {
    if (!box.offsetParent) return;
    box.classList.remove('pending');
    const nodes = $$('.node', box);
    const byId = new Map(nodes.map((n) => [n.dataset.id, n]));
    const main = nodes.filter((n) => !n.dataset.branch || !byId.has(n.dataset.branch));
    const branches = nodes.filter((n) => n.dataset.branch && byId.has(n.dataset.branch));
    const W = box.clientWidth, H = 38, GX = 44, GY = 34, LEAD = 0;
    // Horizontal gap before a node grows to fit its incoming edge label.
    const gapBefore = (n) => Math.max(GX, (n.dataset.edge || '').length * 6.6 + 24);
    const rows = []; let row = [], x = LEAD;
    for (const n of main) {
      const w = n.offsetWidth;
      if (row.length && x + gapBefore(n) + w > W) { rows.push(row); row = []; x = LEAD; }
      if (row.length) x += gapBefore(n);
      row.push(n); x += w;
    }
    if (row.length) rows.push(row);
    const pos = new Map();
    let y = 0;
    rows.forEach((r, ri) => {
      let cx = ri === 0 ? 0 : 18;
      const hasBranch = r.some((n) => branches.some((b) => b.dataset.branch === n.dataset.id));
      r.forEach((n, j) => { if (j) cx += gapBefore(n); pos.set(n, { x: cx, y, w: n.offsetWidth, row: ri }); cx += n.offsetWidth; });
      y += H + (hasBranch ? H + GY - 6 : 0) + GY + (ri < rows.length - 1 ? 6 : 0);
    });
    // Branches drop straight down from their parent, then run right to the node,
    // leaving room on the horizontal leg for the edge label.
    const branchCount = new Map();
    for (const b of branches) {
      const p = pos.get(byId.get(b.dataset.branch));
      const k = branchCount.get(p) || 0; branchCount.set(p, k + 1);
      const lblW = (b.dataset.edge || '').length * 6.6;
      const w = b.offsetWidth;
      let bx = p.x + 16 + Math.max(30, lblW + 22) + k * 24;
      if (bx + w > W) bx = Math.max(0, W - w);
      pos.set(b, { x: bx, y: p.y + H + GY - 6 + k * (H + 12), w, branchOf: p });
    }
    let maxY = 0;
    for (const [n, p] of pos) { n.style.left = p.x + 'px'; n.style.top = p.y + 'px'; maxY = Math.max(maxY, p.y + H); }
    box.style.height = maxY + 4 + 'px';
    const NS = 'http://www.w3.org/2000/svg';
    let svg = box.querySelector('svg.edges');
    if (!svg) { svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'edges'); box.prepend(svg); }
    svg.innerHTML = '<defs><marker id="ah-' + box.id + '" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.2 6.6 4 1 6.8" fill="none" stroke="#bdbcb5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>';
    const path = (d) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('marker-end', 'url(#ah-' + box.id + ')'); svg.appendChild(p); };
    const label = (t, x, y, anchor = 'middle') => { if (!t) return; const e = document.createElementNS(NS, 'text'); e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('text-anchor', anchor); e.textContent = t; svg.appendChild(e); };
    const mid = (p) => p.y + H / 2;
    for (let i = 1; i < main.length; i++) {
      const a = pos.get(main[i - 1]), b = pos.get(main[i]);
      const lbl = main[i].dataset.edge || '';
      if (a.row === b.row) {
        path('M' + (a.x + a.w + 3) + ' ' + mid(a) + ' H' + (b.x - 3));
        label(lbl, (a.x + a.w + b.x) / 2, mid(a) - 8);
      } else {
        const rx = Math.min(W - 2, a.x + a.w + 14), turnY = b.y - GY / 2 - 3, lx = b.x - 12;
        path('M' + (a.x + a.w + 3) + ' ' + mid(a) + ' H' + rx + ' V' + turnY + ' H' + lx + ' V' + mid(b) + ' H' + (b.x - 3));
        label(lbl, lx + 6, turnY - 6, 'start');
      }
    }
    for (const b of branches) {
      const p = pos.get(b), a = p.branchOf, sx = a.x + 16;
      path('M' + sx + ' ' + (a.y + H + 1) + ' V' + mid(p) + ' H' + (p.x - 3));
      label(b.dataset.edge || '', sx + 8, mid(p) - 7, 'start');
    }
  }
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layoutFlows, 60); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutFlows);
  layoutFlows();
})();
`;
