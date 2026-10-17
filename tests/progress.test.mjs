import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('  function calculateProgressInsights(');
const end = html.indexOf('  function renderTrainingInsights(', start);
assert.ok(start >= 0 && end > start, 'Los cálculos de progreso deben existir');
const pureHelpers = html.slice(start, end);
const context = {};
vm.runInNewContext(`${pureHelpers}\nglobalThis.calculateProgressInsights=calculateProgressInsights; globalThis.deriveExerciseRecords=deriveExerciseRecords;`, context);

const now = new Date(2026, 9, 14, 12, 0, 0);
const sessions = [
  { id: 1, date: '2026-10-10', minutes: 45, exercises: [{ name: 'Press de banca', entries: [{ weight: '60', reps: '8' }, { weight: '50', reps: '10' }] }] },
  { id: 2, date: '2026-10-02', minutes: 35, exercises: [{ name: 'Press de banca', entries: [{ weight: '65', reps: '6' }] }] },
  { id: 3, date: '2026-09-30', minutes: 20, exercises: [{ name: 'Sentadilla', entries: [{ weight: '20', reps: '12' }] }] }
];
const activities = [
  { date: '2026-10-14', type: 'Correr', distance: 3, minutes: 30 },
  { date: '2026-10-05', type: 'Caminar', distance: 5, minutes: 50 },
  { date: '2026-09-30', type: 'Correr', distance: 2, minutes: 20 }
];

test('compara los últimos siete días con los siete anteriores sin mezclar períodos', () => {
  const result = context.calculateProgressInsights(sessions, activities, now);
  assert.equal(result.current.start, '2026-10-08');
  assert.equal(result.current.end, '2026-10-14');
  assert.equal(result.current.items, 2);
  assert.equal(result.current.minutes, 75);
  assert.equal(result.current.distance, 3);
  assert.equal(result.previous.start, '2026-10-01');
  assert.equal(result.previous.end, '2026-10-07');
  assert.equal(result.previous.items, 2);
  assert.equal(result.previous.minutes, 85);
  assert.equal(result.previous.distance, 5);
});

test('el resumen del mes excluye fechas de meses anteriores y cuenta días únicos', () => {
  const result = context.calculateProgressInsights(sessions, activities, now);
  assert.equal(result.month.prefix, '2026-10');
  assert.equal(result.month.activeDays, 4);
  assert.equal(result.month.workouts, 2);
  assert.equal(result.month.activities, 2);
  assert.equal(result.month.sets, 3);
  assert.equal(result.month.minutes, 160);
  assert.equal(result.month.distance, 8);
});

test('los récords por ejercicio diferencian mejor carga y más repeticiones', () => {
  const records = context.deriveExerciseRecords(sessions);
  const bench = records.find(row => row.name === 'Press de banca');
  assert.ok(bench);
  assert.equal(bench.bestWeight, 65);
  assert.equal(bench.bestWeightReps, 6);
  assert.equal(bench.bestWeightDate, '2026-10-02');
  assert.equal(bench.bestReps, 10);
  assert.equal(bench.bestRepsWeight, 50);
  assert.equal(bench.bestRepsDate, '2026-10-10');
  assert.ok(records.some(row => row.name === 'Sentadilla'));
});

test('el analizador tolera historial vacío o parcialmente incompleto', () => {
  const empty = context.calculateProgressInsights([], [], now);
  assert.equal(empty.current.items, 0);
  assert.equal(empty.month.activeDays, 0);
  const bodyweight = JSON.parse(JSON.stringify(context.deriveExerciseRecords([{ exercises: [{ name: 'Plancha', entries: [{ reps: '30', weight: '' }] }] }])));
  assert.equal(bodyweight[0].bestReps, 30);
});


test('los récords nuevos ignoran series anotadas pero no marcadas como completadas y mantienen compatibilidad con el historial antiguo', () => {
  const records = context.deriveExerciseRecords([
    { date: '2026-10-10', exercises: [{ name: 'Press de banca', entries: [
      { reps: '25', weight: '150', done: false },
      { reps: '8', weight: '60', done: true }
    ]}] },
    { date: '2026-09-01', exercises: [{ name: 'Sentadilla', entries: [{ reps: '12', weight: '40' }] }] }
  ]);
  const bench = records.find(row => row.name === 'Press de banca');
  assert.equal(bench.bestWeight, 60);
  assert.equal(bench.bestReps, 8);
  const squat = records.find(row => row.name === 'Sentadilla');
  assert.equal(squat.bestWeight, 40);
  assert.equal(squat.bestReps, 12);
});
