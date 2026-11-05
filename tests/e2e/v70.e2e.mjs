// v70: miembros Plus en Comunidad (solo quien eligió mostrar su insignia), insignia del plan al lado del nombre y detalles visuales.
// Navegador real + supabase-js real + PostgREST real sobre PostgreSQL local (misma preparación que v66). Solo /auth y /storage se simulan.
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
// Usuarios: Alicia (Plus, eligió mostrar la insignia) y Bruno (Plus, no eligió). Nadie más se marca.
const A = 'aaaaaaaa-0000-0000-0000-000000000001', B = 'bbbbbbbb-0000-0000-0000-000000000002';
sql(`insert into auth.users(id,email) values('${A}','alice@example.test'),('${B}','bob@example.test') on conflict do nothing`);
sql(`insert into community_profiles(user_id,username,display_name,visibility) values('${A}','alicia_fit','Alicia','public'),('${B}','bruno_fit','Bruno Fit','public') on conflict (user_id) do update set username=excluded.username, display_name=excluded.display_name, visibility='public'`);
sql(`select public.monetization_set_membership('${A}','active',now()+interval '20 days','google_play','e2e-tok-a','fittforma_plus_monthly')`);
sql(`select public.monetization_set_membership('${B}','active',now()+interval '20 days','google_play','e2e-tok-b','fittforma_plus_monthly')`);
sql(`update community_profiles set show_plus = (user_id='${A}') where user_id in ('${A}','${B}')`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { for (const k of ['fittforma-welcome-v1', 'fittforma-tour-v68', 'fittforma-guide-hint-v68', 'fittforma-health-notice-v64']) localStorage.setItem(k, '1'); });
await page.route(/unpkg\.com/, r => r.abort());
await wire(page);
await page.goto(APP + '/'); await page.waitForTimeout(1200);

// 1) Arriba, al lado del nombre: el plan («Gratis» sin Plus verificado por el servidor).
step('La insignia del plan aparece al lado de FittForma AI', await page.isVisible('#planChip') && (await page.textContent('#planChipText')).trim() === 'Miembros');
await page.click('#planChip'); await page.waitForTimeout(700);
step('Tocar la insignia abre la membresía en Ajustes', await page.isVisible('#membershipCard') && (await page.textContent('#membershipStatus')).includes('Tu plan: Gratis'));
step('Sin Plus no aparece el interruptor de la insignia', await page.isHidden('#showPlusRow'));

// 2) Comunidad › Todos: «Miembros Plus» arriba, solo con quien eligió mostrarse.
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(1800);
const row = await page.$('#communityPlusRow:not([hidden])');
const rowText = row ? (await row.textContent()).replace(/\s+/g, ' ') : '';
step('La fila «Miembros Plus» aparece arriba de Todos', !!row && /Miembros/.test(rowText));
step('Muestra a Alicia (Plus y eligió mostrarse)', /Alicia/.test(rowText));
step('No muestra a Bruno (Plus, pero no lo eligió)', !/Bruno/.test(rowText));
const order = await page.evaluate(() => { const r = document.getElementById('communityPlusRow'), f = document.getElementById('communitySearchForm'); return !!(r && f && (r.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING)); });
step('La fila va antes que el buscador', order);
await page.waitForTimeout(600);
const badges = await page.$$eval('#communityPeople .community-avatar.is-plus', els => els.map(e => e.dataset.uid));
step('En la lista, el marco dorado y «Plus» solo en Alicia', badges.length >= 1 && badges.every(u => u === A), JSON.stringify(badges));
step('Bruno no tiene insignia en la lista', !(await page.$(`#communityPeople .community-avatar.is-plus[data-uid="${B}"]`)));
const anonRead = await fetch(PGRST + '/community_memberships?select=user_id', { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
const anonRows = anonRead.ok ? await anonRead.json() : [];
step('Sin sesión no se puede leer quién es Plus (la base lo rechaza)', !anonRead.ok || anonRows.length === 0, `HTTP ${anonRead.status}`);

// 3) Búsqueda: la fila se oculta mientras buscás.
await page.fill('#communitySearch', 'bruno'); await page.click('#communitySearchForm button[type="submit"]').catch(() => page.press('#communitySearch', 'Enter')); await page.waitForTimeout(1500);
step('Al buscar, la fila de Miembros Plus se oculta', await page.isHidden('#communityPlusRow'));

// 4) Detalles visuales: el botón + se corre al bajar y vuelve al subir; Perfil con «Editar nombre y objetivo» plegado.
await page.click('.mobile-nav-item[data-mobile-view="plan"]'); await page.waitForTimeout(700);
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150);
await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(400);
step('El botón + se corre al bajar', await page.evaluate(() => document.getElementById('quickAddFab').classList.contains('is-tucked')));
await page.evaluate(() => window.scrollTo(0, 300)); await page.waitForTimeout(400);
step('El botón + vuelve al subir', await page.evaluate(() => !document.getElementById('quickAddFab').classList.contains('is-tucked')));
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(700);
step('Perfil: «Editar nombre y objetivo» empieza plegado', await page.evaluate(() => { const d = document.getElementById('profileEdit'); return !!d && !d.open; }));
step('Sin errores de la página', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
