// v65: recordatorios de agua visibles (2, 3 o 4 por día; calendario que avisa con la app cerrada) y «Enviar una sugerencia».
// Navegador real + supabase-js real + PostgREST real sobre PostgreSQL local; /auth/v1 simulado como en v63.e2e.mjs.
// Los usuarios de prueba (example.test) se identifican como tales. NO apuntar nunca a un proyecto real.
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
const SUPA = 'https://e2e.supabase.co';
const APP = process.env.APP_URL || 'http://localhost:8787';
const PGRST = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
const sql = q => execFileSync('psql', ['-d', process.env.E2E_DB || 'ff_e2e', '-Atc', q], { env: process.env }).toString().trim();
const APP_VERSION = (await (await fetch(APP + '/api/public-config')).json()).version;
const NEW = 'agua65@example.test', NEW_ID = 'a6500000-0000-0000-0000-0000000000b1';
const PEND = 'pendiente65@example.test', PEND_ID = 'a6500000-0000-0000-0000-0000000000b2';
const PASS = 'clave-segura-123';
// Supabase crea la fila de auth.users al registrarse; acá se prepara antes para que PostgREST la encuentre.
sql(`delete from auth.users where id in ('${NEW_ID}','${PEND_ID}')`);
sql(`insert into auth.users(id,email,raw_user_meta_data) values('${NEW_ID}','${NEW}','{"full_name":"Agua"}'),('${PEND_ID}','${PEND}','{"full_name":"Pendiente"}')`);

let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const browser = await chromium.launch();
const errors = [];
const calls = [];
const registered = new Set();
const userObj = (id, email, identities = [{ id, provider: 'email' }]) => ({ id, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, identities, created_at: new Date().toISOString() });
const session = (id, email) => ({ access_token: jwt({ sub: id, role: 'authenticated', aud: 'authenticated', email, exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + email, user: userObj(id, email) });
const fail = (status, code, msg) => ({ status, contentType: 'application/json', body: JSON.stringify({ code: status, error_code: code, msg }) });

async function open({ welcome = false, google = false, locale = 'es-UY', viewport = { width: 390, height: 844 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/leaflet|ERR_FAILED|unpkg|status of (40[0-9]|429)/i.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.route(/unpkg\.com/, r => r.abort());
  await page.addInitScript(([w, loc]) => { if (!w) localStorage.setItem('fittforma-welcome-v1', '1'); window.__notes = []; class N { static permission = 'default'; static requestPermission() { N.permission = 'granted'; return Promise.resolve('granted'); } constructor(t, o) { window.__notes.push(t + ' | ' + (o?.body || '')); } } window.Notification = N; if (loc !== 'es-UY') localStorage.setItem('fittforma-language-v1', loc.slice(0, 2)); setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); }, [welcome, locale]);
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(process.env.SUPABASE_UMD) }));
  await page.route('**/api/public-config', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: APP_VERSION, supabase: { configured: true, url: SUPA, anonKey: ANON, keyType: 'legacy_anon' }, missing: [], issue: null }) }));
  await page.route(`${SUPA}/rest/v1/**`, async route => {
    const req = route.request(), url = new URL(req.url());
    const headers = { ...req.headers() }; delete headers.host; delete headers.origin; delete headers.referer;
    const res = await fetch(PGRST + url.pathname.replace('/rest/v1', '') + url.search, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() });
    const outHeaders = Object.fromEntries([...res.headers].filter(([k]) => !['content-encoding', 'transfer-encoding', 'connection'].includes(k)));
    await route.fulfill({ status: res.status, headers: { ...outHeaders, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: Buffer.from(await res.arrayBuffer()) });
  });
  await page.route(`${SUPA}/storage/v1/**`, r => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '[]' }));
  await page.route(`${SUPA}/auth/v1/**`, async route => {
    const req = route.request(), url = new URL(req.url()), cors = { 'access-control-allow-origin': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const body = JSON.parse(req.postData() || '{}'), path = url.pathname.replace('/auth/v1', '');
    calls.push(path + (body.email ? ' ' + body.email : ''));
    const json = (o, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (path === '/settings') return json({ external: { email: true, google }, mailer_autoconfirm: true });
    if (path === '/signup') {
      if (body.email === NEW) { if (registered.has(NEW)) return json(userObj(NEW_ID, NEW, [])); registered.add(NEW); return json(session(NEW_ID, NEW)); }
      if (body.email === PEND) return json(userObj(PEND_ID, PEND));
      if (body.email === 'limite63@example.test') return route.fulfill({ status: 429, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }) });
      return route.fulfill({ ...fail(422, 'weak_password', 'Password should be at least 8 characters.'), headers: cors });
    }
    if (path === '/token') {
      if (body.email === PEND) return route.fulfill({ ...fail(400, 'email_not_confirmed', 'Email not confirmed'), headers: cors });
      if (body.email === NEW && body.password === PASS) return json(session(NEW_ID, NEW));
      return route.fulfill({ ...fail(400, 'invalid_credentials', 'Invalid login credentials'), headers: cors });
    }
    if (path === '/recover' || path === '/resend') return json({});
    if (path === '/user') { const tok = (req.headers().authorization || '').split(' ')[1]; const sub = tok && JSON.parse(Buffer.from(tok.split('.')[1], 'base64url')).sub; return sub === NEW_ID ? json(userObj(NEW_ID, NEW)) : json({ msg: 'no' }, 401); }
    if (path === '/logout') return route.fulfill({ status: 204, headers: cors });
    return json({}, 404);
  });
  return { ctx, page };
}

// 1) Agua: tarjeta visible, 2/3/4 por día y calendario
let { ctx, page } = await open();
await page.goto(APP + '/'); await page.waitForTimeout(1500);
await page.click('.mobile-nav-item[data-mobile-view="nutrition"]'); await page.waitForTimeout(400);
await page.evaluate(() => window.FittFormaGo('hydration')); await page.waitForTimeout(600);
step('Hidratación muestra «Recordatorios para tomar agua» a la vista (no escondido)', await page.isVisible('#hydroRemind'));
step('Por defecto, 3 por día: 11:00 · 15:00 · 19:00', (await page.getAttribute('[data-water-count="3"]', 'aria-checked')) === 'true' && /11:00 · 15:00 · 19:00/.test(await page.textContent('#hydroRemindTimes')));
await page.click('[data-water-count="2"]'); await page.waitForTimeout(150);
step('Se puede elegir 2 por día', /11:00 · 16:00/.test(await page.textContent('#hydroRemindTimes')) && (await page.evaluate(() => JSON.parse(localStorage.getItem('fittforma-ai-v4')).hydration.reminder.perDay)) === 2);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#waterCalendar')]);
const ics = fs.readFileSync(await dl.path(), 'utf8');
step('«Agregar a mi calendario» descarga los avisos diarios (llegan con la app cerrada)', dl.suggestedFilename() === 'fittforma-agua.ics' && (ics.match(/BEGIN:VEVENT/g) || []).length === 2 && (ics.match(/RRULE:FREQ=DAILY/g) || []).length === 2 && /BEGIN:VALARM/.test(ics) && /SUMMARY:Tomá un vaso de agua/.test(ics));
await page.click('#waterInApp'); await page.waitForTimeout(400);
step('«Avisarme también en la app» pide permiso y queda activado', /activados/.test(await page.textContent('#hydroRemindState')) && /Dejar de avisarme/.test(await page.textContent('#waterInApp')));
await page.click('#waterInApp'); await page.waitForTimeout(200);
step('Y se puede apagar', !(await page.textContent('#hydroRemindState')) && /Avisarme también/.test(await page.textContent('#waterInApp')));

// 2) Sugerencias: sin cuenta pide iniciar sesión; con cuenta se guarda
sql(`delete from app_feedback where user_id='${NEW_ID}'`);
await page.click('#mobileMoreToggle'); await page.waitForTimeout(200);
step('El menú «Más» tiene «Enviar una sugerencia»', await page.isVisible('#moreFeedback'));
await page.click('#moreFeedback'); await page.waitForTimeout(300);
step('Sin sesión, explica que hace falta una cuenta', await page.isVisible('#feedbackSheet') && /iniciá sesión o creá tu cuenta/.test(await page.textContent('#feedbackStatus')));
await page.fill('#feedbackText', 'Sería genial poder elegir el color de la app');
await page.click('#feedbackSubmit'); await page.waitForTimeout(400);
step('Al enviar sin sesión abre «Iniciá sesión»', await page.isVisible('#authSheet') && /Iniciá sesión/.test(await page.textContent('#authTitle')));
await page.fill('#authEmail', NEW); await page.fill('#authPassword', PASS); await page.click('#authSubmit'); await page.waitForTimeout(1800);
step('Después de entrar vuelve a la sugerencia con el texto escrito', await page.isVisible('#feedbackSheet') && (await page.inputValue('#feedbackText')).length > 10);
await page.click('[data-feedback-kind="problema"]'); await page.click('#feedbackSubmit'); await page.waitForTimeout(1200);
step('Se guarda con la cuenta, la categoría y la versión', sql(`select category||'|'||left(message,12)||'|'||app_version from app_feedback where user_id='${NEW_ID}'`) === `problema|Sería genial|${APP_VERSION.replace(/^0\./, '')}`, sql(`select count(*) from app_feedback where user_id='${NEW_ID}'`));
step('Confirma «¡Gracias! Recibimos tu mensaje.»', /Gracias! Recibimos tu mensaje/.test(await page.textContent('#feedbackStatus')));
await page.waitForTimeout(2000);
step('La hoja se cierra sola', !(await page.isVisible('#feedbackSheet')));
sql(`set request.jwt.claim.sub='${NEW_ID}'; insert into app_feedback(user_id,message) select '${NEW_ID}','relleno '||g from generate_series(1,4) g`);
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(300);
await page.evaluate(() => document.getElementById('feedbackCard')?.closest('details')?.setAttribute('open', ''));
await page.click('#feedbackCard [data-feedback-open]'); await page.waitForTimeout(300);
await page.fill('#feedbackText', 'Otra idea más'); await page.click('#feedbackSubmit'); await page.waitForTimeout(1000);
step('Desde Perfil también se abre, y hay un límite de 5 por día', /máximo de 5 sugerencias por día/.test(await page.textContent('#feedbackStatus')) && sql(`select count(*) from app_feedback where user_id='${NEW_ID}'`) === '5');
step('Desde la app nadie puede leer las sugerencias (ni la propia cuenta)', sql(`select has_table_privilege('authenticated','public.app_feedback','select')::text||has_table_privilege('anon','public.app_feedback','select')::text`) === 'falsefalse');
await ctx.close();

// 3) Inglés
({ ctx, page } = await open({ locale: 'en-US' }));
await page.goto(APP + '/'); await page.waitForTimeout(1500);
await page.evaluate(() => window.FittFormaGo('hydration')); await page.waitForTimeout(600);
step('En inglés, la tarjeta del agua está traducida', /Water reminders/.test(await page.textContent('#hydroRemind')) && /Add to my calendar/.test(await page.textContent('#waterCalendar')));
await ctx.close();

step('Sin errores de JavaScript', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
console.log(`\nv65: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
