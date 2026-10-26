// v49 Etapa 2: mapa muscular, ficha del ejercicio, pantalla de entrenamiento y récords con datos reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFile(path.join(root, f), 'utf8');
const html = await read('index.html');
const css = await read('design.css');
const sw = await read('sw.js');
const server = await read('backend/server.mjs');

const sandbox = { window: {} }; sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
for (const f of ['anatomy.js', 'exercise-guides.js', 'exercise-media.js', 'training-core.js']) vm.runInContext(await read(f), sandbox);
const A = sandbox.window.FittFormaAnatomy;
const T = sandbox.window.FittFormaTraining;

const recStart = html.indexOf('  const TIMED_EXERCISE_RE=');
const recEnd = html.indexOf('  function renderTrainingInsights(', recStart);
const rc = {};
vm.runInNewContext(`${html.slice(recStart, recEnd)}\nglobalThis.deriveExerciseRecords=deriveExerciseRecords;`, rc);

test('mapa muscular: el texto de la ficha se traduce a regiones con identificador estable', () => {
  const cases = [
    ['Pectoral mayor', ['pectorales']],
    ['Dorsal ancho', ['dorsales']],
    ['Cuádriceps y glúteo mayor', ['cuadriceps', 'gluteos']],
    ['Isquiotibiales (bíceps femoral)', ['isquiotibiales']],
    ['Deltoides lateral', ['deltoides_lateral']],
    ['Bíceps braquial', ['biceps']],
    ['Tríceps braquial', ['triceps']],
    ['Glúteo medio', ['gluteo_medio']],
    ['Recto abdominal, oblicuos', ['abdominales', 'oblicuos']],
    ['Gastrocnemio y sóleo', ['gemelos']],
    ['Erectores espinales', ['lumbares']]
  ];
  for (const [text, ids] of cases) assert.deepEqual([...A.musclesFromText(text)].sort(), [...ids].sort(), text);
  // «bíceps femoral» no se confunde con el bíceps del brazo.
  assert.ok(!A.musclesFromText('bíceps femoral').includes('biceps'));
  for (const id of new Set(A.SHAPES.map(s => s.id))) assert.ok(A.MUSCLES[id], `región sin nombre: ${id}`);
});

test('mapa muscular: cada ficha de exercise-guides.js resalta al menos un músculo principal', () => {
  const guides = sandbox.window.FittFormaExerciseGuides;
  const sinMapa = Object.values(guides).filter(g => !/cardiovascular/i.test(g.primary) && A.musclesFromText(g.primary).length === 0).map(g => g.name);
  assert.deepEqual(sinMapa, [], 'fichas sin región principal');
  const svg = A.muscleMapSvg('Pectoral mayor', 'Tríceps y deltoides anterior');
  assert.match(svg, /class="am-m is-primary"/);
  assert.match(svg, /class="am-m is-secondary"/);
  assert.match(svg, /<title id="am\d+">Músculos trabajados: Pectorales<\/title>/);
  assert.doesNotMatch(svg, /<script|on\w+=/i);
});

test('mapa muscular: archivo propio, servido por el backend, precargado y con estilos para ambos temas', () => {
  assert.match(html, /<script src="\.\/anatomy\.js"><\/script>/);
  assert.match(server, /'\/anatomy\.js'/);
  assert.match(sw, /"\.\/anatomy\.js"/);
  assert.match(css, /:root\{--anat-body:/);
  assert.match(css, /:root\[data-theme="light"\]\{--anat-body:/);
});

test('ficha del ejercicio: mapa, músculos, equipo, nivel, tipo de movimiento, posición inicial, pasos y dosis', () => {
  for (const id of ['exerciseModalMap', 'exerciseModalMuscles', 'exerciseModalChips', 'exerciseModalStart', 'exerciseModalProgression', 'exerciseModalBreathing', 'exerciseModalErrors', 'exerciseModalTips', 'exerciseModalDose', 'exerciseModalGroup']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /function movementTypeLabel\(/);
  assert.match(html, /\$\('exerciseModalMap'\)\.innerHTML=muscleMapMarkup\(name,group,'lg'\)/);
  assert.match(html, /Tipo de movimiento/);
});

test('entrenamiento en curso: grupos, ejercicios y series completadas, volumen en vivo, récords y tabla por serie', () => {
  for (const id of ['workoutExerciseCount', 'workoutSetCount', 'workoutVolumeLive', 'workoutPrCount', 'workoutElapsedDisplay', 'finishWorkout']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /class="workout-muscle-chips"/);
  assert.match(html, /class="set-table/);
  assert.match(html, /data-set-row="\$\{ei\}:\$\{si\}"/);
  assert.match(html, /<span class="set-pr" hidden>Récord<\/span>/);
  // Peso y repeticiones de cada serie son campos independientes.
  assert.match(html, /data-e="\$\{ei\}" data-s="\$\{si\}" data-k="weight"/);
  assert.match(html, /data-e="\$\{ei\}" data-s="\$\{si\}" data-k="reps"/);
  assert.match(html, /function setBeatsRecord\(/);
  assert.match(html, /function sessionMeasure\(/);
});

test('récords: solo con datos reales, por tipo de medida', () => {
  const records = JSON.parse(JSON.stringify(rc.deriveExerciseRecords([
    { date: '2026-10-10', type: 'custom', exercises: [
      { name: 'Press de banca con barra', kind: 'strength', entries: [{ reps: '10', weight: '20', done: true }, { reps: '8', weight: '40', done: true }, { reps: '', weight: '200', done: true }] },
      { name: 'Plancha frontal', kind: 'strength', entries: [{ reps: '60', weight: '', done: true }] },
      { name: 'Bicicleta fija', kind: 'cardio', entries: [{ reps: '30', weight: '', done: true }] }
    ] },
    { date: '2026-09-01', type: 'manual', exercises: [{ name: 'Dominadas', kind: 'strength', entries: [{ reps: '12', weight: '', done: true }] }] }
  ])));
  const bench = records.find(r => r.name === 'Press de banca con barra');
  assert.equal(bench.bestWeight, 40, 'un peso sin repeticiones no es un récord');
  assert.equal(bench.bestWeightReps, 8);
  assert.equal(bench.bestReps, 10);
  assert.equal(bench.bestRepsWeight, 20);
  assert.equal(bench.bestE1rm, 50.7, '1RM estimado (Epley) de 40 kg × 8');
  const plank = records.find(r => r.name === 'Plancha frontal');
  assert.equal(plank.measure, 'seconds'); assert.equal(plank.bestSeconds, 60); assert.equal(plank.bestReps, 0);
  assert.ok(!records.some(r => r.name === 'Bicicleta fija'), 'el cardio no se muestra como repeticiones');
  assert.equal(records.find(r => r.name === 'Dominadas').manual, true, 'los registros manuales quedan marcados');
});

test('registro manual: peso por serie, volumen real y orden por fecha', () => {
  assert.match(html, /placeholder="40 o 40, 45, 50"/);
  assert.match(html, /si cargás un valor por serie, tienen que ser \$\{sets\} valores/);
  assert.match(html, /volumeKg:calculateWorkoutSummary\(\{exercises\}\)\.volumeKg/);
  assert.doesNotMatch(html, /volumeKg:0,exercises/);
  assert.match(html, /state\.sessions\.findIndex\(x=>String\(x\?\.date\|\|''\)<=date\)/);
});

test('imágenes: una foto compartida solo entre variantes declaradas de la misma familia', async () => {
  const media = sandbox.window.FittFormaExerciseMedia;
  const byFrame = new Map();
  for (const [name, m] of Object.entries(media)) for (const f of m.frames) { if (!byFrame.has(f)) byFrame.set(f, []); byFrame.get(f).push(name); }
  for (const [frame, names] of byFrame) if (names.length > 1) for (const n of names) assert.ok(media[n].family, `${frame} se repite en ${names.join(', ')} sin familia declarada`);
  for (const e of T.allExercises()) {
    const m = media[e.name]; assert.ok(m, `sin imagen: ${e.name}`);
    for (const f of m.frames) await access(path.join(root, 'assets/exercises', f));
  }
});

test('entrenamiento diario: se mantiene cada 12 horas (decisión confirmada)', () => {
  assert.equal(T.DAILY_COOLDOWN_MS, 12 * 60 * 60 * 1000);
});

// ---------- Etapa 3: insignias ----------
vm.runInContext(await read('achievements.js'), sandbox);
const E = sandbox.window.FittFormaBadgeEngine;

test('insignias: emblema hexagonal con marco distinto por rango y símbolo propio por actividad', () => {
  const shapes = new Set(['bronze', 'silver', 'gold', 'diamond'].map(r => E.medalSvg({ rankKey: r, glyph: 'bench' }).match(/class="ff-medal-shape" d="([^"]+)"/)[1]));
  assert.equal(shapes.size, 4, 'cada rango tiene su propio marco');
  const symbols = { 'exercise-dominadas': 'pullup', 'exercise-flexiones': 'pushup', 'exercise-sentadillas': 'squat', 'exercise-abdominales': 'abs', 'exercise-plancha-frontal': 'plank', 'activity-running': 'run', 'load-press-banca': 'bench', 'consistency-streak': 'flame' };
  const all = [...E.CORE_EXERCISES, ...E.ACTIVITY_CHALLENGES, ...E.LOAD_CHALLENGES];
  for (const [id, glyph] of Object.entries(symbols)) assert.equal(E.glyphFor(all.find(x => x.id === id)), glyph, id);
  assert.equal(E.glyphFor({ name: 'Elevaciones laterales', group: 'Hombros', category: 'strength' }), 'shoulders');
  assert.equal(E.glyphFor({ name: 'Curl de bíceps con mancuernas', group: 'Brazos', category: 'strength' }), 'biceps');
  for (const g of new Set(Object.values(E.SYMBOL_BY_ID))) assert.ok(E.GLYPHS[g], `símbolo sin dibujo: ${g}`);
  assert.match(E.medalSvg({ rankKey: 'gold', numeral: 'III', glyph: 'bench' }), /(class="ff-medal-pip"[^>]*>.*){3}/);
});

test('insignias por carga: mejor serie ÷ peso corporal, umbrales crecientes y sin carga manual', () => {
  for (const c of E.LOAD_CHALLENGES) {
    const t = E.thresholdsForExercise(c);
    assert.equal(t.length, 12, c.name);
    for (let i = 1; i < 12; i++) assert.ok(t[i] > t[i - 1], `${c.name} nivel ${i + 1}`);
    assert.ok(E.maxPlausible(c) >= t[11]);
    assert.equal(E.validateRecord(c, 100, [], '2026-10-18').ok, false, 'se calcula con las series, no se declara a mano');
  }
  assert.equal(E.loadChallengeFor('Press de banca con barra')?.id, 'load-press-banca');
  assert.equal(E.loadChallengeFor('Press de banca con mancuernas'), null, 'mancuernas: el peso por mano no es comparable');
  assert.equal(E.loadChallengeFor('Peso muerto rumano'), null, 'el rumano es otro ejercicio');
  assert.equal(E.loadChallengeFor('Sentadilla con barra')?.id, 'load-sentadilla');
  // 80 kg con 80 kg de peso corporal = 1,00× → Oro II en press de banca.
  const p = E.progressForValue(1.0, E.thresholdsForExercise(E.LOAD_CHALLENGES[0]));
  assert.equal(E.rankForLevel(p.highest).label, 'Oro II');
  assert.equal(E.formatValue(1, 'bw'), '1,00 × tu peso corporal');
});

test('insignias: fuente honesta (manual, sesión o GPS) y nunca «verificada»', () => {
  assert.equal(E.evidenceLabel('declared'), 'Declarada');
  assert.equal(E.evidenceLabel('session'), 'Registrada en sesión');
  assert.equal(E.evidenceLabel('gps_device'), 'Con ruta GPS');
  assert.doesNotMatch(html, /evidence:'verified'/);
  for (const m of ['sessions', 'streak']) assert.equal(E.validateRecord(E.ACTIVITY_CHALLENGES.find(x => x.measure === m), 5, [], '2026-10-18').ok, false);
});

test('insignias: historial, mejor nivel, celebración única y máximo de 3 destacadas', () => {
  assert.match(html, /const catalog=\[\.\.\.CORE_BADGE_EXERCISES,\.\.\.BadgeEngine\.LOAD_CHALLENGES\]/);
  assert.match(html, /!state\.badgeUnlocks\?\.\[b\.id\]\?\.celebratedAt/, 'la celebración se marca como vista y no se repite');
  assert.match(html, /celebratedAt:stamp/);
  assert.match(html, /\$\('badgeRecordStatus'\)\.textContent=message;toast\(message\);celebrateBadges\(delta\.newlyUnlocked\)/, 'también al guardar una marca manual');
  const unlocks = { 'load-press-banca:1': { exerciseId: 'load-press-banca', level: 1, earnedAt: '2026-10-01' }, 'load-press-banca:8': { exerciseId: 'load-press-banca', level: 8, earnedAt: '2026-10-18' }, 'activity-running:3': { exerciseId: 'activity-running', level: 3, earnedAt: '2026-10-10' }, 'exercise-flexiones:5': { exerciseId: 'exercise-flexiones', level: 5, earnedAt: '2026-10-11' }, 'consistency-streak:2': { exerciseId: 'consistency-streak', level: 2, earnedAt: '2026-10-12' } };
  const top = T.highestPerChallenge(unlocks);
  assert.equal(top.length, 4, 'una por desafío');
  assert.equal(top.find(x => x.exerciseId === 'load-press-banca').level, 8, 'running no reemplaza fuerza y el mejor nivel es el más alto');
  assert.ok(T.featuredBadges(unlocks, []).length <= 3);
  assert.ok(T.featuredBadges(unlocks, ['activity-running:3', 'activity-running:3', 'exercise-flexiones:5', 'load-press-banca:8', 'consistency-streak:2']).length <= 3, 'nunca más de 3 ni repetidas');
  assert.equal(Object.keys(unlocks).length, 5, 'el historial no se borra al calcular el mejor nivel');
});

// ---------- Etapa 4: comunidad ----------
const communityJs = await read('community.js');
const communitySql = await read('supabase/migrations/2026-10-23_v49_community.sql');

test('comunidad: barra propia dentro del contenido y barra inferior principal intacta', () => {
  const view = html.slice(html.indexOf('id="view-community"'), html.indexOf('id="view-profile"'));
  assert.match(view, /<header class="community-topbar cm-topbar">/);
  for (const tab of ['world', 'ranking', 'friends', 'messages', 'profile']) assert.match(view, new RegExp(`data-community-tab="${tab}"`));
  assert.doesNotMatch(view, /mobile-nav-item|data-mobile-view/, 'Comunidad no agrega otra barra de navegación general');
  const nav = [...html.matchAll(/class="mobile-nav-item[^"]*"[^>]*data-mobile-view="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(nav, ['plan', 'train', 'nutrition', 'progress', 'community', 'profile']);
  assert.match(css, /#view-community header\.community-topbar\{position:relative!important/);
});

// v53: sin feed (historias, «cargar más», sugeridas ni grilla de explorar); las publicaciones viven en el perfil.
test('comunidad: directorio, mensajes y perfiles sociales con datos reales', () => {
  for (const id of ['communityPeople', 'communityFriends', 'rankingList', 'communityCompare', 'communityConversations', 'communityChatView', 'communityChatBack', 'communityOwnGrid', 'communityPanelUser', 'communityPostDialog', 'communityLinkSession', 'communityAvatarInput']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(communityJs, /client\.rpc\('community_conversations'\)/);
  assert.match(communityJs, /client\.rpc\('community_athlete_profile',\{p_user:uid\}\)/);
  assert.match(communityJs, /client\.rpc\('community_profile_stats',\{p_user:uid\}\)/, 'perfil sin la migración v53');
  assert.match(communityJs, /from\('community_saved_posts'\)/);
  assert.doesNotMatch(communityJs, /ilike\('description'/, 'v53: sin búsqueda de publicaciones que arme un feed');
  assert.doesNotMatch(communityJs, /Math\.random\(\)[^;]*(seguidores|followers|likes)/, 'no se inventan cifras');
});

test('comunidad: me gusta y guardar cambian el botón solo después de que la base confirma', () => {
  const like = communityJs.match(/async function toggleLike[\s\S]*?\n  async function toggleSave/)[0];
  assert.ok(like.indexOf('if(result.error)') < like.indexOf("classList.toggle('is-on',on)"));
  const save = communityJs.match(/async function toggleSave[\s\S]*?\n  async function sharePost/)[0];
  assert.ok(save.indexOf('if(result.error)') < save.indexOf("classList.toggle('is-on',on)"));
  assert.match(communityJs, /\/\/ Recién cuando la base confirma el guardado se muestra como publicada\.\n\s+const \{error\}=await client\.from\('community_posts'\)\.insert\(row\);\n\s+if\(error\)throw error;/);
});

test('comunidad: privacidad del perfil social y del entrenamiento vinculado', () => {
  // El resumen vinculado nunca lleva datos corporales; la base lo valida.
  assert.match(communitySql, /k not in \('title','date','minutes','exercises','sets','type'\)/);
  assert.match(html, /payload:\{title:String\(x\.title\|\|'Entrenamiento'\)\.slice\(0,80\),date:String\(x\.date\),minutes:/);
  assert.doesNotMatch(html.match(/window\.FittFormaRecentSessions=function[\s\S]*?\n  \};/)[0], /currentWeightKg|heightCm|weights/);
  // Destacadas: máximo 3, sin «verified»; foto de perfil solo en la carpeta propia y legible solo si el perfil lo es.
  assert.match(communitySql, /jsonb_array_length\(f\) <= 3/);
  assert.match(communitySql, /avatar_path ~ \('\^' \|\| user_id::text \|\| '\/avatar\//);
  assert.match(communitySql, /create policy community_media_read_avatar[\s\S]*?cp\.avatar_path = name/);
  // Conversaciones bajo RLS (invoker); conteos solo de perfiles visibles y sin bloqueo.
  assert.match(communitySql, /community_conversations\(\)[\s\S]*?security invoker/);
  assert.match(communitySql, /community_profile_stats[\s\S]*?not public\.community_users_blocked\(viewer, p_user\)/);
  assert.match(communitySql, /where p\.visibility = 'public'/);
  assert.doesNotMatch(communitySql, /disable row level security|drop table|delete from/i);
});

test('comunidad: el patrón del usuario es válido en navegadores actuales (antes no validaba)', () => {
  const pattern = html.match(/id="communityUsername"[^>]*pattern="([^"]+)"/)[1];
  assert.doesNotThrow(() => new RegExp(pattern, 'v'));
  assert.ok(new RegExp(`^(?:${pattern})$`, 'v').test('mateo_fit.1'));
  assert.ok(!new RegExp(`^(?:${pattern})$`, 'v').test('a'));
});
