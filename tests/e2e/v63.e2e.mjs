// v63: crear cuenta e iniciar sesión fácil — una sola pantalla para toda la app, errores claros, recuperar contraseña.
// Navegador real + supabase-js real + PostgREST real sobre PostgreSQL local (misma preparación que athletes.e2e.mjs).
// /auth/v1 se simula en el navegador (como en las demás pruebas): cuenta nueva con sesión inmediata (sin confirmar
// correo), cuenta que pide confirmación, correo ya registrado, contraseña incorrecta, recuperar y reenviar.
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
const NEW = 'nuevo63@example.test', NEW_ID = 'a6300000-0000-0000-0000-0000000000a1';
const PEND = 'pendiente63@example.test', PEND_ID = 'a6300000-0000-0000-0000-0000000000a2';
const PASS = 'clave-segura-123';
// Supabase crea la fila de auth.users al registrarse; acá se prepara antes para que PostgREST la encuentre.
sql(`delete from auth.users where id in ('${NEW_ID}','${PEND_ID}')`);
sql(`insert into auth.users(id,email,raw_user_meta_data) values('${NEW_ID}','${NEW}','{"full_name":"Nueva"}'),('${PEND_ID}','${PEND}','{"full_name":"Pendiente"}')`);

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
  page.on('console', m => { if (m.type() === 'error' && !/leaflet|ERR_FAILED|unpkg|status of 40[0-9]/i.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.route(/unpkg\.com/, r => r.abort());
  await page.addInitScript(([w, loc]) => { if (!w) localStorage.setItem('fittforma-welcome-v1', '1'); if (loc !== 'es-UY') localStorage.setItem('fittforma-language-v1', loc.slice(0, 2)); setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); }, [welcome, locale]);
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
const status = page => page.textContent('#authStatus');

// 1) Primer uso: la bienvenida ofrece crear cuenta, iniciar sesión o seguir sin cuenta.
let { ctx, page } = await open({ welcome: true });
await page.goto(APP + '/'); await page.waitForTimeout(1500);
step('Al abrir la app por primera vez aparecen «Crear cuenta», «Iniciar sesión» y «Seguir sin cuenta»', await page.isVisible('#welcomeSignup') && await page.isVisible('#welcomeLogin') && /Seguir sin cuenta/.test(await page.textContent('#welcomeStart')));
await page.click('#welcomeSignup'); await page.waitForTimeout(400);
step('«Crear cuenta» abre la pantalla de cuenta en modo crear', await page.isVisible('#authSheet') && /Creá tu cuenta/.test(await page.textContent('#authTitle')) && (await page.getAttribute('#authTabSignup', 'aria-selected')) === 'true');
step('El cursor queda en el correo', await page.evaluate(() => document.activeElement?.id) === 'authEmail');
step('Correo y contraseña ayudan al celular (autocompletar, teclado de correo)', (await page.getAttribute('#authEmail', 'autocomplete')) === 'email' && (await page.getAttribute('#authEmail', 'inputmode')) === 'email' && (await page.getAttribute('#authPassword', 'autocomplete')) === 'new-password');
await page.click('#authSubmit'); await page.waitForTimeout(200);
step('Sin correo, lo pide con un ejemplo', /Escribí tu correo completo/.test(await status(page)));
await page.fill('#authEmail', NEW); await page.fill('#authPassword', '123'); await page.click('#authSubmit'); await page.waitForTimeout(200);
step('Contraseña corta: explica el mínimo antes de enviar nada', /al menos 8 caracteres/.test(await status(page)) && !calls.some(c => c.startsWith('/signup')));
await page.click('#authShowPassword');
step('El ojo muestra la contraseña', (await page.getAttribute('#authPassword', 'type')) === 'text' && (await page.getAttribute('#authShowPassword', 'aria-pressed')) === 'true');
await page.fill('#authPassword', PASS); await page.click('#authSubmit'); await page.waitForTimeout(1500);
step('Crear la cuenta inicia sesión al instante y avisa', /¡Listo! Creaste tu cuenta y ya iniciaste sesión/.test(await page.textContent('#authDone')) && await page.isVisible('#authDone') && !(await page.isVisible('#authSheet')));
step('Después de crear la cuenta sigue «Contanos un poco»', await page.isVisible('#welcomeStep2'));
await page.fill('#welcomeName', 'Nueva'); await page.click('#welcomeSubmit'); await page.waitForTimeout(500);
step('La bienvenida termina y queda en la app', !(await page.isVisible('#welcomeScreen')));
step('Inicio no muestra la invitación a crear cuenta con la sesión iniciada', !(await page.isVisible('#homeAccountCard')));
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(400);
await page.evaluate(() => { const d = document.getElementById('cloudAccountCard')?.closest('details'); if (d) d.open = true; });
step('Perfil muestra la cuenta iniciada y «Cerrar sesión»', /Sesión iniciada: nuevo63@example\.test/.test(await page.textContent('#cloudStatus')) && await page.isVisible('#cloudLogout') && !(await page.isVisible('#cloudLogin')));
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(1200);
step('Comunidad no pide iniciar sesión', !(await page.isVisible('#communityAuthBanner')));
await page.click('#mobileMoreToggle'); await page.waitForTimeout(250);
step('Con la sesión iniciada, «Más» no ofrece crear cuenta', !(await page.isVisible('#moreSignup')) && !(await page.isVisible('#moreLogin')));
await page.click('#mobileMoreToggle'); await page.waitForTimeout(150);
step('Se creó su perfil de Comunidad (lo hace la base, sin pasos extra)', sql(`select count(*) from community_profiles where user_id='${NEW_ID}'`) === '1');
// 2) Cerrar sesión y volver a entrar
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(300);
await page.click('#cloudLogout'); await page.waitForTimeout(1000);
step('Sin sesión, Perfil muestra «Iniciar sesión» y «Crear cuenta»', await page.isVisible('#cloudLogin') && await page.isVisible('#cloudRegister') && /Todavía no iniciaste sesión/.test(await page.textContent('#cloudStatus')));
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(800);
step('Sin sesión, Comunidad muestra «Entrá a Comunidad» arriba de todo', await page.isVisible('#communityAuthBanner'));
await page.click('#mobileMoreToggle'); await page.waitForTimeout(250);
step('Sin sesión, el menú «Más» tiene «Crear cuenta» e «Iniciar sesión»', await page.isVisible('#moreSignup') && await page.isVisible('#moreLogin'));
await page.click('#moreSignup'); await page.waitForTimeout(300);
step('Desde «Más» se abre «Creá tu cuenta» y el menú se cierra', await page.isVisible('#authSheet') && /Creá tu cuenta/.test(await page.textContent('#authTitle')) && !(await page.isVisible('#mobileMoreMenu')));
await page.click('#authSheet [data-auth-close].auth-skip'); await page.waitForTimeout(200);
await page.click('#communityAuthBanner [data-auth-open="login"]'); await page.waitForTimeout(300);
step('Iniciar sesión recuerda el correo y pone el cursor en la contraseña', (await page.inputValue('#authEmail')) === NEW && await page.evaluate(() => document.activeElement?.id) === 'authPassword' && (await page.getAttribute('#authPassword', 'autocomplete')) === 'current-password');
await page.fill('#authPassword', 'otra-clave-mal'); await page.click('#authSubmit'); await page.waitForTimeout(800);
step('Contraseña incorrecta: lo dice en simple y ofrece recuperarla', /El correo o la contraseña no coinciden/.test(await status(page)) && await page.isVisible('#authForgot'));
await page.click('#authForgot'); await page.waitForTimeout(200);
step('«¿Olvidaste tu contraseña?» pide solo el correo', /Recuperá tu contraseña/.test(await page.textContent('#authTitle')) && !(await page.isVisible('#authPassword')) && (await page.inputValue('#authEmail')) === NEW);
await page.click('#authSubmit'); await page.waitForTimeout(700);
step('Manda el enlace para elegir una contraseña nueva', calls.includes('/recover ' + NEW) && /te llega un enlace/.test(await status(page)));
await page.click('#authBack'); await page.waitForTimeout(200);
await page.fill('#authPassword', PASS); await page.press('#authPassword', 'Enter'); await page.waitForTimeout(1500);
step('Con Enter también entra, y avisa «¡Listo! Ya iniciaste sesión»', /¡Listo! Ya iniciaste sesión\./.test(await page.textContent('#authDone')) && !(await page.isVisible('#communityAuthBanner')));
// 3) Volver a registrarse con un correo que ya tiene cuenta
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(300); await page.click('#cloudLogout'); await page.waitForTimeout(900);
await page.click('#cloudRegister'); await page.waitForTimeout(300);
await page.fill('#authEmail', NEW); await page.fill('#authPassword', PASS); await page.click('#authSubmit'); await page.waitForTimeout(900);
step('Si el correo ya tiene cuenta, pasa a «Iniciar sesión» y lo explica', (await page.getAttribute('#authTabLogin', 'aria-selected')) === 'true' && /Ya hay una cuenta con ese correo/.test(await status(page)) && (await page.inputValue('#authEmail')) === NEW);
await page.click('#authSheet [data-auth-close].auth-skip'); await page.waitForTimeout(300);
step('«Seguir sin cuenta» cierra la pantalla', !(await page.isVisible('#authSheet')));
// 4) Cuenta que pide confirmar el correo (si en Supabase sigue activado «Confirm email»)
await page.click('#cloudRegister'); await page.waitForTimeout(300);
await page.fill('#authEmail', PEND); await page.fill('#authPassword', PASS); await page.click('#authSubmit'); await page.waitForTimeout(900);
step('Si Supabase pide confirmar el correo, lo dice claro y ofrece reenviar', /Te mandamos un correo para confirmarla/.test(await status(page)) && await page.isVisible('#authResend'));
await page.click('#authResend'); await page.waitForTimeout(600);
step('«Reenviar» vuelve a mandar el correo', calls.includes('/resend ' + PEND) && /Te volvimos a mandar/.test(await status(page)));
await page.click('#authTabLogin'); await page.fill('#authPassword', PASS); await page.click('#authSubmit'); await page.waitForTimeout(800);
step('Entrar sin haber confirmado: lo explica y ofrece reenviar', /todavía no está confirmada/.test(await status(page)) && await page.isVisible('#authResend'));
step('Google no aparece si el proyecto no lo tiene activado', !(await page.isVisible('#authGoogle')));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
// 5) Inicio: invitación para quien usa la app sin cuenta, que se puede cerrar
await page.click('.mobile-nav-item[data-mobile-view="plan"]'); await page.waitForTimeout(300);
step('Inicio invita a crear cuenta o iniciar sesión a quien no tiene sesión', await page.isVisible('#homeAccountCard'));
await page.click('#homeAccountDismiss'); await page.waitForTimeout(200);
await page.reload(); await page.waitForTimeout(1500);
step('«Ahora no» la oculta y no vuelve a aparecer', !(await page.isVisible('#homeAccountCard')));
await ctx.close();

// 6) Google activado en el proyecto: aparece el botón. Inglés: la pantalla está traducida. 320 px sin desbordes.
({ ctx, page } = await open({ google: true, locale: 'en-US', viewport: { width: 320, height: 640 } }));
await page.goto(APP + '/'); await page.waitForTimeout(1500);
await page.evaluate(() => window.FittFormaAuth.open('signup')); await page.waitForTimeout(800);
step('Con Google activado aparece «Continuar con Google»', await page.isVisible('#authGoogle'));
step('En inglés, la pantalla de cuenta está traducida', /Create your account/i.test(await page.textContent('#authTitle')) && /Continue without an account/i.test(await page.textContent('#authSheet .auth-skip')), await page.textContent('#authTitle'));
step('A 320 px la pantalla de cuenta entra sin desbordarse', await page.evaluate(() => { const r = document.getElementById('authSheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1; }));
await ctx.close();

step('Sin errores de JavaScript', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
console.log(`\nv63: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
