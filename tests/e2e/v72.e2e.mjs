// v72: normas de la comunidad (se aceptan antes de publicar, comentar o mandar mensajes; se guardan en la base) y
// recordatorios de la app de Android (con un plugin de notificaciones simulado: acá no hay teléfono ni SDK de Android).
// Navegador real + supabase-js real + PostgREST real sobre PostgreSQL local. Solo /auth y /storage se simulan.
// Usuarios de prueba example.test. NO apuntar nunca a un proyecto real. Preparación: docs/PRUEBAS.md.
import { createRequire } from 'module';
import crypto from 'node:crypto';
import fs from 'node:fs';

// v48: la pantalla de logro es modal; las pruebas la registran y la cierran para seguir navegando.
const CLOSE_CELEBRATION = () => { window.__celebrations = []; setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d && d.open) { window.__celebrations.push(document.getElementById('badgeCelebrationName')?.textContent || ''); d.close(); } }, 50); };
import { execFileSync } from 'node:child_process';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const SECRET = fs.readFileSync(process.env.JWT_SECRET_FILE || '/var/tmp/ff_jwt_secret', 'utf8').trim();
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = payload => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload); return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const exp = Math.floor(Date.now() / 1000) + 3600;
const ANON = jwt({ role: 'anon', iss: 'supabase', exp });
const USERS = { 'alice@example.test': 'aaaaaaaa-0000-0000-0000-000000000001', 'bob@example.test': 'bbbbbbbb-0000-0000-0000-000000000002' };
const userObj = email => ({ id: USERS[email], aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() });
const tokenFor = email => jwt({ sub: USERS[email], role: 'authenticated', aud: 'authenticated', email, exp });
const sql = q => execFileSync('psql', ['-d', process.env.E2E_DB || 'ff_e2e', '-Atc', q], { env: process.env }).toString().trim();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SUPA = 'https://e2e.supabase.co';
const APP = process.env.APP_URL || 'http://localhost:8787';
const PGRST = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
const uploaded = [];
const APP_VERSION = (await (await fetch(APP + '/api/public-config')).json()).version;

async function wire(page) {
await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(process.env.SUPABASE_UMD) }));
await page.route('**/api/public-config', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: APP_VERSION, supabase: { configured: true, url: SUPA, anonKey: ANON, keyType: 'legacy_anon' }, missing: [], issue: null }) }));
await page.route(`${SUPA}/rest/v1/**`, async route => {
  const req = route.request(), url = new URL(req.url());
  const headers = { ...req.headers() }; delete headers.host; delete headers.origin; delete headers.referer;
  const res = await fetch(PGRST + url.pathname.replace('/rest/v1', '') + url.search, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() });
  const body = Buffer.from(await res.arrayBuffer());
  const outHeaders = Object.fromEntries([...res.headers].filter(([k]) => !['content-encoding', 'transfer-encoding', 'connection'].includes(k)));
  await route.fulfill({ status: res.status, headers: { ...outHeaders, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body });
});
await page.route(`${SUPA}/auth/v1/**`, async route => {
  const req = route.request(), url = new URL(req.url());
  const cors = { 'access-control-allow-origin': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (url.pathname.endsWith('/token')) {
    const { email, password } = JSON.parse(req.postData() || '{}');
    if (!USERS[email] || password !== 'clave-segura-123') return route.fulfill({ status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
    return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ access_token: tokenFor(email), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + email, user: userObj(email) }) });
  }
  if (url.pathname.endsWith('/user')) { const tok = (req.headers().authorization || '').split(' ')[1]; const sub = tok && JSON.parse(Buffer.from(tok.split('.')[1], 'base64url')).sub; const email = Object.keys(USERS).find(e => USERS[e] === sub); return email ? route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify(userObj(email)) }) : route.fulfill({ status: 401, headers: cors, body: '{}' }); }
  // v63: la app pregunta qué proveedores tiene el proyecto (Google se muestra solo si está activado), como en Supabase.
  if (url.pathname.endsWith('/settings')) return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ external: { email: true, google: false } }) });
  if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors });
  return route.fulfill({ status: 404, headers: cors, body: '{}' });
});
await page.route(`${SUPA}/storage/v1/**`, async route => {
  const req = route.request(), url = new URL(req.url()), cors = { 'access-control-allow-origin': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (url.pathname.includes('/object/sign/') && req.method() === 'GET') return route.fulfill({ headers: cors, contentType: 'image/png', body: PNG }); // la URL firmada devuelve la imagen
  if (url.pathname.includes('/object/sign/')) { const path = url.pathname.split('/object/sign/community-media/')[1]; return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ signedURL: `/object/sign/community-media/${path}?token=t` }) }); }
  if (url.pathname.includes('/object/community-media/') && req.method() === 'POST') { const path = url.pathname.split('/object/community-media/')[1]; uploaded.push(path); return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ Key: 'community-media/' + path, Id: crypto.randomUUID() }) }); }
  if (req.method() === 'GET') return route.fulfill({ headers: cors, contentType: 'image/png', body: PNG });
  return route.fulfill({ headers: cors, contentType: 'application/json', body: '[]' });
});
}

const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) process.exitCode = 1; };
const A = 'aaaaaaaa-0000-0000-0000-000000000001', B = 'bbbbbbbb-0000-0000-0000-000000000002';
sql(`insert into auth.users(id,email) values('${A}','alice@example.test'),('${B}','bob@example.test') on conflict do nothing`);
sql(`insert into community_profiles(user_id,username,display_name,visibility) values('${A}','alicia_fit','Alicia','public'),('${B}','bruno_fit','Bruno Fit','public') on conflict (user_id) do update set username=excluded.username, display_name=excluded.display_name, visibility='public'`);
sql(`delete from community_rules_acceptance where user_id in ('${A}','${B}')`);
sql(`delete from community_posts where user_id='${A}' and post_kind='text'`);
const textPosts = () => sql(`select count(*) from community_posts where user_id='${A}' and post_kind='text'`);
const accepted = () => sql(`select coalesce(max(rules_version),0) from community_rules_acceptance where user_id='${A}'`);

const browser = await chromium.launch();
const errors = [];
async function openApp(init = () => {}, arg = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { for (const k of ['fittforma-welcome-v1', 'fittforma-tour-v68', 'fittforma-guide-hint-v68', 'fittforma-health-notice-v64']) localStorage.setItem(k, '1'); });
  await page.addInitScript(CLOSE_CELEBRATION);
  await page.addInitScript(init, arg);
  await page.route(/unpkg\.com/, r => r.abort());
  await wire(page);
  await page.goto(APP + '/'); await page.waitForTimeout(1200);
  return { ctx, page };
}
const login = async page => {
  await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(900);
  await page.click('#communityTabProfile'); await page.waitForTimeout(300);
  if (await page.isVisible('#communityAuthBanner [data-auth-open="login"]')) {
    await page.click('#communityAuthBanner [data-auth-open="login"]'); await page.fill('#authEmail', 'alice@example.test'); await page.fill('#authPassword', 'clave-segura-123');
    await page.click('#authSubmit'); await page.waitForTimeout(1600);
    await page.keyboard.press('Escape').catch(() => {});
    await page.click('#communityStatsNoticeOk').catch(() => {});
  }
};
const openPublish = async page => { await page.click('#communityTabProfile'); await page.waitForTimeout(400); await page.click('#communityOpenPublish'); await page.waitForTimeout(400); await page.click('[data-post-kind="text"]').catch(() => {}); };

// 1) Primera publicación: aparecen las normas y sin aceptarlas no se publica nada.
let { ctx, page } = await openApp();
await login(page);
await openPublish(page);
await page.fill('#communityTextBody', 'Hoy hice mi primera dominada');
await page.click('#communityTextPublish'); await page.waitForTimeout(700);
step('Al publicar por primera vez aparecen las normas de la comunidad', await page.isVisible('#communityRulesDialog') && /Normas de la comunidad/.test(await page.textContent('#communityRulesTitle')));
const rulesText = (await page.textContent('#communityRulesDialog')).replace(/\s+/g, ' ');
step('Las normas dicen qué no se permite y cómo reportar o bloquear', /Desnudos, contenido sexual o violencia/.test(rulesText) && /«Reportar»/.test(rulesText) && /«Bloquear»/.test(rulesText) && /al menos 13 años/.test(rulesText));
step('«Aceptar y seguir» está desactivado hasta marcar la casilla', await page.isDisabled('#communityRulesAccept'));
step('Hay un enlace a las normas completas', (await page.getAttribute('#communityRulesDialog a[href="/normas.html"]', 'target')) === '_blank');
await page.click('#communityRulesCancel'); await page.waitForTimeout(500);
step('«Ahora no» cierra y avisa que hay que aceptarlas', await page.isHidden('#communityRulesDialog') && /tenés que aceptar las normas/.test(await page.textContent('#communityComposeStatus')));
step('Sin aceptar, no se publicó nada', textPosts() === '0');
step('El texto escrito sigue en el formulario', (await page.inputValue('#communityTextBody')) === 'Hoy hice mi primera dominada');

// 2) Aceptar: se publica y la aceptación queda en la base (con la fecha que pone la base).
await page.click('#communityTextPublish'); await page.waitForTimeout(700);
await page.check('#communityRulesCheck');
step('Al marcar la casilla se puede aceptar', await page.isEnabled('#communityRulesAccept'));
await page.click('#communityRulesAccept'); await page.waitForTimeout(1800);
step('Después de aceptar, la publicación se guarda', textPosts() === '1');
step('La aceptación queda guardada en la base (versión 1)', accepted() === '1');
step('La fecha de aceptación la puso la base', sql(`select count(*) from community_rules_acceptance where user_id='${A}' and accepted_at > now() - interval '5 minutes'`) === '1');

// 3) Leer las normas desde Ajustes: sin casilla, con la fecha en que se aceptaron.
await page.evaluate(() => window.FittFormaGo('settings:privacy')); await page.waitForTimeout(600);
await page.click('.cm-rules-open'); await page.waitForTimeout(400);
step('En Ajustes › Privacidad en Comunidad se pueden leer las normas', await page.isVisible('#communityRulesDialog'));
step('Al leerlas no pide aceptar de nuevo y muestra cuándo se aceptaron', await page.isHidden('#communityRulesCheckRow') && await page.isHidden('#communityRulesAccept') && /Las aceptaste el/.test(await page.textContent('#communityRulesAccepted')));
await page.click('#communityRulesCancel'); await page.waitForTimeout(300);
await ctx.close();

// 4) En otro dispositivo (sin nada guardado en el teléfono) no se vuelve a pedir: lo sabe la base.
({ ctx, page } = await openApp());
await login(page);
await openPublish(page);
await page.fill('#communityTextBody', 'Segunda publicación');
await page.click('#communityTextPublish'); await page.waitForTimeout(1800);
step('En otro dispositivo no vuelve a pedir las normas', await page.isHidden('#communityRulesDialog') && textPosts() === '2');
await ctx.close();

// 5) Si la base todavía no tiene la tabla (migración v72 sin aplicar), igual se puede aceptar y publicar.
sql(`delete from community_rules_acceptance where user_id='${A}'`);
({ ctx, page } = await openApp());
await page.route(`${SUPA}/rest/v1/community_rules_acceptance**`, r => r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.community_rules_acceptance' in the schema cache" }) }));
await login(page);
await openPublish(page);
await page.fill('#communityTextBody', 'Sin la tabla nueva');
await page.click('#communityTextPublish'); await page.waitForTimeout(700);
const askedWithout = await page.isVisible('#communityRulesDialog');
if (askedWithout) { await page.check('#communityRulesCheck'); await page.click('#communityRulesAccept'); await page.waitForTimeout(1800); }
step('Sin la migración v72 igual pide las normas y deja publicar', askedWithout && textPosts() === '3');
step('Sin la migración, la aceptación queda guardada en el teléfono', await page.evaluate(id => { try { return Number(JSON.parse(localStorage.getItem('fittforma-community-rules-v1') || '{}')[id]?.v) === 1; } catch { return false; } }, A));
await ctx.close();

// 6) La página pública de normas.
const normas = await fetch(APP + '/normas.html');
const normasHtml = await normas.text();
step('/normas.html se publica (para la ficha de Google Play)', normas.status === 200 && /Normas de la comunidad/.test(normasHtml) && /Qué no está permitido/.test(normasHtml) && /al menos 13 años/.test(normasHtml));

// 7) App de Android: recordatorios programados en el teléfono (plugin simulado con la misma API que @capacitor/local-notifications).
const NATIVE = (opts) => {
  // Como en un teléfono: el permiso y los avisos pendientes siguen ahí si la app se recarga.
  let saved = null; try { saved = JSON.parse(sessionStorage.getItem('__ln') || 'null'); } catch {}
  window.__ln = saved || { pending: [], perms: 'prompt', requested: 0, scheduled: 0, deny: !!opts?.deny };
  const keep = () => { try { sessionStorage.setItem('__ln', JSON.stringify(window.__ln)); } catch {} };
  const LN = {
    checkPermissions: async () => ({ display: window.__ln.perms }),
    requestPermissions: async () => { window.__ln.requested++; if (window.__ln.perms === 'prompt') window.__ln.perms = window.__ln.deny ? 'denied' : 'granted'; keep(); return { display: window.__ln.perms }; },
    getPending: async () => ({ notifications: window.__ln.pending.map(n => ({ id: n.id, title: n.title, schedule: { at: n.at } })) }),
    cancel: async ({ notifications }) => { const ids = new Set(notifications.map(n => n.id)); window.__ln.pending = window.__ln.pending.filter(n => !ids.has(n.id)); keep(); },
    schedule: async ({ notifications }) => { if (window.__ln.perms !== 'granted') throw new Error('sin permiso'); for (const n of notifications) { window.__ln.pending = window.__ln.pending.filter(p => p.id !== n.id); window.__ln.pending.push({ id: n.id, title: n.title, body: n.body, at: new Date(n.schedule.at).toISOString(), icon: n.smallIcon }); window.__ln.scheduled++; } keep(); return { notifications: notifications.map(n => ({ id: n.id })) }; },
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { LocalNotifications: LN } };
};
({ ctx, page } = await openApp(NATIVE));
await page.evaluate(() => window.FittFormaGo('settings:reminders')); await page.waitForTimeout(500);
step('En la app de Android explica cómo dar el permiso', /Tocá «Permitir notificaciones»/.test(await page.textContent('#reminderPermissionStatus')));
step('Aclara que en Android llegan aunque la app esté cerrada', /llegan aunque FittForma esté cerrada/.test(await page.textContent('#reminderDeliveryNote')));
await page.check('#remindersEnabled');
for (const d of ['1', '2', '3', '4', '5', '6', '0']) await page.check(`[data-reminder-day="${d}"]`);
await page.fill('#reminderTime', '18:00'); await page.fill('#reminderMissedTime', '21:00');
await page.click('#workoutReminderForm button[type=submit]'); await page.waitForTimeout(2500);
const ln = await page.evaluate(() => window.__ln);
const workout = ln.pending.filter(n => n.id >= 71000 && n.id <= 71099);
const hours = new Set(workout.map(n => new Date(n.at).getHours()));
const now = new Date(), todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
const expected = 28 - (now.getHours() >= 21 ? 2 : now.getHours() >= 18 ? 1 : 0);
step('Al guardar pide permiso al teléfono una sola vez', ln.requested === 1 && ln.perms === 'granted');
step('Programa 14 días de avisos de entrenamiento (18:00 y seguimiento 21:00)', workout.length === expected && [...hours].every(h => h === 18 || h === 21), `${workout.length} avisos (esperados ${expected})`);
step('Los avisos usan el ícono de FittForma', workout.every(n => n.icon === 'ic_stat_fittforma'));
step('Muestra cuántos avisos quedaron y cuándo llega el próximo', /Programados en este teléfono: \d+\. El próximo:/.test(await page.textContent('#nativeReminderStatus')));

// Si hoy ya entrenaste, se quitan los avisos de hoy (se rearman al guardar).
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('fittforma-ai-v4')); const d = new Date(); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; s.activities = [...(s.activities || []), { id: 99, type: 'Caminar', date: key, minutes: 30 }]; localStorage.setItem('fittforma-ai-v4', JSON.stringify(s)); });
await page.reload(); await page.waitForTimeout(3500);
const afterLog = (await page.evaluate(() => window.__ln.pending)).filter(n => n.id >= 71000 && n.id <= 71099);
step('Con un entrenamiento registrado hoy, no quedan avisos para hoy', afterLog.length > 0 && afterLog.every(n => { const d = new Date(n.at); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` !== todayKey; }));

// Agua: horarios fijos (11, 15 y 19 h) por 3 días.
await page.evaluate(() => window.FittFormaGo('settings:water')); await page.waitForTimeout(600);
await page.click('#waterInApp'); await page.waitForTimeout(2500);
const water = (await page.evaluate(() => window.__ln.pending)).filter(n => n.id >= 72000 && n.id <= 72199);
const wHours = [...new Set(water.map(n => new Date(n.at).getHours()))].sort((a, b) => a - b).join(',');
step('Agua: avisos en los horarios elegidos de los próximos días', water.length >= 6 && water.length <= 9 && wHours === '11,15,19', `${water.length} avisos · ${wHours}`);
step('Agua: el texto dice el objetivo del día', water.every(n => /Tu objetivo de hoy es \d+ ml/.test(n.body)));

// Prueba: programa un aviso en unos segundos.
await page.evaluate(() => window.FittFormaGo('settings:reminders')); await page.waitForTimeout(400);
await page.click('#testReminderNotification'); await page.waitForTimeout(800);
const test = (await page.evaluate(() => window.__ln.pending)).filter(n => n.id >= 79000 && n.id <= 79009);
step('«Probar notificación» programa una en unos segundos', test.length === 1 && new Date(test[0].at) - Date.now() < 60000 && /programada/.test(await page.textContent('#toast')));
await ctx.close();

// Permiso denegado: lo explica y no programa nada.
({ ctx, page } = await openApp(NATIVE, { deny: true }));
await page.evaluate(() => window.FittFormaGo('settings:reminders')); await page.waitForTimeout(500);
await page.click('#allowReminderNotifications'); await page.waitForTimeout(1200);
const denied = await page.evaluate(() => window.__ln);
step('Si se niega el permiso, explica cómo activarlo y no programa nada', denied.perms === 'denied' && denied.pending.length === 0 && /Ajustes del teléfono › Apps › FittForma AI › Notificaciones/.test(await page.textContent('#reminderPermissionStatus')));
await ctx.close();

// 8) En el navegador común no cambia nada: no hay plugin nativo.
({ ctx, page } = await openApp());
step('En el navegador, el estado de los avisos del teléfono no se muestra', await page.isHidden('#nativeReminderStatus'));
await ctx.close();

step('Sin errores de la página', errors.length === 0, errors.join(' | '));
await browser.close();
