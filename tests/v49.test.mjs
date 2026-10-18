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
