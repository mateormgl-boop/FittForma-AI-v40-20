import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('v40.7: el shell y el diseño unificado están presentes en la hoja principal', async () => {
  const html = await read('index.html');
  assert.match(html, /rediseño integral de interfaz/);
  for (const token of ['--bg:#050b14', '--blue:#168bff', '--blue2:#42c4ff']) assert.ok(html.includes(token), `Falta token visual ${token}`);
  assert.match(html, /\.card\{min-width:0;padding:19px/);
  assert.match(html, /\.field input:focus/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});

test('v41.0: Inicio es un panel con las métricas de constancia y ya no repite el hero antiguo', async () => {
  const html = await read('index.html');
  const home = html.match(/<section class="view active" id="view-plan">([\s\S]*?)<section class="view" id="view-exercises">/)?.[1] || '';
  assert.match(home, /class="home-dash"/);
  assert.match(home, /id="statSessions"/);
  assert.match(home, /id="statMinutes"/);
  assert.match(home, /id="statStreak"/);
  assert.doesNotMatch(html, /<section class="hero hero-v18">/);
});

test('v42: acceso a la IA y seis accesos móviles apuntan a vistas reales', async () => {
  const html = await read('index.html');
  const nav = html.match(/<nav class="mobile-app-nav" id="mobileAppNav"[\s\S]*?<\/nav>/)?.[0] || '';
  const ids = [...nav.matchAll(/data-mobile-view="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, ['plan', 'train', 'nutrition', 'progress', 'community', 'profile']);
  for (const view of ['plan', 'train', 'exercises', 'routines', 'nutrition', 'progress', 'community', 'profile', 'coach', 'running']) {
    assert.match(html, new RegExp(`id="view-${view}"`), `Falta vista ${view}`);
  }
  assert.match(html, /data-shortcut-view="coach" aria-label="Consultar a la IA"/);
  assert.match(html, /const inMoreMenu=false;/);
});

test('v40.7: service worker y versiones de paquetes fuerzan una actualización de caché', async () => {
  const sw = await read('sw.js');
  const rootPkg = JSON.parse(await read('package.json'));
  const backendPkg = JSON.parse(await read('backend/package.json'));
  assert.match(sw, /const CACHE = 'fittforma-ai-static-v54-0'/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /self\.clients\.claim\(\)/);
  assert.equal(rootPkg.version, '0.54.0');
  assert.equal(backendPkg.version, '0.54.0');
});


test('v40.7: curl femoral tiene instrucciones y músculos propios antes de la regla genérica de curl', async () => {
  const html = await read('index.html');
  const muscles = html.slice(html.indexOf('function exerciseMuscles'), html.indexOf('function findExercisePrescription'));
  const steps = html.slice(html.indexOf('function exerciseSteps'), html.indexOf('function exerciseTips'));
  const errors = html.slice(html.indexOf('function exerciseErrors'), html.indexOf('function exerciseEquipment'));
  assert.ok(muscles.indexOf('/curl femoral/') < muscles.indexOf('/curl|biceps/'));
  assert.ok(steps.indexOf('/curl femoral/') < steps.indexOf('/curl|biceps/'));
  assert.ok(errors.indexOf('/curl femoral/') < errors.indexOf('/curl|triceps/'));
});
