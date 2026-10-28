// v59: calorías estimadas por ejercicio y al terminar la rutina, tarjeta «Entrenamiento diario» sin el círculo negro,
// «Mi semana» compacta con hoja para elegir el día y revisión visual en el celular.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const load = (...files) => { const ctx = { window: {} }; ctx.globalThis = ctx; for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), ctx); return ctx.window; };
const ACT = load('activity-core.js').FittFormaActivity;
const html = readFileSync('index.html', 'utf8'), css = readFileSync('design.css', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');
const set = (reps, done = true) => ({ reps: String(reps), weight: '20', done });

test('calorías por ejercicio: MET 3,5 × peso × (trabajo + descanso), solo series hechas', () => {
  // 3 series de 10 repeticiones (~30 s cada una) + 90 s de descanso por serie = 6 min → 3,5 × 75 × 6 / 60 ≈ 26 kcal.
  const r = ACT.estimateExerciseCalories({ entries: [set(10), set(10), set(10), set(10, false)], rest: 90, weightKg: 75 });
  assert.equal(r.kcal, 26); assert.equal(r.minutes, 6); assert.equal(r.met, 3.5); assert.equal(r.approximate, true);
  assert.equal(ACT.estimateExerciseCalories({ entries: [set(10)], rest: 60, weightKg: 75 }).kcal, 7, 'el descanso indicado cambia el tiempo: (30 + 60 s) → 3,5 × 75 × 1,5 / 60 ≈ 7');
  // Cardio cargado en minutos: MET 5 × 70 kg × 20 min / 60 ≈ 117 kcal.
  assert.equal(ACT.estimateExerciseCalories({ kind: 'cardio', entries: [set(20)], weightKg: 70 }).kcal, 117);
});

test('calorías por ejercicio: sin peso o sin series no se inventa nada', () => {
  assert.deepEqual({ ...ACT.estimateExerciseCalories({ entries: [set(10)] }) }, { kcal: null, reason: 'peso' });
  assert.deepEqual({ ...ACT.estimateExerciseCalories({ entries: [set(10, false)], weightKg: 75 }) }, { kcal: null, reason: 'datos' });
  assert.equal(ACT.estimateExerciseCalories({ entries: [set(10)], weightKg: 'abc' }).kcal, null);
});

test('la sesión avisa las calorías al completar cada ejercicio y las resume al terminar', () => {
  assert.match(html, /function exerciseKcal\(e\)/);
  assert.match(html, /id="workoutKcalLive"/, 'calorías en vivo durante la sesión');
  assert.match(html, /¡\$\{ex\.name\} completo! ≈ \$\{k\.kcal\} kcal \(estimación\)\./);
  assert.match(html, /Cargá tu peso en Perfil para estimar las calorías\./, 'sin peso se pide cargarlo');
  assert.match(html, /const bySets=session\.exercises\.reduce\(\(a,e\)=>a\+\(exerciseKcal\(e\)\.kcal\|\|0\),0\);if\(bySets>rec\.kcal\)/, 'se usa el mayor entre la duración y las series');
  assert.match(html, /function workoutKcalSummary\(x\)/);
  assert.match(html, /Calorías gastadas \(estimación\)/); assert.match(html, /data-go-profile-weight/);
  assert.match(html, /Récord nuevo/, 'el resumen muestra los récords que superaste en la sesión');
});

test('tarjeta «Entrenamiento diario» en espera: anillo con tamaño y relleno definidos (sin círculo negro)', () => {
  assert.match(html, /<div class="daily-ring" role="img"/);
  assert.match(css, /\.daily-ring svg\{display:block;width:88px;height:88px/);
  assert.match(css, /\.daily-ring circle\{fill:none;/);
});

test('Mi semana compacta: 7 días en una fila y una hoja para elegir con dibujos de músculos', () => {
  assert.match(css, /\.wp-days\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(html, /<dialog class="wp-sheet" id="wpSheet"/);
  assert.match(html, /sheet\.showModal\(\)/);
  assert.match(html, /function weekDayFigure\(groups,opts=\{\}\)/);
  assert.match(html, /class="wp-opt\$\{is\('focus',k\)\?' active':''\}" data-wp-set="focus:\$\{k\}"/);
  for (const sel of ['data-wp-day', 'data-wp-set="rest"', 'data-wp-set="none"', 'data-wp-close', 'data-wp-groups-save']) assert.ok(html.includes(sel), sel);
});

test('revisión visual: encabezados finos, sin tarjetas anidadas en Entrenar y combinaciones visibles', () => {
  assert.match(css, /\.section-hero\{min-height:0!important;padding:13px 16px!important/);
  assert.match(css, /\.train-launch \.focus-picker\{[^}]*border:0;/);
  assert.match(css, /\.focus-split \.ff-chips\{flex-wrap:wrap;overflow:visible\}/);
  assert.match(css, /\.hydro-timeline li\.hydro-empty\{display:block;flex:0 0 100%/);
});

test('textos nuevos traducidos', () => {
  for (const s of ['Calorías gastadas (estimación)', 'Cargá tu peso', 'Récord nuevo', 'Tocá un día para cambiarlo.', 'Lo decido ese día', 'Recuperación', 'para el próximo'])
    assert.ok(i18n.includes(JSON.stringify(s) + ','), s);
  for (const re of ['completo! ≈', 'Se habilita el', 'Faltan (.+) para el próximo entrenamiento diario', 'Ahora: (.+)']) assert.ok(i18n.includes(re), re);
});
