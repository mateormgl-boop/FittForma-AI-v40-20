// v51: galería de ejercicios sin recortes, hidratación renovada y «Objetivo y actualidad».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = file => { const ctx = { window: {} }; ctx.globalThis = ctx; vm.runInNewContext(readFileSync(file, 'utf8'), ctx); return ctx; };
const trainingCtx = load('training-core.js');
const T = trainingCtx.FittFormaTraining || trainingCtx.window.FittFormaTraining;
const html = readFileSync('index.html', 'utf8'), css = readFileSync('design.css', 'utf8');

test('los GIF de ejercicios se muestran enteros (contain) y en marco cuadrado', () => {
  assert.match(css, /#view-exercises \.exercise-library-item \.exercise-photo\.is-gif img\{object-fit:contain!important/);
  assert.match(css, /\.exercise-library-item \.exercise-photo\.is-gif[^{]*\{height:auto!important;aspect-ratio:1\/1\}/);
  assert.match(css, /\.exercise-gif-hero \.exercise-gif-title\{order:-1;position:static/);
});

test('ritmo de hidratación: 0 antes de empezar, proporcional y completo al final', () => {
  assert.equal(T.hydrationPace(2400, '09:00', '21:00', 8 * 60), 0);
  assert.equal(T.hydrationPace(2400, '09:00', '21:00', 15 * 60), 1200);
  assert.equal(T.hydrationPace(2400, '09:00', '21:00', 22 * 60), 2400);
  assert.equal(T.hydrationPace(2000, 'mal', '21:00', 15 * 60), 1000, 'horario inválido usa 09–21');
  assert.equal(T.hydrationPace(0, '09:00', '21:00', 600), 0);
});

test('racha de hidratación: días seguidos con el objetivo; hoy sin cumplir no corta la racha', () => {
  const e = [{ date: '2026-10-16', ml: 2500 }, { date: '2026-10-17', ml: 1000 }, { date: '2026-10-17', ml: 1000 }, { date: '2026-10-18', ml: 2000 }, { date: '2026-10-19', ml: 300 }];
  assert.equal(T.hydrationStreak(e, 2000, '2026-10-19'), 3);
  assert.equal(T.hydrationStreak([...e, { date: '2026-10-19', ml: 1700 }], 2000, '2026-10-19'), 4);
  assert.equal(T.hydrationStreak([{ date: '2026-10-17', ml: 3000 }], 2000, '2026-10-19'), 0, 'un día sin cumplir corta la racha');
  assert.equal(T.hydrationStreak([], 2000, 'x'), 0);
  assert.equal(T.hydrationStreak([{ date: '2026-03-01', ml: 2000 }, { date: '2026-02-28', ml: 2000 }], 2000, '2026-03-01'), 2, 'cruza fin de mes');
});

test('tarjeta de hidratación: conserva los ids existentes y suma los nuevos', () => {
  for (const id of ['hydrationCard', 'hydroBottle', 'hydroWater', 'hydroWave', 'waterMlToday', 'waterGoalMlText', 'waterPct', 'waterRemaining', 'waterCount', 'addWater', 'removeWater', 'waterCustomForm', 'waterEntries', 'waterResetToday', 'waterGoalMl', 'glassMl', 'waterSuggestion', 'saveWaterSettings', 'useWaterSuggestion', 'waterReminderEnabled', 'saveWaterReminder', 'waterWeek', 'waterWeekSummary', 'hydroBar', 'hydroPaceMark', 'waterPace', 'waterStreak', 'waterGlassesToday', 'waterLastAt', 'waterTimeline'])
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `id único: ${id}`);
  for (const ml of [330, 500, 750]) assert.match(html, new RegExp(`data-water-add="${ml}"`));
  assert.match(css, /\.hydro-bottle\{width:104px;height:180px/, 'la botella tiene tamaño fijo');
});
