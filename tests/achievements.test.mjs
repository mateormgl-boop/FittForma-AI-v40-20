import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'achievements.js'), 'utf8');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const sw = await readFile(path.join(root, 'sw.js'), 'utf8');
const context = { globalThis: {} };
context.window = context;
vm.runInNewContext(source, context);
const engine = context.FittFormaBadgeEngine;

test('motor de insignias publica rangos y doce hitos en orden creciente', () => {
  assert.ok(engine);
  for (const measure of ['reps', 'seconds', 'minutes', 'km', 'days']) {
    const list = engine.thresholdsForExercise({ measure });
    assert.equal(list.length, 12);
    for (let i = 1; i < list.length; i++) assert.ok(list[i] > list[i - 1]);
  }
  assert.equal(engine.rankForLevel(0).label, 'Bronce I');
  assert.equal(engine.rankForLevel(5).label, 'Plata III');
  assert.equal(engine.rankForLevel(8).label, 'Oro III');
  assert.equal(engine.rankForLevel(11).label, 'Diamante III');
});

test('normaliza nombres y representa progreso sin crear hitos falsos', () => {
  assert.equal(engine.normalizeName('Elevación de talones'), 'elevacion de talones');
  assert.equal(engine.slug('Plancha lateral'), 'plancha-lateral');
  const none = engine.progressForValue(0, [5, 10, 15]);
  assert.equal(none.highest, -1);
  assert.equal(none.unlocked, 0);
  assert.equal(none.nextTarget, 5);
  const result = engine.progressForValue(15, [5, 10, 15]);
  assert.equal(result.highest, 2);
  assert.equal(result.complete, true);
  assert.equal(result.pct, 100);
});

test('solo marca running como GPS válido si tiene puntos plausibles, suficientes y no teleportados', () => {
  const base = Date.now();
  const route = Array.from({ length: 6 }, (_, i) => ({ lat: -34.9 + i * 0.0001, lon: -56.15 + i * 0.0001, accuracy: 8, at: base + i * 30000 }));
  const activity = { source: 'gps', type: 'Correr', distance: 0.15, durationSeconds: 180, minutes: 3, route };
  assert.equal(engine.validGpsActivity(activity, 'Correr'), true);
  assert.equal(engine.validGpsActivity({ ...activity, source: 'manual' }, 'Correr'), false);
  assert.equal(engine.validGpsActivity({ ...activity, type: 'Caminar' }, 'Correr'), false);
  assert.equal(engine.validGpsActivity({ ...activity, route: route.slice(0, 3) }, 'Correr'), false);
  const teleport = route.map((point, i) => i === 4 ? { ...point, lat: 10, lon: 10 } : point);
  assert.equal(engine.validGpsActivity({ ...activity, route: teleport }, 'Correr'), false);
});

test('interfaz integra insignias en Progreso/Perfil y precarga el motor en la PWA', () => {
  assert.match(html, /id="achievementCenter"/);
  assert.match(html, /id="profileBadgesPreview"/);
  assert.match(html, /<script src="\.\/achievements\.js"><\/script>/);
  assert.match(html, /initBadgeCenter\(\)/);
  assert.match(sw, /fittforma-ai-static-v45-0/);
  const match = sw.match(/const ASSETS = (\[[\s\S]*?\]);/);
  assert.ok(match);
  assert.ok(JSON.parse(match[1]).includes('./achievements.js'));
});
