import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(path.join(root, 'training-core.js'));
const T = globalThis.FittFormaTraining;
const html = await readFile(path.join(root, 'index.html'), 'utf8');

const GOALS = ['fitness', 'muscle', 'strength', 'habit'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const COMBOS = [];
for (const goal of GOALS) for (const level of LEVELS) for (const days of ['2', '3', '4', '5']) for (const equipment of ['gym', 'home', 'bodyweight']) for (const duration of ['20', '30', '45', '60']) COMBOS.push({ goal, level, days, equipment, duration });
const entryOf = name => T.libraryEntry(name);
const PUSH = ['hpush', 'vpush', 'chest_iso', 'lat_raise', 'triceps', 'front_raise'];
const PULL = ['hpull', 'vpull', 'pull_iso', 'rear_delt', 'biceps', 'shrug', 'scap'];
const CORE = ['core_ae', 'core_rot', 'core_flex'];
const ISO_ORDER = { main: 0, secondary: 1, iso: 2 };

test('v48: la biblioteca no tiene duplicados con otro nombre y la movilidad no se usa como fuerza', () => {
  const all = T.allExercises();
  assert.ok(all.length >= 150, `Se esperaban al menos 150 ejercicios únicos; hay ${all.length}`);
  for (const [alias, canonical] of Object.entries(T.ALIASES)) {
    assert.ok(entryOf(canonical), `El alias ${alias} apunta a ${canonical}, que no existe`);
    assert.equal(T.canonicalName(alias), canonical);
    assert.ok(!all.some(e => T.norm(e.name) === T.norm(alias)), `${alias} sigue en la biblioteca además de ${canonical}`);
  }
  for (const name of ['Movilidad de cadera en el suelo', 'Estiramiento de flexores de cadera', 'Movilidad de tobillo contra pared', 'Círculos de brazos controlados']) assert.equal(entryOf(name).kind, 'mobility', name);
  for (const e of all) {
    assert.ok(Array.isArray(e.level) && e.level[0] <= e.level[1], `${e.name}: rango de nivel inválido`);
    if (e.kind === 'strength') assert.ok(e.slot && e.tier, `${e.name}: falta patrón o jerarquía`);
  }
  assert.equal(entryOf('Flexiones escapulares contra pared').group, 'Hombros', 'el trabajo escapular no se agrupa como pecho');
});

test('v48: el objetivo cambia la prescripción y el nivel cambia los ejercicios', () => {
  const base = { level: 'intermediate', days: '4', equipment: 'gym', duration: '60' };
  const strength = T.buildPlan({ ...base, goal: 'strength' }), muscle = T.buildPlan({ ...base, goal: 'muscle' });
  assert.notDeepEqual(strength.days.map(d => d.exercises.map(e => e.reps)), muscle.days.map(d => d.exercises.map(e => e.reps)));
  assert.equal(strength.days[0].exercises[0].reps, '4–6', 'fuerza: compuestos en rango bajo');
  assert.equal(muscle.days[0].exercises[0].reps, '6–10', 'hipertrofia: compuestos en rango moderado');
  assert.ok(strength.days[0].exercises[0].rest > muscle.days[0].exercises.at(-1).rest, 'fuerza descansa más en los compuestos');
  const adv = T.buildPlan({ goal: 'muscle', level: 'advanced', days: '3', equipment: 'bodyweight', duration: '45' }).days.flatMap(d => d.exercises.map(e => e.name));
  for (const regression of ['Flexiones contra la pared', 'Sentadilla a una silla', 'Plancha elevada contra una mesa firme']) assert.ok(!adv.includes(regression), `Avanzado no recibe ${regression}`);
});

test('v48: todas las combinaciones generan rutinas coherentes (orden, equilibrio, nivel, sin duplicados)', () => {
  for (const combo of COMBOS) {
    const plan = T.buildPlan(combo), label = JSON.stringify(combo), lv = { beginner: 1, intermediate: 2, advanced: 3 }[combo.level];
    assert.equal(plan.days.length, Number(combo.days), label);
    let push = 0, pull = 0;
    for (const day of plan.days) {
      const names = day.exercises.map(e => T.norm(e.name));
      assert.equal(new Set(names).size, names.length, `${label} ${day.title}: ejercicio repetido`);
      assert.ok(day.exercises.length >= 3 && day.exercises.length <= 7, `${label} ${day.title}: ${day.exercises.length} ejercicios`);
      const coreIdx = day.exercises.findIndex(e => CORE.includes(e.slot));
      if (coreIdx >= 0) assert.equal(coreIdx, day.exercises.length - 1, `${label} ${day.title}: el core va al final`);
      const tiers = day.exercises.filter(e => !CORE.includes(e.slot)).map(e => ISO_ORDER[entryOf(e.name).tier]);
      assert.ok(tiers[0] <= 1, `${label} ${day.title}: empieza con un aislamiento`);
      for (const e of day.exercises) {
        const meta = entryOf(e.name);
        assert.ok(meta && meta.kind === 'strength', `${label}: ${e.name} no es de fuerza`);
        assert.ok(meta.modes.includes(combo.equipment), `${label}: ${e.name} no corresponde al equipamiento`);
        if (lv === 1) assert.ok(meta.level[0] <= 1, `${label}: ${e.name} es demasiado avanzado para principiante`);
        assert.ok(e.sets >= 1 && e.sets <= 5 && e.rest >= 30 && e.rest <= 180, `${label}: ${e.name} ${e.sets} series ${e.rest}s`);
        if (PUSH.includes(e.slot)) push += e.sets; if (PULL.includes(e.slot)) pull += e.sets;
      }
      if (/superior|Empuje|Tracción/.test(day.title) && /superior/.test(day.title)) {
        assert.ok(day.exercises.some(e => PUSH.includes(e.slot)) && day.exercises.some(e => PULL.includes(e.slot)), `${label} ${day.title}: falta empuje o tracción`);
      }
      if (/inferior|Piernas/.test(day.title)) {
        assert.ok(day.exercises.some(e => ['squat', 'lunge', 'quad_iso'].includes(e.slot)), `${label} ${day.title}: sin dominante de rodilla`);
        assert.ok(day.exercises.some(e => ['hinge', 'ham_iso', 'glute'].includes(e.slot)), `${label} ${day.title}: sin cadena posterior`);
      }
    }
    assert.ok(pull >= push * 0.5 && push >= pull * 0.5, `${label}: empuje ${push} vs tracción ${pull} desequilibrados`);
  }
});

test('v48: la resistencia mantiene cardio y suma un día de fuerza de apoyo', () => {
  const plan = T.buildPlan({ goal: 'endurance', level: 'beginner', days: '3', equipment: 'home', duration: '30' });
  assert.equal(plan.days[0].exercises[0].kind, 'cardio');
  assert.ok(plan.days[2].exercises.every(e => e.kind === 'strength'));
});

test('v48: entrenamiento diario cada 12 horas con reloj del servidor', () => {
  assert.equal(T.DAILY_COOLDOWN_MS, 12 * 60 * 60 * 1000);
  const t0 = Date.parse('2026-10-17T10:00:00Z');
  assert.deepEqual(T.dailyStatus({ seq: 0 }, 3, t0), { state: 'available', nextIndex: 0, seq: 0 });
  const after = { seq: 1, nextAvailableAt: new Date(t0 + T.DAILY_COOLDOWN_MS).toISOString() };
  const st = T.dailyStatus(after, 3, t0 + 60_000);
  assert.equal(st.state, 'cooldown'); assert.equal(st.nextIndex, 1); assert.ok(st.remainingMs > 11 * 3600_000);
  assert.equal(T.dailyStatus(after, 3, t0 + T.DAILY_COOLDOWN_MS - 1).state, 'cooldown');
  assert.equal(T.dailyStatus(after, 3, t0 + T.DAILY_COOLDOWN_MS).state, 'available', 'a las 12 h exactas se habilita el siguiente');
  assert.equal(T.dailyStatus(after, 3, NaN).state, 'needs-time', 'sin hora del servidor no se habilita');
  assert.equal(T.dailyStatus({ seq: 3 }, 3, t0).nextIndex, 0, 'la progresión vuelve al día 1 del plan');
  assert.equal(T.dailyStatus({ seq: 0 }, 0, t0).state, 'no-plan');
  assert.match(T.formatRemaining(5 * 3600_000 + 12 * 60_000), /5 h 12 min/);
});

test('v48: una sesión diaria incompleta no cuenta como completa', () => {
  const ex = (planned, done) => ({ plannedSets: planned, entries: Array.from({ length: planned }, (_, i) => ({ done: i < done })) });
  assert.equal(T.evaluateDailyCompletion({ exercises: [ex(3, 3), ex(3, 3), ex(3, 2)] }).complete, true);
  assert.equal(T.evaluateDailyCompletion({ exercises: [ex(3, 3), ex(3, 3), ex(3, 0)] }).complete, false, 'un ejercicio sin series');
  assert.equal(T.evaluateDailyCompletion({ exercises: [ex(3, 1), ex(3, 1), ex(3, 1)] }).complete, false, 'menos del 70 %');
  assert.equal(T.evaluateDailyCompletion({ exercises: [] }).complete, false);
  const extraSets = T.evaluateDailyCompletion({ exercises: [{ plannedSets: 2, entries: [{ done: true }, { done: true }, { done: true }, { done: true }] }] });
  assert.equal(extraSets.completedSets, 2, 'series agregadas no inflan el porcentaje');
});

test('v48: recompensas sin duplicar: diaria 50 XP, extras con tope y parciales sin XP', () => {
  const d = '2026-10-17';
  const xp = T.sessionXp([
    { type: 'daily', date: d }, { type: 'plan_extra', date: d }, { type: 'custom', date: d }, { type: 'free', date: d },
    { type: 'manual', date: '2026-10-16' }, { type: 'daily', status: 'partial', date: d }
  ]);
  assert.equal(xp, 50 + 20 + 20 + 10, 'la tercera sesión extra del día no suma y la parcial tampoco');
  assert.equal(T.sessionXp([{ date: d }]), 50, 'sesiones de versiones anteriores conservan su valor');
});

test('v48: hidratación en ml con referencia orientativa y validación', () => {
  const entries = [{ date: '2026-10-17', ml: 250 }, { date: '2026-10-17', ml: 500 }, { date: '2026-10-16', ml: 330 }];
  assert.equal(T.hydrationDay(entries, '2026-10-17'), 750);
  assert.equal(T.hydrationDay(entries, '2026-10-15'), 0);
  assert.deepEqual(T.hydrationRecommendation(70), { low: 2100, high: 2450 });
  assert.equal(T.hydrationRecommendation(''), null);
  assert.equal(T.validWaterMl(5), null); assert.equal(T.validWaterMl(2500), null); assert.equal(T.validWaterMl(330), 330);
});

test('v48: insignias destacadas: máximo 3, mejor nivel por desafío, sin duplicar ni mezclar desafíos', () => {
  const u = (id, level, earnedAt = '2026-10-01') => [`${id}:${level}`, { id: `${id}:${level}`, exerciseId: id, exerciseName: id, level, earnedAt }];
  const unlocks = Object.fromEntries([u('flex', 1), u('flex', 2), u('flex', 3), u('flex', 4), u('plank', 2), u('run', 7), u('days', 1), u('squat', 3)]);
  const top = T.highestPerChallenge(unlocks);
  assert.equal(top.find(x => x.exerciseId === 'flex').level, 4, 'Plata I reemplaza a Bronce III en lo destacado');
  assert.equal(Object.keys(unlocks).length, 8, 'el historial no se borra');
  const auto = T.featuredBadges(unlocks);
  assert.equal(auto.length, 3);
  assert.deepEqual(auto.map(x => x.exerciseId), ['run', 'flex', 'squat'], 'automático: mayor nivel primero');
  const chosen = T.featuredBadges(unlocks, ['plank', 'plank', 'days', 'flex:1', 'squat']);
  assert.deepEqual(chosen.map(x => `${x.exerciseId}:${x.level}`), ['plank:2', 'days:1', 'flex:4'], 'selección manual sin duplicados y siempre con el mejor nivel');
  assert.equal(T.featuredBadges(unlocks, ['inexistente']).length, 3, 'solo insignias obtenidas');
});

test('v48: la app usa el núcleo, distingue tipos de sesión y pide hora al servidor', async () => {
  const server = await readFile(path.join(root, 'backend/server.mjs'), 'utf8'), sw = await readFile(path.join(root, 'sw.js'), 'utf8');
  assert.match(html, /<script src="\.\/training-core\.js"><\/script>/);
  assert.match(server, /'\/training-core\.js'/); assert.match(sw, /\.\/training-core\.js/);
  assert.match(server, /url\.pathname==='\/api\/time'/);
  assert.match(html, /fetch\('\/api\/time'/);
  assert.match(html, /supabaseClient\.rpc\('complete_daily_training'/);
  assert.match(html, /function sessionTypeTag\(s\)/);
  for (const t of ["'daily'", "'plan_extra'", "'custom'", "'free'", "'manual'"]) assert.ok(html.includes(t), t);
  assert.match(html, /id="badgeCelebration"/);
  assert.match(html, /id="featuredBadges"/);
  assert.match(html, /id="trainingPrefsForm"/);
  assert.match(html, /id="profileWeightUnit"/);
});

test('v48: la migración del entrenamiento diario es aditiva y la base controla las 12 horas', async () => {
  const sql = await readFile(path.join(root, 'supabase/migrations/2026-10-20_v48_daily_training.sql'), 'utf8');
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdelete\s+from\b|\btruncate\b|disable row level security/i);
  assert.match(sql, /interval '12 hours'/);
  assert.match(sql, /for update/);
  assert.match(sql, /unique \(user_id, seq\)/);
  assert.match(sql, /unique \(user_id, client_session_id\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.daily_training_sessions from anon, authenticated/);
});

test('v48: cada ejercicio tiene su propia imagen local, sin fotos de otro movimiento', async () => {
  const { access } = await import('node:fs/promises');
  globalThis.window = globalThis; await import(path.join(root, 'exercise-media.js'));
  const media = globalThis.FittFormaExerciseMedia;
  const owner = new Map();
  for (const e of T.allExercises()) {
    const m = media[e.name];
    assert.ok(m && Array.isArray(m.frames) && m.frames.length, `${e.name} no tiene imagen`);
    assert.ok(['photo', 'illustration'].includes(m.kind));
    for (const f of m.frames) {
      assert.doesNotMatch(f, /^https?:|reference-|unverified-generated/, `${e.name}: recurso externo o genérico ${f}`);
      await access(path.join(root, 'assets/exercises', f));
      assert.ok(!owner.has(f), `${f} se usa para ${owner.get(f)} y ${e.name}`);
      owner.set(f, e.name);
    }
    if (m.kind === 'photo' && m.frames.length === 2) assert.match(m.frames[0], new RegExp(`${T.slugify(e.name)}-0\\.webp$`));
  }
  // Casos que antes heredaban una foto incorrecta.
  assert.notEqual(media['Curl femoral tumbado'].frames[0], media['Curl de bíceps con mancuernas'].frames[0]);
  assert.match(media['Bicicleta estática'].frames[0], /bicicleta-estatica/);
  assert.match(media['Sentadilla hack en máquina'].frames[0], /sentadilla-hack/);
  assert.equal(media['Sentadilla a una silla'].kind, 'illustration', 'la silla tiene que verse');
  // Fotos compartidas solo entre variantes de carrera/caminata (misma técnica, distinta intensidad), declaradas.
  for (const [name, m] of Object.entries(media)) if (!T.libraryEntry(name)) assert.ok(m.family, `${name} comparte foto sin declararlo`);
  assert.match(html, /<script src="\.\/exercise-media\.js"><\/script>/);
  assert.doesNotMatch(html, /photoReferenceRules|exerciseReferenceAsset/, 'no quedan reglas de foto por familia');
  const sources = await readFile(path.join(root, 'assets/exercises/lib/SOURCES.md'), 'utf8');
  assert.match(sources, /Unlicense/);
  await access(path.join(root, 'assets/exercises/illustrations/README.md'));
});

test('v48: insignias con forma por rango, color por categoría y criterios corregidos', async () => {
  globalThis.window = globalThis; await import(path.join(root, 'achievements.js'));
  const E = globalThis.FittFormaBadgeEngine;
  const svg = r => E.medalSvg({ rankKey: r, numeral: 'II', glyph: 'pushup', category: 'calisthenics' });
  const shapes = ['bronze', 'silver', 'gold', 'diamond'].map(r => svg(r).match(/class="ff-medal-shape" d="([^"]+)"/)[1]);
  assert.equal(new Set(shapes).size, 4, 'cada rango tiene una forma distinta');
  assert.equal((svg('gold').match(/ff-medal-pip/g) || []).length, 2, 'el nivel II muestra 2 marcas');
  assert.notEqual(E.medalSvg({ rankKey: 'gold', glyph: 'run', category: 'running' }).match(/--medal-hue:([^"]+)/)[1], E.medalSvg({ rankKey: 'gold', glyph: 'heart', category: 'cardio' }).match(/--medal-hue:([^"]+)/)[1]);
  assert.match(html, /if\(exercise\.load&&!hasHistory\)continue;/, 'repeticiones con carga no generan desafío nuevo');
  assert.match(html, /BADGE_CHALLENGE_ALIASES/, 'las variantes suman al desafío principal');
  assert.match(html, /function celebrateBadges\(newly\)/);
});
