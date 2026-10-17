// Integración entre secciones en un navegador real (Chromium + Playwright), sin servicios externos.
// Requiere `npm start` en otra terminal. Uso: APP_URL=http://localhost:8787 node tests/e2e/integration.e2e.mjs
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
const KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };

const browser = await chromium.launch();
for (const [w, h, label] of [[390, 844, 'móvil'], [1366, 900, 'escritorio']]) {
  console.log(`\n== ${label} ${w}px`);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|leaflet|unpkg|jsdelivr/i.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(() => localStorage.setItem('fittforma-welcome-v1', '1'));
  await page.goto(APP + '/'); await page.evaluate(k => localStorage.removeItem(k), KEY); await page.reload(); await page.waitForTimeout(500);
  const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
  const go = async view => { const sel = w < 761 ? `.mobile-nav-item[data-mobile-view="${view}"]` : `.tab[data-view="${view}"]`; await page.click(sel); await page.waitForTimeout(200); };
  const text = sel => page.textContent(sel).then(t => (t || '').trim());

  // Rutinas propias: crear, reordenar, duplicar, eliminar, editar
  await go('train'); await page.click('.view.active [data-subview="routines"]');
  await page.click('#newRoutine'); await page.fill('#routineName', 'Pierna fuerte');
  await page.fill('[data-rx="0"][data-rk="name"]', 'Sentadillas'); await page.fill('[data-rx="0"][data-rk="weight"]', '40'); await page.fill('[data-rx="0"][data-rk="rest"]', '90');
  await page.click('#routineAddExercise'); await page.fill('[data-rx="1"][data-rk="name"]', 'Zancadas');
  await page.click('[data-rmove="1:-1"]');
  await page.click('#routineForm button[type=submit]'); await page.waitForTimeout(150);
  let s = await st();
  step('Rutina guardada con el orden elegido', s.routines?.length === 1 && s.routines[0].exercises.map(e => e.name).join(',') === 'Zancadas,Sentadillas', JSON.stringify(s.routines?.[0]?.exercises?.map(e => e.name)));
  step('Rutina guarda kg y descanso', s.routines?.[0]?.exercises?.[1]?.weight === 40 && s.routines[0].exercises[1].rest === 90);
  await page.click('#newRoutine'); await page.fill('#routineName', 'X'); await page.click('#routineForm button[type=submit]');
  step('Validación de rutina inválida', /al menos 2 caracteres/.test(await text('#routineStatus')));
  await page.click('#routineCancel');
  const rid = s.routines[0].id;
  await page.click(`[data-routine-duplicate="${rid}"]`); s = await st();
  step('Duplicar rutina', s.routines.length === 2 && s.routines[0].name === 'Pierna fuerte (copia)');
  await page.click(`[data-routine-delete="${s.routines[0].id}"]`); s = await st();
  step('Eliminar rutina', s.routines.length === 1 && s.routines[0].id === rid);
  await page.click(`[data-routine-edit="${rid}"]`); await page.fill('#routineName', 'Pierna fuerte A'); await page.click('#routineForm button[type=submit]'); s = await st();
  step('Editar rutina persiste', s.routines[0].name === 'Pierna fuerte A' && s.routines.length === 1);

  // Caso 1: entrenamiento desde rutina, editar series, agregar ejercicio, finalizar
  await page.click(`[data-routine-start="${rid}"]`); await page.waitForTimeout(200);
  step('Sesión iniciada desde rutina', (await text('#trainContent')).includes('Pierna fuerte A'));
  await page.fill('input[data-e="0"][data-s="0"][data-k="reps"]', '12'); await page.check('input[data-done][data-e="0"][data-s="0"]');
  await page.click('[data-session-add-set="0"]');
  step('Agregar serie en la sesión', (await page.$$('input[data-e="0"][data-k="reps"]')).length === 4);
  await page.fill('#sessionAddExerciseName', 'Flexiones'); await page.click('#sessionAddExerciseForm button');
  const fi = (await st()) && await page.evaluate(() => [...document.querySelectorAll('.train-exercise-head h3')].findIndex(h => h.textContent.trim() === 'Flexiones'));
  await page.fill(`input[data-e="${fi}"][data-s="0"][data-k="reps"]`, '22'); await page.check(`input[data-done][data-e="${fi}"][data-s="0"]`);
  await page.reload(); await page.waitForTimeout(500); await go('train');
  step('La sesión en curso se recupera tras recargar', (await page.$$(`input[data-e="${fi}"][data-k="reps"]`)).length >= 1 && (await page.inputValue(`input[data-e="${fi}"][data-s="0"][data-k="reps"]`)) === '22');
  await page.evaluate(() => { const b = document.getElementById('finishWorkout'); b.click(); b.click(); }); await page.waitForTimeout(300);
  s = await st();
  step('Sesión guardada una sola vez (doble clic)', s.sessions?.length === 1, s.sessions?.length);
  step('Insignias de flexiones evaluadas (22 reps → 4 niveles)', Object.keys(s.badgeUnlocks || {}).filter(k => k.startsWith('exercise-flexiones:')).length === 4);
  await go('plan');
  step('Inicio refleja la sesión', (await text('#statSessions')) === '1');
  await go('progress'); await page.click('#progressTabHistory');
  step('Historial muestra la sesión', (await text('#historyList')).includes('Pierna fuerte A'));
  await page.click(`[data-session-edit="${s.sessions[0].id}"]`); await page.fill('[data-session-form] input[name=minutes]', '47'); await page.click('[data-session-form] button[type=submit]'); s = await st();
  step('Corregir sesión del historial', s.sessions[0].minutes === 47 && s.sessions.length === 1);

  // Entrenamiento libre
  await go('train');
  await page.click('#startFreeWorkout'); await page.waitForTimeout(150);
  await page.evaluate(() => document.getElementById('finishWorkout').click()); s = await st();
  step('Libre sin datos no se guarda', s.sessions.length === 1);
  await page.fill('#sessionAddExerciseName', 'Plancha frontal'); await page.click('#sessionAddExerciseForm button');
  await page.fill('input[data-e="0"][data-s="0"][data-k="reps"]', '45'); await page.check('input[data-done][data-e="0"][data-s="0"]');
  await page.evaluate(() => document.getElementById('finishWorkout').click()); await page.waitForTimeout(200); s = await st();
  step('Entrenamiento libre guardado sin crear rutina', s.sessions.length === 2 && s.sessions[0].title === 'Entrenamiento libre' && s.routines.length === 1);

  // Eliminar sesión revoca insignias que dependían de ella
  await go('progress'); await page.click('#progressTabHistory');
  const flexSession = s.sessions.find(x => x.title === 'Pierna fuerte A');
  await page.click(`[data-session-delete="${flexSession.id}"]`); s = await st();
  step('Eliminar sesión revoca sus insignias', s.sessions.length === 1 && Object.keys(s.badgeUnlocks || {}).filter(k => k.startsWith('exercise-flexiones:')).length === 0);

  // Caso 2: nutrición (registrar, editar sin duplicar, Inicio actualizado)
  await go('plan'); await page.click('[data-home-quick="meal"]'); await page.waitForTimeout(150);
  await page.fill('#mealName', 'Pollo con arroz'); await page.fill('#mealCalories', '600'); await page.fill('#mealProtein', '40');
  await page.click('#mealForm button[type=submit]'); s = await st();
  step('Comida registrada', s.meals.length === 1 && s.meals[0].calories === 600);
  await page.click('[data-view-tab="hoy"]'); await page.click('.editMeal'); await page.fill('#mealCalories', '650'); await page.click('#mealForm button[type=submit]'); s = await st();
  step('Editar comida no duplica', s.meals.length === 1 && s.meals[0].calories === 650);
  await go('plan');
  step('Inicio refleja las calorías', (await text('#homeKcalVal')).replace(/\D/g, '') === '650', await text('#homeKcalVal'));

  // Caso 4: hidratación
  await page.click('[data-home-quick="water"]'); await page.click('[data-home-quick="water"]');
  await go('nutrition'); await page.click('#removeWater'); await page.reload(); await page.waitForTimeout(400);
  s = await st(); const key = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  step('Agua: +2 −1 persiste tras recargar', Number(s.waterLogs?.[key]) === 1, s.waterLogs?.[key]);
  await go('plan');
  step('Inicio muestra el agua', (await text('#homeWaterVal')) === '1');

  // Caso 3: running manual
  await go('train'); await page.click('.view.active [data-subview="running"]');
  await page.fill('#runDistance', '5'); await page.fill('#runMinutes', '25'); await page.click('#runLogForm button[type=submit]'); await page.waitForTimeout(200); s = await st();
  const run = s.activities?.find(a => a.type === 'Correr');
  step('Carrera manual guardada', Boolean(run) && Number(run.distance) === 5);
  step('Carrera manual no figura como GPS', run && run.source !== 'gps');
  step('Insignia de running declarada (5 km → 4 niveles, sin GPS)', Object.values(s.badgeUnlocks || {}).filter(b => b.exerciseId === 'activity-running').length === 4 && Object.values(s.badgeUnlocks).filter(b => b.exerciseId === 'activity-running').every(b => b.evidence !== 'gps_device'));
  await go('progress'); await page.click('#progressTabBadges');
  step('Progreso › Insignias muestra running', (await text('#badgeGallery')).includes('Running'));

  // Etapa 4: períodos, cuerpo, fotos privadas, notificaciones y contexto de FittAI
  await go('progress'); await page.click('#progressTabSummary'); await page.click('[data-activity-period="4w"]');
  step('Período 4 semanas: 4 barras y comparación', (await page.$$('#weeklyActivityChart .activity-bar-day')).length === 4 && (await text('#activityPeriodSummary')).includes('Minutos'));
  await page.click('[data-activity-period="7d"]');
  step('Período 7 días: 7 barras', (await page.$$('#weeklyActivityChart .activity-bar-day')).length === 7);
  await page.click('#progressTabBody');
  await page.fill('#m_waist', '82.5'); await page.fill('#m_bodyFat', '18'); await page.click('#measureForm button[type=submit]'); s = await st();
  step('Medidas guardadas', s.bodyMeasures?.length === 1 && s.bodyMeasures[0].waist === 82.5);
  await page.fill('#m_waist', '82.5'); await page.fill('#m_bodyFat', '18'); await page.click('#measureForm button[type=submit]'); s = await st();
  step('Medidas duplicadas rechazadas', s.bodyMeasures.length === 1);
  await page.fill('#m_waist', '500'); await page.click('#measureForm button[type=submit]'); s = await st();
  step('Medida imposible rechazada', s.bodyMeasures.length === 1);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#progressPhotoFile', { name: 'p.png', mimeType: 'image/png', buffer: png });
  await page.click('#progressPhotoForm button[type=submit]'); await page.waitForTimeout(600);
  step('Foto de progreso guardada en el dispositivo', (await page.$$('.progress-photo img')).length === 1);
  step('La foto no entra en el estado sincronizable', !JSON.stringify(await st()).includes('image/'));
  await page.reload(); await page.waitForTimeout(500); await go('progress'); await page.click('#progressTabBody'); await page.waitForTimeout(400);
  step('Foto persiste tras recargar', (await page.$$('.progress-photo img')).length === 1);
  await page.click('[data-remove-photo]'); await page.waitForTimeout(400);
  step('Quitar foto', (await page.$$('.progress-photo img')).length === 0);
  await go('plan'); s = await st();
  step('Notificación de insignia creada una sola vez por desafío', (s.notifications || []).filter(n => n.id.startsWith('badge:exercise-flexiones')).length === 1 && (s.notifications || []).some(n => n.id.startsWith('badge:activity-running')));
  step('Campana con contador', await page.isVisible('#notifCount'));
  await page.click('#notifBell'); await page.click('#notifReadAll'); await page.waitForTimeout(150); s = await st();
  step('Marcar todo como leído', (s.notifications || []).every(n => n.read) && !(await page.isVisible('#notifCount')));
  await page.click('#notifBell');
  const coachBodies = [];
  await page.route('**/api/coach', async r => { coachBodies.push(JSON.parse(r.request().postData())); await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Respuesta de prueba', proposal: null }) }); });
  await go('train'); await page.click('.view.active [data-subview="coach"]');
  await page.fill('#coachInput', '¿Cómo voy?'); await page.click('#coachForm button[type=submit]'); await page.waitForTimeout(400);
  const withData = coachBodies[0] || {};
  step('FittAI recibe nutrición, rutinas e insignias', withData.shareData === true && withData.nutrition?.today?.calories === 650 && withData.routines?.length === 1 && Array.isArray(withData.badges));
  await page.uncheck('#coachShareData');
  await page.fill('#coachInput', 'Otra pregunta'); await page.click('#coachForm button[type=submit]'); await page.waitForTimeout(400);
  const noData = coachBodies[1] || {};
  step('Sin permiso FittAI solo recibe el mensaje', noData.shareData === false && !('profile' in noData) && !('sessions' in noData) && !('nutrition' in noData));
  await page.unroute('**/api/coach');

  step('Sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO PASA');
process.exitCode = failures ? 1 : 0;
