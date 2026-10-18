// E2E de flujos críticos que no cubre integration.e2e.mjs (Etapa 7):
// generar plan, propuesta de FittAI (aprobar, deshacer, rechazar), GPS simulado, foto de comida,
// hábitos, exportar → borrar → importar, cambio de idioma y uso sin conexión (service worker).
// Uso: APP_URL=http://localhost:8787 node tests/e2e/flows.e2e.mjs  (con `npm start` en otra terminal)
import { createRequire } from 'module';

// v48: la pantalla de logro es modal; las pruebas la registran y la cierran para seguir navegando.
const CLOSE_CELEBRATION = () => { window.__celebrations = []; setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d && d.open) { window.__celebrations.push(document.getElementById('badgeCelebrationName')?.textContent || ''); d.close(); } }, 50); };
import fs from 'node:fs';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
const KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERR ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|ERR_INTERNET_DISCONNECTED|leaflet|unpkg|jsdelivr/i.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
await page.addInitScript(CLOSE_CELEBRATION);
  await page.addInitScript(() => {
  localStorage.setItem('fittforma-welcome-v1', '1');
  // GPS simulado: la prueba decide cada posición y su hora (con el reloj simulado de Playwright).
  const watchers = new Map(); let next = 1;
  const fake = {
    watchPosition(ok) { const id = next++; watchers.set(id, ok); return id; },
    clearWatch(id) { watchers.delete(id); },
    getCurrentPosition(ok) { ok({ coords: { latitude: -34.9, longitude: -56.16, accuracy: 5 }, timestamp: Date.now() }); }
  };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, get: () => fake });
  window.__gpsEmit = (lat, lon, accuracy = 5) => watchers.forEach(ok => ok({ coords: { latitude: lat, longitude: lon, accuracy }, timestamp: Date.now() }));
});
await page.clock.install();
await page.goto(APP + '/'); await page.waitForTimeout(700);

const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
const go = view => page.evaluate(v => {
  const visible = sel => [...document.querySelectorAll(sel)].find(x => x.offsetParent);
  const parent = { routines: 'train', exercises: 'train' }[v];
  if (parent) visible(`.tab[data-view="${parent}"]`)?.click();
  (visible(`.tab[data-view="${v}"]`) || visible(`[data-subview="${v}"]`))?.click();
}, view).then(() => page.waitForTimeout(250));
// Abre los <details> que contienen el elemento (la app agrupa formularios en secciones plegables).
const reveal = sel => page.evaluate(q => { let el = document.querySelector(q); for (let d = el?.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true; el?.scrollIntoView({ block: 'center' }); }, sel);

// 1. Generar el plan desde el perfil
await go('routines');
await reveal('#days'); await page.selectOption('#days', '4'); await reveal('#makePlan'); await page.click('#makePlan'); await page.waitForTimeout(300);
let s = await st();
step('Plan generado con los días elegidos', s.plan?.days?.length === 4 && (await page.$$('#planOutput .startDay')).length === 4, String(s.plan?.days?.length));

// 2. Propuesta de FittAI: aprobar aplica, deshacer restaura, rechazar conserva
const proposal = { reply: 'Te propongo bajar a 3 días.', proposal: { title: 'Plan de 3 días', description: 'Menos días, más recuperación.', kind: 'routine', days: 3, duration: 45 } };
await page.route('**/api/coach', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(proposal) }));
await go('coach');
await reveal('#coachInput'); await page.fill('#coachInput', '¿Puedo entrenar menos días?'); await page.press('#coachInput', 'Enter'); await page.waitForTimeout(500);
step('La propuesta queda pendiente sin cambiar el plan', (await st()).plan.days.length === 4 && await page.isVisible('#approveProposal'));
await page.click('#approveProposal'); await page.waitForTimeout(300); s = await st();
step('Aprobar aplica la propuesta (3 días, 45 min)', s.plan.days.length === 3 && s.profile.days === '3' && s.profile.duration === '45' && s.proposal.status === 'approved');
await go('routines'); await reveal('#undoPlan'); await page.click('#undoPlan'); await page.waitForTimeout(300); s = await st();
step('Deshacer restaura el plan anterior', s.plan.days.length === 4 && s.profile.days === '4');
await go('coach');
await page.fill('#coachInput', 'Otra propuesta'); await page.press('#coachInput', 'Enter'); await page.waitForTimeout(500);
await page.click('#rejectProposal'); await page.waitForTimeout(200); s = await st();
step('Rechazar conserva el plan actual', s.plan.days.length === 4 && s.proposal.status === 'rejected');

// 3. GPS simulado: ~300 m en 100 s
await go('running');
const before = (await st()).activities?.length || 0;
await reveal('#gpsStart'); await page.click('#gpsStart'); await page.waitForTimeout(100);
const lat0 = -34.9, lon0 = -56.16, dLat = 15 / 111320;
for (let i = 0; i <= 20; i++) { await page.clock.runFor(5000); await page.evaluate(([a, b]) => window.__gpsEmit(a, b), [lat0 + i * dLat, lon0]); }
await page.evaluate(([a, b]) => window.__gpsEmit(a, b, 120), [lat0 + 40 * dLat, lon0]); // señal imprecisa: no suma distancia
await reveal('#gpsStop'); await page.click('#gpsStop'); await page.waitForTimeout(300); s = await st();
const act = s.activities?.[s.activities.length - 1];
step('Actividad GPS guardada', (s.activities?.length || 0) === before + 1 && act?.source === 'gps', JSON.stringify({ km: act?.distance, s: act?.durationSeconds }));
step('Distancia GPS plausible (≈0,30 km) e ignora la señal imprecisa', act && Math.abs(act.distance - 0.3) < 0.02, String(act?.distance));
step('Duración y ritmo calculados', act && act.durationSeconds >= 100 && act.durationSeconds <= 110 && act.paceSecondsPerKm > 300 && act.paceSecondsPerKm < 380, `${act?.durationSeconds}s ${act?.paceSecondsPerKm}s/km`);
step('Ruta guardada con sus puntos', Array.isArray(act?.route) && act.route.length >= 20);

// 4. Foto de comida: completa el formulario pero no registra sola
await page.route('**/api/meal-photo', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: 'Ensalada con pollo', calories: 420, protein: 35, carbs: 20, fat: 18, notes: 'Estimación de prueba.' }) }));
await go('nutrition');
await page.evaluate(() => document.querySelector('[data-tab-target="registrar"], [data-nutrition-tab="registrar"], [data-view-tab="registrar"]')?.click());
const mealsBefore = (await st()).meals?.length || 0;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await page.setInputFiles('#mealPhoto', { name: 'plato.png', mimeType: 'image/png', buffer: png });
await page.evaluate(() => document.getElementById('analyzeMealPhoto').click()); await page.waitForTimeout(600);
step('Foto de comida completa el formulario', (await page.inputValue('#mealName')) === 'Ensalada con pollo' && (await page.inputValue('#mealCalories')) === '420');
step('La estimación no se registra sin confirmar', ((await st()).meals?.length || 0) === mealsBefore);

// 5. Hábitos: marcar persiste tras recargar
await page.evaluate(() => { const i = document.querySelector('#habitChecklist [data-habit-key]'); i.click(); });
await page.waitForTimeout(200);
const habitDay = Object.values((await st()).habitLogs || {}).find(d => d && Object.values(d).some(v => v === true));
step('Hábito marcado se guarda', Boolean(habitDay));

// 6. Exportar → borrar → importar recupera los datos
await go('profile');
const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('exportData').click())]);
const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
s = await st();
step('La exportación contiene los datos actuales', exported.activities?.length === s.activities.length && exported.plan?.days?.length === 4);
await page.evaluate(() => document.getElementById('clearData').click()); await page.waitForTimeout(300);
step('Borrar datos deja la app vacía', ((await st()).activities?.length || 0) === 0);
await page.setInputFiles('#importDataFile', { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
await page.waitForTimeout(500); s = await st();
step('Importar recupera actividades, plan y hábitos', s.activities.length === exported.activities.length && s.plan?.days?.length === 4 && JSON.stringify(s.habitLogs) === JSON.stringify(exported.habitLogs));

// 7. Idiomas: la navegación cambia en los seis idiomas
const navText = () => page.evaluate(() => [...document.querySelectorAll('.tab[data-view]')].map(t => t.textContent.trim()).join('|'));
const spanish = await navText();
const langs = {};
for (const lang of ['en', 'pt', 'fr', 'it', 'de']) { await page.evaluate(l => window.FittFormaI18n?.setLanguage(l), lang); await page.waitForTimeout(150); langs[lang] = await navText(); }
await page.evaluate(() => window.FittFormaI18n?.setLanguage('es')); await page.waitForTimeout(150);
step('La navegación se traduce en los cinco idiomas', Object.values(langs).every(t => t && t !== spanish) && new Set(Object.values(langs)).size === 5, langs.en);
step('Volver a español restaura los textos', (await navText()) === spanish);

// 7b. Cobertura de traducción: en inglés no quedan textos con letras propias del español en las secciones principales
await page.evaluate(() => window.FittFormaI18n?.setLanguage('en'));
const leftovers = new Set();
for (const v of ['plan', 'train', 'routines', 'exercises', 'nutrition', 'progress', 'community', 'profile', 'coach', 'running']) {
  await go(v);
  (await page.evaluate(() => {
    const root = document.querySelector('.view.active'); const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (t && !n.parentElement.closest('[hidden],.bubble,script,style,select,#proposalArea,#photoStatus') && /[áéíóúñ¿¡]/.test(t)) out.push(t); }
    root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e => ['placeholder', 'aria-label', 'title'].forEach(a => { const t = e.getAttribute(a); if (t && /[áéíóúñ¿¡]/.test(t) && !e.closest('[hidden]')) out.push(t); }));
    return out;
  })).forEach(t => leftovers.add(t));
}
const enDate = await page.textContent('#habitTodayDate');
await page.evaluate(() => window.FittFormaI18n?.setLanguage('es')); await page.waitForTimeout(150);
step('Las fechas siguen el idioma elegido', /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(enDate) && /\b(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\b/.test(await page.textContent('#habitTodayDate')), enDate);
step('En inglés no quedan textos en español visibles', leftovers.size === 0, [...leftovers].slice(0, 5).join(' | '));

// 8. Sin conexión: el service worker sirve la app ya visitada
await page.clock.runFor(1000);
const swReady = await page.evaluate(async () => { if (!('serviceWorker' in navigator)) return false; const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 8000))]); return Boolean(reg?.active); });
step('Service worker activo', swReady);
await page.reload(); await page.waitForTimeout(800); // segunda carga: queda controlada por el service worker
await context.setOffline(true);
await page.reload().catch(() => {}); await page.waitForTimeout(800);
step('Sin conexión la app abre y conserva los datos', await page.isVisible('#view-plan') && ((await st()).activities?.length || 0) > 0);
await context.setOffline(false);

step('Sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO PASA');
process.exitCode = failures ? 1 : 0;
