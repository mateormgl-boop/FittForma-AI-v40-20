// v71: coronita de miembros, «Próxima serie» y récord al momento, «Lo de siempre» en Nutrición y tendencia del peso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const read = p => readFileSync(p, 'utf8');
const root = process.cwd();
await import(path.join(root, 'training-core.js'));
await import(path.join(root, 'food-core.js'));
await import(path.join(root, 'body-goals.js'));
const T = globalThis.FittFormaTraining, F = globalThis.FittFormaFood, B = globalThis.FittFormaBody;
const html = read('index.html'), css = read('design.css'), ads = read('ads.js'), community = read('community.js');

test('v71: coronita en vez de «Gratis»; «Miembro» solo con membresía verificada y «Próximamente» mientras no hay pagos', () => {
  assert.match(html, /id="planChip"[^>]*hidden[^>]*><svg class="crown"[\s\S]*?<span id="planChipText">Miembros<\/span>/);
  assert.doesNotMatch(html, /id="planChipText">Gratis/);
  assert.match(ads, /label = plus \? t\('Miembro'\) : t\('Miembros'\)/);
  assert.match(ads, /membershipSoon/);
  assert.match(html, /id="membershipSoon" hidden><strong>Próximamente<\/strong>/);
  assert.match(css, /@media \(max-width:359px\)\{[\s\S]*?\.plan-chip #planChipText\{position:absolute;width:1px/, 'en 320 px queda solo la corona');
  assert.match(community, /cm-plus-badge" role="img" aria-label="Miembro"><svg/);
});

test('v71: próxima serie — usa la misma serie de la última vez y no sube la carga si hoy costó', () => {
  const last = [{ reps: 8, weight: 60, done: true }, { reps: 8, weight: 60, done: true }];
  assert.deepEqual(T.nextSetHint(last, [{ reps: 8, weight: 60, done: true }, {}], '8–12', 'reps', 1).reps, 9, 'progresión doble: una repetición más');
  const up = T.nextSetHint([{ reps: 12, weight: 60, done: true }], [], '8–12', 'reps', 0);
  assert.equal(up.kind, 'load'); assert.equal(up.weight, 62.5); assert.equal(up.reps, 8);
  const hold = T.nextSetHint(last, [{ reps: 6, weight: 60, done: true }], '8–12', 'reps', 1);
  assert.equal(hold.kind, 'hold'); assert.equal(hold.weight, 60);
  const today = T.nextSetHint([{ reps: 10, weight: 20 }, { reps: 10, weight: 20 }], [{ reps: 10, weight: 22, done: true }], '6–10', 'reps', 1);
  assert.equal(today.weight, 22, 'si hoy ya subiste, sugiere mantener lo de hoy');
  assert.equal(T.nextSetHint([], [], '8–12', 'reps', 0), null, 'sin datos no inventa');
  assert.match(html, /data-next-set="\$\{ei\}" role="status" hidden/);
});

test('v71: el récord se anuncia una sola vez por serie, con vibración opcional', () => {
  assert.match(html, /if\(inp\.checked&&setBeatsRecord\(ex,ex\.entries\[s\]\)\)announceSetRecord\(ex,e,s\)/);
  assert.match(html, /activeSession\.prSeen\.includes\(key\)\)return/);
  assert.match(html, /restAlertPrefs\(\)\.vibrate&&navigator\.vibrate/);
});

test('v71: «Lo de siempre» sale solo de tus registros del mismo momento del día', () => {
  assert.equal(F.mealTypeForHour(8), 'Desayuno'); assert.equal(F.mealTypeForHour(13), 'Almuerzo'); assert.equal(F.mealTypeForHour(17), 'Merienda'); assert.equal(F.mealTypeForHour(21), 'Cena');
  const meals = [
    { date: '2026-11-01', type: 'Desayuno', name: 'Avena con banana', calories: 350, protein: 12 },
    { date: '2026-11-03', type: 'Desayuno', name: 'avena con banana', calories: 360, protein: 12 },
    { date: '2026-11-04', type: 'Desayuno', name: 'Tostadas', calories: 200 },
    { date: '2026-11-02', type: 'Almuerzo', name: 'Pollo' }, { date: '2026-11-03', type: 'Almuerzo', name: 'Pollo' },
    { date: '2026-09-01', type: 'Desayuno', name: 'Viejo' }, { date: '2026-09-02', type: 'Desayuno', name: 'Viejo' }
  ];
  const r = F.usualMeals(meals, { today: '2026-11-05', hour: 8 });
  assert.equal(r.length, 1, 'una sola vez no alcanza, y lo de hace más de 4 semanas no cuenta');
  assert.equal(r[0].calories, 360, 'usa los valores de la última vez'); assert.equal(r[0].times, 2);
  assert.equal(F.usualMeals([...meals, { date: '2026-11-05', type: 'Desayuno', name: 'Avena con banana' }], { today: '2026-11-05', hour: 8 }).length, 0, 'no repite lo ya registrado hoy');
  assert.match(html, /data-view-panel="hoy">\s*<div class="card nutrition-summary-card">[^\n]*\n\s*<div class="card usual-meals" id="usualMeals" hidden><\/div>/, 'en la pestaña que se abre primero');
});

test('v71: tendencia del peso suavizada y ritmo semanal de las últimas 4 semanas', () => {
  const w = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), kg: 80 - i * 0.05 + (i % 3 ? 0.6 : -0.6) }));
  const r = B.weightTrend(w);
  assert.equal(r.points.length, 30);
  assert.ok(Math.abs(r.weeklyKg - -0.35) < 0.05, String(r.weeklyKg));
  const spread = a => Math.max(...a) - Math.min(...a);
  assert.ok(spread(r.points.slice(10).map(p => p.trend)) < spread(r.points.slice(10).map(p => p.kg)), 'la línea suaviza los altibajos');
  assert.equal(B.weightTrend([{ date: '2026-11-01', kg: 80 }, { date: '2026-11-03', kg: 79 }]).weeklyKg, null, 'con pocos datos no se calcula un ritmo');
  assert.match(html, /class="wc-trend" fill="none"/);
});
