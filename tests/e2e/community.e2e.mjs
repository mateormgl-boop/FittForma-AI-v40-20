// E2E de Comunidad: navegador real + supabase-js real + PostgREST real sobre PostgreSQL local.
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

const seed = { profile: { goal: 'fitness' }, sessions: [{ id: 5, type: 'custom', status: 'completed', date: '2026-10-15', title: 'Pecho y tríceps', minutes: 40, completedSets: 6, exercises: [{ name: 'Press de banca con barra', group: 'Pecho', kind: 'strength', entries: [{ reps: '8', weight: '40', done: true }] }] }], activities: [], badgeRecords: [{ id: 1, exerciseId: 'exercise-plancha-frontal', exerciseName: 'Plancha frontal', measure: 'seconds', value: 70, unit: 'seconds', date: new Date().toISOString().slice(0, 10), source: 'manual' }] };
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
await page.goto(APP + '/'); await page.waitForTimeout(800);
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(800);
step('Sin sesión: Comunidad abre en Todos con personas reales (sin feed)', (await page.getAttribute('#communityTabWorld', 'aria-selected')) === 'true' && /bruno_fit/.test(await page.textContent('#communityPeople')) && !(await page.$('#communityFeed')));
// v53: publicar se hace desde Mi perfil; las publicaciones de otra persona se abren desde su perfil.
const openPublish = async () => { await page.click('#communityTabProfile'); await page.waitForTimeout(400); await page.click('#communityOpenPublish'); await page.waitForTimeout(400); };
const openBrunoPost = async () => { await page.click('#communityTabWorld'); await page.waitForTimeout(900); await page.click('#communityPeople .cm-card-open[aria-label*="Bruno"]'); await page.waitForTimeout(1300); await page.click('#communityUserGrid [data-community-open-post="b0000000-0000-0000-0000-0000000000b1"]'); await page.waitForTimeout(1000); };
const POST_B = '#communityPostDialog [data-community-post="b0000000-0000-0000-0000-0000000000b1"]';

await page.click('#communityTabProfile');
await page.fill('#communityEmail', 'alice@example.test'); await page.fill('#communityPassword', 'clave-segura-123');
await page.click('#communityEmailLogin'); await page.waitForTimeout(1500);
step('Inicio de sesión', /Sesión iniciada|Sesión online/.test(await page.textContent('#communityEmailStatus') + await page.textContent('#communityProfileStatus')));
step('Indicador de 1 mensaje sin leer', await page.isVisible('#communityUnreadBadge') && (await page.textContent('#communityUnreadBadge')).trim() === '1');

// Publicación de texto con foto, vista previa y consentimiento
await openPublish();
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
await openPublish(); await page.click('[data-post-kind="achievement"]');
const options = await page.$$eval('#communityAchievementSelect option', o => o.map(x => x.textContent));
step('Selector ofrece la insignia local', options.some(o => /Plancha frontal · Plata I/.test(o)), options.join(' | '));
await page.fill('#communityAchievementComment', 'Tres semanas para llegar');
step('Vista previa del logro dice "Declarada por el autor"', (await page.textContent('#communityPostPreview')).includes('Declarada por el autor'));
await page.click('#communityAchievementPublish'); await page.waitForTimeout(1500);
const ach = sql(`select achievement->>'rank', achievement->>'level', achievement->>'evidence' from community_posts where post_kind='achievement'`);
step('Logro persistido con evidencia declarada', ach === 'silver|4|declared', ach);
await page.waitForTimeout(600);
step('Después de publicar vuelve a Mi perfil con las publicaciones', await page.isVisible('#communityPanelProfile') && (await page.$$('#communityOwnGrid [data-community-open-post]')).length === 2 && /Plancha frontal/.test(await page.textContent('#communityOwnGrid')));

// Me gusta, comentario y edición
await openBrunoPost();
await page.click(`${POST_B} [data-community-like]`); await page.waitForTimeout(1200);
await page.click(`${POST_B} [data-community-like]`).catch(() => {}); await page.waitForTimeout(1200);
step('Me gusta alterna sin duplicar', sql(`select count(*) from community_likes`) === '0');
await page.click(`${POST_B} [data-community-like]`); await page.waitForTimeout(1200);
step('Me gusta persistido', sql(`select count(*) from community_likes where user_id='aaaaaaaa-0000-0000-0000-000000000001'`) === '1');
await page.fill('#communityPostDialog [data-community-comment-form="b0000000-0000-0000-0000-0000000000b1"] input', '¡Vamos Bruno!');
await page.click('#communityPostDialog [data-community-comment-form="b0000000-0000-0000-0000-0000000000b1"] button'); await page.waitForTimeout(1300);
step('Comentario persistido', sql(`select body from community_comments`) === '¡Vamos Bruno!');
const textPostId = sql(`select id from community_posts where post_kind='text' and user_id='aaaaaaaa-0000-0000-0000-000000000001'`);
// v49: editar, eliminar, denunciar y bloquear están en el menú «⋯» de cada publicación (v53: abierta desde el perfil).
step('Botón editar ausente en post ajeno', !(await page.$(`${POST_B} [data-community-edit-post]`)));
// v49: guardar una publicación (solo después de que la base confirma).
await page.click(`${POST_B} [data-community-save]`); await page.waitForTimeout(900);
step('Publicación guardada en la base', sql(`select count(*) from community_saved_posts where user_id='aaaaaaaa-0000-0000-0000-000000000001'`) === '1');
step('El botón guardar queda marcado', (await page.getAttribute(`${POST_B} [data-community-save]`, 'aria-pressed')) === 'true');
await page.evaluate(() => document.getElementById('communityPostDialog').close());
const otherProfile = await page.textContent('#communityUserProfile');
step('Perfil de otra persona: nombre, usuario y conteos reales', /Bruno Fit/.test(otherProfile) && /@bruno_fit/.test(otherProfile) && /seguidores/.test(otherProfile), otherProfile.replace(/\s+/g, ' ').slice(0, 140));
step('Mutuos: se ofrece escribir un mensaje', await page.isVisible('#communityUserProfile [data-user-message]'));
step('La barra inferior principal sigue intacta', await page.$$eval('.mobile-nav-item', n => n.map(x => x.dataset.mobileView).join(',')) === 'plan,train,nutrition,progress,community,profile');
await page.click('#communityTabProfile'); await page.waitForTimeout(900);
await page.click(`#communityOwnGrid [data-community-open-post="${textPostId}"]`); await page.waitForTimeout(1000);
await page.click(`#communityPostDialog [data-community-post="${textPostId}"] .community-post-menu summary`);
await page.click(`#communityPostDialog [data-community-edit-post="${textPostId}"]`);
await page.fill(`#communityPostDialog [data-community-post="${textPostId}"] .community-edit-form textarea`, 'Hoy corrí 5 km sin parar (editado)');
await page.click(`#communityPostDialog [data-community-post="${textPostId}"] .community-edit-form button[type=submit]`); await page.waitForTimeout(1200);
await page.evaluate(() => document.getElementById('communityPostDialog').close());
step('Edición propia persistida', sql(`select description from community_posts where id='${textPostId}'`) === 'Hoy corrí 5 km sin parar (editado)');
// v53: los #hashtags ya no abren una búsqueda de publicaciones (no hay feed general).
// v49: publicación con un entrenamiento vinculado (resumen elegido por la persona).
await openPublish(); await page.click('[data-post-kind="text"]');
await page.fill('#communityTextBody', 'Sesión de pecho completa #fuerza');
await page.selectOption('#communityLinkSession', 's5');
step('La vista previa muestra el entrenamiento vinculado', /Pecho y tríceps/.test(await page.textContent('#communityPostPreview')));
await page.click('#communityTextPublish'); await page.waitForTimeout(1500);
step('Entrenamiento vinculado guardado (sin datos corporales)', sql(`select linked_session->>'title' || '|' || (linked_session ? 'weightKg')::text from community_posts where description='Sesión de pecho completa #fuerza'`) === 'Pecho y tríceps|false');
// Guardadas en el perfil propio.
await page.click('#communityTabProfile'); await page.waitForTimeout(900);
await page.click('[data-own-tab="saved"]'); await page.waitForTimeout(900);
step('Perfil propio › Guardadas muestra la publicación guardada', (await page.$$('#communityOwnGrid [data-community-open-post="b0000000-0000-0000-0000-0000000000b1"]')).length === 1);

// Mensajes: abrir conversación marca leído
await page.click('#communityTabMessages'); await page.waitForTimeout(1200);
step('Lista de conversaciones con el último mensaje y no leídos', /Bruno Fit/.test(await page.textContent('#communityConversations')) && (await page.$$('#communityConversations .community-conversation.has-unread')).length === 1);
const opt = await page.$$eval('#communityChatContact option', o => o.map(x => x.textContent));
step('Contacto muestra mensajes sin leer', opt.some(o => /1 sin leer/.test(o)), opt.join(' | '));
await page.selectOption('#communityChatContact', 'bbbbbbbb-0000-0000-0000-000000000002'); await page.waitForTimeout(1200);
step('Abrir conversación marca leído en la base', sql(`select count(*) from community_messages where read_at is null`) === '0');
step('Indicador de no leídos desaparece', !(await page.isVisible('#communityUnreadBadge')));
await page.fill('#communityChatText', 'Dale, sábado 9 h'); await page.click('#communityChatSend'); await page.waitForTimeout(1000);
step('Mensaje enviado y persistido', sql(`select count(*) from community_messages where sender_id='aaaaaaaa-0000-0000-0000-000000000001'`) === '1');

// v50: perfiles nuevos públicos, directorio de usuarios reales, privado con datos básicos y foto de perfil.
sql(`delete from community_follows where following_id='cccccccc-0000-0000-0000-0000000000c5'; delete from community_profiles where user_id in ('cccccccc-0000-0000-0000-0000000000c5','dddddddd-0000-0000-0000-0000000000d5'); delete from auth.users where id in ('cccccccc-0000-0000-0000-0000000000c5','dddddddd-0000-0000-0000-0000000000d5')`);
sql(`insert into auth.users(id,email,raw_user_meta_data) values('cccccccc-0000-0000-0000-0000000000c5','carla@example.test','{"full_name":"Carla"}'),('dddddddd-0000-0000-0000-0000000000d5','diego@example.test','{"full_name":"Diego"}')`);
step('Un perfil nuevo empieza público', sql(`select visibility from community_profiles where user_id='dddddddd-0000-0000-0000-0000000000d5'`) === 'public');
sql(`update community_profiles set username='carla_priv', visibility='private', bio='No deberías ver esto', avatar_path='cccccccc-0000-0000-0000-0000000000c5/avatar/c1.jpg' where user_id='cccccccc-0000-0000-0000-0000000000c5'; update community_profiles set username='diego_pub' where user_id='dddddddd-0000-0000-0000-0000000000d5'`);
await page.click('#communityTabWorld'); await page.waitForTimeout(1200);
const people = await page.textContent('#communityPeople');
step('Todos lista usuarios reales de la app', /carla_priv/.test(people) && /diego_pub/.test(people) && /bruno_fit/.test(people), people.replace(/\s+/g, ' ').slice(0, 160));
step('El perfil privado muestra solo datos básicos y la etiqueta', /Perfil privado/.test(people) && !/No deberías ver esto/.test(people));
const carlaAvatar = await page.$$eval('#communityPeople .cm-card', n => (n.find(x => /carla_priv/.test(x.textContent))?.querySelector('.community-avatar')?.outerHTML) || '');
step('Foto de perfil del privado visible como dato básico', /has-photo/.test(carlaAvatar) && /cccccccc-0000-0000-0000-0000000000c5\/avatar\/c1\.jpg/.test(carlaAvatar), carlaAvatar.slice(0, 200));
await page.click('#communityPeople .cm-card-open[aria-label*="Carla"]'); await page.waitForTimeout(900);
const priv = await page.textContent('#communityUserProfile');
step('Abrir un perfil privado muestra el aviso, sin su contenido', /Este perfil es privado/.test(priv) && !/No deberías ver esto/.test(priv), priv.replace(/\s+/g, ' ').slice(0, 140));
await page.click('#communityUserProfile [data-user-follow]'); await page.waitForTimeout(700);
step('Solicitar seguir a un privado queda pendiente', sql(`select status from community_follows where follower_id='aaaaaaaa-0000-0000-0000-000000000001' and following_id='cccccccc-0000-0000-0000-0000000000c5'`) === 'pending');
await page.click('#communityTabWorld'); await page.fill('#communitySearch', 'diego'); await page.press('#communitySearch', 'Enter'); await page.waitForTimeout(900);
const found = await page.textContent('#communityPeople');
step('Buscar personas por nombre o usuario', /diego_pub/.test(found) && !/carla_priv/.test(found), found.replace(/\s+/g, ' ').slice(0, 100));
await page.fill('#communitySearch', ''); await page.press('#communitySearch', 'Enter'); await page.waitForTimeout(500);
await page.click('#communityTabProfile'); await page.waitForTimeout(600);
await page.setInputFiles('#communityAvatarInput', { name: 'yo.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(1500);
const avatarPath = sql(`select coalesce(avatar_path,'') from community_profiles where user_id='aaaaaaaa-0000-0000-0000-000000000001'`);
step('Subir foto de perfil (carpeta propia)', /^aaaaaaaa-0000-0000-0000-000000000001\/avatar\/[a-z0-9]+\.jpg$/.test(avatarPath), avatarPath);
step('Botón para quitar la foto visible', await page.isVisible('#communityAvatarRemove'));
await page.click('#communityAvatarRemove'); await page.waitForTimeout(800);
step('Quitar la foto de perfil vuelve a las iniciales', sql(`select avatar_path is null from community_profiles where user_id='aaaaaaaa-0000-0000-0000-000000000001'`) === 't' && !(await page.isVisible('#communityAvatarRemove')));
await page.selectOption('#communityVisibility', 'private'); await page.evaluate(() => document.getElementById('communityProfileForm').requestSubmit()); await page.waitForTimeout(800);
step('Cambiar a privado se aplica al instante en la base', sql(`select visibility from community_profiles where user_id='aaaaaaaa-0000-0000-0000-000000000001'`) === 'private');
await page.selectOption('#communityVisibility', 'public'); await page.evaluate(() => document.getElementById('communityProfileForm').requestSubmit()); await page.waitForTimeout(800);


// Eliminación propia
await page.click('#communityTabProfile'); await page.waitForTimeout(900); await page.click('[data-own-tab="posts"]'); await page.waitForTimeout(900);
await page.click(`#communityOwnGrid [data-community-open-post="${textPostId}"]`); await page.waitForTimeout(1000);
await page.click(`#communityPostDialog [data-community-post="${textPostId}"] .community-post-menu summary`);
await page.click(`#communityPostDialog [data-community-post="${textPostId}"] [data-community-delete-post]`); await page.waitForTimeout(1200);
step('Eliminar publicación propia', sql(`select count(*) from community_posts where id='${textPostId}'`) === '0');
// Moderación (v43): solo una cuenta agregada por SQL ve las denuncias.
await page.click('#communityTabProfile'); await page.waitForTimeout(900);
step('Sin rol de moderación no se ve la tarjeta', !(await page.isVisible('#communityModerationCard')));
const achId = sql(`select id from community_posts where post_kind='achievement' and user_id='aaaaaaaa-0000-0000-0000-000000000001'`);
sql(`insert into community_moderators(user_id) values('aaaaaaaa-0000-0000-0000-000000000001'); insert into community_reports(reporter_id,post_id,reason) values('bbbbbbbb-0000-0000-0000-000000000002','b0000000-0000-0000-0000-0000000000b1','Prueba descartar'),('bbbbbbbb-0000-0000-0000-000000000002','${achId}','Prueba eliminar')`);
await page.click('#communityTabWorld'); await page.waitForTimeout(500); await page.click('#communityTabProfile'); await page.waitForTimeout(1200);
step('Moderador ve las denuncias abiertas', await page.isVisible('#communityModerationCard') && /Prueba descartar/.test(await page.textContent('#communityReportsList')));
// v60: las dos denuncias se crean en el mismo instante y el orden de la lista puede variar: se toca la de «Prueba descartar»
// (antes se tocaba la primera y a veces se descartaba la otra) y se espera a que la base lo registre.
const dismissId = sql(`select id from community_reports where reason='Prueba descartar'`);
await page.click(`#communityReportsList [data-report-dismiss="${dismissId}"]`);
for (let i = 0; i < 40 && sql(`select status from community_reports where id='${dismissId}'`) !== 'dismissed'; i++) await page.waitForTimeout(150);
step('Descartar denuncia guarda estado y quién resolvió', sql(`select status, resolved_by is not null from community_reports where reason='Prueba descartar'`) === 'dismissed|t');
await page.click(`#communityReportsList [data-report-remove="${achId}"]`); await page.waitForTimeout(1200);
step('Moderador elimina la publicación denunciada', sql(`select count(*) from community_posts where id='${achId}'`) === '0');

// Copia en la nube (user_app_data real vía PostgREST): guardar, borrar local y volver a cargar.
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(600);
await page.evaluate(() => { const d = document.getElementById('cloudAccountCard')?.closest('details'); if (d) d.open = true; });
const localBadges = () => page.evaluate(() => (JSON.parse(localStorage.getItem('fittforma-ai-v4') || '{}').badgeRecords || []).length);
await page.click('#cloudUpload'); await page.waitForTimeout(1200);
step('Guardar en la nube crea la copia de A', sql(`select jsonb_array_length(data->'badgeRecords') from user_app_data where user_id='aaaaaaaa-0000-0000-0000-000000000001'`) === '1');
await page.evaluate(() => document.getElementById('clearData').click()); await page.waitForTimeout(400);
step('Borrar datos locales', (await localBadges()) === 0);
await page.click('#cloudDownload'); await page.waitForTimeout(1200);
step('Cargar desde la nube recupera los datos', (await localBadges()) === 1);

// Eliminar la propia cuenta (v43): confirmación escrita "ELIMINAR".
step('Botón de eliminar cuenta visible con sesión', await page.isVisible('#deleteCloudAccount'));
await page.click('#deleteCloudAccount'); await page.waitForTimeout(1800);
step('Cuenta y datos en cascada eliminados', sql(`select (select count(*) from auth.users where id='aaaaaaaa-0000-0000-0000-000000000001')||'|'||(select count(*) from community_profiles where user_id='aaaaaaaa-0000-0000-0000-000000000001')||'|'||(select count(*) from community_messages where sender_id='aaaaaaaa-0000-0000-0000-000000000001')`) === '0|0|0');
step('La otra cuenta no se toca', sql(`select count(*) from auth.users where id='bbbbbbbb-0000-0000-0000-000000000002'`) === '1');
step('Datos locales del dispositivo se conservan', await page.evaluate(() => Boolean(localStorage.getItem('fittforma-ai-v4'))));
step('Sin errores de página', errors.length === 0, errors.slice(0, 4).join(' || '));
await browser.close();
