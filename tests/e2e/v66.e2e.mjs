// E2E v66: Comunidad propia — muro de amigos, aplausos y comentarios con aviso, compartir una carrera (sin mapa) o un
// entrenamiento solo si la persona lo elige, y desafíos del mes.
// Navegador real + supabase-js real + PostgREST real sobre PostgreSQL local (misma preparación que athletes.e2e.mjs).
// Solo /auth/v1 y /storage/v1 se simulan. Usuarios de prueba example.test; no se generan fotos de personas.
// Preparación y variables: ver docs/PRUEBAS.md. NO apuntar nunca a un proyecto real.
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
const A = 'aaaaaaaa-0000-0000-0000-000000000001', B = 'bbbbbbbb-0000-0000-0000-000000000002', F = 'ffffffff-0000-0000-0000-0000000000f6';
const POST_B = 'b6600000-0000-0000-0000-0000000000b1', POST_F = 'b6600000-0000-0000-0000-0000000000f1';

// Datos: Alicia y Bruno se siguen (aceptado). Franco es un desconocido con una publicación pública: NO va al muro de Alicia.
sql(`insert into auth.users(id,email) values('${A}','alice@example.test'),('${B}','bob@example.test'),('${F}','franco66@example.test') on conflict do nothing`);
sql(`insert into community_profiles(user_id,username,display_name,visibility) values('${A}','alicia_fit','Alicia','public'),('${B}','bruno_fit','Bruno Fit','public'),('${F}','franco66','Franco Desconocido','public') on conflict (user_id) do update set username=excluded.username, display_name=excluded.display_name, visibility=excluded.visibility`);
sql(`delete from community_blocks where blocker_id in ('${A}','${B}') or blocked_id in ('${A}','${B}'); delete from community_follows where follower_id in ('${A}','${F}') or following_id in ('${A}','${F}');
     insert into community_follows(follower_id,following_id,status) values('${A}','${B}','accepted'),('${B}','${A}','accepted') on conflict do nothing`);
sql(`delete from user_app_data where user_id='${A}'; delete from community_notifications where user_id in ('${A}','${B}'); delete from community_posts where user_id in ('${A}','${B}','${F}'); delete from community_athlete_stats where user_id in ('${A}','${B}','${F}')`);
sql(`insert into community_posts(id,user_id,post_kind,description,activity,visibility,created_at) values
  ('${POST_B}','${B}','activity','Piernas al fallo','{"type":"workout","title":"Piernas","minutes":52,"exercises":6,"sets":18,"volume_kg":5400}','followers',now()-interval '1 hour'),
  ('${POST_F}','${F}','text','Publicación de alguien que Alicia no sigue',null,'public',now()-interval '30 minutes')`);
// Bruno muestra sus estadísticas: 9 entrenamientos este mes.
sql(`insert into community_athlete_stats(user_id,stats_date,workouts_total,workouts_30d,active_days_30d,workouts_month,active_days_month,run_km_month) values('${B}',current_date,40,12,10,9,8,0)`);

// Alicia registró 12 entrenamientos este mes (días distintos) y una carrera: cumple el desafío de entrenamientos.
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const inMonth = Math.min(12, new Date().getDate());
const seed = { profile: { goal: 'fitness', level: 'intermediate', equipment: 'gym' },
  activities: [{ id: 900, type: 'Correr', date: day(0), distance: 4, minutes: 24 }],
  sessions: Array.from({ length: inMonth }, (_, i) => ({ id: 6600 + i, date: day(i), status: 'completed', type: 'custom', title: 'Fuerza', minutes: 40,
    exercises: [{ name: 'Sentadilla goblet', entries: [{ reps: '10', weight: '20', done: true }] }, { name: 'Flexiones clásicas', entries: [{ reps: '15', weight: '', done: true }] }] })) };

const browser = await chromium.launch();
const errors = [];
const open = async (lang = '', withSeed = true) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/leaflet|ERR_FAILED|unpkg/i.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.addInitScript(CLOSE_CELEBRATION);
  await page.addInitScript(([s, l]) => {
    localStorage.setItem('fittforma-welcome-v1', '1'); localStorage.setItem('fittforma-health-notice-v64', '1');
    if (l) localStorage.setItem('fittforma-language-v1', l);
    if (s && !sessionStorage.getItem('seeded')) { localStorage.setItem('fittforma-ai-v4', s); sessionStorage.setItem('seeded', '1'); }
  }, [withSeed ? JSON.stringify(seed) : '', lang]);
  await page.route(/unpkg\.com/, r => r.abort());
  await wire(page);
  return { ctx, page };
};

// 0) Sin sesión: el muro invita a iniciar sesión y no muestra nada de nadie.
let { ctx, page } = await open('', false);
await page.goto(APP + '/'); await page.waitForTimeout(900);
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(900);
step('Comunidad tiene «Muro» entre Todos y Ranking', (await page.$$eval('.cm-tabs [role=tab]', t => t.map(x => x.textContent.trim()).join('|'))) === 'Todos|Muro|Ranking|Amigos');
await page.click('#communityTabWall'); await page.waitForTimeout(900);
const wallOut = await page.textContent('#communityWall');
step('Sin sesión: «Tu muro te espera» con Iniciar sesión y ninguna publicación', /Tu muro te espera/.test(wallOut) && !/Piernas|Franco/.test(wallOut) && !!(await page.$('#communityWall [data-auth-open="login"]')));
await ctx.close();

// 1) Alicia inicia sesión: se publican sus números del mes (los calcula la app).
({ ctx, page } = await open());
await page.goto(APP + '/'); await page.waitForTimeout(900);
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(900);
await page.click('#communityTabProfile');
await page.click('#communityAuthBanner [data-auth-open="login"]'); await page.fill('#authEmail', 'alice@example.test'); await page.fill('#authPassword', 'clave-segura-123');
await page.click('#authSubmit'); await page.waitForTimeout(1800);
for (let i = 0; i < 20 && sql(`select count(*) from community_athlete_stats where user_id='${A}'`) === '0'; i++) await page.waitForTimeout(250);
const month = sql(`select workouts_month||'|'||active_days_month||'|'||run_km_month||'|'||(month_start=date_trunc('month',current_date)::date) from community_athlete_stats where user_id='${A}'`);
// La carrera también es una actividad: entrenamientos = sesiones + carrera; el mismo día cuenta una sola vez.
step('Al iniciar sesión se guardan los números del mes', month === `${inMonth + 1}|${inMonth}|4.00|true`, month);
await page.click('#communityStatsNoticeOk').catch(() => {});

// 2) Muro: lo de Bruno (seguido), no lo de Franco (desconocido).
await page.click('#communityTabWall'); await page.waitForTimeout(1500);
let wall = (await page.textContent('#communityWall')).replace(/\s+/g, ' ');
step('El muro muestra el entrenamiento que compartió Bruno con sus números', /Bruno Fit/.test(wall) && /Piernas/.test(wall) && /52 min/.test(wall) && /18 series/.test(wall), wall.slice(0, 200));
step('El muro NO muestra a quien Alicia no sigue', !/Franco/.test(wall));
step('Aclara que los números los registró la persona en la app', /Registrado en la app/.test(wall));

// 3) Aplaudir y comentar: Bruno recibe un aviso de cada uno.
const post = `[data-community-post="${POST_B}"]`;
await page.click(`${post} [data-community-like]`); await page.waitForTimeout(800);
step('«Aplaudir» suma un aplauso', sql(`select count(*) from community_likes where post_id='${POST_B}' and user_id='${A}'`) === '1' && (await page.getAttribute(`${post} [data-community-like]`, 'aria-pressed')) === 'true');
step('Bruno recibe el aviso «aplaudió tu publicación»', sql(`select count(*) from community_notifications where user_id='${B}' and actor_id='${A}' and kind='applause'`) === '1');
await page.fill(`${post} [data-community-comment-form] input[name=body]`, '¡Qué sesión!'); await page.click(`${post} [data-community-comment-form] button[type=submit]`); await page.waitForTimeout(1500);
step('Comentar también avisa a Bruno', sql(`select count(*) from community_notifications where user_id='${B}' and actor_id='${A}' and kind='comment'`) === '1' && /Qué sesión/.test(await page.textContent(post)));

// 4) Desafíos del mes (en Amigos): avance propio, amigos al lado y compartir un desafío cumplido.
await page.click('#communityTabFriends'); await page.waitForTimeout(1500);
const mBox = (await page.textContent('#communityMonth')).replace(/\s+/g, ' ');
step('«Desafíos del mes» con las tres metas', await page.isVisible('#communityMonth') && /12 entrenamientos/.test(mBox) && /15 días activos/.test(mBox) && /30 km corriendo/.test(mBox), mBox.slice(0, 160));
step('Muestra a Bruno con sus 9 entrenamientos del mes', /Bruno Fit\s*9/.test(mBox));
step('Mi avance en kilómetros: 4 / 30', /4 \/ 30/.test(mBox));
if (inMonth >= 12) {
  step('Entrenamientos 12/12: «¡Desafío cumplido!»', /¡Desafío cumplido!/.test(await page.textContent('[data-month-goal="workouts"]')));
  await page.click('[data-month-share="workouts"]'); await page.waitForTimeout(900);
  step('Compartir el desafío lo publica solo para seguidores', sql(`select (activity->>'type')||'|'||(activity->>'challenge')||'|'||visibility from community_posts where user_id='${A}' and post_kind='activity'`) === 'challenge|workouts|followers');
} else step('Desafío cumplido (se omite: el mes recién empieza)', true);
sql(`delete from community_posts where user_id='${A}'`);

// 5) Guardar una carrera: ofrece compartirla sin el mapa; «Compartir» la publica.
await page.evaluate(() => window.FittFormaGo('running')); await page.waitForTimeout(500);
await page.fill('#runDistance', '6.2'); await page.fill('#runMinutes', '34'); await page.click('#runLogForm button[type=submit]'); await page.waitForTimeout(700);
const runBox = await page.textContent('#runShareBox');
step('Al guardar una carrera ofrece compartirla (sin el mapa)', /¿Compartir con tus amigos\?/.test(runBox) && /sin el mapa/.test(runBox));
step('No se publica nada hasta tocar «Compartir»', sql(`select count(*) from community_posts where user_id='${A}'`) === '0');
await page.fill('#runShareBox input', 'Fondo tranquilo'); await page.click('#runShareBox .btn-row .btn:not(.ghost)'); await page.waitForTimeout(900);
const run = sql(`select (activity->>'type')||'|'||(activity->>'distance_km')||'|'||(activity->>'minutes')||'|'||(activity ? 'points')||'|'||visibility||'|'||description from community_posts where user_id='${A}'`);
step('La carrera se comparte con distancia y tiempo, sin ruta, para seguidores', run === 'run|6.2|34|false|followers|Fondo tranquilo', run);
step('Confirma «Compartido con tus amigos»', /Compartido con tus amigos/.test(await page.textContent('#runShareBox')));

// 6) Terminar un entrenamiento: «Ahora no» no publica nada.
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(400);
await page.click('[data-focus="chest_triceps"]'); await page.waitForTimeout(200); await page.click('#focusStart'); await page.waitForTimeout(500);
await page.fill('input[data-e="0"][data-s="0"][data-k="reps"]', '10').catch(() => {}); await page.check('input[data-done][data-e="0"][data-s="0"]'); await page.waitForTimeout(300);
await page.click('#finishWorkout'); await page.waitForTimeout(900);
const share = page.locator('.workout-live-card .share-friends');
step('El resumen del entrenamiento ofrece compartirlo con amigos', await share.count() === 1 && /Compartir con mis amigos/.test(await share.textContent()));
await page.click('.workout-live-card .share-friends .btn.ghost'); await page.waitForTimeout(300);
step('«Ahora no» lo cierra y no publica nada', await share.count() === 0 && sql(`select count(*) from community_posts where user_id='${A}' and activity->>'type'='workout'`) === '0');

// 7) El muro muestra lo propio y la carrera con el ritmo.
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(600);
await page.click('#communityTabWall'); await page.waitForTimeout(1500);
wall = (await page.textContent('#communityWall')).replace(/\s+/g, ' ');
step('Mi carrera aparece en el muro con distancia, tiempo y ritmo', /Salió a correr/.test(wall) && /6,2 km|6\.2 km/.test(wall) && /5:29 \/km/.test(wall), wall.slice(0, 220));

// 8) Avisos: un aplauso de Bruno se lee y lleva al muro.
sql(`insert into community_notifications(user_id,kind,actor_id) values('${A}','applause','${B}')`);
await page.click('#communityTabAlerts'); await page.waitForTimeout(1200);
step('Avisos: «Bruno Fit aplaudió tu publicación»', /Bruno Fit\s*aplaudió tu publicación/.test(await page.textContent('#communityPanelAlerts')));
await page.click('#communityPanelAlerts [data-alert-kind="applause"]'); await page.waitForTimeout(900);
step('Tocar el aviso abre el muro', (await page.getAttribute('#communityTabWall', 'aria-selected')) === 'true');
await page.setViewportSize({ width: 320, height: 720 }); await page.waitForTimeout(300);
step('A 320 px el muro no se desborda', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await ctx.close();

// 9) En inglés
({ ctx, page } = await open('en', false));
await page.goto(APP + '/'); await page.waitForTimeout(1500);
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(800);
step('En inglés la pestaña se llama «Wall»', (await page.textContent('#communityTabWall')).trim() === 'Wall');
await ctx.close();

step('Sin errores de página ni de consola', errors.length === 0, errors.slice(0, 4).join(' || '));
sql(`delete from community_posts where user_id in ('${A}','${F}') or id='${POST_B}'; delete from community_notifications where user_id in ('${A}','${B}'); delete from community_follows where follower_id='${F}' or following_id='${F}'`);
await browser.close();
console.log(`\nv66: ${process.exitCode ? 'hay fallas' : 'todo pasa'}`);
