import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);

test('v46: el acento deja el texto blanco en 4.5:1 o más en ambos extremos', () => {
  const m = html.match(/v46 — pulido[\s\S]*?--ff-accent-a:(#[0-9a-f]{6});--ff-accent-b:(#[0-9a-f]{6})/i);
  assert.ok(m, 'falta la capa v46');
  for (const c of [m[1], m[2]]) assert.ok(ratio('#ffffff', c) >= 4.5, `${c}: ${ratio('#ffffff', c).toFixed(2)}`);
});

test('v46: placeholders legibles, sin texto con degradado y con foco visible', () => {
  // v47: el placeholder usa --text-3 de cada tema (design.css); se verifica en ambos fondos de campo.
  const design = readFileSync(path.join(root, 'design.css'), 'utf8');
  assert.match(design, /::placeholder\{color:var\(--text-3\)!important/);
  assert.ok(ratio('#8d9bbb', '#13203d') >= 4.5, 'oscuro');
  assert.ok(ratio('#56627e', '#eef2f9') >= 4.5, 'claro');
  assert.doesNotMatch(html, /background-clip:text/);
  assert.match(html, /:focus-visible\{outline:2px solid/);
  assert.match(html, /::selection\{/);
});

test('v46: piso de 11 px para rótulos que estaban entre 8 y 10,5 px', () => {
  const layer = html.slice(html.indexOf('v46 — pulido'));
  for (const sel of ['.mobile-app-nav .mobile-nav-item', '.calendar-day-name', '.nutrition-week-day small', '.run-option-kicker', '.stats .stat small']) assert.ok(layer.includes(sel), sel);
  assert.match(layer, /\{font-size:11px!important\}/);
});
