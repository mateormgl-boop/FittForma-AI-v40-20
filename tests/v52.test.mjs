// v52: «Mapa de avances» — rango por músculo según las series completadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = file => { const ctx = { window: {} }; ctx.globalThis = ctx; vm.runInNewContext(readFileSync(file, 'utf8'), ctx); return ctx; };
const ctx = load('muscle-ranks.js'), R = ctx.FittFormaMuscleRanks || ctx.window.FittFormaMuscleRanks;
const actx = load('anatomy.js'), A = actx.FittFormaAnatomy || actx.window.FittFormaAnatomy;
const html = readFileSync('index.html', 'utf8');
const MAP = { Sentadilla: { primary: ['cuadriceps', 'gluteos'], secondary: ['aductores'] }, Curl: { primary: ['biceps'], secondary: ['antebrazos'] } };
const of = name => MAP[name] || { primary: [], secondary: [] };
const sess = (date, name, sets, done = true, status = 'completed') => ({ date, status, exercises: [{ name, entries: Array.from({ length: sets }, () => ({ reps: '10', weight: '20', done })) }] });

test('rangos: umbrales ordenados, 9 rangos de Hierro a Leyenda y todos los músculos del mapa', () => {
  assert.equal(R.RANKS.length, 9); assert.equal(R.RANKS[0].name, 'Hierro'); assert.equal(R.RANKS[8].name, 'Leyenda');
  for (let i = 1; i < R.RANKS.length; i++) assert.ok(R.RANKS[i].min > R.RANKS[i - 1].min);
  assert.equal(R.rankFor(0), -1); assert.equal(R.rankFor(1), 0); assert.equal(R.rankFor(9.5), 0); assert.equal(R.rankFor(10), 1); assert.equal(R.rankFor(9999), 8);
  assert.deepEqual([...R.MUSCLES].sort(), [...new Set(A.SHAPES.map(s => s.id))].sort(), 'mismos músculos que el mapa de anatomy.js');
});

test('series: principal suma 1, secundario 0,5; solo cuentan series hechas y sesiones completas', () => {
  const r = R.compute([sess('2026-10-01', 'Sentadilla', 4), sess('2026-10-02', 'Curl', 3), sess('2026-10-03', 'Curl', 5, false), sess('2026-10-04', 'Curl', 5, true, 'cancelled')], of);
  assert.equal(r.byId.cuadriceps.score, 4); assert.equal(r.byId.gluteos.score, 4); assert.equal(r.byId.aductores.score, 2);
  assert.equal(r.byId.biceps.score, 3); assert.equal(r.byId.antebrazos.score, 1.5);
  assert.equal(r.byId.pectorales.rank, -1);
  // Sesión vieja sin marcas de «hecha»: cuentan las series con repeticiones.
  const legacy = R.compute([{ date: '2026-01-01', exercises: [{ name: 'Curl', entries: [{ reps: '8' }, { reps: '' }, { reps: '10' }] }] }], of);
  assert.equal(legacy.byId.biceps.score, 2);
});

test('rango general = músculo mediano; «antes» filtra por fecha y detecta subidas', () => {
  const many = Array.from({ length: 12 }, (_, i) => sess(`2026-09-${String(i + 1).padStart(2, '0')}`, 'Sentadilla', 5));
  const r = R.compute(many, of);
  assert.equal(r.byId.cuadriceps.rank, 3, '60 series → Oro');
  assert.equal(r.overall, -1, 'con pocos músculos entrenados el general no sube');
  assert.ok(r.balance < 30, 'muy desparejo → equilibrio bajo');
  const before = R.compute(many, of, '2026-09-04'), ups = R.rankUps(before, r);
  assert.equal(before.byId.cuadriceps.score, 20);
  assert.ok(ups.some(u => u.id === 'cuadriceps' && u.rank === 3));
  const all = R.compute([{ date: '2026-10-01', status: 'completed', exercises: R.MUSCLES.map(m => ({ name: m, entries: Array.from({ length: 12 }, () => ({ done: true })) })) }], n => ({ primary: [n], secondary: [] }));
  assert.equal(all.overall, 1, 'todo el cuerpo con 12 series → general Bronce'); assert.equal(all.balance, 100);
  assert.deepEqual({ ...R.nextStep(12) }.next.name, 'Plata');
  assert.equal(R.nextStep(9999).next, null);
});

test('emblemas y mapa coloreado: SVG propio, sin texto inyectable', () => {
  for (let i = -1; i < 9; i++) assert.match(R.emblemSvg(i, 40), /^<svg/);
  const svg = A.muscleFillSvg({ biceps: '#f2b631' }, { label: '<b>x</b>', sides: 'front' });
  assert.match(svg, /data-muscle="biceps" style="fill:#f2b631"/);
  assert.doesNotMatch(svg, /<b>x/);
});

test('Progreso › Músculos integrado, cargado por la app, en el servidor y en el service worker', () => {
  assert.match(html, /data-progress-tab="muscles"/); assert.match(html, /id="progressPanelMuscles"[^>]*role="tabpanel"/);
  for (const id of ['mrHero', 'mrMaps', 'mrLadder', 'mrList']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /<script src="\.\/muscle-ranks\.js"><\/script>/);
  assert.match(html, /checkMuscleRankUps\(\);save\(\);renderAll\(\);renderTrain\(\);switchView\('train'\)/, 'avisa al terminar un entrenamiento');
  assert.match(readFileSync('backend/server.mjs', 'utf8'), /'\/muscle-ranks\.js'/);
  assert.match(readFileSync('sw.js', 'utf8'), /\.\/muscle-ranks\.js/);
});
