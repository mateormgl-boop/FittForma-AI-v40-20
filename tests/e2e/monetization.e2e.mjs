// E2E de monetización: navegador real + backend real (con MONETIZATION_ENABLED y proveedor de PRUEBA) +
// PostgREST real sobre PostgreSQL local con las migraciones v48. Gemini se reemplaza por una respuesta fija
// (tests/e2e/fixtures/mock-gemini.mjs). Ningún anuncio real: el proveedor 'test' muestra «Anuncio de prueba».
// Este archivo inicia su propio backend y una pasarela local que imita /auth/v1 y /rest/v1 de Supabase.
//   POSTGREST_URL (http://127.0.0.1:3300)  JWT_SECRET_FILE  SUPABASE_UMD  PLAYWRIGHT_DIR  E2E_DB (ff_e2e)
//   PGHOST/PGPORT/PGUSER para psql. NO apuntar nunca a un proyecto real.
import { createRequire } from 'module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');

const CLOSE_CELEBRATION = () => { setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d && d.open) d.close(); }, 50); };
const SECRET = fs.readFileSync(process.env.JWT_SECRET_FILE || '/var/tmp/ff_jwt_secret', 'utf8').trim();
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = payload => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload); return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const verify = tok => { const [h, p, s] = String(tok).split('.'); if (!s || crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null; return JSON.parse(Buffer.from(p, 'base64url')); };
const exp = Math.floor(Date.now() / 1000) + 3600;
const ANON = jwt({ role: 'anon', iss: 'supabase', exp });
const SERVICE = jwt({ role: 'service_role', iss: 'supabase', exp });
const USERS = { 'carla@example.test': 'cccccccc-0000-0000-0000-000000000003', 'dario@example.test': 'dddddddd-0000-0000-0000-000000000004' };
const userObj = email => ({ id: USERS[email], aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() });
const tokenFor = email => jwt({ sub: USERS[email], role: 'authenticated', aud: 'authenticated', email, exp });
const sql = q => execFileSync('psql', ['-d', process.env.E2E_DB || 'ff_e2e', '-Atc', q], { env: process.env }).toString().trim();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SUPA = 'https://e2e.supabase.co';
const PGRST = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
const GATEWAY_PORT = 3400, APP_PORT = 8811, APP = `http://127.0.0.1:${APP_PORT}`;
const C = USERS['carla@example.test'], D = USERS['dario@example.test'];
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- Datos de prueba (solo en la base local de pruebas) ----------
sql(`insert into auth.users(id,email) values('${C}','carla@example.test'),('${D}','dario@example.test') on conflict do nothing`);
sql(`insert into community_profiles(user_id,username,display_name,visibility) values('${C}','carla_fit','Carla','public'),('${D}','dario_fit','Darío','public') on conflict (user_id) do update set visibility='public'`);
sql(`delete from community_posts where user_id in ('${C}','${D}'); delete from monetization_usage; delete from monetization_rewards; delete from community_memberships where user_id in ('${C}','${D}')`);
// Darío tiene Plus vigente (fila que en producción escribe solo el servidor tras verificar el pago).
sql(`insert into community_memberships(user_id,tier,status,current_period_end) values('${D}','pro','active',now()+interval '30 days')`);
const previousLimit = sql(`select photo_limit_enabled from monetization_settings`);
sql(`update monetization_settings set photo_limit_enabled=true, photos_free_per_day=2, photos_max_extra_per_day=1`);

// ---------- Pasarela local: /auth/v1/user (firma HS256) y /rest/v1 → PostgREST ----------
const gateway = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/auth/v1/user') {
    const claims = verify((req.headers.authorization || '').split(' ')[1]);
    const email = claims && Object.keys(USERS).find(e => USERS[e] === claims.sub);
    res.writeHead(email ? 200 : 401, { 'content-type': 'application/json' }); return res.end(JSON.stringify(email ? userObj(email) : {}));
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = {}; for (const k of ['authorization', 'content-type', 'prefer', 'accept', 'apikey']) if (req.headers[k]) headers[k] = req.headers[k];
    const r = await fetch(PGRST + url.pathname.replace('/rest/v1', '') + url.search, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  res.writeHead(404); res.end('{}');
});
await new Promise(r => gateway.listen(GATEWAY_PORT, '127.0.0.1', r));

// ---------- Backend real con monetización en modo de prueba ----------
const server = spawn(process.execPath, ['--import', './tests/e2e/fixtures/mock-gemini.mjs', 'backend/server.mjs'], {
  env: { ...process.env, PORT: String(APP_PORT), GEMINI_API_KEY: 'test-key-not-real', SUPABASE_URL: `http://127.0.0.1:${GATEWAY_PORT}`, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    MONETIZATION_ENABLED: 'true', ADS_PROVIDER: 'test', ADS_ALLOW_TEST: 'true', AI_FREE_PER_DAY: '2', AI_MAX_VIDEOS_PER_DAY: '1', ADS_MIN_REWARD_SECONDS: '5', ADS_INTERSTITIAL_MIN_MINUTES: '5', ADMIN_METRICS_TOKEN: 'admin-test-token-123456' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = ''; server.stdout.on('data', d => { serverLog += d; }); server.stderr.on('data', d => { serverLog += d; });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP + '/healthz')).ok) break; } catch {} await wait(100); }

const browser = await chromium.launch();
async function newPage({ clock = false, blockEntitlements = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.errors = [];
  page.on('pageerror', e => page.errors.push('PAGEERR ' + e.message));
  page.on('dialog', d => d.accept());
  if (clock) await page.clock.install();
  await page.addInitScript(CLOSE_CELEBRATION);
  await page.addInitScript(() => localStorage.setItem('fittforma-welcome-v1', '1'));
  await page.route(/unpkg\.com/, r => r.abort());
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(process.env.SUPABASE_UMD) }));
  await page.route('**/api/public-config', async r => {
    const real = await (await fetch(APP + '/api/public-config')).json();
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...real, supabase: { configured: true, url: SUPA, anonKey: ANON, keyType: 'legacy_anon' }, missing: [], issue: null }) });
  });
  if (blockEntitlements) await page.route('**/api/entitlements', r => r.abort('internetdisconnected'));
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
    if (url.pathname.endsWith('/token')) {
      const { email, password } = JSON.parse(req.postData() || '{}');
      if (!USERS[email] || password !== 'clave-segura-123') return route.fulfill({ status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
      return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ access_token: tokenFor(email), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + email, user: userObj(email) }) });
    }
    if (url.pathname.endsWith('/user')) { const claims = verify((req.headers().authorization || '').split(' ')[1]); const email = claims && Object.keys(USERS).find(e => USERS[e] === claims.sub); return email ? route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify(userObj(email)) }) : route.fulfill({ status: 401, headers: cors, body: '{}' }); }
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: 404, headers: cors, body: '{}' });
  });
  await page.route(`${SUPA}/storage/v1/**`, async route => {
    const req = route.request(), url = new URL(req.url()), cors = { 'access-control-allow-origin': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.includes('/object/sign/')) { const path = url.pathname.split('/object/sign/community-media/')[1]; return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ signedURL: `/object/sign/community-media/${path}?token=t` }) }); }
    if (url.pathname.includes('/object/community-media/') && req.method() === 'POST') { const path = url.pathname.split('/object/community-media/')[1]; return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ Key: 'community-media/' + path, Id: crypto.randomUUID() }) }); }
    if (req.method() === 'GET') return route.fulfill({ headers: cors, contentType: 'image/png', body: PNG });
    return route.fulfill({ headers: cors, contentType: 'application/json', body: '[]' });
  });
  page.go = async view => { await page.click(`.mobile-nav-item[data-mobile-view="${view}"]`); await page.waitForTimeout(250); };
  page.ent = () => page.evaluate(async () => { const h = await window.FittFormaAuthHeader?.() || {}; return (await fetch('/api/entitlements', { headers: h })).json(); });
  page.login = async email => {
    await page.go('community'); await page.click('#communityTabProfile');
    await page.click('#communityAuthBanner [data-auth-open="login"]'); await page.fill('#authEmail', email); await page.fill('#authPassword', 'clave-segura-123');
    await page.click('#authSubmit'); await page.waitForTimeout(1500);
    await page.evaluate(() => window.FittFormaAds.refresh(true)); await page.waitForTimeout(300);
  };
  await page.goto(APP + '/'); await page.waitForTimeout(800);
  return page;
}
const overlayText = page => page.evaluate(() => document.querySelector('.ad-overlay')?.textContent || '');

try {
  // ========== 1. Sin cuenta (gratis): banners, intersticial e IA ==========
  console.log('\n== Gratis sin cuenta');
  const p1 = await newPage({ clock: true });
  const ent1 = await p1.ent();
  step('Servidor: plan gratis, monetización activa con proveedor de prueba', ent1.enabled === true && ent1.plan === 'free' && ent1.ads.show === true && ent1.ads.provider === 'test');
  await p1.evaluate(() => document.getElementById('adSlotHome')?.scrollIntoView()); await p1.waitForSelector('#adSlotHome.is-visible', { timeout: 4000 }).catch(() => {});
  step('Banner de Inicio visible y etiquetado como prueba', await p1.isVisible('#adSlotHome.is-visible') && /Anuncio de prueba/.test(await p1.textContent('#adSlotHome')), await p1.evaluate(() => document.getElementById('adSlotHome').className + ' ' + document.querySelector('.view.active')?.id));
  step('Ningún anuncio dentro de Entrenar ni GPS', await p1.evaluate(() => !document.querySelector('#view-train .ad-slot, #view-running .ad-slot')));
  let d = await p1.evaluate(() => window.FittFormaAds.maybeInterstitial('returned-to-menu'));
  step('Sin intersticial antes de 5 minutos de uso activo', !d.shown && d.reason === 'warmup', d.reason);
  await p1.go('train'); await p1.click('#startFreeWorkout'); await p1.waitForTimeout(200);
  await p1.clock.runFor(6 * 60000);
  d = await p1.evaluate(() => window.FittFormaAds.maybeInterstitial('workout-saved'));
  step('Durante un entrenamiento nunca hay intersticial (aunque pasó el tiempo)', !d.shown && d.reason === 'busy:workout' && !(await p1.$('.ad-overlay')), d.reason);
  await p1.fill('#sessionAddExerciseName', 'Plancha frontal'); await p1.click('#sessionAddExerciseForm button');
  await p1.fill('input[data-e="0"][data-s="0"][data-k="reps"]', '45'); await p1.check('input[data-done][data-e="0"][data-s="0"]');
  await p1.evaluate(() => document.getElementById('finishWorkout').click()); await p1.waitForTimeout(400);
  step('Al guardar el entrenamiento no aparece nada encima del guardado', !(await p1.$('.ad-overlay')));
  await p1.go('plan'); await p1.waitForTimeout(300);
  step('Pausa natural después de guardar: intersticial de prueba', /Anuncio de prueba/.test(await overlayText(p1)));
  if (await p1.$('.ad-overlay [data-ad-close]')) await p1.click('.ad-overlay [data-ad-close]');
  await p1.go('nutrition'); await p1.go('plan'); await p1.go('nutrition'); await p1.go('plan'); await p1.go('nutrition');
  step('Respeta el intervalo: no se repite enseguida', !(await p1.$('.ad-overlay')));
  await p1.clock.runFor(6 * 60000);
  await p1.go('plan'); await p1.waitForTimeout(500);
  const shownAfter = /Anuncio de prueba/.test(await overlayText(p1));
  step('Cambiar de sección tras el intervalo sí puede mostrarlo', shownAfter, shownAfter ? '' : JSON.stringify(await p1.evaluate(() => window.FittFormaActivities())));
  if (await p1.$('.ad-overlay [data-ad-close]')) await p1.click('.ad-overlay [data-ad-close]');
  step('Sin errores de página (intersticiales)', p1.errors.length === 0, p1.errors.join(' | '));
  await p1.close();

  const p2 = await newPage();
  await p2.go('train'); await p2.click('.view.active [data-subview="coach"]'); await p2.waitForTimeout(300);
  const ask = async text => { await p2.fill('#coachInput', text); await p2.click('#coachForm button[type=submit]'); await p2.waitForTimeout(900); };
  await ask('Primera consulta'); await ask('Segunda consulta');
  step('IA: 2 consultas gratis respondidas por el servidor', (await p2.$$eval('#coachMessages .bubble', b => b.filter(x => /Respuesta de prueba del entrenador/.test(x.textContent)).length)) === 2);
  d = await p2.evaluate(() => window.FittFormaAds.maybeInterstitial('section-change'));
  step('En el chat de IA nunca hay intersticial', !d.shown);
  await ask('Tercera consulta');
  step('IA agotada: el mensaje vuelve al cuadro y se ofrece esperar o mirar un video', (await p2.inputValue('#coachInput')) === 'Tercera consulta' && await p2.isVisible('#watchRewardedAd') && /esperar/.test(await p2.textContent('#coachUsageText')));
  step('IA agotada: el servidor no llamó al modelo ni respondió', !(await p2.textContent('#coachMessages')).includes('Tercera consulta') || (await p2.$$eval('#coachMessages .bubble', b => b.filter(x => /Respuesta de prueba/.test(x.textContent)).length)) === 2);
  await p2.click('#watchRewardedAd'); await p2.waitForTimeout(200);
  step('Antes del video se pide aceptación explícita', /Mirar un video voluntario/.test(await overlayText(p2)));
  await p2.click('.ad-overlay [data-no]'); await p2.waitForTimeout(200);
  step('«Ahora no» no suma nada', (await p2.ent()).ai.remaining === 0);
  await p2.evaluate(() => { window.__ffAdsTestSeconds = 30; });
  await p2.click('#watchRewardedAd'); await p2.click('.ad-overlay [data-ok]'); await p2.waitForTimeout(1200);
  await p2.click('.ad-overlay [data-ad-close]'); await p2.waitForTimeout(500);
  step('Video cerrado antes de terminar: sin consultas extra', (await p2.ent()).ai.remaining === 0);
  await p2.evaluate(() => { window.__ffAdsTest = 'nofill'; });
  await p2.click('#watchRewardedAd'); await p2.click('.ad-overlay [data-ok]'); await p2.waitForTimeout(500);
  step('Sin inventario: no suma y la conversación sigue', (await p2.ent()).ai.remaining === 0 && (await p2.inputValue('#coachInput')) === 'Tercera consulta');
  await p2.evaluate(() => { window.__ffAdsTest = 'error'; });
  await p2.click('#watchRewardedAd'); await p2.click('.ad-overlay [data-ok]'); await p2.waitForTimeout(500);
  step('Video con error: no suma', (await p2.ent()).ai.remaining === 0);
  await p2.evaluate(() => { window.__ffAdsTest = 'fill'; window.__ffAdsTestSeconds = 6; });
  await p2.click('#watchRewardedAd'); await p2.click('.ad-overlay [data-ok]'); await p2.waitForTimeout(7500);
  const afterVideo = await p2.ent();
  step('Video completado: el servidor suma 3 consultas', afterVideo.ai.remaining === 3, JSON.stringify(afterVideo.ai));
  step('Tope diario de videos alcanzado (1 configurado)', afterVideo.ai.videosLeft === 0);
  await p2.click('#coachForm button[type=submit]'); await p2.waitForTimeout(900);
  step('Con las consultas ganadas se responde el mensaje que quedó guardado', (await p2.$$eval('#coachMessages .bubble', b => b.filter(x => /Respuesta de prueba/.test(x.textContent)).length)) === 3);
  const fake = await p2.evaluate(async () => (await fetch('/api/rewards/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce: 'x'.repeat(24) }) })).status);
  step('Un comprobante inventado se rechaza', fake === 404 || fake === 400, String(fake));
  step('Sin errores de página (IA)', p2.errors.length === 0, p2.errors.join(' | '));
  await p2.close();

  // ========== 2. Cuenta gratis: fotos en Comunidad ==========
  console.log('\n== Gratis con cuenta: fotos');
  const p3 = await newPage();
  await p3.login('carla@example.test');
  const ent3 = await p3.ent();
  step('Sesión iniciada y plan gratis verificado en el servidor', ent3.signedIn === true && ent3.plan === 'free' && ent3.planVerified === true, JSON.stringify({ s: ent3.signedIn, p: ent3.plan, v: ent3.planVerified }));
  const photoCount = () => Number(sql(`select count(*) from community_posts where user_id='${C}' and image_path is not null`));
  const publishPhoto = async text => {
    // v53: se publica desde Mi perfil › «Publicar en mi perfil».
    if (!(await p3.isVisible('#communityPanelPublish'))) { await p3.click('#communityTabProfile'); await p3.waitForTimeout(300); await p3.click('#communityOpenPublish'); await p3.waitForTimeout(300); }
    await p3.fill('#communityTextBody', text);
    await p3.setInputFiles('#communityTextImage', { name: 'foto.png', mimeType: 'image/png', buffer: PNG });
    await p3.check('#communityTextPhotoConsent'); await p3.click('#communityTextPublish'); await p3.waitForTimeout(1500);
  };
  await publishPhoto('Foto uno'); await publishPhoto('Foto dos');
  step('Fotos 1 y 2 del día se publican gratis', photoCount() === 2, String(photoCount()));
  await publishPhoto('Foto tres');
  step('Foto 3: se ofrece un video voluntario (explicado antes)', /Mirar un video voluntario/.test(await overlayText(p3)), JSON.stringify([(await p3.ent()).photos, await p3.textContent('#communityComposeStatus'), await p3.evaluate(() => window.FittFormaAds.entitlements()?.photos)]));
  await p3.click('.ad-overlay [data-no]'); await p3.waitForTimeout(300);
  step('Sin aceptar: no se publica y el borrador queda en el formulario', photoCount() === 2 && (await p3.inputValue('#communityTextBody')) === 'Foto tres');
  await p3.evaluate(() => { window.__ffAdsTestSeconds = 6; });
  await p3.click('#communityTextPublish'); await p3.waitForTimeout(500);
  await p3.click('.ad-overlay [data-ok]'); await p3.waitForTimeout(7500);
  step('Video completado: la foto NO se publica sola', photoCount() === 2 && (await p3.inputValue('#communityTextBody')) === 'Foto tres');
  step('Se avisa que ya se puede publicar', /Listo: tocá «Publicar»/.test(await p3.textContent('#communityComposeStatus')));
  await p3.click('#communityTextPublish'); await p3.waitForTimeout(1500);
  step('La persona publica la foto 3 cuando decide', photoCount() === 3);
  const direct = await fetch(`${PGRST}/community_posts`, { method: 'POST', headers: { Authorization: `Bearer ${tokenFor('carla@example.test')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: C, post_kind: 'text', description: 'salteando la app', image_path: `${C}/x/image.jpg`, visibility: 'public' }) });
  const directBody = await direct.text();
  step('La base bloquea una 4.ª foto aunque se salteen los controles de la app', !direct.ok && /photo_daily_limit/.test(directBody), `${direct.status}`);
  await publishPhoto('Foto cuatro');
  step('Con el tope diario de videos alcanzado no se ofrece otro y el borrador se conserva', !(await p3.$('.ad-overlay')) && photoCount() === 3 && (await p3.inputValue('#communityTextBody')) === 'Foto cuatro');
  await p3.click('#communityTabWorld').catch(() => {}); await p3.waitForTimeout(1200);
  await p3.evaluate(() => document.getElementById('adSlotCommunity')?.scrollIntoView()); await p3.waitForTimeout(400);
  step('Banner de Comunidad debajo del directorio (no entre perfiles)', await p3.evaluate(() => { const s = document.getElementById('adSlotCommunity'); return Boolean(s?.classList.contains('is-visible') && /Anuncio de prueba/.test(s.textContent)); }));
  step('Sin errores de página (fotos)', p3.errors.length === 0, p3.errors.join(' | '));
  await p3.close();

  // ========== 3. Plus verificado ==========
  console.log('\n== Plus');
  const p4 = await newPage();
  await p4.login('dario@example.test');
  const ent4 = await p4.ent();
  step('Servidor: Plus verificado desde la membresía', ent4.plan === 'plus' && ent4.planVerified === true && ent4.ads.show === false, JSON.stringify({ p: ent4.plan, v: ent4.planVerified }));
  step('Plus: límites de IA y fotos más altos', ent4.ai.limit > ent3.ai.limit && ent4.photos.allowed > ent3.photos.allowed, `${ent4.ai.limit}/${ent4.photos.allowed}`);
  await p4.go('plan'); await p4.evaluate(() => document.getElementById('adSlotHome')?.scrollIntoView()); await p4.waitForTimeout(400);
  step('Plus: ningún banner', await p4.evaluate(() => [...document.querySelectorAll('.ad-slot')].every(s => !s.classList.contains('is-visible') && !s.classList.contains('is-reserved'))));
  d = await p4.evaluate(() => window.FittFormaAds.maybeInterstitial('workout-saved'));
  step('Plus: ningún intersticial', !d.shown);
  const plusReward = await p4.evaluate(async () => { const h = await window.FittFormaAuthHeader(); return (await fetch('/api/rewards/start', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ai' }) })).status; });
  step('Plus: el servidor no ofrece videos', plusReward === 409, String(plusReward));
  await p4.go('profile'); await p4.waitForTimeout(300);
  step('Perfil muestra «FittForma AI Plus · verificado»', /Plus/.test(await p4.textContent('#membershipStatus')) && /verificado/.test(await p4.textContent('#membershipStatus')));
  step('Sin errores de página (Plus)', p4.errors.length === 0, p4.errors.join(' | '));
  await p4.close();

  // ========== 4. Sin red hacia el servidor de planes ==========
  console.log('\n== Error de red');
  const p5 = await newPage({ blockEntitlements: true });
  await p5.go('plan');
  step('Sin respuesta del servidor: no se muestran anuncios ni se conceden beneficios', await p5.evaluate(() => [...document.querySelectorAll('.ad-slot')].every(s => !s.classList.contains('is-visible')) && !window.FittFormaAds.isPlus()));
  await p5.go('train'); await p5.click('#startFreeWorkout'); await p5.waitForTimeout(200);
  step('La app sigue funcionando (se puede entrenar)', await p5.isVisible('#finishWorkout'));
  step('Sin errores de página (red)', p5.errors.length === 0, p5.errors.join(' | '));
  await p5.close();

  // ========== 5. Métricas: solo eventos confirmados ==========
  const summary = await (await fetch(APP + '/api/metrics/summary', { headers: { 'X-Admin-Token': 'admin-test-token-123456' } })).json();
  const m = {}; for (const day of Object.values(summary.days || {})) for (const [k, v] of Object.entries(day)) m[k] = (m[k] || 0) + v;
  step('Métricas: video completado y video cerrado se cuentan por separado', (m.rewarded_completed || 0) >= 2 && (m.rewarded_closed_early || 0) >= 1, JSON.stringify(m));
  step('Métricas: recompensas concedidas las cuenta el servidor al canjear', m.reward_granted_ai === 1 && m.reward_granted_photo === 1, JSON.stringify(m));
} finally {
  await browser.close();
  server.kill(); gateway.close();
  sql(`update monetization_settings set photo_limit_enabled=${previousLimit === 't'}, photos_max_extra_per_day=3`);
}
if (failures) { console.log(serverLog.split('\n').slice(-20).join('\n')); }
console.log(`\n${failures ? 'FALLÓ' : 'OK'}: ${failures} falla(s)`);
process.exit(failures ? 1 : 0);
