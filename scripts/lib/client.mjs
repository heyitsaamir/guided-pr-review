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
  $$('.ba-head').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed')));
  $$('.fhead .tog').forEach((b) => b.addEventListener('click', () => b.closest('.fcard').classList.toggle('collapsed')));
  const peleDialog = $('#gpr-pele-dialog');
  if (peleDialog) {
    $$('[data-pele-open]').forEach((button) => button.addEventListener('click', () => peleDialog.showModal()));
    peleDialog.addEventListener('click', (event) => {
      if (event.target === peleDialog) peleDialog.close();
    });
  }
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

})();
`;
