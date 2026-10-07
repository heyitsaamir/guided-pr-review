// Small inline-SVG file-type icons in the spirit of editor file trees.

const badge = (label, bg, fg = '#fff', size = 6.2) =>
  `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3.5" fill="${bg}"/><text x="8" y="11.1" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${size}" font-weight="700" fill="${fg}">${label}</text></svg>`;

const REACT = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><g fill="none" stroke="#2fa6c9" stroke-width="1.1"><ellipse cx="8" cy="8" rx="6.6" ry="2.6"/><ellipse cx="8" cy="8" rx="6.6" ry="2.6" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="6.6" ry="2.6" transform="rotate(120 8 8)"/></g><circle cx="8" cy="8" r="1.3" fill="#2fa6c9"/></svg>`;
const BRACES = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><text x="8" y="12" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="11" font-weight="700" fill="#d08a2e">{}</text></svg>`;
const MD = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><text x="8" y="11.4" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="7.4" font-weight="800" fill="#3d9a5b">M↓</text></svg>`;
const SHELL = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2" width="13" height="12" rx="2.5" fill="#e7ece9" stroke="#9fb3a8" stroke-width=".8"/><path d="M4.3 6l2 2-2 2" fill="none" stroke="#4f6f5f" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10.4h3.4" stroke="#4f6f5f" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const PY = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><path d="M7.9 1.5c-3 0-2.8 1.3-2.8 1.3v1.4h2.9v.5H3.9S2 4.5 2 7.5s1.7 2.9 1.7 2.9h1V8.9s0-1.7 1.7-1.7h2.8s1.6 0 1.6-1.6V3.1s.3-1.6-2.9-1.6zM6.3 2.4a.5.5 0 110 1 .5.5 0 010-1z" fill="#3a75b0"/><path d="M8.1 14.5c3 0 2.8-1.3 2.8-1.3v-1.4H8v-.5h4.1S14 11.5 14 8.5s-1.7-2.9-1.7-2.9h-1v1.5s0 1.7-1.7 1.7H6.8s-1.6 0-1.6 1.6v2.5s-.3 1.6 2.9 1.6zm1.6-.9a.5.5 0 110-1 .5.5 0 010 1z" fill="#f2c641"/></svg>`;
const SWIFT = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><path d="M12.7 10.2c.9-2.6-.4-5.4-2.9-7.3 1.2 1.7 1.6 3.6 1.1 5C9 6.6 6.2 4.6 3.8 2.6c1.2 1.6 2.7 3 3.9 4.1-1.7-1-3.6-2.3-5-3.6 1.6 2.6 4.3 5.2 6.6 6.6-2.2 1.1-4.7.9-6.9-.4 1.9 2.4 5 3.6 7.6 2.6.8-.3 1.6 0 2.4.8.3-.9-.2-1.8.3-2.5z" fill="#ef7a3c"/></svg>`;
const FILE = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5.2L12.6 5v8.6a.9.9 0 01-.9.9H4a.9.9 0 01-.9-.9V2.7c0-.5.4-.9.9-.9z" fill="#f1f1ef" stroke="#b9b9b4" stroke-width=".9"/><path d="M9 1.9V5h3.5" fill="none" stroke="#b9b9b4" stroke-width=".9"/></svg>`;
const LOCK = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="7" rx="1.6" fill="#ecebe7" stroke="#a9a8a2" stroke-width=".9"/><path d="M5.4 7V5.2a2.6 2.6 0 015.2 0V7" fill="none" stroke="#a9a8a2" stroke-width="1.1"/></svg>`;
const DB = `<svg class="fi" viewBox="0 0 16 16" aria-hidden="true"><g fill="#efe9fb" stroke="#8a6cc9" stroke-width=".9"><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4"/><ellipse cx="8" cy="4" rx="5" ry="2"/></g><path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" fill="none" stroke="#8a6cc9" stroke-width=".9"/></svg>`;

const BY_EXT = {
  ts: () => badge('TS', '#3d7cc9'),
  mts: () => badge('TS', '#3d7cc9'),
  cts: () => badge('TS', '#3d7cc9'),
  js: () => badge('JS', '#f0d24a', '#4a4210'),
  mjs: () => badge('JS', '#f0d24a', '#4a4210'),
  cjs: () => badge('JS', '#f0d24a', '#4a4210'),
  tsx: () => REACT,
  jsx: () => REACT,
  json: () => BRACES,
  jsonc: () => BRACES,
  md: () => MD,
  mdx: () => MD,
  sh: () => SHELL,
  bash: () => SHELL,
  zsh: () => SHELL,
  py: () => PY,
  swift: () => SWIFT,
  go: () => badge('GO', '#4bb3d4'),
  rs: () => badge('RS', '#c7744a'),
  rb: () => badge('RB', '#c9443d'),
  java: () => badge('J', '#d9813a'),
  kt: () => badge('KT', '#8e6be0'),
  css: () => badge('#', '#5a7fd6', '#fff', 8),
  scss: () => badge('#', '#c9649a', '#fff', 8),
  html: () => badge('&lt;&gt;', '#e0673d', '#fff', 6),
  vue: () => badge('V', '#3fb27f'),
  svelte: () => badge('S', '#ef5a2f'),
  yml: () => badge('Y', '#b8b2a6'),
  yaml: () => badge('Y', '#b8b2a6'),
  toml: () => badge('T', '#b8b2a6'),
  sql: () => DB,
  prisma: () => DB,
  lock: () => LOCK,
  c: () => badge('C', '#6b8fc7'),
  h: () => badge('H', '#9a8fc7'),
  cpp: () => badge('C+', '#5f7fc0', '#fff', 5.6),
  cs: () => badge('C#', '#7a5fc0', '#fff', 5.6),
  php: () => badge('P', '#7b80b7'),
};

export function fileIcon(path) {
  const base = path.split('/').pop();
  if (/(^|\.)lock$|lock\.(json|ya?ml)$|^go\.sum$/i.test(base)) return LOCK;
  if (/^Dockerfile$/i.test(base)) return badge('D', '#3c8fd8');
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  return (BY_EXT[ext] || (() => FILE))();
}
