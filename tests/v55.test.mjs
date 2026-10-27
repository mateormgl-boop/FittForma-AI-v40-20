// v55: entrenar por grupos musculares, «Lo hice» desde la ficha, rango junto al nombre, Músculos y guía de alimentación.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = file => { const ctx = { window: {} }; ctx.globalThis = ctx; vm.runInNewContext(readFileSync(file, 'utf8'), ctx); return ctx.window; };
const T = load('training-core.js').FittFormaTraining;
const NG = load('nutrition-guides.js').FittFormaNutritionGuides;
const DB = load('food-db.js').FittFormaFoodDb;
const MR = load('muscle-ranks.js').FittFormaMuscleRanks;
const html = readFileSync('index.html', 'utf8'), community = readFileSync('community.js', 'utf8'), sw = readFileSync('sw.js', 'utf8'), server = readFileSync('backend/server.mjs', 'utf8');

test('combinaciones habituales: cada una arma una sesión con ejercicios reales de sus grupos', () => {
  const gym = { equipment: 'gym', level: 'intermediate', goal: 'muscle' };
  for (const key of ['push', 'pull', 'legs', 'upper', 'lower', 'chest_triceps', 'back_biceps', 'shoulders_core', 'chest_back', 'arms', 'full']) {
    assert.ok(T.FOCUS[key], key);
    const day = T.buildFocusDay(key, gym);
    assert.ok(day && day.exercises.length >= 4 && day.exercises.length <= 8, `${key}: ${day?.exercises.length}`);
    assert.deepEqual([...day.missing], [], `${key} con gimnasio no debería tener grupos sin ejercicios`);
    const names = day.exercises.map(e => e.name);
    assert.equal(new Set(names).size, names.length, `${key}: sin repetidos`);
    for (const e of day.exercises) assert.ok(T.libraryEntry ? T.libraryEntry(e.name) || T.allExercises().some(x => x.name === e.name) : true, `${e.name} existe en la biblioteca`);
  }
  assert.deepEqual([...T.FOCUS.pull.groups], ['back', 'rear_delts', 'biceps'], 'tracción: espalda, deltoides posterior y bíceps');
  assert.deepEqual([...T.FOCUS.push.groups], ['chest', 'shoulders', 'triceps'], 'empuje: pecho, hombros y tríceps');
});

test('elegir grupos a mano: reparte entre los grupos y avisa lo que no hay con tu equipo', () => {
  const day = T.buildGroupsDay(['chest', 'biceps'], { equipment: 'gym' });
  const groups = new Set(day.exercises.map(e => e.group));
  assert.ok(groups.has('Pecho') && groups.has('Brazos'));
  assert.equal(T.buildGroupsDay([], { equipment: 'gym' }), null, 'sin grupos no arma nada');
  assert.equal(T.buildGroupsDay(['nope'], { equipment: 'gym' }), null, 'grupos desconocidos se ignoran');
  const bw = T.buildFocusDay('pull', { equipment: 'bodyweight' });
  assert.ok(bw.missing.length >= 1, 'sin equipo no hay curl de bíceps: se informa en vez de inventar');
  assert.match(html, /function focusPickerMarkup/); assert.match(html, /bindFocusPicker\(root\)/);
  assert.match(html, /beginSession\(\{type:'custom'/, 'se entrena como sesión libre'); assert.match(html, /Guardar como rutina/);
});

test('«Lo hice»: registra un ejercicio suelto sin estimar minutos ni inventar datos', () => {
  assert.match(html, /id="exerciseQuickLog"/); assert.match(html, /renderQuickLog\(name,group,kind\);/);
  assert.match(html, /type:'manual',status:'completed',source:'quick'/);
  assert.match(html, /Sin minutos cargados no se estiman/);
  assert.match(html, /date>dateKey\(\)\)\{status\.textContent='Elegí una fecha válida que no sea futura\.'/);
  assert.match(html, /syncBadgeUnlocks\(\);checkMuscleRankUps\(\);if\(!save\(\)\)/);
});

test('Músculos: cada músculo se traduce a un grupo entrenable', () => {
  const m = html.match(/const MR_GROUP=(\{[^}]*\})/); assert.ok(m);
  const map = vm.runInNewContext('(' + m[1] + ')');
  for (const id of MR.MUSCLES) { assert.ok(map[id], `falta ${id}`); assert.ok(T.MUSCLE_GROUPS[map[id]], `${map[id]} no es un grupo`); }
  assert.match(html, /id="mrNext"/); assert.match(html, /id="mrLegend"/); assert.match(html, /Entrenar esto hoy/);
});

test('Comunidad: rango junto al nombre, mis músculos y sugeridas', () => {
  assert.match(community, /function rankMini\(/); assert.match(community, /function renderOwnRankAndMuscles\(/);
  assert.match(community, /community_suggested_profiles/); assert.match(html, /id="communityOwnRank"/); assert.match(html, /id="communityOwnMuscles"/);
  assert.match(html, /window\.FittFormaMyMuscles=/);
});

test('recetas calculadas con la base de alimentos: todas resuelven y los valores cierran', () => {
  const list = NG.recipesWithValues(DB);
  assert.equal(list.length, NG.RECIPES.length, 'ningún ingrediente queda sin encontrar');
  assert.ok(list.length >= 15);
  for (const r of list) {
    const atw = r.protein * 4 + r.carbs * 4 + r.fat * 9;
    assert.ok(Math.abs(atw - r.kcal) / r.kcal < 0.2, `${r.name}: ${r.kcal} kcal vs ${Math.round(atw)} por macros`);
    assert.ok(r.computed && r.grams > 0 && r.tags.length);
  }
  assert.equal(NG.computeRecipe({ items: [['no-existe', 100, 'x']] }, DB), null, 'si falta un alimento no se inventa');
});

test('guía por objetivo: rangos de proteína con fuente y sin datos personales inventados', () => {
  for (const k of ['lose', 'maintain', 'muscle', 'strength', 'endurance']) {
    const g = NG.GUIDES[k]; assert.ok(g, k);
    assert.ok(g.protein.min >= 1.2 && g.protein.max <= 2.4 && g.protein.min < g.protein.max);
    assert.equal(g.plate.veg + g.plate.carbs + g.plate.protein, 100);
    assert.ok(g.more.length >= 3 && g.less.length >= 2 && g.sources.length);
    for (const s of g.sources) assert.match(NG.SOURCES[s].url, /^https:\/\//);
  }
  assert.equal(NG.proteinRange('muscle', 0), null, 'sin peso no se calculan gramos');
  const r = NG.proteinRange('muscle', 70); assert.ok(r.min >= 110 && r.max <= 140);
  assert.equal(NG.guideFor({ bodyGoal: 'lose' }), 'lose');
  assert.match(html, /id="nutritionGuideCard"/); assert.match(html, /no reemplaza a un profesional/);
  assert.ok(JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]).includes('./nutrition-guides.js'));
  assert.match(server, /'\/nutrition-guides\.js'/);
});
