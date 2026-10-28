import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderHtml } from './render.mjs';

const pr = JSON.parse(readFileSync(new URL('../samples/ky-873.pr.json', import.meta.url)));
const analysis = JSON.parse(readFileSync(new URL('../samples/ky-873.json', import.meta.url)));
const html = renderHtml(pr, analysis);

assert.match(html, /class="ad"/, 'keeps annotated before/after content');
assert.match(html, /data-pele-open/, 'renders an accessible diagram trigger');
assert.match(html, /<dialog class="pele-viewer" id="gpr-pele-dialog"/, 'renders the expanded viewer');
assert.match(html, /<form method="dialog"><button[^>]+>Close<\/button>/, 'renders a native close control');
assert.match(html, /peleDialog\.showModal\(\)/, 'opens the viewer with native dialog behavior');
assert.match(html, /event\.target === peleDialog/, 'closes the viewer from its backdrop');

const viewBox = html.match(/data-pele-open[\s\S]*?<svg[^>]+viewBox="0 0 ([\d.]+) ([\d.]+)"/);
assert.ok(viewBox, 'renders an inline Pele SVG');
assert.ok(Number(viewBox[2]) > Number(viewBox[1]), 'renders the sample flow top-to-bottom');
