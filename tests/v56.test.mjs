// v56: Hidratación, 31 ejercicios nuevos, biblioteca mejorada, progresión con números, división semanal,
// calendario del mes, series por grupo, repetir comidas y Perfil más ordenado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const load = file => { const ctx = { window: {} }; ctx.globalThis = ctx; vm.runInNewContext(readFileSync(file, 'utf8'), ctx); return ctx.window; };
const T = load('training-core.js').FittFormaTraining;
const guides = load('exercise-guides.js').FittFormaExerciseGuides;
const gifs = load('exercise-gifs.js').FittFormaExerciseGifs;
const media = load('exercise-media.js').FittFormaExerciseMedia;
const B = load('achievements.js').FittFormaBadgeEngine;
const html = readFileSync('index.html', 'utf8'), sources = readFileSync('assets/exercises/lib/SOURCES.md', 'utf8');
const NEW = [...html.match(/const NEW_EXERCISES_V56=new Set\((\[[^\]]+\])\)/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

test('31 ejercicios nuevos, cada uno completo: biblioteca, ficha, animación, fotos con fuente y músculos', () => {
  assert.equal(NEW.length, 31);
  assert.equal(T.allExercises().length, 187);
  const byName = new Map(guides.map(g => [g.name, g]));
  for (const n of NEW) {
    const e = T.libraryEntry(n); assert.ok(e, `${n} no está en la biblioteca`);
    const g = byName.get(n); assert.ok(g, `${n} sin ficha`);
    assert.ok(g.steps.length >= 4 && g.errors.length >= 3 && g.tips.length >= 3 && g.alternatives.length >= 3 && g.start && g.breathing && g.primary);
    for (const a of g.alternatives) assert.ok(T.libraryEntry(a), `${n}: la alternativa «${a}» no existe`);
    assert.ok(gifs[n] && existsSync('assets/exercises/' + gifs[n].file), `${n} sin animación`);
    assert.ok(gifs[n].muscles.length, `${n} sin músculos`);
    const m = media[n]; assert.equal(m.kind, 'photo'); assert.equal(m.frames.length, 2);
    for (const f of m.frames) { assert.ok(existsSync('assets/exercises/' + f)); assert.ok(sources.includes('`' + f.replace('lib/', '') + '`'), `${f} sin fuente en SOURCES.md`); }
  }
});

test('los ejercicios nuevos van al final: los planes generados antes no cambian por agregarlos', () => {
  for (const mode of ['gym', 'home', 'bodyweight']) {
    const list = T.LIBRARY[mode].map(e => e.name), first = list.findIndex(n => NEW.includes(n));
    assert.ok(list.slice(first).every(n => NEW.includes(n)), `${mode}: hay ejercicios viejos después de los nuevos`);
  }
});

test('insignias: «Press militar con barra de pie» y «Sentadilla trasera con barra» cuentan para su desafío de carga', () => {
  assert.equal(B.loadChallengeFor('Press militar con barra de pie')?.id, 'load-press-militar');
  assert.equal(B.loadChallengeFor('Press militar con barra')?.id, 'load-press-militar');
  assert.equal(B.loadChallengeFor('Sentadilla trasera con barra')?.id, 'load-sentadilla');
  assert.equal(B.loadChallengeFor('Press militar con mancuernas'), null, 'las mancuernas siguen sin contar como barra');
});

test('progresión doble con números, sin inventar cargas', () => {
  const E = (r, w, d = true) => ({ reps: String(r), weight: w == null ? '' : String(w), done: d });
  assert.deepEqual({ ...T.suggestProgression([E(12, 30), E(12, 30), E(12, 30)], '8–12') }, { kind: 'load', weight: 32, reps: 8, unit: 'reps' });
  assert.deepEqual({ ...T.suggestProgression([E(10, 30), E(9, 30), E(8, 30)], '8–12') }, { kind: 'reps', weight: 30, reps: 9, unit: 'reps' });
  assert.equal(T.suggestProgression([E(7, 30), E(6, 30)], '8–12').kind, 'repeat');
  assert.equal(T.suggestProgression([E(12, 30), E(12, 30, false)], '8–12').kind, 'repeat', 'si una serie no se completó, no se sube');
  assert.deepEqual({ ...T.suggestProgression([E(15), E(15)], '10–15') }, { kind: 'reps', weight: 0, reps: 16, unit: 'reps' });
  assert.equal(T.suggestProgression([E(45), E(45)], '30–45 seg', 'seconds').reps, 50);
  assert.equal(T.suggestProgression([E(10, 50), E(10, 50)], '6–10').weight, 52.5);
  assert.equal(T.suggestProgression([], '8–12'), null);
  assert.match(html, /placeholder="\$\{load\?\(e\.targetWeight\?esc\(e\.targetWeight\):\(suggestedWeightFor\(e\)\|\|'kg'\)\):'\+kg'\}"/, 'la sugerencia es un placeholder, no un valor cargado');
});

test('división semanal: «Hoy toca» sigue a la última hecha de esa división', () => {
  assert.deepEqual(Object.keys(T.SPLIT_PLANS), ['ppl', 'upper_lower', 'pairs', 'antagonists', 'full']);
  for (const p of Object.values(T.SPLIT_PLANS)) for (const k of p.focus) assert.ok(T.FOCUS[k], k);
  assert.equal(T.nextFocusInSplit('ppl', []).key, 'push');
  assert.equal(T.nextFocusInSplit('ppl', [{ date: '2026-10-20', title: 'Empuje' }, { date: '2026-10-22', title: 'Tracción' }]).key, 'legs');
  assert.equal(T.nextFocusInSplit('ppl', [{ date: '2026-10-24', title: 'Piernas' }, { date: '2026-10-22', title: 'Tracción' }]).key, 'push', 'vuelve a empezar');
  assert.equal(T.nextFocusInSplit('upper_lower', [{ date: '2026-10-22', title: 'Otra cosa' }]).key, 'upper');
  assert.equal(T.nextFocusInSplit('nope', []), null);
  assert.match(html, /id="focusSplitPlan"/); assert.match(html, /Hoy toca/);
});

test('biblioteca y ficha: filtros, orden, lista, historial, agregar a rutina, alternativas tocables', () => {
  for (const id of ['exerciseLevelFilter', 'exerciseKindFilter', 'exerciseSort', 'exerciseModalHistory', 'exerciseModalAddRoutine']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-library-view="list"/); assert.match(html, /function exerciseUsage\(/);
  assert.match(html, /class="ex-alt" data-exercise-detail=/, 'las alternativas abren su ficha');
  assert.match(html, /const e1rm=\(w,r\)=>w>0&&r>=1&&r<=12\?w\*\(1\+r\/30\):0/, 'Epley solo de 1 a 12 repeticiones');
});

test('Progreso, Nutrición, Perfil e Hidratación', () => {
  assert.match(html, /id="monthCalendarCard"/); assert.match(html, /id="muscleWeekCard"/);
  assert.match(html, /function repeatMealsFrom\(/); assert.match(html, /have\.has\(`\$\{m\.type\}\|\$\{m\.name\}`\)/, 'no duplica comidas ya registradas hoy');
  assert.match(html, /id="bodyEditDetails"/); assert.match(html, /id="view-settings"[^]*?<h2>Ajustes<\/h2>/, 'v69: los ajustes tienen su propia sección');
  assert.doesNotMatch(html, />\+1 vaso de agua</, 'el acceso se llama Hidratación');
  assert.match(html, /<b>Hidratación<\/b>/);
});
