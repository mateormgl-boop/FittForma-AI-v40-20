import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const helperStart = html.indexOf('  function calculateWorkoutSummary(');
const helperEnd = html.indexOf('  function activeSessionElapsedMs(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Los helpers de resumen y validación de sesión deben existir');
const context = {};
vm.runInNewContext(`${html.slice(helperStart, helperEnd)}\nglobalThis.calculateWorkoutSummary=calculateWorkoutSummary;globalThis.validateWorkoutSession=validateWorkoutSession;globalThis.formatWorkoutDuration=formatWorkoutDuration;`, context);

const sessionExample = {
  title: 'Tren superior A',
  exercises: [
    { name: 'Press de banca', kind: 'strength', entries: [
      { reps: '8', weight: '60', done: true },
      { reps: '10', weight: '60', done: false },
      { reps: '8', weight: '', done: true }
    ]},
    { name: 'Plancha', kind: 'strength', entries: [
      { reps: '', weight: '', done: false }
    ]}
  ]
};

test('el resumen distingue series prescritas, con datos y completadas y calcula volumen solo de las completadas', () => {
  const summary = context.calculateWorkoutSummary(sessionExample);
  assert.equal(summary.totalExercises, 2);
  assert.equal(summary.completedExercises, 1);
  assert.equal(summary.totalSets, 4);
  assert.equal(summary.recordedSets, 3);
  assert.equal(summary.completedSets, 2);
  assert.equal(summary.totalReps, 16);
  assert.equal(summary.volumeKg, 480);
});

test('la validación acepta datos dentro de los límites de la interfaz', () => {
  assert.equal(context.validateWorkoutSession(sessionExample).valid, true);
  assert.equal(context.validateWorkoutSession({ exercises: [{ name: 'Cinta', kind: 'cardio', entries: [{ reps: '300', weight: '', done: true }] }] }).valid, true);
  assert.equal(context.validateWorkoutSession({ exercises: [{ name: 'Cinta', kind: 'cardio', entries: [{ reps: '10.5', weight: '', done: true }] }] }).valid, false);
});

test('la validación rechaza repeticiones fraccionarias, pesos negativos y valores fuera de rango', () => {
  const fractional = context.validateWorkoutSession({ exercises: [{ name: 'Sentadilla', kind: 'strength', entries: [{ reps: '8.5', weight: '40', done: true }] }] });
  assert.equal(fractional.valid, false);
  assert.equal(fractional.code, 'reps');
  const negative = context.validateWorkoutSession({ exercises: [{ name: 'Remo', kind: 'strength', entries: [{ reps: '8', weight: '-1', done: true }] }] });
  assert.equal(negative.valid, false);
  assert.equal(negative.code, 'weight');
  const outOfRange = context.validateWorkoutSession({ exercises: [{ name: 'Press', kind: 'strength', entries: [{ reps: '201', weight: '10', done: true }] }] });
  assert.equal(outOfRange.valid, false);
});

test('el tiempo activo se congela durante pausa y suma solo los segmentos en marcha', () => {
  const elapsedStart = html.indexOf('  function activeSessionElapsedMs(');
  const elapsedEnd = html.indexOf('  function persistActiveSessionDraft(', elapsedStart);
  assert.ok(elapsedStart >= 0 && elapsedEnd > elapsedStart);
  const clock = { now: 11_000 };
  const fakeDate = { now: () => clock.now };
  const elapsedContext = { Date: fakeDate };
  vm.runInNewContext(`${html.slice(elapsedStart, elapsedEnd)}\nglobalThis.activeSessionElapsedMs=activeSessionElapsedMs;`, elapsedContext);
  const running = { elapsedMs: 5000, segmentStartedAt: 10000, pausedAt: 0 };
  assert.equal(elapsedContext.activeSessionElapsedMs(running), 6000);
  const paused = { elapsedMs: 6000, segmentStartedAt: 10000, pausedAt: 10500 };
  assert.equal(elapsedContext.activeSessionElapsedMs(paused), 6000);
});

test('el reloj de sesión formatea correctamente minutos y duraciones largas', () => {
  assert.equal(context.formatWorkoutDuration(0), '00:00');
  assert.equal(context.formatWorkoutDuration(125), '02:05');
  assert.equal(context.formatWorkoutDuration(3661), '01:01:01');
  assert.equal(context.formatWorkoutDuration(-10), '00:00');
});

test('la interfaz permite pausar, reanudar y salir guardando el borrador para retomarlo', () => {
  assert.match(html, /id="workoutElapsedDisplay"/);
  assert.match(html, /id="toggleWorkoutPause"/);
  assert.match(html, /id="leaveWorkoutForLater"/);
  assert.match(html, /class="cardio-complete"/);
  assert.match(html, /Marcar actividad como completada/);
  assert.match(html, /function pauseWorkout\(/);
  assert.match(html, /function resumeWorkout\(/);
  assert.match(html, /persistActiveSessionDraft\(\);switchView\('plan'\)/);
});

test('la sesión interrumpida se recupera en pausa y conserva el temporizador de descanso', () => {
  assert.match(html, /function restoreActiveSessionDraft\(/);
  assert.match(html, /pauseReason:'manual'/);
  assert.match(html, /restEndAt=Number\(draft\.restEndAt\)>Date\.now\(\)\?Number\(draft\.restEndAt\):0/);
  assert.match(html, /activeSession\.restEndAt=restEndAt/);
  assert.match(html, /pagehide/);
  assert.match(html, /ACTIVE_SESSION_DRAFT_KEY/);
});

test('el ocultamiento de la app no cancela una pausa manual ni reanuda una sesión pausada manualmente', () => {
  assert.match(html, /document\.visibilityState==='visible'&&activeSession\.pausedAt&&activeSession\.pauseReason==='background'/);
  assert.match(html, /activeSession\.pauseReason='manual'/);
});

test('al finalizar se guardan métricas de la sesión y se muestra el resumen antes de ir al progreso', () => {
  assert.match(html, /function finishWorkout\(/);
  assert.match(html, /const validation=validateWorkoutSession\(activeSession\)/);
  assert.match(html, /completedSets:summary\.completedSets/);
  assert.match(html, /volumeKg:summary\.volumeKg/);
  assert.match(html, /id="summaryGoProgress"/);
  assert.match(html, /id="summaryGoPlan"/);
  assert.match(html, /switchView\('train'\);toast\('Sesión guardada/);
});

test('el service worker y los paquetes están alineados con v41.0 para refrescar la PWA', async () => {
  const sw = await readFile(path.join(root, 'sw.js'), 'utf8');
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const backendPkg = JSON.parse(await readFile(path.join(root, 'backend/package.json'), 'utf8'));
  assert.match(sw, /fittforma-ai-static-v43-0/);
  assert.equal(pkg.version, '0.43.0');
  assert.equal(backendPkg.version, '0.43.0');
});
