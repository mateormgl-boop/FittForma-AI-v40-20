import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');

test('v42: seis destinos y FittAI accesible desde Más, Inicio y Entrenar', () => {
  const nav = html.match(/<nav class="mobile-app-nav"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/data-mobile-view="([^"]+)"/g)].map(m => m[1]), ['plan', 'train', 'nutrition', 'progress', 'community', 'profile']);
  assert.match(html, /data-subview="coach">FittAI</);
  assert.match(html, /data-shortcut-view="coach" aria-label="Consultar a la IA"/);
});

test('v42: Inicio ofrece acciones reales (entrenar, comida, agua, correr, insignias, FittAI)', () => {
  for (const q of ['train', 'meal', 'water']) assert.match(html, new RegExp(`data-home-quick="${q}"`));
  assert.match(html, /function homeQuickAction\(kind\)/);
  assert.match(html, /\$\('addWater'\)\?\.click\(\)/, 'el agua usa el mismo registro que Nutrición');
  assert.match(html, /Buenas noches':hour<13\?'Buen día':'Buenas tardes'/);
});

test('v42: Nutrición en pestañas y Perfil en grupos sin perder IDs', () => {
  assert.deepEqual([...html.matchAll(/data-view-tab="([^"]+)"/g)].map(m => m[1]), ['hoy', 'registrar', 'plan', 'historial']);
  for (const id of ['mealForm', 'barcodeInput', 'mealPhoto', 'foodSearch', 'generateMenu', 'nutritionWeekChart', 'mealFavoritesList', 'addWater', 'removeWater', 'calorieGoal', 'identityForm', 'bodyProfileForm', 'workoutReminderForm', 'cloudAuthForm', 'membershipCard', 'checkUpdateButton', 'profileStats']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.equal((html.match(/<details class="ff-group"/g) || []).length, 10, "v47 suma Apariencia e idioma; v69 suma Agua, Inicio y Privacidad en Ajustes");
});

test('v42: rutinas propias con CRUD, validación y plantilla desde el plan', () => {
  assert.match(html, /const defaults = \{[^\n]*routines:\[\],/);
  for (const fn of ['renderRoutines', 'openRoutineEditor', 'validateRoutine', 'saveRoutineDraft', 'initRoutines', 'startRoutine']) assert.match(html, new RegExp(`function ${fn}\\(`), fn);
  for (const attr of ['data-routine-start', 'data-routine-edit', 'data-routine-duplicate', 'data-routine-delete', 'data-rmove', 'data-rremove']) assert.match(html, new RegExp(attr));
  assert.match(html, /routineFromTemplate/);
  assert.match(html, /Tenés cambios sin guardar en la rutina/);
});

test('v42: sesiones desde plan, rutina o libre, editables en curso', () => {
  assert.match(html, /function beginSession\(meta,exercises\)/);
  assert.match(html, /function startFreeWorkout\(\)/);
  assert.match(html, /beginSession\(\{type:'plan_extra',dayIndex,title:day\.title\},day\.exercises\)/);
  assert.match(html, /beginSession\(\{type:'daily',dailySeq:st\.seq\+1,dayIndex:st\.nextIndex,title:day\.title\},day\.exercises\)/);
  for (const attr of ['data-session-add-set', 'data-session-remove-set', 'data-session-remove-ex']) assert.match(html, new RegExp(attr));
  assert.match(html, /if\(inp\.checked&&restAfter>0\)startRestTimer\(restAfter\)/);
  assert.match(html, /entries:Array\.from\(\{length:sets\},\(\)=>\(\{reps:'',weight:'',done:false\}\)\)/, 'el peso objetivo no precarga series para no guardar sesiones vacías');
});

test('v42: historial de sesiones y comidas editables sin duplicar', () => {
  assert.match(html, /data-session-edit=/);
  assert.match(html, /data-session-delete=/);
  assert.match(html, /syncBadgeUnlocks\(badgeIdsForSession\(session\)\)/);
  assert.match(html, /function setMealEditing\(meal\)/);
  assert.match(html, /if\(editing\)Object\.assign\(editing,values/);
});

test('v42.1: períodos en Progreso, medidas, fotos locales y notificaciones reales', () => {
  for (const p of ['7d', '4w', '12w']) assert.match(html, new RegExp(`data-activity-period="${p}"`));
  for (const p of ['1m', '3m', '6m', 'all']) assert.match(html, new RegExp(`data-weight-period="${p}"`));
  assert.match(html, /function periodTotals\(fromKey,toKey\)/);
  assert.match(html, /sin registros en el período anterior/);
  assert.match(html, /const MEASURE_FIELDS=/);
  assert.match(html, /const PHOTO_DB='fittforma-progress-photos'/);
  assert.match(html, /No se suben a la nube ni se publican/);
  assert.match(html, /addNotification\(\{id:`badge:\$\{b\.id\}`/);
  assert.match(html, /if\(state\.notifications\.some\(x=>x\.id===n\.id\)\)return false;/);
  assert.match(html, /id="notifBell"/);
});

test('v42.1: FittAI usa más contexto solo con permiso visible', () => {
  assert.match(html, /id="coachShareData" type="checkbox" checked/);
  assert.match(html, /state\.coachShareData===false\?\{message:msg/);
  assert.match(html, /function coachExtraContext\(\)/);
});
