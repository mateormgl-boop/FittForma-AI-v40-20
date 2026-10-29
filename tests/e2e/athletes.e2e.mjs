// E2E v53/v53.1: Comunidad de deportistas — Todos, perfil completo, Ranking, Amigos, comparación y privacidad.
// Navegador real + supabase-js real + PostgREST real sobre PostgreSQL local (misma preparación que community.e2e.mjs).
// Solo /auth/v1 y /storage/v1 se simulan en el navegador (sus permisos los cubre supabase/tests/run.sh).
// Los usuarios de prueba (example.test) se identifican como tales; no se generan fotos de personas.
// Preparación y variables: ver docs/PRUEBAS.md. NO apuntar nunca a un proyecto real.
//   APP_URL (http://localhost:8787)  POSTGREST_URL (http://127.0.0.1:3300)  JWT_SECRET_FILE
//   SUPABASE_UMD (ruta a @supabase/supabase-js/dist/umd/supabase.js)  PLAYWRIGHT_DIR  E2E_DB (ff_e2e)
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
// Alicia entrena de verdad en la app: flexiones, plancha y todo el cuerpo en los últimos días, y una carrera.
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const seed = { profile: { goal: 'fitness', level: 'intermediate' }, activities: [{ id: 900, type: 'Correr', date: day(2), distance: 5, minutes: 30 }], sessions: Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, date: day(1 + i), status: 'completed', type: 'custom', title: 'Cuerpo completo', minutes: 45,
  exercises: ['Sentadilla goblet', 'Press de banca con barra', 'Remo con barra', 'Press militar con mancuernas', 'Peso muerto rumano con mancuernas', 'Curl de bíceps con mancuernas', 'Elevación de talones con apoyo'].map(name => ({ name, entries: [1, 2, 3].map(() => ({ reps: '10', weight: '20', done: true })) }))
    .concat([{ name: 'Flexiones clásicas', entries: [{ reps: String(18 + i), weight: '', done: true }] }, { name: 'Plancha frontal', entries: [{ reps: '60', weight: '', done: true }] }]) })) };
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

const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) process.exitCode = 1; };
const A = 'aaaaaaaa-0000-0000-0000-000000000001', B = 'bbbbbbbb-0000-0000-0000-000000000002';
const C = 'cccccccc-0000-0000-0000-0000000000c6', D = 'dddddddd-0000-0000-0000-0000000000d6', E = 'eeeeeeee-0000-0000-0000-0000000000e6';
sql(`delete from community_athlete_stats; delete from community_follows where follower_id in ('${C}','${D}','${E}') or following_id in ('${C}','${D}','${E}'); delete from community_profiles where user_id in ('${C}','${D}','${E}'); delete from auth.users where id in ('${C}','${D}','${E}')`);
sql(`insert into auth.users(id,email,raw_user_meta_data) values('${C}','carla53@example.test','{"full_name":"Carla"}'),('${D}','diego53@example.test','{"full_name":"Diego"}'),('${E}','eva53@example.test','{"full_name":"Eva"}')`);
sql(`update community_profiles set username='carla_priv53', visibility='private', bio='Bio solo para seguidores' where user_id='${C}'; update community_profiles set username='diego_pub53', display_name='Diego' where user_id='${D}'; update community_profiles set username='eva_oculta53', display_name='Eva' where user_id='${E}'`);
// Estadísticas de prueba de los demás (las de Alicia las calcula y publica la app).
sql(`insert into community_athlete_stats(user_id,training_level,xp_level,overall_rank,ranked_muscles,badges_count,badges,workouts_total,workouts_30d,active_days_30d,best_pushups,best_pullups) values
 ('${B}','advanced',9,2,18,2,'[{"exerciseId":"exercise-flexiones","exerciseName":"Flexiones","category":"calisthenics","rank":"silver","level":4,"measure":"reps","evidence":"session","earnedAt":"2026-10-20"}]',80,20,16,45,8),
 ('${C}','beginner',2,5,10,1,'[]',30,12,10,70,0),
 ('${D}','beginner',3,1,6,0,'[]',20,8,6,12,0)`);
sql(`insert into community_athlete_stats(user_id,stats_public,overall_rank,workouts_total,workouts_30d,active_days_30d,best_pushups) values('${E}',false,8,99,30,30,200)`);
// v53.1: bandera y mapa de músculos de Bruno; «Mi físico» de Alicia se sube desde la app.
sql(`update community_profiles set country_code='AR' where user_id='${B}'; update community_profiles set country_code=null, avatar_path=null where user_id='${A}'; update community_athlete_stats set muscle_ranks='{"biceps":3,"pectorales":2,"cuadriceps":1}' where user_id='${B}'`);
sql(`delete from community_physique where user_id='${A}'; delete from community_physique_history where user_id='${A}'; delete from community_memberships where user_id='${A}'`);

await page.goto(APP + '/'); await page.waitForTimeout(800);
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(1200);
step('1. Comunidad abre en «Todos»', (await page.getAttribute('#communityTabWorld', 'aria-selected')) === 'true' && await page.isVisible('#communityPanelWorld'));
step('2. Cuatro apartados (v66: «Muro» solo de amigos) y ningún feed general ni «Para vos»', (await page.$$eval('.cm-tabs [role=tab]', t => t.map(x => x.textContent.trim()).join('|'))) === 'Todos|Muro|Ranking|Amigos' && !(await page.$('#communityFeed')) && !(await page.$('[data-feed-mode]')) && !/Para vos/.test(await page.textContent('#view-community')));
let people = await page.textContent('#communityPeople');
step('3. Sin sesión: perfiles públicos con nivel y rango', /Bruno Fit/.test(people) && /Avanzado/.test(people) && /Plata/.test(people) && !/carla_priv53/.test(people), people.replace(/\s+/g, ' ').slice(0, 160));
step('3. Las estadísticas ocultas no aparecen', !/Leyenda/.test(people));

await page.click('#communityTabProfile');
await page.click('#communityAuthBanner [data-auth-open="login"]'); await page.fill('#authEmail', 'alice@example.test'); await page.fill('#authPassword', 'clave-segura-123');
await page.click('#authSubmit'); await page.waitForTimeout(1800);
// v61: públicas desde el inicio (pedido de la persona dueña): se publican al iniciar sesión, sin esperar el aviso.
for (let i = 0; i < 20 && sql(`select count(*) from community_athlete_stats where user_id='${A}'`) === '0'; i++) await page.waitForTimeout(250);
step('Al iniciar sesión se publican las estadísticas sin esperar el aviso', sql(`select count(*) from community_athlete_stats where user_id='${A}'`) === '1');
await page.click('#communityTabWorld'); await page.waitForTimeout(1000);
step('Aviso: qué estadísticas se ven (y que nunca peso ni medidas)', await page.isVisible('#communityStatsNotice') && /Nunca tu peso/.test(await page.textContent('#communityStatsNotice')));
await page.click('#communityStatsNoticeOk'); await page.waitForTimeout(1500);
const mine = sql(`select stats_public||'|'||training_level||'|'||best_pushups||'|'||best_plank_seconds||'|'||run_km_30d||'|'||active_days_30d from community_athlete_stats where user_id='${A}'`);
step('Estadísticas reales de Alicia publicadas (públicas por defecto)', mine === 'true|intermediate|23|60|5.00|6', mine);
step('v53.1 También se publica el rango de cada músculo (sin datos corporales)', Number(sql(`select count(*) from jsonb_object_keys((select muscle_ranks from community_athlete_stats where user_id='${A}'))`)) >= 15);
step('v53.1 La tarjeta muestra la bandera', /🇦🇷/.test(await page.textContent('#communityPeople')));
step('La fila no tiene columnas de datos corporales', sql(`select count(*) from information_schema.columns where table_name='community_athlete_stats' and column_name ~ '(weight|height|peso|altura|waist|measure|photo|goal)'`) === '0');

await page.fill('#communitySearch', 'diego'); await page.press('#communitySearch', 'Enter'); await page.waitForTimeout(900);
people = await page.textContent('#communityPeople');
step('4. La búsqueda encuentra usuarios reales', /diego_pub53/.test(people) && !/bruno_fit/.test(people), people.replace(/\s+/g, ' ').slice(0, 100));
await page.click('#communityClearSearch'); await page.waitForTimeout(900);
await page.click('#communityPeople .cm-card-open[aria-label*="Bruno"]'); await page.waitForTimeout(1500);
let prof = await page.textContent('#communityUserProfile');
step('5. Al tocar la tarjeta se abre el perfil correcto', /Bruno Fit/.test(prof) && /@bruno_fit/.test(prof), prof.replace(/\s+/g, ' ').slice(0, 120));
step('6. Perfil completo: rango, nivel, estadísticas e insignias', /Rango principal/.test(prof) && /Plata/.test(prof) && /Avanzado · Nivel 9/.test(prof) && /45 rep/.test(prof) && /Insignias y logros/.test(prof) && /Registrada en un entrenamiento/.test(prof));
step('6. Lo que falta dice «Sin datos disponibles»', /Sin datos disponibles/.test(prof));
step('v53.1 Perfil: bandera y mapa de músculos de Bruno', /🇦🇷/.test(prof) && /Mapa de músculos/.test(prof) && await page.isVisible('#communityUserProfile .cm-muscle-map svg') && /Oro/.test(await page.textContent('#communityUserProfile .cm-muscle-top')), prof.replace(/\s+/g, ' ').slice(0, 120));
step('11. Mutuos: se ofrece mensaje; también comparar', await page.isVisible('#communityUserProfile [data-user-message]') && await page.isVisible('#communityUserProfile [data-user-compare]'));
step('Publicaciones dentro del perfil', /Primera semana completa|Publicaciones/.test(prof));
if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/profile.png`, fullPage: true });
await page.click('#communityUserProfile [data-user-compare]'); await page.waitForTimeout(1500);
if (process.env.SHOTS) { await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await page.screenshot({ path: `${process.env.SHOTS}/compare.png`, fullPage: true }); await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); }
const cmp = await page.textContent('#communityCompare');
step('10. Comparación: «Tu progreso» y «Progreso de Bruno Fit»', /Tu progreso/.test(cmp) && /Progreso de Bruno Fit/.test(cmp));
step('10. Misma métrica y unidad; lo faltante sin estimar', /Flexiones clásicas/.test(cmp) && /23 rep/.test(cmp) && /45 rep/.test(cmp) && /Sin datos disponibles/.test(cmp) && /No es un diagnóstico médico/.test(cmp), cmp.replace(/\s+/g, ' ').slice(0, 200));

await page.click('#communityTabRanking'); await page.waitForTimeout(1500);
step('8. Ranking explica qué mide, el período y el orden', /Período/.test(await page.textContent('#rankingExplain')) && /Orden/.test(await page.textContent('#rankingExplain')));
let board = await page.textContent('#communityPanelRanking');
step('8. Ranking general con datos reales (sin ocultos ni privados no aceptados)', /Bruno Fit/.test(board) && /Diego/.test(board) && !/Eva/.test(board) && !/carla/i.test(board), board.replace(/\s+/g, ' ').slice(0, 200));
await page.click('[data-ranking-category="pushups"]'); await page.waitForTimeout(1200);
const pushOrder = await page.$$eval('#communityPanelRanking [data-community-open-user]', b => b.map(x => x.getAttribute('aria-label')));
step('8. Ranking de flexiones ordenado por el servidor', /Puesto 1: Bruno Fit, 45 rep/.test(pushOrder.join('|')) && /Puesto 2: Vos, 23 rep/.test(pushOrder.join('|')) && /Puesto 3: Diego, 12 rep/.test(pushOrder.join('|')), pushOrder.join(' | '));
await page.click('[data-ranking-scope="friends"]'); await page.waitForTimeout(1200);
board = await page.textContent('#communityPanelRanking');
step('8. Ranking de amigos: solo vos y quienes seguís', /Bruno Fit/.test(board) && !/Diego/.test(board), board.replace(/\s+/g, ' ').slice(0, 160));
await page.click('#rankingPodium [data-community-open-user]'); await page.waitForTimeout(1200);
step('7. El ranking abre el mismo perfil completo', /Rango principal/.test(await page.textContent('#communityUserProfile')));

await page.click('#communityTabFriends'); await page.waitForTimeout(1500);
let friends = await page.textContent('#communityFriends');
step('9. Amigos refleja el seguimiento aceptado', /Bruno Fit/.test(friends) && !/Diego/.test(friends) && /Comparar/.test(friends) && /en rango/.test(friends), friends.replace(/\s+/g, ' ').slice(0, 160));
await page.click('#communityTabWorld'); await page.waitForTimeout(900);
await page.click(`#communityPeople [data-community-search-follow="${D}"]`); await page.waitForTimeout(1000);
step('11. Seguir actualiza la relación real', sql(`select status from community_follows where follower_id='${A}' and following_id='${D}'`) === 'accepted');
await page.click('#communityTabFriends'); await page.waitForTimeout(1500);
step('9. Amigos se actualiza al seguir', /Diego/.test(await page.textContent('#communityFriends')));
await page.click('#communityFriends .cm-card-open[aria-label*="Diego"]'); await page.waitForTimeout(1200);
step('11. Sin seguimiento mutuo no hay mensaje', !(await page.$('#communityUserProfile [data-user-message]')) && /mutuamente/.test(await page.textContent('#communityUserProfile')));
await page.click('#communityUserProfile [data-user-follow]'); await page.waitForTimeout(1200);
step('11. Dejar de seguir borra la relación', sql(`select count(*) from community_follows where follower_id='${A}' and following_id='${D}'`) === '0');

await page.click('#communityUserBack'); await page.waitForTimeout(600);
await page.click('#communityTabWorld'); await page.waitForTimeout(900);
await page.click('#communityPeople .cm-card-open[aria-label*="Carla"]'); await page.waitForTimeout(1200);
prof = await page.textContent('#communityUserProfile');
step('12. Perfil privado: sin bio ni estadísticas', /Este perfil es privado/.test(prof) && !/Bio solo para seguidores/.test(prof) && !/Estadísticas/.test(prof) && !/70 rep/.test(prof));
step('12. La tabla no se puede leer directamente', sql(`set role authenticated; set request.jwt.claim.sub='${A}'; select count(*) from community_athlete_stats`) === 'SET\nSET\n1');

// Ocultar las propias estadísticas.
await page.click('#communityTabProfile'); await page.waitForTimeout(900);
step('Mi perfil: interruptor de estadísticas activado por defecto', await page.isChecked('#communityStatsPublic'));
await page.uncheck('#communityStatsPublic'); await page.waitForTimeout(1200);
step('Ocultar se guarda en la base', sql(`select stats_public from community_athlete_stats where user_id='${A}'`) === 'f');
await page.click('#communityTabRanking'); await page.waitForTimeout(1200);
step('Con estadísticas ocultas no aparece en el ranking', !(await page.$$eval('#communityPanelRanking [data-community-open-user]', b => b.map(x => x.getAttribute('aria-label')).join('|'))).includes(': Vos,'));
// Mapa de avances (Progreso › Músculos) usa la misma preferencia.
await page.evaluate(() => document.querySelector('[data-view="progress"]').click()); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('[data-progress-tab="muscles"]').click()); await page.waitForTimeout(1800);
step('13. Mapa de avances: la casilla refleja la preferencia', !(await page.isChecked('#rkShareToggle')));
await page.check('#rkShareToggle'); await page.waitForTimeout(1800);
let names = await page.$$eval('#rkBoard .rk-who strong', l => l.map(x => x.textContent));
step('13. Al mostrarlas vuelve al ranking con amigos', sql(`select stats_public from community_athlete_stats where user_id='${A}'`) === 't' && names.includes('Vos') && names.includes('Bruno Fit'), names.join(','));
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(800);

// Publicar en el perfil: foto con descripción y antes/después.
await page.click('#communityTabProfile'); await page.waitForTimeout(600); await page.click('#communityOpenPublish'); await page.waitForTimeout(400);
await page.fill('#communityTextBody', 'Mi primera dominada completa');
await page.setInputFiles('#communityTextImage', { name: 'foto.png', mimeType: 'image/png', buffer: PNG }); await page.check('#communityTextPhotoConsent');
await page.click('#communityTextPublish'); await page.waitForTimeout(1800);
step('Foto con descripción publicada en el perfil', sql(`select count(*) from community_posts where user_id='${A}' and description='Mi primera dominada completa' and image_path is not null`) === '1' && await page.isVisible('#communityPanelProfile'));
await page.click('#communityOpenPublish'); await page.waitForTimeout(300); await page.click('[data-post-kind="transformation"]');
await page.setInputFiles('#communityBeforePhoto', { name: 'a.png', mimeType: 'image/png', buffer: PNG }); await page.setInputFiles('#communityAfterPhoto', { name: 'b.png', mimeType: 'image/png', buffer: PNG });
await page.fill('#communityPostDescription', 'Tres meses de constancia'); await page.check('#communityPhotoConsent');
await page.click('#communityPublish'); await page.waitForTimeout(2000);
step('Antes y después publicado en el perfil', sql(`select count(*) from community_posts where user_id='${A}' and post_kind='transformation' and description='Tres meses de constancia'`) === '1');
await page.waitForTimeout(800);
step('El perfil propio muestra lo publicado', (await page.$$('#communityOwnGrid [data-community-open-post]')).length >= 2);
await page.click('#communityViewOwnPublic'); await page.waitForTimeout(1500);
step('«Ver cómo me ven» usa el mismo perfil completo', /Así ven tu perfil/.test(await page.textContent('#communityUserProfile')) && /Rango principal/.test(await page.textContent('#communityUserProfile')));

// v61: sin foto en Comunidad se ofrece agregar una; si hay foto en Perfil, «Usar mi foto» la sube de un toque.
await page.click('#communityTabRanking'); await page.waitForTimeout(300); await page.click('#communityTabWorld'); await page.waitForTimeout(600);
step('v61 Sin foto en Comunidad se ofrece agregar una', await page.isVisible('#communityAvatarOffer') && /Agregá una foto de perfil/.test(await page.textContent('#communityAvatarOffer')));
await page.evaluate(b64 => { window.FittFormaLocalAvatar = () => 'data:image/jpeg;base64,' + b64; }, PNG.toString('base64'));
await page.click('#communityTabRanking'); await page.waitForTimeout(300); await page.click('#communityTabWorld'); await page.waitForTimeout(600);
step('v61 Con foto en Perfil ofrece usarla en Comunidad', /¿Usar tu foto de perfil en Comunidad\?/.test(await page.textContent('#communityAvatarOffer')) && await page.isVisible('#communityAvatarOffer img'));
await page.click('#communityAvatarOffer [data-avatar-offer-use]'); await page.waitForTimeout(1800);
step('v61 «Usar mi foto» la sube como foto de Comunidad y la oferta desaparece', /^aaaaaaaa-0000-0000-0000-000000000001\/avatar\//.test(sql(`select coalesce(avatar_path,'') from community_profiles where user_id='${A}'`)) && !(await page.isVisible('#communityAvatarOffer')));
await page.click('#communityTabProfile'); await page.waitForTimeout(900);
await page.click('#communityOwnAvatarBtn'); await page.waitForTimeout(700); await page.click('#communityPhotoViewerActions [data-viewer-remove-avatar]'); await page.waitForTimeout(1500);
step('v61 La foto se puede quitar desde Comunidad', sql(`select coalesce(avatar_path,'') from community_profiles where user_id='${A}'`) === '');
// v53.1: foto de perfil (tocar el avatar), bandera, «Mi físico», mapa de músculos y acceso desde Inicio.
await page.click('#communityTabProfile'); await page.waitForTimeout(900);
let [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#communityOwnAvatarBtn')]);
await fc.setFiles({ name: 'yo.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(1500);
step('v53.1 Tocar el avatar sin foto permite subir una', /^aaaaaaaa-0000-0000-0000-000000000001\/avatar\//.test(sql(`select coalesce(avatar_path,'') from community_profiles where user_id='${A}'`)) && /actualizada/.test(await page.textContent('#communityAvatarStatus')));
await page.click('#communityOwnAvatarBtn'); await page.waitForTimeout(900);
step('v53.1 Tocar el avatar con foto la muestra en grande con «Cambiar» y «Quitar»', await page.isVisible('#communityPhotoViewer img') && /Cambiar foto/.test(await page.textContent('#communityPhotoViewerActions')) && /Quitar foto/.test(await page.textContent('#communityPhotoViewerActions')));
await page.click('#communityPhotoViewer [data-close-viewer]'); await page.waitForTimeout(300);
await page.selectOption('#communityCountry', 'UY'); await page.evaluate(() => document.getElementById('communityProfileForm').requestSubmit()); await page.waitForTimeout(1300);
step('v53.1 Bandera guardada y visible en el perfil propio', sql(`select country_code from community_profiles where user_id='${A}'`) === 'UY' && /🇺🇾/.test(await page.textContent('#communityOwnFlag')));
const choose = async (button, files) => { let next = page.waitForEvent('filechooser'); await page.click(button); for (let i = 0; i < files.length; i++) { const chooser = await next; if (i + 1 < files.length) next = page.waitForEvent('filechooser'); await chooser.setFiles(files[i]); } await page.waitForTimeout(2200); };
const img = n => ({ name: n + '.png', mimeType: 'image/png', buffer: PNG });
await choose('[data-phys-upload="pair"]', [img('antes'), img('despues')]);
step('v53.1 «Mi físico»: antes y después subido', sql(`select (before_path like '${A}/physique/%')::text||(after_path like '${A}/physique/%')::text from community_physique where user_id='${A}' and kind='pair'`) === 'truetrue' && (await page.$$('#communityPhysiqueEdit .cm-phys-pair img')).length === 2);
await choose('[data-phys-upload="single"]', [img('una')]);
step('v53.1 «Mi físico»: una foto subida', sql(`select count(*) from community_physique where user_id='${A}' and kind='single' and photo_path is not null`) === '1');
const singleBefore = sql(`select photo_path from community_physique where user_id='${A}' and kind='single'`);
await page.click('[data-phys-upload="single"]'); await page.waitForTimeout(500);
step('v53.1 Sin Plus no se cambia antes de 30 días (y se explica)', /30 días/.test(await page.textContent('#communityPhysiqueStatus')) && sql(`select photo_path from community_physique where user_id='${A}' and kind='single'`) === singleBefore);
await page.click('#communityPhysiqueEdit [data-phys-view]'); await page.waitForTimeout(600);
step('v53.1 Las fotos de «Mi físico» se ven en grande', await page.isVisible('#communityPhotoViewer img'));
await page.click('#communityPhotoViewer [data-close-viewer]'); await page.waitForTimeout(300);
await page.click('#communityViewOwnPublic'); await page.waitForTimeout(1800);
const asOthers = await page.textContent('#communityUserProfile');
if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/asothers.png`, fullPage: true });
step('v53.1 «Ver cómo me ven» abre el perfil con «Mi físico», mapa de músculos y bandera', /Así ven tu perfil/.test(asOthers) && /Mi físico/.test(asOthers) && /Mapa de músculos/.test(asOthers) && /🇺🇾/.test(asOthers), asOthers.replace(/\s+/g, ' ').slice(0, 160));
await page.click('#communityTabProfile'); await page.waitForTimeout(900);
await page.uncheck('#communityShowMuscles'); await page.waitForTimeout(1300);
step('v53.1 Ocultar el mapa de músculos', sql(`select show_muscles from community_athlete_stats where user_id='${A}'`) === 'f');
await page.click('#communityViewOwnPublic'); await page.waitForTimeout(1500);
step('v53.1 Con el mapa oculto, el perfil propio lo sigue mostrando solo a vos', /Mapa de músculos/.test(await page.textContent('#communityUserProfile')));
await page.click('#communityTabProfile'); await page.waitForTimeout(600); await page.check('#communityShowMuscles'); await page.waitForTimeout(1000);
await page.click('.mobile-nav-item[data-mobile-view="plan"]'); await page.waitForTimeout(600);
await page.click('[data-home-muscles]'); await page.waitForTimeout(1200);
step('v53.1 Inicio tiene acceso directo a Músculos', await page.isVisible('#progressPanelMuscles'));
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(800);

// ---------- v54: semana actual, reto entre amigos, evolución semanal, avisos e historial de «Mi físico» ----------
step('v54 La app publica la semana actual (lunes a hoy)', sql(`select (week_start = date_trunc('week', current_date)::date)::text||'|'||(workouts_week>0)::text from community_athlete_stats where user_id='${A}'`) === 'true|true');
sql(`update community_athlete_stats set workouts_week=5, active_days_week=4 where user_id='${B}'`);
sql(`delete from community_athlete_weekly where user_id in ('${A}','${B}') and week_start < date_trunc('week', current_date)::date; insert into community_athlete_weekly(user_id,week_start,active_days,workouts) values ('${A}',date_trunc('week',current_date)::date-7,3,4),('${B}',date_trunc('week',current_date)::date-7,5,6),('${A}',date_trunc('week',current_date)::date-14,2,2),('${B}',date_trunc('week',current_date)::date-14,1,1)`);
sql(`insert into community_follows(follower_id,following_id,status) values('${A}','${B}','accepted') on conflict do nothing`);
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(600);
await page.click('#communityTabRanking'); await page.waitForTimeout(1000);
await page.click('[data-ranking-category="constancy"]'); await page.waitForTimeout(900);
step('v54 Constancia ofrece «Esta semana»', await page.isVisible('#rankingPeriod'));
await page.click('[data-ranking-period="week"]'); await page.waitForTimeout(1200);
const weekBoard = await page.$$eval('#communityPanelRanking [data-community-open-user]', b => b.map(x => x.getAttribute('aria-label')).join('|'));
step('v54 Ranking de esta semana ordenado por el servidor', /Bruno Fit, 4 días/.test(weekBoard) && /Esta semana/.test(await page.textContent('#rankingExplain')), weekBoard);
await page.click('[data-ranking-period="30d"]'); await page.waitForTimeout(300);
await page.click('#communityTabFriends'); await page.waitForTimeout(1600);
const ch = await page.textContent('#communityChallenge');
step('v54 Reto de la semana entre amigos, con quién ganó la semana pasada', await page.isVisible('#communityChallenge') && /Más días activos/.test(ch) && /4 de 7/.test(ch) && /Semana pasada: Bruno Fit con 5 días activos/.test(ch), ch.replace(/\s+/g, ' ').slice(0, 200));
await page.click(`#communityFriends [data-community-compare="${B}"]`); await page.waitForTimeout(1800);
const evo = await page.textContent('#communityCompare');
step('v61 La comparación incluye músculo por músculo (mapas de los dos y quién va adelante)', /Músculos/.test(evo) && (await page.$$('#communityCompare .cm-mvs-maps svg')).length === 2 && (await page.$$('#communityCompare .cm-mvs-row:not(.cm-mvs-head)')).length >= 3 && /a tu favor/.test(evo), evo.replace(/\s+/g, ' ').slice(0, 200));
step('v54 La comparación muestra la evolución semanal de las dos personas', /Evolución semanal/.test(evo) && (await page.$$('#communityCompare .cm-evo-bars .cm-evo-wk')).length === 16, evo.replace(/\s+/g, ' ').slice(-200));
if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/v54-compare.png`, fullPage: true });
// Aviso real: Bruno empieza a seguir a Alicia (lo crea el servidor con un trigger).
sql(`delete from community_notifications where user_id='${A}'; delete from community_follows where follower_id='${B}' and following_id='${A}'; insert into community_follows(follower_id,following_id,status) values('${B}','${A}','accepted')`);
await page.click('#communityTabAlerts'); await page.waitForTimeout(1500);
step('v54 Avisos: «Bruno Fit empezó a seguirte»', /Bruno Fit\s*empezó a seguirte/.test(await page.textContent('#communityAlerts')));
step('v54 Al abrir los avisos quedan leídos en la base', sql(`select count(*) from community_notifications where user_id='${A}' and read_at is null`) === '0');
await page.click('#communityAlerts [data-alert-actor]'); await page.waitForTimeout(1300);
step('v54 Tocar el aviso abre el perfil de quien lo generó', /Bruno Fit/.test(await page.textContent('#communityUserProfile')) && await page.isVisible('#communityPanelUser'));
// v62: insignias tocables, chat → perfil y datos físicos privados por defecto.
sql(`delete from community_body where user_id in ('${A}','${B}')`);
await page.evaluate(id => window.FittFormaCommunity.openProfile(id), B); await page.waitForTimeout(1500);
await page.click('#communityUserProfile .cm-badge[data-badge-key]'); await page.waitForTimeout(500);
let bi = await page.textContent('#communityBadgeInfo');
step('v62 Tocar una insignia de otra persona abre su ficha', await page.isVisible('#communityBadgeInfo') && /Flexiones/.test(bi) && /nivel 4 de 15/.test(bi) && /Cómo se registró/.test(bi) && !(await page.$('#communityBadgeInfo [data-bi-mine]')), bi.replace(/\s+/g, ' ').slice(0, 160));
await page.click('#communityBadgeInfo button.btn[data-bi-close]'); await page.waitForTimeout(300);
step('v62 La ficha se cierra y el perfil sigue abierto', !(await page.isVisible('#communityBadgeInfo')) && await page.isVisible('#communityPanelUser'));
step('v62 Sin elegir nada, el perfil de Bruno no muestra datos físicos', !/Datos físicos/.test(await page.textContent('#communityUserProfile')));
sql(`insert into community_body(user_id,weight_kg,goal) values('${B}',80,'strength')`);
await page.evaluate(id => window.FittFormaCommunity.openProfile(id), B); await page.waitForTimeout(1500);
let bp = await page.textContent('#communityUserProfile');
step('v62 Con peso y objetivo activados, se ven solo esos dos', /Datos físicos/.test(bp) && /80 kg/.test(bp) && /Ganar fuerza/.test(bp) && !/Altura/.test(bp));
await page.click('#communityUserProfile [data-user-message]'); await page.waitForTimeout(1500);
step('v62 La cabecera del chat dice «Ver perfil»', await page.isVisible('#communityChatWho') && /Bruno Fit/.test(await page.textContent('#communityChatWho')));
await page.click('#communityChatWho'); await page.waitForTimeout(1500);
step('v62 Tocar el nombre o la foto en el chat abre su perfil', await page.isVisible('#communityPanelUser') && /@bruno_fit/.test(await page.textContent('#communityUserProfile')));
await page.click('#communityTabProfile'); await page.waitForTimeout(1500);
step('v62 Mis datos físicos: todo apagado por defecto y nada en la nube', !(await page.$$eval('#communityBodyCard input[type=checkbox]', l => l.some(x => x.checked))) && sql(`select count(*) from community_body where user_id='${A}'`) === '0');
await page.click('#communityBodyWeight'); await page.waitForTimeout(800);
step('v62 Sin peso cargado no se activa y explica dónde cargarlo', !(await page.isChecked('#communityBodyWeight')) && /Primero cargá tu peso actual en Perfil/.test(await page.textContent('#communityBodyStatus')) && sql(`select count(*) from community_body where user_id='${A}'`) === '0');
const setWeight = kg => page.evaluate(kg => { document.getElementById('profileWeightUnit') && (document.getElementById('profileWeightUnit').value = 'kg'); document.getElementById('profileCurrentWeight').value = kg; document.getElementById('profileHeight').value = '170'; document.getElementById('bodyProfileForm').requestSubmit(); }, kg);
await setWeight('68'); await page.waitForTimeout(3500);
step('v62 Cargar el peso en Perfil no lo publica solo', sql(`select count(*) from community_body where user_id='${A}'`) === '0');
await page.check('#communityBodyWeight'); await page.waitForTimeout(1200);
step('v62 Al activarlo se guarda solo el peso (la altura sigue privada)', sql(`select weight_kg::text||'|'||coalesce(height_cm::text,'-')||'|'||coalesce(goal,'-') from community_body where user_id='${A}'`) === '68.0|-|-' && /68 kg/.test(await page.textContent('#communityBodyWeightVal')));
await setWeight('70'); await page.waitForTimeout(4000);
step('v62 Si cambia el peso en Perfil, se actualiza solo lo activado', sql(`select weight_kg::text||'|'||coalesce(height_cm::text,'-') from community_body where user_id='${A}'`) === '70.0|-');
await page.click('#communityViewOwnPublic'); await page.waitForTimeout(1500);
bp = await page.textContent('#communityUserProfile');
step('v62 «Ver cómo me ven» muestra el peso elegido y nada más', /Datos físicos/.test(bp) && /70 kg/.test(bp) && !/170 cm/.test(bp));
const ownBadge = await page.$('#communityUserProfile [data-badge-key]');
if (ownBadge) { await ownBadge.click(); await page.waitForTimeout(500);
  step('v62 Una insignia propia ofrece «Ver en mis insignias»', await page.isVisible('#communityBadgeInfo [data-bi-mine]'));
  await page.click('#communityBadgeInfo [data-bi-mine]'); await page.waitForTimeout(1200);
  step('v62 «Ver en mis insignias» abre Progreso › Insignias', await page.evaluate(() => document.getElementById('view-progress').classList.contains('active') && document.querySelector('[data-progress-tab="badges"]').getAttribute('aria-selected') === 'true'));
  await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(800);
} else step('v62 Una insignia propia ofrece «Ver en mis insignias»', false, 'el perfil propio no tiene insignias');
await page.click('#communityTabProfile'); await page.waitForTimeout(1500);
await page.uncheck('#communityBodyWeight'); await page.waitForTimeout(1200);
step('v62 Al apagarlo, el peso se quita de la nube', sql(`select coalesce(weight_kg::text,'null') from community_body where user_id='${A}'`) === 'null' && /volvió a ser privado/.test(await page.textContent('#communityBodyStatus')));
await page.evaluate(id => window.FittFormaCommunity.openProfile(id), B); await page.waitForTimeout(1300);
// Historial privado de «Mi físico»: con el plazo cumplido, cambiar una foto guarda la anterior.
sql(`alter table community_physique disable trigger community_physique_guard; update community_physique set changed_at=now()-interval '40 days' where user_id='${A}'; alter table community_physique enable trigger community_physique_guard`);
await page.click('#communityTabProfile'); await page.waitForTimeout(1500);
const oldSingle = sql(`select photo_path from community_physique where user_id='${A}' and kind='single'`);
await choose('[data-phys-upload="single"]', [img('nueva')]);
step('v54 Al cambiar la foto, la anterior queda en el historial privado', sql(`select photo_path from community_physique_history where user_id='${A}' order by id desc limit 1`) === oldSingle && /Historial privado/.test(await page.textContent('#communityPhysiqueHistory')));
await page.click('#communityPhysiqueHistory [data-phys-history-delete]'); await page.waitForTimeout(1200);
step('v54 Se puede borrar del historial', sql(`select count(*) from community_physique_history where user_id='${A}'`) === '0');

// Sin amigos: estado vacío.
sql(`delete from community_follows where follower_id='${A}'`);
await page.click('#communityTabFriends'); await page.waitForTimeout(1500);
step('Amigos vacío: «Todavía no tenés amigos en tu comunidad»', /Todavía no tenés amigos en tu comunidad/.test(await page.textContent('#communityFriends')));
if (process.env.SHOTS_NARROW) {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    for (const t of ['world', 'ranking', 'friends', 'alerts', 'profile']) { await page.click(`[data-community-tab="${t}"]`); await page.waitForTimeout(1300); await page.screenshot({ path: `${process.env.SHOTS_NARROW}/${theme}-${t}.png`, fullPage: true }); }
    await page.click('.mobile-nav-item[data-mobile-view="plan"]'); await page.waitForTimeout(800); await page.screenshot({ path: `${process.env.SHOTS_NARROW}/${theme}-home.png`, fullPage: false });
    await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(600);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}
if (process.env.SHOTS) { for (const t of ['world', 'ranking']) { await page.click(`[data-community-tab="${t}"]`); await page.waitForTimeout(1300); await page.screenshot({ path: `${process.env.SHOTS}/${t}.png`, fullPage: true }); } }
step('14. Sin errores de página ni de consola', errors.length === 0, errors.slice(0, 4).join(' || '));
// Restaura el seguimiento mutuo que usan las demás pruebas.
sql(`insert into community_follows(follower_id,following_id,status) values('${A}','${B}','accepted') on conflict do nothing`);
await browser.close();
