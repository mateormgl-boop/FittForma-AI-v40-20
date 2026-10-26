// E2E v52/v53: ranking de rangos con amigos en Progreso › Músculos (desde v53 usa las estadísticas de Comunidad). Navegador real + supabase-js real + PostgREST real sobre PostgreSQL local.
// Reutiliza la preparación de community.e2e.mjs (misma sesión simulada y mismas variables de entorno).
// Solo /auth/v1 y /storage/v1 se simulan en el navegador (sus permisos los cubre supabase/tests/run.sh).
// Preparación y variables: ver docs/PRUEBAS.md. NO apuntar nunca a un proyecto real.
//   APP_URL (http://localhost:8787)  POSTGREST_URL (http://127.0.0.1:3300)  JWT_SECRET_FILE
//   SUPABASE_UMD (ruta a @supabase/supabase-js/dist/umd/supabase.js)  PLAYWRIGHT_DIR  E2E_DB (ff_e2e)
//   PGHOST/PGPORT/PGUSER para psql.
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

// Datos externos: B publica un texto y le escribe a A (con auth.uid() de B para pasar el trigger anti-spam).
// Fixture propio (el último paso elimina la cuenta de A, así que se recrea en cada ejecución).
sql(`insert into auth.users(id,email) values('aaaaaaaa-0000-0000-0000-000000000001','alice@example.test'),('bbbbbbbb-0000-0000-0000-000000000002','bob@example.test') on conflict do nothing`);
sql(`insert into community_profiles(user_id,username,display_name,visibility) values('aaaaaaaa-0000-0000-0000-000000000001','alicia_fit','Alicia','public'),('bbbbbbbb-0000-0000-0000-000000000002','bruno_fit','Bruno Fit','public') on conflict (user_id) do update set visibility='public'`);
sql(`insert into community_follows(follower_id,following_id,status) values('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','accepted'),('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','accepted') on conflict do nothing`);
sql(`delete from user_app_data where user_id='aaaaaaaa-0000-0000-0000-000000000001'; delete from community_messages; delete from community_reports; delete from community_posts; delete from community_moderators;`);
sql(`insert into community_posts(id,user_id,post_kind,description,visibility) values('b0000000-0000-0000-0000-0000000000b1','bbbbbbbb-0000-0000-0000-000000000002','text','Primera semana completa de entrenamientos','public')`);
sql(`set request.jwt.claim.sub='bbbbbbbb-0000-0000-0000-000000000002'; insert into community_messages(sender_id,recipient_id,body) values('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','¡Hola Alicia! ¿Entrenamos el sábado?')`);

// Alicia tiene entrenamientos de todo el cuerpo: su rango general es real, calculado por la app.
const seed = { profile: { goal: 'fitness' }, sessions: Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, date: `2026-10-${String(10 + i).padStart(2, '0')}`, status: 'completed', type: 'custom', title: 'Cuerpo completo', minutes: 45,
  exercises: ['Sentadilla goblet', 'Press de banca con barra', 'Remo con barra', 'Press militar con mancuernas', 'Peso muerto rumano con mancuernas', 'Curl de bíceps con mancuernas', 'Plancha frontal', 'Elevación de talones con apoyo'].map(name => ({ name, entries: [1, 2, 3].map(() => ({ reps: '10', weight: '20', done: true })) })) })) };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push('PAGEERR ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/leaflet|ERR_FAILED|unpkg/i.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.type() === 'prompt' ? d.accept('ELIMINAR') : /dispositivo/.test(d.message()) ? d.dismiss() : d.accept());
await page.addInitScript(CLOSE_CELEBRATION);
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('fittforma-ai-v4', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(seed));
await page.route(/unpkg\.com/, r => r.abort());
await page.addInitScript(() => localStorage.setItem('fittforma-welcome-v1', '1'));
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


const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) process.exitCode = 1; };
const A = 'aaaaaaaa-0000-0000-0000-000000000001', B = 'bbbbbbbb-0000-0000-0000-000000000002';
// v53: Bruno (a quien Alicia sigue, aceptado) muestra sus estadísticas con rango Plata. Alicia todavía no publicó nada.
sql(`delete from community_athlete_stats`);
sql(`insert into community_athlete_stats(user_id,overall_rank,ranked_muscles) values('${B}',2,20)`);
sql(`insert into community_follows(follower_id,following_id,status) values('${A}','${B}','accepted') on conflict do nothing`);
await page.goto(APP + '/'); await page.waitForTimeout(800);
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(600);
await page.click('#communityTabProfile');
await page.fill('#communityEmail', 'alice@example.test'); await page.fill('#communityPassword', 'clave-segura-123');
await page.click('#communityEmailLogin'); await page.waitForTimeout(1500);
const openMuscles = async () => { await page.evaluate(() => document.querySelector('[data-view="progress"]').click()); await page.waitForTimeout(300); await page.evaluate(() => document.querySelector('[data-progress-tab="muscles"]').click()); await page.waitForTimeout(1800); };
await openMuscles();
let names = await page.$$eval('#rkBoard .rk-who strong', l => l.map(x => x.textContent));
step('Ve a quien sigue y muestra sus estadísticas', names.includes('Bruno Fit'), names.join(','));
step('Sin ver el aviso de Comunidad no se publicó nada de Alicia', sql(`select count(*) from community_athlete_stats where user_id='${A}'`) === '0' && !names.includes('Vos'));
step('La casilla arranca activada (públicas por defecto)', await page.isChecked('#rkShareToggle'));
await page.uncheck('#rkShareToggle'); await page.waitForTimeout(1500);
step('Al desactivar, la preferencia queda oculta en la base', sql(`select stats_public from community_athlete_stats where user_id='${A}'`) === 'f');
await page.check('#rkShareToggle'); await page.waitForTimeout(1800);
step('Al activar, se publica el rango general calculado por la app', sql(`select stats_public||'|'||(overall_rank>=0) from community_athlete_stats where user_id='${A}'`) === 'true|true');
names = await page.$$eval('#rkBoard .rk-who strong', l => l.map(x => x.textContent));
step('Aparece «Vos» en el ranking', names.includes('Vos') && names.includes('Bruno Fit'), names.join(','));
if (process.env.SHOT) await (await page.$('#rkBoardCard')).screenshot({ path: process.env.SHOT });
step('El primer puesto se destaca', await page.$('#rkBoard .rk-row.is-first') !== null);
await page.click('#rkBoard [data-rk-user="' + B + '"]'); await page.waitForTimeout(1500);
step('Tocar una fila abre el perfil completo en Comunidad', /Bruno Fit/.test(await page.textContent('#communityUserProfile')) && await page.isVisible('#communityPanelUser'));
step('Sin errores de página', errors.length === 0, errors.join(' | '));
sql(`delete from community_athlete_stats`);
await browser.close();
