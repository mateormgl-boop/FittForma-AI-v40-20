// v57: copia automática en la nube. Navegador real + supabase-js real + PostgREST real sobre PostgreSQL local
// (solo /auth/v1 se simula). Mismas variables que community.e2e.mjs (ver docs/PRUEBAS.md). NO apuntar nunca a un proyecto real.
// Comprueba que la copia se sube sola y que nunca pisa una copia más nueva de otro dispositivo ni sube datos vacíos encima.
import { createRequire } from 'module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const SECRET = fs.readFileSync(process.env.JWT_SECRET_FILE || '/var/tmp/ff_jwt_secret', 'utf8').trim();
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = payload => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload); return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const exp = Math.floor(Date.now() / 1000) + 3600;
const ANON = jwt({ role: 'anon', iss: 'supabase', exp });
const EMAIL = 'carla@example.test', UID = 'cccccccc-0000-0000-0000-000000000003';
const userObj = () => ({ id: UID, aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() });
const sql = q => execFileSync('psql', ['-d', process.env.E2E_DB || 'ff_e2e', '-Atc', q], { env: process.env }).toString().trim();
const SUPA = 'https://e2e.supabase.co', APP = process.env.APP_URL || 'http://localhost:8787', PGRST = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
const APP_VERSION = (await (await fetch(APP + '/api/public-config')).json()).version;
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };

sql(`insert into auth.users(id,email) values('${UID}','${EMAIL}') on conflict do nothing; delete from user_app_data where user_id='${UID}'`);
const cloudSessions = () => sql(`select coalesce(jsonb_array_length(data->'sessions'),-1) from user_app_data where user_id='${UID}'`);
const seed = { profile: { goal: 'fitness' }, sessions: [{ id: 5, type: 'custom', status: 'completed', date: '2026-10-15', title: 'Pecho y tríceps', minutes: 40, completedSets: 6, exercises: [{ name: 'Press de banca con barra', group: 'Pecho', kind: 'strength', entries: [{ reps: '8', weight: '40', done: true }] }] }], activities: [], badgeRecords: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('fittforma-ai-v4', s); sessionStorage.setItem('seeded', '1'); } localStorage.setItem('fittforma-welcome-v1', '1'); setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); }, JSON.stringify(seed));
await page.route(/unpkg\.com/, r => r.abort());
await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(process.env.SUPABASE_UMD) }));
await page.route('**/api/public-config', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: APP_VERSION, supabase: { configured: true, url: SUPA, anonKey: ANON, keyType: 'legacy_anon' }, missing: [], issue: null }) }));
await page.route(`${SUPA}/rest/v1/**`, async route => {
  const req = route.request(), url = new URL(req.url());
  const headers = { ...req.headers() }; delete headers.host; delete headers.origin; delete headers.referer;
  const res = await fetch(PGRST + url.pathname.replace('/rest/v1', '') + url.search, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() });
  const outHeaders = Object.fromEntries([...res.headers].filter(([k]) => !['content-encoding', 'transfer-encoding', 'connection'].includes(k)));
  await route.fulfill({ status: res.status, headers: { ...outHeaders, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: Buffer.from(await res.arrayBuffer()) });
});
await page.route(`${SUPA}/auth/v1/**`, async route => {
  const req = route.request(), url = new URL(req.url()), cors = { 'access-control-allow-origin': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (url.pathname.endsWith('/token')) return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ access_token: jwt({ sub: UID, role: 'authenticated', aud: 'authenticated', email: EMAIL, exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-c', user: userObj() }) });
  if (url.pathname.endsWith('/user')) return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify(userObj()) });
  if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors });
  return route.fulfill({ status: 404, headers: cors, body: '{}' });
});
await page.route(`${SUPA}/storage/v1/**`, r => r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' }));

// «Lo hice» desde la ficha: un cambio real hecho con la app, que pasa por save().
const logOnce = async () => {
  await page.evaluate(() => { const all = [...document.querySelectorAll('[data-exercise-detail]')]; (all.find(x => /Press de banca/.test(x.dataset.exerciseDetail)) || all.find(x => (x.dataset.exerciseKind || 'strength') === 'strength'))?.click(); });
  await page.waitForTimeout(250);
  await page.evaluate(() => document.getElementById('exTabMineBtn')?.click());
  await page.click('#quickLogOpen'); await page.fill('#qlSets', '2'); await page.fill('#qlValue', '10'); await page.fill('#qlWeight', '30');
  await page.click('#quickLogForm button[type="submit"]'); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('[data-close-exercise-modal]')?.click()); await page.waitForTimeout(150);
};
// Salir de la app (pestaña oculta) sube enseguida lo pendiente.
const leaveApp = async () => {
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  await page.waitForTimeout(1500);
};
const autoStatus = () => page.evaluate(() => { const e = document.getElementById('cloudAutoStatus'); return { state: e?.dataset.state || '', text: e?.textContent || '' }; });

await page.goto(APP + '/'); await page.waitForTimeout(1200);
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(400);
await page.evaluate(() => { const d = document.getElementById('cloudAccountCard')?.closest('details'); if (d) d.open = true; });
step('Sin sesión no se muestra la copia automática', !(await page.isVisible('#cloudAutoRow')));
await page.fill('#cloudEmail', EMAIL); await page.fill('#cloudPassword', 'clave-segura-123'); await page.click('#cloudLogin');
await page.waitForTimeout(4500);
step('Al iniciar sesión se ofrece la copia automática, prendida', await page.isVisible('#cloudAutoRow') && await page.isChecked('#cloudAutoToggle'));
step('Primera copia: se sube sola (no había copia en la nube)', cloudSessions() === '1', cloudSessions());
step('Indica que la copia está al día', (await autoStatus()).state === 'ok', (await autoStatus()).text);

await logOnce();
step('Un cambio deja la copia pendiente', (await autoStatus()).state === 'pending');
await leaveApp();
step('Al salir de la app se sube lo pendiente', cloudSessions() === '2', cloudSessions());

// Otro dispositivo guarda una copia más nueva: este dispositivo no la pisa.
sql(`update user_app_data set data = jsonb_set(data,'{sessions}', (data->'sessions') || (data->'sessions')), updated_at = now() + interval '1 second' where user_id='${UID}'`);
await logOnce(); await leaveApp();
step('No pisa una copia más nueva hecha desde otro dispositivo', cloudSessions() === '4', cloudSessions());
const paused = await autoStatus();
step('Avisa que está en pausa y qué hacer', paused.state === 'newer' && /Cargar datos de la nube/.test(paused.text), paused.text.slice(0, 120));
await page.click('#cloudDownload'); await page.waitForTimeout(1500);
step('Cargar la copia de la nube la trae a este dispositivo', await page.evaluate(() => JSON.parse(localStorage.getItem('fittforma-ai-v4')).sessions.length) === 4);
await logOnce(); await leaveApp();
step('Después de elegir, la copia automática sigue sola', cloudSessions() === '5' && (await autoStatus()).state === 'ok', cloudSessions());

// Borrar los datos locales no vacía la copia de la nube.
await page.evaluate(() => document.getElementById('clearData').click()); await page.waitForTimeout(400); await leaveApp();
step('Con este dispositivo vacío no se reemplaza la copia de la nube', cloudSessions() === '5', cloudSessions());
step('Explica cómo recuperar los datos', (await autoStatus()).state === 'empty');
await page.click('#cloudDownload'); await page.waitForTimeout(1500);

// Apagarla: los cambios quedan solo en el dispositivo.
await page.uncheck('#cloudAutoToggle'); await logOnce(); await leaveApp();
step('Apagada, no sube nada', cloudSessions() === '5' && (await autoStatus()).state === 'off', cloudSessions());
await page.click('#cloudUpload'); await page.waitForTimeout(1200);
step('El botón manual sigue funcionando', cloudSessions() === '6', cloudSessions());
step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
sql(`delete from user_app_data where user_id='${UID}'`);
await browser.close();
console.log(`\ncloud-backup: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
