// E2E de Comunidad: navegador real + supabase-js real + PostgREST real sobre PostgreSQL local.
// Solo /auth/v1 y /storage/v1 se simulan en el navegador (sus permisos los cubre supabase/tests/run.sh).
// Preparación y variables: ver docs/PRUEBAS.md. NO apuntar nunca a un proyecto real.
//   APP_URL (http://localhost:8787)  POSTGREST_URL (http://127.0.0.1:3300)  JWT_SECRET_FILE
//   SUPABASE_UMD (ruta a @supabase/supabase-js/dist/umd/supabase.js)  PLAYWRIGHT_DIR  E2E_DB (ff_e2e)
//   PGHOST/PGPORT/PGUSER para psql.
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
sql(`delete from community_messages; delete from community_posts;`);
sql(`insert into community_posts(id,user_id,post_kind,description,visibility) values('b0000000-0000-0000-0000-0000000000b1','bbbbbbbb-0000-0000-0000-000000000002','text','Primera semana completa de entrenamientos','public')`);
sql(`set request.jwt.claim.sub='bbbbbbbb-0000-0000-0000-000000000002'; insert into community_messages(sender_id,recipient_id,body) values('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','¡Hola Alicia! ¿Entrenamos el sábado?')`);

const seed = { profile: { goal: 'fitness' }, sessions: [], activities: [], badgeRecords: [{ id: 1, exerciseId: 'exercise-plancha-frontal', exerciseName: 'Plancha frontal', measure: 'seconds', value: 70, unit: 'seconds', date: new Date().toISOString().slice(0, 10), source: 'manual' }] };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push('PAGEERR ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/leaflet|ERR_FAILED|unpkg/i.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('fittforma-ai-v4', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(seed));
await page.route(/unpkg\.com/, r => r.abort());
await page.addInitScript(() => localStorage.setItem('fittforma-welcome-v1', '1'));
await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.SUPABASE_UMD) }));
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
  if (url.pathname.includes('/object/sign/')) { const path = url.pathname.split('/object/sign/community-media/')[1]; return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ signedURL: `/object/sign/community-media/${path}?token=t` }) }); }
  if (url.pathname.includes('/object/community-media/') && req.method() === 'POST') { const path = url.pathname.split('/object/community-media/')[1]; uploaded.push(path); return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ Key: 'community-media/' + path, Id: crypto.randomUUID() }) }); }
  if (req.method() === 'GET') return route.fulfill({ headers: cors, contentType: 'image/png', body: PNG });
  return route.fulfill({ headers: cors, contentType: 'application/json', body: '[]' });
});

const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) process.exitCode = 1; };
await page.goto(APP + '/'); await page.waitForTimeout(800);
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(800);
step('Feed anónimo carga el post público de B', (await page.textContent('#communityFeed')).includes('Primera semana completa'));

await page.click('#communityTabProfile');
await page.fill('#communityEmail', 'alice@example.test'); await page.fill('#communityPassword', 'clave-segura-123');
await page.click('#communityEmailLogin'); await page.waitForTimeout(1500);
step('Inicio de sesión', /Sesión iniciada|Sesión online/.test(await page.textContent('#communityEmailStatus') + await page.textContent('#communityProfileStatus')));
step('Indicador de 1 mensaje sin leer', await page.isVisible('#communityUnreadBadge') && (await page.textContent('#communityUnreadBadge')).trim() === '1');

// Publicación de texto con foto, vista previa y consentimiento
await page.click('#communityTabPublish');
await page.fill('#communityTextBody', 'Hoy corrí 5 km sin parar por primera vez');
const preview = await page.textContent('#communityPostPreview');
step('Vista previa muestra texto y audiencia', preview.includes('Hoy corrí 5 km') && /Visible para cualquier persona/.test(preview), preview.slice(0, 90));
await page.setInputFiles('#communityTextImage', { name: 'foto.png', mimeType: 'image/png', buffer: PNG });
await page.click('#communityTextPublish'); await page.waitForTimeout(400);
step('Sin consentimiento de foto no publica', /Confirmá que tenés derecho/.test(await page.textContent('#communityComposeStatus')));
await page.check('#communityTextPhotoConsent');
await page.click('#communityTextPublish'); await page.waitForTimeout(1500);
step('Post de texto con foto persistido', sql(`select count(*) from community_posts where post_kind='text' and image_path like 'aaaaaaaa-0000-0000-0000-000000000001/%/image.jpg'`) === '1');
step('Foto subida a la carpeta del usuario', uploaded.some(p => p.startsWith('aaaaaaaa-0000-0000-0000-000000000001/')), uploaded.join(','));

// Logro
await page.click('#communityTabPublish'); await page.click('[data-post-kind="achievement"]');
const options = await page.$$eval('#communityAchievementSelect option', o => o.map(x => x.textContent));
step('Selector ofrece la insignia local', options.some(o => /Plancha frontal · Plata I/.test(o)), options.join(' | '));
await page.fill('#communityAchievementComment', 'Tres semanas para llegar');
step('Vista previa del logro dice "Declarada por el autor"', (await page.textContent('#communityPostPreview')).includes('Declarada por el autor'));
await page.click('#communityAchievementPublish'); await page.waitForTimeout(1500);
const ach = sql(`select achievement->>'rank', achievement->>'level', achievement->>'evidence' from community_posts where post_kind='achievement'`);
step('Logro persistido con evidencia declarada', ach === 'silver|4|declared', ach);
const feed = await page.textContent('#communityFeed');
step('Feed muestra logro y texto', feed.includes('Plancha frontal · Plata I') && feed.includes('Hoy corrí 5 km'));

// Me gusta, comentario y edición
await page.click('#communityTabFeed'); await page.waitForTimeout(1000);
await page.click('[data-community-post="b0000000-0000-0000-0000-0000000000b1"] [data-community-like]'); await page.waitForTimeout(900);
await page.click('[data-community-post="b0000000-0000-0000-0000-0000000000b1"] [data-community-like]').catch(() => {}); await page.waitForTimeout(900);
step('Me gusta alterna sin duplicar', sql(`select count(*) from community_likes`) === '0');
await page.click('[data-community-post="b0000000-0000-0000-0000-0000000000b1"] [data-community-like]'); await page.waitForTimeout(900);
step('Me gusta persistido', sql(`select count(*) from community_likes where user_id='aaaaaaaa-0000-0000-0000-000000000001'`) === '1');
await page.fill('[data-community-comment-form="b0000000-0000-0000-0000-0000000000b1"] input', '¡Vamos Bruno!');
await page.click('[data-community-comment-form="b0000000-0000-0000-0000-0000000000b1"] button'); await page.waitForTimeout(900);
step('Comentario persistido', sql(`select body from community_comments`) === '¡Vamos Bruno!');
const textPostId = sql(`select id from community_posts where post_kind='text' and user_id='aaaaaaaa-0000-0000-0000-000000000001'`);
await page.click(`[data-community-edit-post="${textPostId}"]`);
await page.fill(`[data-community-post="${textPostId}"] .community-edit-form textarea`, 'Hoy corrí 5 km sin parar (editado)');
await page.click(`[data-community-post="${textPostId}"] .community-edit-form button[type=submit]`); await page.waitForTimeout(1000);
step('Edición propia persistida', sql(`select description from community_posts where id='${textPostId}'`) === 'Hoy corrí 5 km sin parar (editado)');
step('Botón editar ausente en post ajeno', !(await page.$('[data-community-post="b0000000-0000-0000-0000-0000000000b1"] [data-community-edit-post]')));

// Mensajes: abrir conversación marca leído
await page.click('#communityTabMessages'); await page.waitForTimeout(1000);
const opt = await page.$$eval('#communityChatContact option', o => o.map(x => x.textContent));
step('Contacto muestra mensajes sin leer', opt.some(o => /1 sin leer/.test(o)), opt.join(' | '));
await page.selectOption('#communityChatContact', 'bbbbbbbb-0000-0000-0000-000000000002'); await page.waitForTimeout(1200);
step('Abrir conversación marca leído en la base', sql(`select count(*) from community_messages where read_at is null`) === '0');
step('Indicador de no leídos desaparece', !(await page.isVisible('#communityUnreadBadge')));
await page.fill('#communityChatText', 'Dale, sábado 9 h'); await page.click('#communityChatSend'); await page.waitForTimeout(1000);
step('Mensaje enviado y persistido', sql(`select count(*) from community_messages where sender_id='aaaaaaaa-0000-0000-0000-000000000001'`) === '1');

// Eliminación propia
await page.click('#communityTabFeed'); await page.waitForTimeout(900);
await page.click(`[data-community-post="${textPostId}"] [data-community-delete-post]`); await page.waitForTimeout(1200);
step('Eliminar publicación propia', sql(`select count(*) from community_posts where id='${textPostId}'`) === '0');
step('Sin errores de página', errors.length === 0, errors.slice(0, 4).join(' || '));
await browser.close();
