// v64: entrenamiento — orden real de los ejercicios (un grupo completo antes del siguiente, de lo más pesado a lo más
// liviano), trapecio y antebrazos, sesiones de más de 60 minutos con tiempo estimado, calculadora de RM y aviso de salud.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import '../training-core.js';

const T = globalThis.FittFormaTraining;
const html = readFileSync('index.html', 'utf8'), server = readFileSync('backend/server.mjs', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');
const tierOf = name => T.libraryEntry(name)?.tier;

test('pecho y tríceps: primero todo el pecho (de lo más pesado a lo más liviano) y después el tríceps', () => {
  for (const level of ['beginner', 'intermediate', 'advanced']) for (const equipment of ['gym', 'home']) {
    const d = T.buildGroupsDay(['chest', 'triceps'], { goal: 'muscle', level, equipment, duration: '45' });
    const groups = d.exercises.map(e => T.groupsOfExercise(e)[0]);
    const firstTri = groups.indexOf('triceps');
    assert.ok(firstTri > 0, `${level}/${equipment}: hay pecho antes del tríceps`);
    assert.ok(groups.slice(firstTri).every(g => g === 'triceps'), `${level}/${equipment}: no vuelve al pecho después del tríceps — ${d.exercises.map(e => e.name).join(' | ')}`);
    const rank = { main: 0, secondary: 1, iso: 2 }, chestTiers = d.exercises.slice(0, firstTri).map(e => rank[tierOf(e.name)] ?? 2);
    assert.deepEqual(chestTiers, [...chestTiers].sort((a, b) => a - b), `${level}/${equipment}: dentro del pecho, principales primero`);
  }
});

test('el orden no cambia qué ejercicios se eligen y respeta los grupos de «Empuje»', () => {
  const d = T.buildFocusDay('push', { goal: 'strength', level: 'advanced', equipment: 'gym', duration: '60' });
  const order = ['chest', 'shoulders', 'triceps'], seen = d.exercises.map(e => order.indexOf(T.groupsOfExercise(e)[0])).filter(x => x >= 0);
  assert.deepEqual(seen, [...seen].sort((a, b) => a - b));
});

test('trapecio y antebrazos se pueden elegir y usan ejercicios que ya tienen ficha', () => {
  assert.equal(T.MUSCLE_GROUPS.traps.label, 'Trapecio');
  assert.equal(T.MUSCLE_GROUPS.forearms.label, 'Antebrazos');
  const gym = T.buildGroupsDay(['traps', 'forearms'], { goal: 'muscle', level: 'intermediate', equipment: 'gym', duration: '45' });
  assert.deepEqual(gym.missing, []);
  assert.ok(gym.exercises.some(e => /Encogimientos/.test(e.name)) && gym.exercises.some(e => /Curl (inverso|martillo)/.test(e.name)));
  const home = T.buildGroupsDay(['traps'], { goal: 'muscle', level: 'beginner', equipment: 'home', duration: '30' });
  assert.ok(home.exercises.some(e => /Encogimientos con mancuernas/.test(e.name)), 'en casa, encogimientos con mancuernas');
  const bw = T.buildGroupsDay(['forearms'], { goal: 'muscle', level: 'beginner', equipment: 'bodyweight', duration: '30' });
  assert.deepEqual(bw.missing, ['Antebrazos'], 'sin equipamiento, se avisa que no hay ejercicio (no se inventa)');
});

test('más de 60 minutos: más ejercicios y series; el tiempo estimado se acerca a lo elegido', () => {
  const mins = m => { const d = T.buildFocusDay('push', { goal: 'muscle', level: 'intermediate', equipment: 'gym', duration: String(m) }); return T.estimateMinutes(d.exercises); };
  assert.ok(mins(30) <= 35, `30 min → ${mins(30)}`);
  assert.ok(mins(60) >= 50 && mins(60) <= 66, `60 min → ${mins(60)}`);
  assert.ok(mins(90) > mins(60), `90 min (${mins(90)}) > 60 min (${mins(60)})`);
  assert.ok(T.exerciseCountFor({ duration: '90', level: 'advanced', goal: 'muscle' }) > T.exerciseCountFor({ duration: '60', level: 'advanced', goal: 'muscle' }));
  for (const sel of ['id="duration"', 'id="prefDuration"']) assert.match(html, new RegExp(`${sel}>[^]*?<option value="75">[^]*?<option value="90">[^]*?<option value="120">Más de 90`));
  assert.match(server, /\[20,30,45,60,75,90,120\]\.includes\(duration\)/);
});

test('calculadora de RM (Epley) y «si con X hago Y, con W haría ~Z»', () => {
  const one = T.oneRepMax(100, 10);
  assert.equal(Math.round(one * 10) / 10, 133.3);
  assert.equal(T.oneRepMax(80, 1), 80);
  assert.equal(T.oneRepMax(0, 5), 0);
  assert.equal(Math.round(T.weightForReps(one, 10)), 100);
  assert.equal(T.repsAtWeight(one, 100), 10);
  assert.equal(T.repsAtWeight(one, 140), 0, 'más que el 1RM: ni una');
  assert.match(html, /function openRmCalculator\(opts=\{\}\)/);
  assert.match(html, /data-session-rm=/); assert.match(html, /data-ex-rm/); assert.match(html, /data-open-rm/);
});

test('aviso de salud visible: la primera vez que se entrena y en cada ficha', () => {
  assert.match(html, /Si tenés molestias o dolor en alguna articulación o músculo, consultá con un profesional de la salud antes de hacer estos ejercicios/);
  assert.match(html, /<p class="ex-health" role="note">Si tenés molestias o dolor/);
  assert.match(html, /healthNoticeMarkup\(\)\+exerciseStripMarkup\(\)/);
});

test('la rutina explica qué cambió según las opciones, y todo está traducido', () => {
  assert.match(html, /function planChoicesMarkup\(p\)/);
  for (const s of ['Más de 90 minutos', 'Trapecio', 'Antebrazos', 'Calculadora de RM', 'Antes de empezar', 'Cómo la armamos', 'Cada grupo muscular se termina antes de pasar al siguiente, empezando por los ejercicios más pesados.'])
    assert.ok(i18n.includes(JSON.stringify(s) + ','), s);
  assert.ok(i18n.includes('harías, en teoría, unas'), 'respuesta de la calculadora');
});
