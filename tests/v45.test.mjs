import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFile(path.join(root, f), 'utf8');
const [extra, i18n, html, sw, server, pkg] = await Promise.all(['i18n-extra.js', 'i18n.js', 'index.html', 'sw.js', 'backend/server.mjs', 'package.json'].map(read));

test('v45: i18n-extra.js define filas válidas de seis idiomas', () => {
  const ctx = { window: {} }; vm.runInNewContext(extra, ctx);
  const rows = ctx.window.FittFormaI18nExtra;
  assert.ok(Array.isArray(rows) && rows.length > 800, `filas: ${rows?.length}`);
  for (const r of rows) assert.ok(Array.isArray(r) && r.length === 6 && r.every(x => typeof x === 'string' && x.length), JSON.stringify(r));
  const byKey = new Map(rows.map(r => [r[0], r]));
  for (const k of ['Agua', 'Plan y recetas', 'Moderación', 'Eliminar mi cuenta en la nube', 'Tu plan actual']) assert.ok(byKey.has(k), `falta «${k}»`);
});

test('v45: el archivo se carga antes que i18n.js, se precachea y el servidor lo publica', () => {
  assert.ok(html.indexOf('src="./i18n-extra.js"') > 0 && html.indexOf('src="./i18n-extra.js"') < html.indexOf('src="./i18n.js"'));
  assert.match(sw, /"\.\/i18n-extra\.js"/);
  assert.match(server, /'\/i18n-extra\.js'/);
  assert.match(i18n, /window\.FittFormaI18nExtra/);
});

test('v45: atributos de textarea y fotos de ejercicios se traducen; patrones nuevos', () => {
  assert.match(i18n, /translateAttrs\(node\);[^\n]*\n\s*if\(node\.matches\(skipSelector\)\)return;/);
  assert.doesNotMatch(i18n, /el\.matches\('script,style,textarea/);
  assert.match(i18n, /\^Referencia visual de \(\.\+\)\$/);
  assert.match(i18n, /kcal estimadas restantes para tu objetivo diario/);
});

test('v45: npm run test:e2e incluye los flujos críticos', () => {
  assert.match(JSON.parse(pkg).scripts['test:e2e'], /flows\.e2e\.mjs/);
});
