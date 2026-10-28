// v58: Mi semana (qué entrenar cada día), rutinas listas y recomendada, Inicio personalizable, menú según el objetivo,
// «Completá tu día» e insignias metálicas con la galería «Sistema de insignias».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const load = (...files) => { const ctx = { window: {} }; ctx.globalThis = ctx; for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), ctx); return ctx.window; };
const T = load('training-core.js').FittFormaTraining;
const W = load('food-db.js', 'nutrition-guides.js'), NG = W.FittFormaNutritionGuides, DB = W.FittFormaFoodDb;
const E = load('achievements.js').FittFormaBadgeEngine;
const html = readFileSync('index.html', 'utf8'), css = readFileSync('design.css', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');
const plain = x => JSON.parse(JSON.stringify(x));
const ago = (today, n) => new Date(new Date(today + 'T12:00:00').getTime() - n * 864e5).toISOString().slice(0, 10);
const ex = (name, group, done = 3) => ({ name, group, entries: Array.from({ length: done }, () => ({ reps: '10', weight: '40', done: true })) });

test('Mi semana: días de lunes (1) a domingo (7) y cada rutina lista arma una semana válida', () => {
  assert.equal(T.weekdayOf('2026-10-26'), 1); assert.equal(T.weekdayOf('2026-11-01'), 7); assert.equal(T.weekdayOf('no'), 0);
  assert.ok(Object.keys(T.PROGRAMS).length >= 10);
  for (const [id, p] of Object.entries(T.PROGRAMS)) {
    const w = plain(T.programWeek(id));
    assert.equal(Object.keys(w).length, 7, id);
    const train = Object.values(w).filter(d => d.kind === 'focus');
    assert.equal(train.length, Object.keys(p.days).length, `${id}: días de entrenamiento`);
    for (const d of train) { assert.ok(T.FOCUS[d.key], `${id}: ${d.key}`); assert.ok(T.buildFocusDay(d.key, { equipment: p.equipment[0] }).exercises.length >= 3, `${id}: ${d.key} sin ejercicios`); }
    assert.ok(p.levels.length && p.goals.length && p.equipment.length && p.desc);
  }
  assert.equal(T.programWeek('nope'), null);
});

test('qué toca hoy: primero lo que elegiste para el día; si no, lo que hace más que no entrenás', () => {
  const today = '2026-10-28'; // miércoles
  assert.deepEqual(plain(T.recommendToday({}, [], { 3: { kind: 'focus', key: 'back_biceps' } }, today)), { source: 'week', weekday: 3, day: { kind: 'focus', key: 'back_biceps' } });
  assert.equal(T.recommendToday({}, [], { 3: { kind: 'rest' } }, today).day.kind, 'rest');
  const none = T.recommendToday({ level: 'beginner' }, [], null, today);
  assert.equal(none.source, 'none'); assert.equal(none.day.key, 'full', 'sin historial, principiante empieza por cuerpo completo');
  const sessions = [{ date: ago(today, 1), title: 'Pecho y tríceps', exercises: [ex('Press de banca con barra', 'Pecho'), ex('Extensión de tríceps en polea', 'Brazos')] },
    { date: ago(today, 3), title: 'Espalda y bíceps', exercises: [ex('Jalón al pecho', 'Espalda'), ex('Curl de bíceps con mancuernas', 'Brazos')] }];
  const r = T.recommendToday({}, sessions, null, today);
  assert.equal(r.source, 'history'); assert.ok(['legs', 'shoulders_core', 'glutes'].includes(r.day.key), r.day.key);
  assert.match(r.reason, /no registraste|no entrenás/);
  const h = T.groupHistory(sessions, today, 14);
  assert.equal(h.chest.sets, 3); assert.equal(h.chest.last, ago(today, 1)); assert.equal(h.legs_quads.sets, 0);
  assert.equal(T.groupHistory([{ date: ago(today, 1), exercises: [{ name: 'Press de banca con barra', entries: [{ reps: '10', done: false }] }] }], today).chest.sets, 0, 'series sin completar no cuentan');
});

test('rutina recomendada: objetivo, nivel, equipamiento, días y lo que venís haciendo, siempre con motivos', () => {
  const today = '2026-10-28';
  const sessions = [{ date: ago(today, 2), title: 'Pecho y tríceps', exercises: [ex('Press de banca con barra', 'Pecho')] }, { date: ago(today, 4), title: 'Espalda y bíceps', exercises: [ex('Jalón al pecho', 'Espalda')] }];
  const list = T.recommendPrograms({ goal: 'muscle', level: 'intermediate', equipment: 'gym', days: 4 }, sessions, today);
  assert.equal(list[0].id, 'pairs4');
  assert.ok(list[0].reasons.some(x => /Se parece a lo que venís haciendo/.test(x)));
  assert.ok(list[0].reasons.some(x => /piernas/.test(x)), 'avisa los grupos que quedaron sin entrenar');
  const home = T.recommendPrograms({ goal: 'lose', level: 'beginner', equipment: 'bodyweight', days: 3 }, [], today);
  assert.ok(home[0].fits && ['home3', 'full3'].includes(home[0].id), home[0].id);
  assert.ok(home.filter(x => !x.fits).every(x => !T.PROGRAMS[x.id].equipment.includes('bodyweight')), 'no recomienda rutinas de gimnasio sin equipo');
  const strength = T.recommendPrograms({ goal: 'strength', level: 'beginner', equipment: 'gym', days: 3 }, [], today);
  assert.equal(strength[0].id, 'strength3');
});

test('Mi semana en la app: se guarda saneada y la división vieja se oculta cuando la usás', () => {
  assert.match(html, /function sanitizeWeekPlan\(/); assert.match(html, /out\.weekPlan=sanitizeWeekPlan\(st\.weekPlan\);/);
  assert.match(html, /const splitBox=T\.SPLIT_PLANS&&!Object\.keys\(state\.weekPlan\?\.days\|\|\{\}\)\.length\?/);
  for (const sel of ['data-wp-day', 'data-wp-set', 'data-wp-program', 'data-wp-perweek', 'wpStartToday', 'wpProgramsToggle']) assert.ok(html.includes(sel), sel);
});

test('Inicio personalizable: todas las tarjetas son bloques que se pueden ordenar u ocultar', () => {
  const blocks = [...html.matchAll(/data-home-block="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(blocks)].sort(), ['badges', 'body', 'gym', 'habits', 'quote', 'recent', 'stats', 'summary', 'tiles', 'today', 'week']);
  const order = html.match(/const HOME_DEFAULT_ORDER=(\[[^\]]+\])/)[1];
  assert.deepEqual(plain(vm.runInNewContext(order)).sort(), [...new Set(blocks)].sort(), 'el orden por defecto incluye todas');
  assert.match(html, /id="homeLayoutDialog"/); assert.match(html, /function applyHomeLayout\(/); assert.match(html, /function repeatSession\(/);
  assert.match(css, /\.home-block\{display:contents\}/);
  assert.match(html, /Lo que hiciste en el gym/);
});

test('menú según el objetivo: alimentos de la base, porciones razonables y cerca de las calorías y la proteína', () => {
  for (const list of Object.values(NG.MENU_OPTIONS)) for (const o of list) for (const [id] of o.items) assert.ok(DB.some(f => f.id === id), `${o.id}: falta ${id}`);
  for (const s of NG.SNACKS) for (const [id] of s.items) assert.ok(DB.some(f => f.id === id), `${s.id}: falta ${id}`);
  for (const [goal, kcal, protein] of [['lose', 1800, 140], ['maintain', 2300, 110], ['muscle', 2900, 150], ['strength', 3200, 160], ['endurance', 2600, 120]]) {
    for (const pick of [0, 1, 2]) {
      const m = NG.dailyMenu(DB, { goal, kcal, protein }, { Desayuno: pick, Almuerzo: pick, Merienda: pick, Cena: pick });
      assert.equal(m.meals.length, 4);
      assert.ok(Math.abs(m.totals.kcal - kcal) / kcal < 0.16, `${goal}/${pick}: ${m.totals.kcal} kcal`);
      assert.ok(m.totals.protein >= protein * 0.85, `${goal}/${pick}: ${m.totals.protein} g`);
      for (const meal of m.meals) for (const it of meal.items) assert.ok(it.grams >= 5 && it.grams <= 450, `${meal.name}: ${it.grams} g de ${it.name}`);
    }
  }
  const a = NG.dailyMenu(DB, { goal: 'lose' }, {}), b = NG.dailyMenu(DB, { goal: 'lose' }, { Desayuno: 1 });
  assert.notEqual(a.meals[0].name, b.meals[0].name, '«Otra opción» cambia la comida');
});

test('«Completá tu día»: opciones que entran en lo que falta y nada si ya llegaste', () => {
  const r = NG.completeDay(DB, { goal: 'lose', kcalLeft: 300, proteinLeft: 40 });
  assert.equal(r.status, 'protein'); assert.ok(r.options.length >= 2);
  for (const o of r.options) { assert.ok(o.totals.kcal <= 320, `${o.name}: ${o.totals.kcal}`); assert.ok(o.totals.protein * 4 / o.totals.kcal > 0.3, `${o.name} tiene que ser rica en proteína`); }
  assert.equal(NG.completeDay(DB, { kcalLeft: 50, proteinLeft: 5 }).status, 'done');
  assert.deepEqual(plain(NG.completeDay(DB, { kcalLeft: 50, proteinLeft: 40 })), { status: 'kcal-reached', options: [] }, 'sin calorías no sugiere comer más');
  assert.match(html, /id="completeDayCard"/); assert.match(html, /id="goalMenuCard"/); assert.match(html, /id="generateMenu"/);
});

test('insignias metálicas: contorno propio por rango, borde con bisel, Diamante con destellos y Legendario con corona', () => {
  const svg = r => E.medalSvg({ rankKey: r, numeral: 'II', glyph: 'pullup', category: 'calisthenics' });
  assert.equal(new Set(['bronze', 'silver', 'gold', 'diamond', 'legend'].map(r => svg(r).match(/class="ff-medal-shape" d="([^"]+)"/)[1])).size, 5);
  for (const r of ['Bronze', 'Silver', 'Gold', 'Diamond', 'Legend']) { assert.ok(html.includes(`id="ffRim${r}"`) && html.includes(`id="ffBevel${r}"`) && html.includes(`id="ffFace2${r}"`), r); }
  assert.match(svg('bronze'), /fill="url\(#ffBevelBronze\)"/); assert.match(svg('diamond'), /ff-medal-spark/); assert.match(svg('legend'), /ff-medal-crown/);
  assert.doesNotMatch(svg('gold'), /ff-medal-laurel/);
  assert.match(html, /class="badge-system"/); assert.match(html, /class="badge-row-card"/);
  assert.match(html, /\$\{Math\.max\(0,progress\.highest\+1\)\}\/\$\{thresholds\.length\}/, 'la ficha cuenta sobre 15 niveles');
});

test('textos nuevos traducidos', () => {
  for (const t of ['Mi semana', 'Rutinas listas', 'Recomendada para vos', 'Personalizar inicio', 'Lo que hiciste en el gym', 'Completá tu día', 'Menú de ejemplo según tu objetivo', 'Sistema de insignias', 'Pares clásicos 4 días']) assert.ok(i18n.includes(`["${t}", "`), t);
});

test('Nutrición: cada pestaña cierra bien (las recetas quedan solo en Plan)', () => {
  const a = html.indexOf('<section class="view" id="view-nutrition">'), b = html.indexOf('</section>', a), seg = html.slice(a, b);
  assert.equal((seg.match(/<div\b/g) || []).length, (seg.match(/<\/div>/g) || []).length, 'mismas aperturas y cierres de <div>');
  const plan = seg.indexOf('data-view-panel="plan"'), hist = seg.indexOf('data-view-panel="historial"'), rec = seg.indexOf('id="recipesCard"');
  assert.ok(plan < rec && rec < hist, 'las recetas están dentro de la pestaña Plan');
});

test('las figuras del centro de las insignias son siluetas rellenas', () => {
  for (const [k, g] of Object.entries(E.GLYPHS)) assert.match(g, /class="gf"/, `${k} tiene que tener partes rellenas`);
  for (const k of ['pullup', 'pushup', 'squat', 'run', 'ohp', 'dips', 'lunge']) assert.match(E.GLYPHS[k], /class="lb"/, `${k}: extremidades gruesas`);
  assert.match(E.GLYPHS.biceps, /class="lbx"/, 'el bíceps es un brazo flexionado musculoso');
  assert.match(css, /\.ff-medal \.ff-medal-glyph \.lb\{fill:none;stroke-width:5\.2!important\}/);
});
