// v57: Nutrición lee toda la base con gramos por alimento, insignias de 15 niveles (Legendario negro), Músculos desde Bronce
// hasta Leyenda con mapa redibujado, ficha en dos pestañas, animaciones WebP, copia automática en la nube y fichas traducidas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const load = (...files) => { const ctx = { window: {} }; ctx.globalThis = ctx; for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), ctx); return ctx.window; };
const W = load('food-db.js', 'food-core.js'), F = W.FittFormaFood, DB = W.FittFormaFoodDb;
const B = load('achievements.js').FittFormaBadgeEngine;
const MR = load('muscle-ranks.js').FittFormaMuscleRanks;
const A = load('anatomy.js').FittFormaAnatomy;
const guides = load('exercise-guides.js').FittFormaExerciseGuides;
const html = readFileSync('index.html', 'utf8'), css = readFileSync('design.css', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');
const migration = readFileSync('supabase/migrations/2026-10-30_v57_legend_badges.sql', 'utf8');

test('Nutrición: entiende cantidades por alimento («100 g de hamburguesa, 2 croquetas y 200 g de pan»)', () => {
  const r = F.parseMealText(DB, '100 g de hamburguesa, 2 croquetas de papa y 200 g de pan');
  assert.deepEqual([...r.items.map(i => i.grams)], [100, 90, 200]);
  assert.deepEqual([...r.unknown], []);
  assert.match(r.items[0].food.name, /Hamburguesa/); assert.equal(r.items[1].food.name, 'Croquetas de papa'); assert.match(r.items[2].food.name, /^Pan/);
  const dish = F.parseMealText(DB, 'fideos con tuco y una factura');
  assert.deepEqual([...dish.items.map(i => i.food?.name)], ['Fideos con tuco', 'Factura'], 'un plato con «con» no se parte en dos');
  assert.equal(F.parseMealText(DB, '2 huevos').items[0].grams, 100, 'unidades con peso típico, no una taza');
  assert.deepEqual([...F.parseMealText(DB, 'xyzzy').unknown], ['xyzzy'], 'lo que no reconoce se avisa, no se inventa');
  assert.ok(DB.length >= 306);
  for (const n of ['Croquetas de papa', 'Factura', 'Brownie', 'Hamburguesa casera al pan', 'Revuelto gramajo']) assert.ok(DB.some(f => f.name === n), n);
  assert.match(html, /id="mealParse"/); assert.match(html, /data-parse-grams/);
});

test('Insignias: 15 niveles, Legendario arriba de Diamante, sin cambiar los 12 umbrales anteriores', () => {
  assert.equal(B.LEVELS, 15);
  assert.deepEqual([...B.RANKS.map(r => r.key)], ['bronze', 'silver', 'gold', 'diamond', 'legend']);
  assert.equal(B.RANKS.at(-1).name, 'Legendario');
  const pull = B.CORE_EXERCISES.find(x => x.id === 'exercise-dominadas');
  assert.equal(pull.thresholds.length, 15);
  assert.deepEqual([...pull.thresholds.slice(0, 12)], [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20], 'los niveles ya ganados no cambian');
  assert.ok(pull.thresholds.at(-1) > 20, 'dominadas ya no termina en 20');
  for (const e of B.CORE_EXERCISES) { assert.equal(e.thresholds.length, 15, e.name); assert.ok(e.thresholds.every((v, i, a) => !i || v > a[i - 1]), `${e.name}: umbrales crecientes`); }
  assert.equal(B.rankForLevel(11).key, 'diamond'); assert.equal(B.rankForLevel(12).key, 'legend');
  assert.match(B.medalSvg({ rankKey: 'legend' }), /ff-medal--legend/);
  assert.match(html, /id="ffMedalLegend"/); assert.match(css, /\.ff-medal--legend/);
});

test('Migración v57: aditiva, acepta niveles 13–15 solo con rango legend', () => {
  assert.doesNotMatch(migration, /\bdrop\s+(table|policy|function)\b|\bdelete\s+from\b|\btruncate\b|disable row level security/i);
  assert.match(migration, /array\['bronze','silver','gold','diamond','legend'\]/);
  assert.match(migration, /\(1,2,3,4,5,6,7,8,9,10,11,12,13,14,15\)/);
});

test('Músculos: escalera desde Bronce hasta Leyenda (negro), con los mismos umbrales de series', () => {
  assert.deepEqual([...MR.RANKS.map(r => r.name)], ['Bronce', 'Plata', 'Oro', 'Platino', 'Esmeralda', 'Rubí', 'Diamante', 'Campeón', 'Leyenda']);
  assert.deepEqual([...MR.RANKS.map(r => r.min)], [1, 10, 25, 50, 90, 150, 240, 360, 520], 'los rangos guardados (índices 0–8) siguen valiendo lo mismo');
  assert.equal(MR.RANKS.at(-1).color, '#17141f');
  assert.match(html, /Sin entrenar/); assert.doesNotMatch(html, />Sin rango</);
  const id = A.SHAPES[0].id, svg = A.muscleFillSvg({ [id]: { color: '#17141f', edge: '#ffd66b' } });
  assert.match(svg, /fill:#17141f;stroke:#ffd66b/, 'Leyenda se pinta negra con borde dorado');
  assert.ok(A.SHAPES.length > 20 && A.SILHOUETTE, 'mapa redibujado con más cabezas musculares');
  assert.match(html, /data-mr-view="compare"/);
});

test('Ficha del ejercicio: dos pestañas, «Cómo se hace» primero', () => {
  for (const id of ['exTabHowBtn', 'exTabMineBtn', 'exTabHow', 'exTabMine']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /function showExerciseTab\(/); assert.match(html, /showExerciseTab\('how'\)/);
  assert.match(i18n, /\["Cómo se hace", "How to do it"/); assert.match(i18n, /\["Mi progreso", "My progress"/);
});

test('Copia automática en la nube: nunca pisa una copia más nueva ni sube datos vacíos encima', () => {
  assert.match(html, /id="cloudAutoToggle"/);
  assert.match(html, /if\(remote&&!\(mark&&mark\.user===uid&&mark\.at===remote\.updated_at\)\)\{setCloudAutoStatus\('newer'/);
  assert.match(html, /if\(!stateHasData\(state\)\)\{if\(remote\)setCloudAutoStatus\('empty'\)/);
  assert.match(html, /function save\(\)\{try\{localStorage\.setItem\(STORAGE,JSON\.stringify\(state\)\);scheduleCloudBackup\(\);return true;\}/);
  assert.match(html, /if\(cloudAutoTimer&&cloudAutoDue<=due\)return;/, 'guardar seguido no posterga la copia indefinidamente');
});

test('las 31 fichas nuevas están traducidas (cada texto tiene su fila de idiomas)', () => {
  const NEW = [...html.match(/const NEW_EXERCISES_V56=new Set\((\[[^\]]+\])\)/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const missing = [];
  for (const g of guides.filter(g => NEW.includes(g.name))) for (const [k, v] of Object.entries(g)) {
    if (k === 'pattern' || k === 'alternatives' || k === 'name') continue;
    for (const s of [].concat(v)) if (typeof s === 'string') { const key = JSON.stringify(s); if (!i18n.includes('[' + key) && !i18n.includes('[ ' + key)) missing.push(s); }
  }
  assert.deepEqual(missing, []);
});
