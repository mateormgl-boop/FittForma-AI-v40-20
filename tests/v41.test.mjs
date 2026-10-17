import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');
const context = { globalThis: {} };
context.window = context;
vm.runInNewContext(await read('achievements.js'), context);
const E = context.FittFormaBadgeEngine;
const html = await read('index.html');
const community = await read('community.js');

test('v41: catálogo principal con 12 umbrales crecientes, categoría válida y tope por encima de Diamante III', () => {
  const categories = new Set(E.CATEGORIES.map(c => c.key));
  for (const item of [...E.CORE_EXERCISES, ...E.ACTIVITY_CHALLENGES]) {
    const t = E.thresholdsForExercise(item);
    assert.equal(t.length, 12, item.name);
    for (let i = 1; i < 12; i++) assert.ok(t[i] > t[i - 1], `${item.name} nivel ${i + 1}`);
    assert.ok(categories.has(item.category), `${item.name} categoría ${item.category}`);
    if (item.measure !== 'days') assert.ok(E.maxPlausible(item) >= t[11], `${item.name}: el tope debe permitir Diamante III`);
  }
  for (const key of ['calisthenics', 'strength', 'legs', 'core', 'hold', 'cardio', 'running', 'consistency']) assert.ok(categories.has(key), key);
});

test('v41: los IDs de desafíos de v40.20 se conservan para no invalidar insignias guardadas', () => {
  const ids = E.CORE_EXERCISES.map(x => x.id);
  for (const id of ['exercise-flexiones', 'exercise-dominadas', 'exercise-sentadillas', 'exercise-abdominales', 'exercise-plancha-frontal']) assert.ok(ids.includes(id), id);
  assert.deepEqual([...E.CORE_EXERCISES.find(x => x.id === 'exercise-flexiones').thresholds], [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100]);
});

test('v41: el mensaje de progreso es concreto y correcto', () => {
  const flex = E.CORE_EXERCISES.find(x => x.id === 'exercise-flexiones');
  assert.equal(E.nextStepMessage(17, flex.thresholds, 'reps'), 'Te faltan 3 repeticiones para Plata I.');
  assert.equal(E.nextStepMessage(19, flex.thresholds, 'reps'), 'Te falta 1 repetición para Plata I.');
  assert.equal(E.nextStepMessage(0, flex.thresholds, 'reps'), 'Tu primera marca de 5 repeticiones desbloquea Bronce I.');
  assert.equal(E.nextStepMessage(100, flex.thresholds, 'reps'), 'Completaste los 12 niveles de este desafío.');
  assert.match(E.nextStepMessage(3.2, E.RUN_DISTANCE_TARGETS, 'km'), /Te faltan 1,8 km para Plata I\./);
});

test('v41: validación de marcas rechaza valores imposibles, decimales y duplicados del día', () => {
  const flex = E.CORE_EXERCISES.find(x => x.id === 'exercise-flexiones');
  assert.equal(E.validateRecord(flex, 25, [], '2026-10-17').ok, true);
  assert.equal(E.validateRecord(flex, 0, [], '2026-10-17').ok, false);
  assert.equal(E.validateRecord(flex, 12.5, [], '2026-10-17').ok, false);
  assert.match(E.validateRecord(flex, 5000, [], '2026-10-17').reason, /supera el máximo/);
  assert.equal(E.validateRecord(flex, 25, [{ exerciseId: flex.id, value: 25, date: '2026-10-17' }], '2026-10-17').ok, false);
  assert.equal(E.validateRecord(flex, 25, [{ exerciseId: flex.id, value: 25, date: '2026-10-16' }], '2026-10-17').ok, true);
  assert.equal(E.validateRecord(E.ACTIVITY_CHALLENGES[0], 5, [], '2026-10-17').ok, false, 'running no se declara a mano desde insignias');
});

test('v41: nunca existe un estado "verificada"; la evidencia es declarada o GPS del dispositivo', () => {
  assert.equal(E.evidenceLabel('declared'), 'Declarada');
  assert.equal(E.evidenceLabel('gps_device'), 'Con ruta GPS');
  assert.equal(E.evidenceLabel('verified'), 'Declarada', 'un valor desconocido no eleva la evidencia');
  assert.doesNotMatch(html, /Verificadas por GPS|✓ GPS/);
  assert.match(html, /FittForma todavía no verifica marcas en el servidor/);
});

test('v41: medallas SVG por rango sin emojis', () => {
  for (const rankKey of ['bronze', 'silver', 'gold', 'diamond']) {
    const svg = E.medalSvg({ rankKey, numeral: 'II', glyph: 'run' });
    assert.match(svg, new RegExp(`ff-medal--${rankKey}`));
    assert.doesNotMatch(svg, /[\u{1F300}-\u{1FAFF}]/u);
  }
  assert.match(E.medalSvg({ locked: true }), /is-locked/);
  assert.match(E.medalSvg({ title: '<b>Oro</b>' }), /<title>bOro\/b<\/title>/, 'el título se sanea');
});

test('v41: Progreso separado en Resumen, Insignias, Historial y Peso con tabs accesibles', () => {
  const tabs = [...html.matchAll(/data-progress-tab="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ['summary', 'badges', 'history', 'body']);
  for (const id of ['progressPanelSummary', 'progressPanelBadges', 'progressPanelHistory', 'progressPanelBody']) assert.match(html, new RegExp(`id="${id}"[^>]*role="tabpanel"`));
  assert.match(html, /id="badgeGallery"/);
  assert.match(html, /id="badgeRecordList"/);
  assert.match(html, /data-delete-badge-record/);
  assert.match(html, /function syncBadgeUnlocks\(revokeIds=\[\]\)/);
});

test('v41: renderProgress tolera sesiones sin ejercicios (datos antiguos o importados)', () => {
  assert.match(html, /const setsOf=s=>\(Array\.isArray\(s\?\.exercises\)\?s\.exercises:\[\]\)/);
  assert.doesNotMatch(html, /state\.sessions\.reduce\(\(a,s\)=>a\+s\.exercises\.reduce/);
});

test('v41: escritorio usa barra lateral y Herramientas; Inicio muestra la próxima insignia', () => {
  assert.match(html, /@media\(min-width:1024px\)\{\n\s*\.app\{display:grid;grid-template-columns:var\(--ff-sidebar\)/);
  assert.match(html, /<span class="tab-group-label" aria-hidden="true">Herramientas<\/span>/);
  assert.match(html, /function closestNextBadge\(\)/);
  assert.match(html, /id="homeBadgeBar"/);
});

test('v41: la migración es aditiva y no permite evidencia "verificada" desde el cliente', async () => {
  const files = await readdir(path.join(root, 'supabase/migrations'));
  assert.ok(files.includes('2026-10-17_v41_posts_achievements_unread.sql'));
  const sql = await read('supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql');
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|disable row level security/i);
  assert.match(sql, /a->>'evidence' in \('declared','gps_device'\)/);
  assert.match(sql, /grant update\(description\) on public\.community_posts to authenticated/);
  assert.match(sql, /grant update\(read_at\) on public\.community_messages to authenticated/);
  assert.match(sql, /recipient_id=auth\.uid\(\)/);
});

test('v41: Comunidad detecta la migración, publica texto/logros con vista previa y marca no leídos', () => {
  assert.match(community, /const isMissingColumn=/);
  assert.match(community, /markLegacySchema\(\)/);
  assert.match(community, /post_kind:'text'/);
  assert.match(community, /post_kind:'achievement'/);
  assert.match(community, /function renderPostPreview\(\)/);
  assert.match(community, /\.is\('read_at',null\)/);
  assert.match(community, /Declarada por el autor/);
  assert.doesNotMatch(community, /verificad[oa] por FittForma['"`]/);
  for (const id of ['communityTextPostForm', 'communityAchievementPostForm', 'communityPostForm', 'communityPostPreview', 'communityUnreadBadge']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /window\.FittFormaShareableBadges=function/);
});

test('v41: sin emojis pictográficos como iconos en la interfaz', () => {
  assert.doesNotMatch(html, /class="emoji"/);
  assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}]/u);
});
