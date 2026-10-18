import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMonetization, monetizationConfigFromEnv, adsCspAdditions, MemoryStore } from '../backend/monetization.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = globalThis.FittFormaMonetization;
const USER = '11111111-2222-3333-4444-555555555555';
const req = (token, extra = {}) => ({ headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra } });
const TOKEN = 'x'.repeat(40);
// Supabase simulado: /auth/v1/user y community_memberships.
function fakeSupabase({ plus = false, membershipError = false } = {}) {
  return async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(init.headers.Authorization === `Bearer ${TOKEN}` ? { id: USER } : {}), { status: init.headers.Authorization === `Bearer ${TOKEN}` ? 200 : 401 });
    if (u.includes('/rest/v1/community_memberships')) return membershipError ? new Response('x', { status: 500 }) : new Response(JSON.stringify(plus ? [{ tier: 'pro', status: 'active', current_period_end: new Date(Date.now() + 86400000).toISOString() }] : []), { status: 200 });
    return new Response('{}', { status: 404 });
  };
}
const ENV = { MONETIZATION_ENABLED: 'true', ADS_PROVIDER: 'test', ADS_ALLOW_TEST: 'true', SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_ANON_KEY: 'anon', AI_FREE_PER_DAY: '2', ADS_MIN_REWARD_SECONDS: '10' };

test('monetización: reglas de intersticiales (nunca durante actividades, intervalo y Plus)', () => {
  const config = M.normalizeConfig({ enabled: true, ads: { interstitialMinMinutes: 7, sectionChangesBetweenInterstitials: 4 } });
  const base = { config, plan: 'free', adsAvailable: true, event: 'workout-saved', activities: [], activeMsSinceLast: 8 * 60000, sectionChangesSinceLast: 0, shownBefore: true };
  assert.equal(M.interstitialDecision(base).allowed, true);
  for (const a of ['workout', 'rest-timer', 'gps-running', 'meal-logging', 'ai-chat', 'login', 'payment', 'photo-upload', 'saving', 'ad-open', 'ad-loading']) assert.equal(M.interstitialDecision({ ...base, activities: [a] }).allowed, false, a);
  assert.equal(M.interstitialDecision({ ...base, plan: 'plus' }).reason, 'plus');
  assert.equal(M.interstitialDecision({ ...base, activeMsSinceLast: 4 * 60000 }).reason, 'interval');
  assert.equal(M.interstitialDecision({ ...base, event: 'random-click' }).reason, 'not-a-break');
  assert.equal(M.interstitialDecision({ ...base, event: 'section-change', sectionChangesSinceLast: 1 }).reason, 'not-enough-navigation');
  assert.equal(M.interstitialDecision({ ...base, adsAvailable: false }).reason, 'no-provider');
  assert.equal(M.interstitialDecision({ ...base, config: M.normalizeConfig({ enabled: false }) }).reason, 'disabled');
  assert.equal(M.normalizeConfig({ ads: { interstitialMinMinutes: 1 } }).ads.interstitialMinMinutes, 5, 'el intervalo mínimo nunca baja de 5 minutos');
  assert.equal(M.normalizeConfig({ ads: { interstitialMinMinutes: 60 } }).ads.interstitialMinMinutes, 10);
});

test('monetización: cuotas de IA y fotos', () => {
  const config = M.normalizeConfig({ enabled: true });
  assert.deepEqual(M.aiQuota({ config, plan: 'free', used: 6, bonus: 0, rewardedVideos: 0 }), { limit: 6, used: 6, bonus: 0, remaining: 0, videosLeft: 3, canOfferVideo: true });
  assert.equal(M.aiQuota({ config, plan: 'free', used: 9, bonus: 3, rewardedVideos: 1 }).remaining, 0);
  assert.equal(M.aiQuota({ config, plan: 'plus', used: 6 }).canOfferVideo, false);
  assert.equal(M.photoQuota({ config, plan: 'free', posted: 1 }).remaining, 1, 'primera y segunda foto gratis');
  assert.equal(M.photoQuota({ config, plan: 'free', posted: 2 }).needsReward, true, 'la tercera pide video');
  assert.equal(M.photoQuota({ config, plan: 'free', posted: 2, extra: 1 }).remaining, 1);
  assert.equal(M.photoQuota({ config, plan: 'free', posted: 5, extra: 9 }).allowed, 5, 'el extra se acota al máximo diario');
  assert.equal(M.photoQuota({ config, plan: 'plus', posted: 2 }).remaining, 8);
});

test('monetización: desactivada por defecto, sin anuncios ni límites nuevos', async () => {
  const m = createMonetization({ env: {}, fetchImpl: fakeSupabase() });
  const e = await m.entitlements(req(), '1.2.3.4');
  assert.equal(e.enabled, false); assert.equal(e.ads.show, false); assert.equal(m.publicAdsConfig().provider, 'none');
  assert.deepEqual(await m.consumeAi(req(), 'x'), { ok: true, skipped: true });
  assert.deepEqual(adsCspAdditions(m.settings.ads).script, [], 'sin proveedor no se abre la CSP');
});

test('monetización: configuración segura (solo IDs públicos con formato válido; test explícito)', () => {
  const s = monetizationConfigFromEnv({ MONETIZATION_ENABLED: 'true', ADS_PROVIDER: 'gam', GAM_NETWORK_CODE: '123456', GAM_SLOT_HOME: '/123456/fittforma/home', GAM_SLOT_REWARDED: 'javascript:alert(1)' });
  assert.equal(s.ads.provider, 'gam'); assert.equal(s.ads.slots.home, '/123456/fittforma/home'); assert.equal(s.ads.slots.rewarded, '', 'un identificador inválido se ignora');
  assert.ok(adsCspAdditions(s.ads).script.includes('https://securepubads.g.doubleclick.net'));
  assert.equal(monetizationConfigFromEnv({ ADS_PROVIDER: 'gam' }).ads.provider, 'none', 'sin network code no hay anuncios');
  assert.equal(monetizationConfigFromEnv({ ADS_PROVIDER: 'test' }).ads.provider, 'none', 'el proveedor de prueba requiere ADS_ALLOW_TEST');
});

test('monetización: la IA se limita en el servidor y se devuelve si el modelo falla', async () => {
  const m = createMonetization({ env: ENV, fetchImpl: fakeSupabase() });
  const a = await m.consumeAi(req(TOKEN), 'ip'), b = await m.consumeAi(req(TOKEN), 'ip');
  assert.equal(a.ok && b.ok, true);
  const c = await m.consumeAi(req(TOKEN), 'ip');
  assert.equal(c.ok, false); assert.equal(c.quota.remaining, 0); assert.equal(c.quota.canOfferVideo, true);
  await b.refund();
  assert.equal((await m.consumeAi(req(TOKEN), 'ip')).ok, true, 'el reintegro devuelve la consulta');
  const other = await m.consumeAi(req(), 'otra-ip');
  assert.equal(other.ok, true, 'cada cuenta/dispositivo tiene su propia cuota');
});

test('monetización: recompensa de IA solo con comprobante del servidor, una vez y tras completar', async () => {
  let clock = Date.parse('2026-10-18T15:00:00Z');
  const m = createMonetization({ env: ENV, fetchImpl: fakeSupabase(), now: () => clock });
  assert.equal((await m.startReward(req(TOKEN), 'ip', 'ai')).status, 409, 'con consultas disponibles no se ofrece video');
  await m.consumeAi(req(TOKEN), 'ip'); await m.consumeAi(req(TOKEN), 'ip');
  const start = await m.startReward(req(TOKEN), 'ip', 'ai');
  assert.equal(start.status, 200);
  clock += 3000;
  assert.equal((await m.claimReward(req(TOKEN), 'ip', start.body.nonce)).status, 409, 'cerrar antes de tiempo no da recompensa');
  clock += 9000;
  const ok = await m.claimReward(req(TOKEN), 'ip', start.body.nonce);
  assert.equal(ok.status, 200); assert.equal(ok.body.credits, 3);
  const dup = await m.claimReward(req(TOKEN), 'ip', start.body.nonce);
  assert.equal(dup.status, 409); assert.equal(dup.body.duplicate, true, 'la misma reproducción no paga dos veces');
  assert.equal((await m.claimReward(req(), 'otra-ip', start.body.nonce)).status, 404, 'otro usuario no puede canjear el comprobante');
  assert.equal((await m.entitlements(req(TOKEN), 'ip')).ai.remaining, 3);
  const bad = await m.claimReward(req(TOKEN), 'ip', 'nonce-falso-123456789012345');
  assert.equal(bad.status, 404, 'un comprobante inventado no sirve');
  // Tope diario de videos.
  for (let i = 0; i < 3; i++) await m.consumeAi(req(TOKEN), 'ip');
  for (let i = 0; i < 2; i++) { const s = await m.startReward(req(TOKEN), 'ip', 'ai'); clock += 11000; await m.claimReward(req(TOKEN), 'ip', s.body.nonce); for (let j = 0; j < 3; j++) await m.consumeAi(req(TOKEN), 'ip'); }
  assert.equal((await m.startReward(req(TOKEN), 'ip', 'ai')).status, 429, 'se respeta el máximo diario de videos');
  // Vencido.
  const m2 = createMonetization({ env: { ...ENV, AI_FREE_PER_DAY: '1' }, fetchImpl: fakeSupabase(), now: () => clock });
  await m2.consumeAi(req(TOKEN), 'ip'); const s2 = await m2.startReward(req(TOKEN), 'ip', 'ai'); clock += 3600_000;
  assert.equal((await m2.claimReward(req(TOKEN), 'ip', s2.body.nonce)).status, 410);
});

test('monetización: Plus verificado sin anuncios ni videos; error de estado no concede Plus', async () => {
  const plus = createMonetization({ env: ENV, fetchImpl: fakeSupabase({ plus: true }) });
  const e = await plus.entitlements(req(TOKEN), 'ip');
  assert.equal(e.plan, 'plus'); assert.equal(e.ads.show, false); assert.equal(e.ai.limit, 40);
  assert.equal((await plus.startReward(req(TOKEN), 'ip', 'ai')).status, 409);
  const broken = createMonetization({ env: ENV, fetchImpl: fakeSupabase({ membershipError: true }) });
  const e2 = await broken.entitlements(req(TOKEN), 'ip');
  assert.equal(e2.plan, 'free'); assert.equal(e2.planVerified, false, 'si no se puede verificar, no se afirma Plus');
  const anon = await plus.entitlements(req('token-invalido-xxxxxxxxxxxxxxxxxxxx'), 'ip');
  assert.equal(anon.plan, 'free', 'un token falso no da Plus');
  assert.equal((await plus.startReward(req(), 'ip', 'photo')).status, 401, 'fotos extra requieren cuenta');
  const mem = createMonetization({ env: ENV, fetchImpl: fakeSupabase() });
  assert.equal((await mem.startReward(req(TOKEN), 'ip', 'photo')).status, 503, 'sin almacenamiento en la base no se dan fotos extra');
});

test('monetización: Google Play — estados de suscripción y verificación en el servidor', async () => {
  const m = createMonetization({ env: ENV, fetchImpl: fakeSupabase() });
  const future = new Date(Date.now() + 86400000).toISOString(), past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(m.membershipFromPlay({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'p', expiryTime: future }] }).status, 'active');
  assert.equal(m.membershipFromPlay({ subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', lineItems: [{ productId: 'p', expiryTime: future }] }).status, 'active');
  assert.equal(m.membershipFromPlay({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'p', expiryTime: past }] }).status, 'inactive', 'vencida');
  assert.equal(m.membershipFromPlay({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', lineItems: [{ productId: 'p', expiryTime: past }] }).status, 'cancelled');
  assert.equal(m.membershipFromPlay({ subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD', lineItems: [] }).status, 'past_due');
  assert.equal((await m.verifyPlayPurchase(req(TOKEN), { purchaseToken: 'abcdefghijkl', productId: 'x' })).status, 503, 'sin configuración no se verifica ni se activa nada');
  // Con configuración: firma JWT real con una clave de prueba y respuestas simuladas de Google.
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: 'svc@demo.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = String(url); calls.push(u);
    if (u === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'g-token', expires_in: 3600 }));
    if (u.includes('/purchases/subscriptionsv2/tokens/')) return new Response(JSON.stringify({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', lineItems: [{ productId: 'fittforma_plus_monthly', expiryTime: future }] }));
    if (u.includes(':acknowledge')) return new Response('{}');
    if (u.includes('/rest/v1/rpc/monetization_user_for_purchase')) return new Response('null');
    if (u.includes('/rest/v1/rpc/monetization_set_membership')) return new Response('true');
    return fakeSupabase()(url, init);
  };
  const m2 = createMonetization({ env: { ...ENV, SUPABASE_SERVICE_ROLE_KEY: 'service', GOOGLE_PLAY_PACKAGE_NAME: 'ai.fittforma.app', GOOGLE_PLAY_PLUS_PRODUCT_IDS: 'fittforma_plus_monthly', GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: sa }, fetchImpl });
  assert.equal((await m2.verifyPlayPurchase(req(), { purchaseToken: 'abcdefghijkl', productId: 'fittforma_plus_monthly' })).status, 401);
  assert.equal((await m2.verifyPlayPurchase(req(TOKEN), { purchaseToken: 'abcdefghijkl', productId: 'otro_producto' })).status, 400);
  const ok = await m2.verifyPlayPurchase(req(TOKEN), { purchaseToken: 'abcdefghijkl', productId: 'fittforma_plus_monthly' });
  assert.equal(ok.status, 200); assert.equal(ok.body.plan, 'plus');
  assert.ok(calls.some(u => u.includes(':acknowledge')), 'la compra se reconoce para que Google no la reembolse');
  assert.ok(calls.some(u => u.includes('monetization_set_membership')), 'Plus se guarda con la clave de servicio');
  assert.equal((await m2.playNotification('token-incorrecto', {})).status, 403, 'las notificaciones requieren el token configurado');
});

test('monetización: la app usa el servidor y no concede Plus ni recompensas en el navegador', async () => {
  const ads = await readFile(path.join(root, 'ads.js'), 'utf8'), html = await readFile(path.join(root, 'index.html'), 'utf8'), server = await readFile(path.join(root, 'backend/server.mjs'), 'utf8');
  assert.match(ads, /api\('\/api\/rewards\/start'/); assert.match(ads, /api\('\/api\/rewards\/claim'/);
  assert.match(ads, /const isPlus = \(\) => ent\?\.plan === 'plus' && ent\?\.planVerified === true;/);
  assert.doesNotMatch(ads, /localStorage/, 'ni cuotas ni recompensas en el almacenamiento local');
  assert.match(ads, /Anuncio de prueba/); assert.match(ads, /no genera ingresos/);
  assert.match(html, /data\.code==='ai_quota'/); assert.match(html, /\$\('coachInput'\)\.value=msg/, 'el mensaje vuelve al cuadro de texto');
  assert.match(html, /pendingAdBreak='workout-saved'/); assert.match(html, /pendingAdBreak='run-saved'/);
  assert.match(html, /window\.FittFormaActivities=/);
  assert.match(server, /monetization\.consumeAi/); assert.match(server, /aiQuota\.refund/);
  const sql = await readFile(path.join(root, 'supabase/migrations/2026-10-21_v48_monetization.sql'), 'utf8');
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdelete\s+from\b|\btruncate\b|disable row level security/i);
  assert.match(sql, /photo_limit_enabled boolean not null default false/);
  assert.ok(new MemoryStore());
});
