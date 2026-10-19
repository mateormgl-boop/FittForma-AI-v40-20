// v50: GPS simulado (Playwright) para correr, caminar y bicicleta: pausa, reanudación, saltos descartados,
// tiempo en movimiento, velocidad máxima, calorías estimadas con el peso vigente y recuperación del borrador.
// No prueba el segundo plano real (requiere un celular): ver docs/GPS_SEGUNDO_PLANO.md.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/gps.e2e.mjs
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
await page.route(/cdn\.jsdelivr|unpkg\.com|tile\.openstreetmap/, r => r.abort());
// GPS simulado y controlado: entrega posiciones con la misma forma que la API del navegador (y que el puente nativo).
await page.addInitScript(() => {
  localStorage.setItem('fittforma-welcome-v1', '1');
  const watchers = new Map(); let n = 0;
  const geo = { watchPosition(ok, err) { const id = ++n; watchers.set(id, { ok, err }); return id; }, clearWatch(id) { watchers.delete(id); }, getCurrentPosition(ok) { ok({ coords: { latitude: -34.9011, longitude: -56.1645, accuracy: 5 }, timestamp: Date.now() }); } };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  window.__geoEmit = (lat, lon, acc, alt, altAcc) => { for (const w of [...watchers.values()]) w.ok({ coords: { latitude: lat, longitude: lon, accuracy: acc, altitude: alt ?? null, altitudeAccuracy: altAcc ?? null, speed: null }, timestamp: Date.now() }); };
  window.__geoError = code => { for (const w of [...watchers.values()]) w.err({ code, message: '' }); };
  window.__geoWatchers = () => watchers.size;
});
await page.goto(APP + '/'); await page.waitForTimeout(500);
await page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k) || '{}'); s.profile = { ...(s.profile || {}), currentWeightKg: 70 }; s.sessions = s.sessions || []; localStorage.setItem(k, JSON.stringify(s)); }, KEY); await page.reload(); await page.waitForTimeout(600);
const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(200);
await page.click('.subnav-item[data-subview="running"]:visible'); await page.waitForTimeout(300);
const wait = ms => page.waitForTimeout(ms);
// Mueve hacia el este a velocidad v (m/s) en pasos de dt segundos.
let lat = -34.9011, lon = -56.1645;
const mPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);
const emit = (acc = 5) => page.evaluate(([a, b, c]) => window.__geoEmit(a, b, c), [lat, lon, acc]);
async function move(n, v, dt = 1, acc = 5) { for (let i = 0; i < n; i++) { await wait(dt * 1000); lon += (v * dt) / mPerDegLon; await emit(acc); } }

async function session(type, plan) {
  await page.selectOption('#gpsActivityType', type); await page.click('#gpsStart'); await wait(300); await emit();
  await plan(); await page.click('#gpsStop'); await wait(600);
  const s = await st(); return s.activities[s.activities.length - 1];
}

// 1. Bicicleta: 12 tramos a ~8 m/s, pausa, reanuda y sigue; incluye un salto imposible que se descarta.
const bike = await session('Bicicleta', async () => {
  await move(12, 8);
  step('Señal GPS visible mientras registra', /Señal buena/.test(await page.textContent('#gpsSignal')));
  const live = await page.textContent('#gpsKcal'); step('Calorías estimadas en vivo con el peso del perfil', /≈ \d+ kcal/.test(live), live);
  step('Bicicleta muestra velocidad (km/h), no ritmo', /km\/h/.test(await page.textContent('#gpsPace')) && /Velocidad actual/.test(await page.textContent('#gpsSpeedLabel')));
  await page.click('#gpsPause'); const t1 = await page.textContent('#gpsTime'); await wait(2200); const t2 = await page.textContent('#gpsTime');
  step('En pausa el tiempo no avanza', t1 === t2, `${t1} → ${t2}`);
  await page.click('#gpsPause'); await wait(300);
  lon += 600 / mPerDegLon; await emit(); // salto tras reanudar: inicia tramo nuevo
  await move(8, 8);
  lon += 400 / mPerDegLon; await wait(1000); await emit(); // salto imposible: 400 m en 1 s
  await move(4, 8);
  await page.evaluate(() => window.__geoError(2)); // corte breve de señal
  step('Un corte breve de señal no detiene el registro', (await page.evaluate(() => window.__geoWatchers())) === 1 && /continúa/.test(await page.textContent('#gpsStatus')));
  await move(1, 8); await move(4, 8);
});
step('Bicicleta guardada como actividad propia', bike?.type === 'Bicicleta' && /^gps/.test(bike.source), JSON.stringify({ t: bike?.type, s: bike?.source }));
step('Distancia sin contar saltos ni el tramo pausado', bike.distance > 0.2 && bike.distance < 0.27, String(bike.distance));
step('Tiempo en movimiento y velocidad máxima guardados', bike.movingMinutes > 0 && bike.maxSpeedKmh > 20 && bike.maxSpeedKmh < 40, `${bike.movingMinutes} min · ${bike.maxSpeedKmh} km/h`);
step('Calorías de bici con el Compendio 2011 y 70 kg', bike.calories?.method === 'compendio-2011-bicicleta' && bike.calories.weightKg === 70 && bike.calories.kcal > 0, JSON.stringify(bike.calories));
step('Resumen al finalizar con mapa y calorías', await page.isVisible('#gpsSummary') && /Calorías estimadas/.test(await page.textContent('#gpsSummary')) && await page.isVisible('#gpsSummaryRoute'));

// 2. Caminata con el peso actualizado a 90 kg: usa el peso nuevo; la bici conserva 70 kg.
await page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); s.profile.currentWeightKg = 90; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
await page.reload(); await wait(600); await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.click('.subnav-item[data-subview="running"]:visible'); await wait(300);
const walk = await session('Caminar', async () => { await move(30, 1.4); await move(3, 1.4, 1, 60); step('Señal imprecisa marcada como insuficiente', /insuficiente/i.test(await page.textContent('#gpsSignal'))); await move(4, 1.4); });
let s = await st();
step('Caminata con ecuación ACSM y 90 kg', walk.type === 'Caminar' && walk.calories?.method === 'acsm-caminar' && walk.calories.weightKg === 90, JSON.stringify(walk.calories));
step('El registro anterior conserva el peso con que se calculó', s.activities.find(a => a.type === 'Bicicleta').calories.weightKg === 70);

// 3. Correr y recuperar un borrador tras recargar la página (simula que el sistema cerró la pestaña).
await page.selectOption('#gpsActivityType', 'Correr'); await page.click('#gpsStart'); await wait(300); await emit(); await move(20, 3.2);
await wait(5500); // el borrador se guarda cada 5 s
await page.reload(); await wait(800); await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.click('.subnav-item[data-subview="running"]:visible'); await wait(300);
step('Al volver aparece la actividad interrumpida', await page.isVisible('#gpsDraftNotice'));
await page.click('#gpsRestoreDraft'); await wait(400);
const restored = await page.textContent('#gpsDistance');
step('El recorrido se recupera en pausa', parseFloat(restored) > 0.015 && /Reanudar/.test(await page.textContent('#gpsPause')), restored);
await page.click('#gpsPause'); await wait(300); await emit(); await move(14, 3.2); await page.click('#gpsStop'); await wait(600);
s = await st(); const run = s.activities[s.activities.length - 1];
step('Carrera guardada con ritmo y ecuación ACSM de carrera', run.type === 'Correr' && run.paceSecondsPerKm > 0 && run.calories?.method === 'acsm-correr', JSON.stringify({ d: run.distance, c: run.calories?.method }));
step('Historial muestra calorías estimadas', /kcal/.test(await page.textContent('#runningHistory')) && /kcal/.test(await page.textContent('#activityHistory')));

// 4. Progreso: gasto estimado por actividad (semana y mes), separado de lo consumido.
await page.click('.mobile-nav-item[data-mobile-view="progress"]'); await wait(400);
const exp = await page.textContent('#expenditureBody');
step('Progreso muestra calorías gastadas por correr, caminar y bici', /Correr[\s\S]*Caminar[\s\S]*Bicicleta[\s\S]*fuerza/i.test(exp), exp.replace(/\s+/g, ' ').slice(0, 160));
await page.click('[data-exp-period="month"]'); step('Vista mensual', /Este mes/.test(await page.textContent('#expenditureBody')));
step('Sin errores de página', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO PASA');
process.exit(failures ? 1 : 0);
