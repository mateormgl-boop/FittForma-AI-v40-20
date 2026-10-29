import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const sw = await readFile(path.join(root, 'sw.js'), 'utf8');

function loadPureFunction(name, nextName, extra = '') {
  const start = html.indexOf(`  function ${name}(`);
  const end = html.indexOf(`\n  function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `No se encontró ${name}`);
  const source = html.slice(start, end);
  const context = {};
  vm.runInNewContext(`${extra}\n${source}\nglobalThis.fn=${name};`, context);
  return context.fn;
}

const defsMatch = html.match(/  const dailyHabitDefinitions=(\[[\s\S]*?\n  \]);/);
assert.ok(defsMatch, 'Debe existir la lista de hábitos diarios');
const definitions = JSON.parse(JSON.stringify(vm.runInNewContext(defsMatch[1])));
const calculateNutritionWeek = loadPureFunction('calculateNutritionWeek', 'summarizeHabitWeek');
const summarizeHabitWeek = loadPureFunction(
  'summarizeHabitWeek', 'todayMeals',
  `const dailyHabitDefinitions=${JSON.stringify(definitions)};`
);

test('la tendencia nutricional semanal excluye días sin comidas de los promedios', () => {
  const dates = [
    { key: '2026-10-12', label: 'lun', isToday: false },
    { key: '2026-10-13', label: 'mar', isToday: false },
    { key: '2026-10-14', label: 'mié', isToday: true }
  ];
  const result = JSON.parse(JSON.stringify(calculateNutritionWeek([
    { date: '2026-10-12', calories: 2000, protein: 100 },
    { date: '2026-10-14', calories: 3000, protein: 150 },
    { date: '2026-10-14', calories: 0, protein: 0 }
  ], { '2026-10-12': 5, '2026-10-14': 10 }, { calories: 2400, protein: 120, water: 8 }, dates)));
  assert.equal(result.summary.mealDays, 2);
  assert.equal(result.summary.averageCalories, 2500);
  assert.equal(result.summary.averageProtein, 125);
  assert.equal(result.summary.waterDays, 2);
  assert.equal(result.summary.averageWater, 7.5);
  assert.equal(result.days[1].mealCount, 0);
  assert.equal(result.days[1].water, null);
  assert.equal(result.days[0].caloriePct, 83);
});

test('la tendencia maneja datos vacíos, incompletos y valores negativos de forma segura', () => {
  const dates = [{ key: '2026-10-14', label: 'mié', isToday: true }];
  const empty = JSON.parse(JSON.stringify(calculateNutritionWeek([], {}, {}, dates)));
  assert.equal(empty.summary.mealDays, 0);
  assert.equal(empty.summary.averageCalories, null);
  assert.equal(empty.summary.averageProtein, null);
  assert.equal(empty.summary.averageWater, null);
  const limited = JSON.parse(JSON.stringify(calculateNutritionWeek([
    { date: '2026-10-14', calories: -80, protein: -4 }
  ], { '2026-10-14': -3 }, {}, dates)));
  assert.equal(limited.days[0].calories, 0);
  assert.equal(limited.days[0].protein, 0);
  assert.equal(limited.days[0].water, 0);
});

test('el resumen de hábitos cuenta solo los booleanos marcados y tolera logs incompletos', () => {
  const dates = [
    { key: '2026-10-13', label: 'ma', isToday: false },
    { key: '2026-10-14', label: 'mi', isToday: true }
  ];
  const result = JSON.parse(JSON.stringify(summarizeHabitWeek({
    '2026-10-13': { movement: true, protein: true, produce: false },
    '2026-10-14': { movement: true, protein: 'yes', recovery: true }
  }, dates, definitions)));
  assert.equal(result.habitCount, 5);
  assert.equal(result.days[0].completed, 2);
  assert.equal(result.days[1].completed, 2);
  assert.equal(result.totalMarked, 4);
  assert.equal(result.daysWithCheckIn, 2);
});

test('nutrición y hábitos tienen controles accesibles y resumen semanal', () => {
  assert.match(html, /id="nutritionWeekSummary"/);
  assert.match(html, /id="nutritionWeekChart"/);
  assert.match(html, /role="progressbar" aria-label="Hábitos marcados hoy"/);
  assert.match(html, /id="habitChecklist"/);
  assert.match(html, /id="habitWeekHistory"/);
  assert.match(html, /data-habit-key=/);
  assert.match(html, /function renderNutritionWeek\(/);
  assert.match(html, /function renderHabitTracker\(/);
});

test('hidratación e historial de hábitos sobreviven carga local, importación y normalización en nube', () => {
  assert.match(html, /habitLogs:parsed\.habitLogs&&typeof parsed\.habitLogs==='object'/);
  assert.match(html, /waterLogs:parsed\.waterLogs&&typeof parsed\.waterLogs==='object'/);
  assert.match(html, /habitLogs:data\.habitLogs&&typeof data\.habitLogs==='object'/);
  assert.match(html, /waterLogs:data\.waterLogs&&typeof data\.waterLogs==='object'/);
  assert.match(html, /function addWater\(ml,label\)/, 'v48: el agua se registra en ml por entrada');
  assert.match(html, /state\.waterLogs\[d\]=Math\.round\(ml\/h\.glassMl\*10\)\/10/, 'waterLogs se deriva de los registros para compatibilidad');
  assert.match(html, /state\.habitLogs\[key\]=log/);
  assert.match(html, /JSON\.stringify\(state,null,2\)/);
});

test('v41.0 fuerza la actualización de la caché PWA y mantiene recursos base', async () => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const backendPkg = JSON.parse(await readFile(path.join(root, 'backend/package.json'), 'utf8'));
  assert.equal(pkg.version, '0.67.0');
  assert.equal(backendPkg.version, '0.67.0');
  assert.match(sw, /fittforma-ai-static-v67-0/);
  assert.match(sw, /\.\/index\.html/);
  assert.match(sw, /\.\/supabase-config\.js/);
});
