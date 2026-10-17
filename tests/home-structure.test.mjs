import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const section = (html, id) => html.match(new RegExp(`<section class="view(?: active)?" id="view-${id}">([\\s\\S]*?)(?=<section class="view(?: active)?" id="view-|\\n  </main>)`))?.[1] || '';

test('v40.21: Inicio muestra datos reales y la biblioteca y las rutinas viven en sus propias vistas', async () => {
  const html = await read('index.html');
  const home = section(html, 'plan'), exercises = section(html, 'exercises'), routines = section(html, 'routines');
  for (const id of ['homeGreeting', 'homeGoalTitle', 'homeWeek', 'homeTodayTitle', 'homeStartBtn', 'homeKcalArc', 'homeProtArc', 'homeWaterArc',
    'homeHabits', 'homeBadgeTitle', 'statSessions', 'statMinutes', 'statStreak', 'adSlotHome']) {
    assert.match(home, new RegExp(`id="${id}"`), `Inicio debe tener ${id}`);
  }
  assert.doesNotMatch(home, /id="exerciseLibraryResults"|id="makePlan"|id="plannedActivityForm"/);
  for (const id of ['exerciseSearch', 'exerciseGroupFilter', 'exerciseFavoritesOnly', 'exerciseLibraryResults', 'libraryTitle']) assert.match(exercises, new RegExp(`id="${id}"`));
  for (const id of ['makePlan', 'planOutput', 'plannedActivityForm', 'weeklyActivityStrip', 'undoPlan', 'planChangeHistory']) assert.match(routines, new RegExp(`id="${id}"`));
});

test('v40.21: no hay identificadores duplicados en el HTML estático', async () => {
  const html = await read('index.html');
  const staticHtml = html.slice(0, html.indexOf('<script>'));
  const ids = [...staticHtml.matchAll(/\sid="([^"$]+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))], []);
});

test('v40.21: Entrenar agrupa Sesión, Ejercicios, Rutinas, Correr y Coach y la barra inferior marca Entrenar', async () => {
  const html = await read('index.html');
  assert.equal((html.match(/<nav class="train-subnav"/g) || []).length, 5, 'las cinco vistas de Entrenar llevan la fila de subpestañas');
  assert.deepEqual([...new Set([...html.matchAll(/data-subview="([^"]+)"/g)].map(m => m[1]))], ['train', 'exercises', 'routines', 'running', 'coach']);
  assert.match(html, /const trainViews=\['exercises','routines','running','coach'\];/);
  assert.match(html, /const mobileName=trainViews\.includes\(name\)\?'train':name;/);
  assert.match(html, /if\(name==='plan'\)renderHome\(\);/);
  assert.match(html, /function renderAll\(\)\{renderAllBase\(\);renderHome\(\);\}/);
  const menu = html.match(/<div class="mobile-more-menu" id="mobileMoreMenu"[\s\S]*?<\/div>/)?.[0] || '';
  for (const view of ['nutrition', 'coach', 'running']) assert.match(menu, new RegExp(`data-mobile-view="${view}"`), `${view} accesible desde Más`);
  assert.match(html, /\.mobile-app-nav \.mobile-nav-item\{min-height:58px;font-size:11px/);
});

test('v40.21: el botón principal de Inicio arranca de verdad la siguiente sesión de la rutina', async () => {
  const html = await read('index.html');
  assert.match(html, /action='start:'\+nextIndex/);
  assert.match(html, /if\(parts\[0\]==='start'\)\{const index=Number\(parts\[1\]\);if\(Number\.isInteger\(index\)&&state\.plan&&state\.plan\.days&&state\.plan\.days\[index\]\)startWorkout\(index\)/);
  assert.match(html, /\(titles\.indexOf\(newest\.title\)\+1\)%titles\.length/);
  assert.match(html, /\$\('summaryGoPlan'\)\.onclick=\(\)=>switchView\('routines'\)/);
  assert.match(html, /\$\('goPlan'\)\.onclick=\(\)=>switchView\('routines'\)/);
});

test('v40.21: los hábitos de Inicio usan los mismos registros que el módulo de hábitos', async () => {
  const html = await read('index.html');
  const handler = html.match(/\$\('homeHabits'\)\.addEventListener\('click'[\s\S]*?renderHome\(\);\}\);/)?.[0] || '';
  assert.ok(handler, 'falta el manejador de hábitos de Inicio');
  assert.match(handler, /dailyHabitDefinitions\.some\(item=>item\.key===habitKey\)/, 'solo acepta claves de hábitos definidas');
  assert.match(handler, /state\.habitLogs\[day\]=log;save\(\);renderHabitTracker\(\);/);
});

test('v40.21: las insignias de Inicio salen de las mismas insignias desbloqueadas que el Perfil', async () => {
  const html = await read('index.html');
  assert.match(html, /Object\.values\(state\.badgeUnlocks\|\|\{\}\)\.filter\(entry=>catalog\.some\(item=>!item\.customPlaceholder&&item\.id===entry\.exerciseId\)\)/);
  assert.match(html, /window\.FittFormaBadgeEngine\.rankForLevel|rankForLevel\(\(Number\(last\.level\)\|\|1\)-1\)/);
});

test('v40.21: el CSS no usa font: con tamaño e inherit juntos (inválido)', async () => {
  const html = await read('index.html');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.deepEqual([...css.matchAll(/font:\s*[^;}{]*\b\d+(?:\.\d+)?(?:px|rem|em|%)[^;}{]*\binherit\b[^;}{]*/g)].map(m => m[0]), []);
});

test('v40.21: el sistema visual añade chips de biblioteca y anillo de nutrición con datos reales', async () => {
  const html = await read('index.html');
  assert.match(html, /id="libraryChips"/);
  assert.match(html, /function syncLibraryChips\(\)/);
  assert.match(html, /id="nutriRingArc"/);
  assert.match(html, /\$\('nutriRingArc'\)\.style\.strokeDashoffset/);
  assert.match(html, /\.tabs\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)\}/);
});
