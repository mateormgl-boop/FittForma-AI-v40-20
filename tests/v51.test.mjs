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

const bodyCtx = load('body-goals.js');
const B = bodyCtx.FittFormaBody || bodyCtx.window.FittFormaBody;

test('IMC y categoría (OMS), sin clasificar a menores', () => {
  assert.equal(B.bmi(86, 178), 27.1);
  assert.equal(B.bmiCategory(27.1, 30).key, 'over');
  assert.equal(B.bmiCategory(22, 30).key, 'normal');
  assert.equal(B.bmiCategory(17, 30).key, 'under');
  assert.equal(B.bmiCategory(31, 30).key, 'obese');
  assert.equal(B.bmiCategory(22, 15).key, 'minor');
  assert.equal(B.bmi('', 178), null); assert.equal(B.bmi(80, 50), null);
});

test('cintura/altura y metabolismo basal (Mifflin-St Jeor, Katch-McArdle)', () => {
  assert.deepEqual({ ...B.waistToHeight(94, 178) }, { ratio: 0.53, ok: false });
  assert.equal(B.waistToHeight('', 178), null);
  assert.equal(B.bmr({ sex: 'male', weightKg: 86, heightCm: 178, age: 30 }).kcal, 1830);
  assert.equal(B.bmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 }).kcal, 1320);
  const anon = B.bmr({ sex: '', weightKg: 60, heightCm: 165, age: 30 });
  assert.equal(anon.kcal, 1400); assert.equal(anon.approximate, true);
  const k = B.bmr({ weightKg: 80, bodyFatPct: 20 });
  assert.equal(k.method, 'katch'); assert.equal(k.kcal, 1750);
  assert.equal(B.bmr({ weightKg: 80 }), null, 'sin altura ni edad no se inventa');
  assert.equal(B.tdee(1830, 'moderate'), 2840);
});

test('resumen del objetivo: calorías, proteína, agua y fecha estimada', () => {
  const r = B.summary({ sex: 'male', age: '30', heightCm: '178', currentWeightKg: '86', targetWeightKg: '78', activityLevel: 'moderate', bodyGoal: 'lose', weeklyRateKg: '0.5' }, '2026-10-19');
  assert.equal(r.direction, 'lose'); assert.equal(r.tdee, 2840); assert.equal(r.calories, 2300);
  assert.equal(r.proteinG, 155); assert.equal(r.waterMl, 2800); assert.equal(r.diffKg, -8);
  assert.equal(r.weeksToGoal, 17); assert.equal(r.etaDate, '2027-02-15');
  assert.deepEqual([...r.warnings], []);
});

test('resumen: avisos honestos y sin inventar datos', () => {
  const empty = B.summary({}, '2026-10-19');
  assert.equal(empty.calories, null); assert.equal(empty.bmi, null); assert.deepEqual([...empty.missing], ['peso', 'altura', 'edad']);
  const minor = B.summary({ age: '16', heightCm: '170', currentWeightKg: '60', targetWeightKg: '55' }, '2026-10-19');
  assert.equal(minor.calories, null); assert.equal(minor.etaDate, undefined); assert.ok(minor.warnings[0].includes('menores'));
  const fast = B.summary({ sex: 'female', age: '30', heightCm: '165', currentWeightKg: '60', targetWeightKg: '55', activityLevel: 'sedentary', bodyGoal: 'lose', weeklyRateKg: '0.75' }, '2026-10-19');
  assert.ok(fast.warnings.some(w => w.includes('1 %')));
  assert.ok(fast.calories >= 1200, 'nunca por debajo del mínimo'); assert.ok(fast.warnings.some(w => w.includes('18,5')) === false);
  const wrong = B.summary({ age: '30', heightCm: '170', currentWeightKg: '70', targetWeightKg: '80', bodyGoal: 'lose' }, '2026-10-19');
  assert.ok(wrong.warnings.some(w => w.includes('mayor que tu peso actual')));
  const dated = B.summary({ age: '30', heightCm: '170', currentWeightKg: '70', targetWeightKg: '66', targetDate: '2026-12-14' }, '2026-10-19');
  assert.equal(dated.direction, 'lose'); assert.equal(dated.requiredRateKg, 0.5);
  const past = B.summary({ age: '30', heightCm: '170', currentWeightKg: '70', targetWeightKg: '66', targetDate: '2026-10-01' }, '2026-10-19');
  assert.ok(past.warnings.some(w => w.includes('ya pasó')));
  const thin = B.summary({ age: '30', heightCm: '180', currentWeightKg: '62', targetWeightKg: '58' }, '2026-10-19');
  assert.ok(thin.warnings.some(w => w.includes('18,5')));
  assert.equal(B.goalProgress(90, 86, 80), 40); assert.equal(B.goalProgress(90, 92, 80), 0); assert.equal(B.goalProgress(80, 80, 80), null);
});

test('«Objetivo y actualidad» en Perfil e Inicio, privado y cargado por la app', () => {
  for (const id of ['bodyProfileCard', 'bodyProfileForm', 'profileSex', 'profileAge', 'profileHeight', 'profileCurrentWeight', 'profileWaist', 'profileBodyFat', 'profileActivityLevel', 'profileBodyGoal', 'profileTargetWeight', 'profileWeeklyRate', 'profileTargetDate', 'bodyGoalGlance', 'bodyGoalResults', 'applyBodyGoals', 'homeBodyGoal'])
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `id único: ${id}`);
  assert.match(html, /<h3 id="bodyGoalTitle">Objetivo y actualidad<\/h3>/);
  assert.match(html, /<option value="">Prefiero no decir<\/option><option value="female">Femenino<\/option><option value="male">Masculino<\/option>/);
  assert.match(html, /nunca se muestran en Comunidad/);
  assert.match(html, /<script src="\.\/body-goals\.js"><\/script>/);
  const server = readFileSync('backend/server.mjs', 'utf8'), sw = readFileSync('sw.js', 'utf8'), community = readFileSync('community.js', 'utf8');
  assert.match(server, /'\/body-goals\.js'/); assert.match(sw, /\.\/body-goals\.js/);
  assert.doesNotMatch(community, /heightCm|currentWeightKg|waistCm|bodyFatPct|profile\.sex/, 'Comunidad no lee datos corporales');
});
