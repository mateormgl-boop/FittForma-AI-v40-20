// FittForma AI v48 — monetización del lado del servidor (sin dependencias).
// Decide quién es Plus, cuántas consultas de IA y fotos quedan, emite y canjea recompensas de un solo uso
// y verifica compras de Google Play. El navegador nunca concede nada por sí mismo.
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
// monetization-core.js es un script de navegador sin exportaciones: se evalúa y se lee de globalThis.
function loadCore() {
  if (!globalThis.FittFormaMonetization) {
    const src = require('node:fs').readFileSync(path.join(here, '..', 'monetization-core.js'), 'utf8');
    new Function(src)();
  }
  return globalThis.FittFormaMonetization;
}
const M = loadCore();

const bool = v => ['1', 'true', 'yes', 'on'].includes(String(v || '').trim().toLowerCase());
const num = v => (v === undefined || v === null || String(v).trim() === '' ? undefined : Number(v));
const SLOT_PATH = /^\/\d{2,20}(\/[A-Za-z0-9_.\-]{1,100}){1,6}$/;

export function monetizationConfigFromEnv(env = process.env) {
  const config = M.normalizeConfig({
    enabled: bool(env.MONETIZATION_ENABLED),
    ai: { freePerDay: num(env.AI_FREE_PER_DAY), plusPerDay: num(env.AI_PLUS_PER_DAY), creditsPerRewardedVideo: num(env.AI_CREDITS_PER_VIDEO), maxRewardedVideosPerDay: num(env.AI_MAX_VIDEOS_PER_DAY) },
    photos: { freePerDay: num(env.PHOTOS_FREE_PER_DAY), plusPerDay: num(env.PHOTOS_PLUS_PER_DAY), maxExtraPerDay: num(env.PHOTOS_MAX_EXTRA_PER_DAY) },
    ads: { interstitialMinMinutes: num(env.ADS_INTERSTITIAL_MIN_MINUTES), sectionChangesBetweenInterstitials: num(env.ADS_SECTION_CHANGES), minRewardWatchSeconds: num(env.ADS_MIN_REWARD_SECONDS) }
  });
  // Anuncios: solo identificadores públicos de Google Ad Manager. Un identificador con formato inválido se ignora.
  const provider = ['gam', 'test'].includes(String(env.ADS_PROVIDER || '').trim()) ? String(env.ADS_PROVIDER).trim() : 'none';
  const networkCode = /^\d{2,20}$/.test(String(env.GAM_NETWORK_CODE || '').trim()) ? String(env.GAM_NETWORK_CODE).trim() : '';
  const slot = k => (SLOT_PATH.test(String(env[k] || '').trim()) ? String(env[k]).trim() : '');
  const ads = {
    provider: provider === 'gam' && !networkCode ? 'none' : provider,
    // El proveedor de prueba solo existe si se habilita explícitamente; nunca genera ingresos.
    testMode: provider === 'test' ? bool(env.ADS_ALLOW_TEST) : false,
    networkCode,
    slots: { home: slot('GAM_SLOT_HOME'), community: slot('GAM_SLOT_COMMUNITY'), explore: slot('GAM_SLOT_EXPLORE'), rewarded: slot('GAM_SLOT_REWARDED'), interstitial: slot('GAM_SLOT_INTERSTITIAL') },
    consent: String(env.ADS_CONSENT || 'google-cmp').trim() === 'none' ? 'none' : 'google-cmp'
  };
  if (ads.provider === 'test' && !ads.testMode) ads.provider = 'none';
  const play = {
    packageName: /^[a-zA-Z][\w.]{2,150}$/.test(String(env.GOOGLE_PLAY_PACKAGE_NAME || '').trim()) ? String(env.GOOGLE_PLAY_PACKAGE_NAME).trim() : '',
    productIds: String(env.GOOGLE_PLAY_PLUS_PRODUCT_IDS || '').split(',').map(s => s.trim()).filter(s => /^[a-z0-9._]{1,100}$/.test(s)),
    serviceAccount: String(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '').trim(),
    rtdnToken: String(env.GOOGLE_PLAY_RTDN_TOKEN || '').trim()
  };
  return { config, ads, play, metricsToken: String(env.ADMIN_METRICS_TOKEN || '').trim() };
}

// Los anuncios solo agregan dominios a la CSP cuando hay un proveedor real configurado.
export function adsCspAdditions(ads) {
  if (!ads || ads.provider !== 'gam') return { script: [], frame: [], connect: [], img: [] };
  const g = ['https://securepubads.g.doubleclick.net', 'https://pagead2.googlesyndication.com', 'https://tpc.googlesyndication.com', 'https://www.googletagservices.com'];
  const cmp = ads.consent === 'google-cmp' ? ['https://fundingchoicesmessages.google.com'] : [];
  return { script: [...g, ...cmp], frame: ['https://securepubads.g.doubleclick.net', 'https://tpc.googlesyndication.com', 'https://googleads.g.doubleclick.net', ...cmp], connect: ['https://securepubads.g.doubleclick.net', 'https://pagead2.googlesyndication.com', ...cmp], img: [] };
}

// ---------- Almacenamiento de contadores ----------
// En memoria (se reinicia con el servidor) o en Supabase con la clave de servicio, solo en el servidor.
export class MemoryStore {
  constructor() { this.counts = new Map(); this.nonces = new Map(); this.kind = 'memory'; }
  _k(subject, day, kind) { return `${subject}|${day}|${kind}`; }
  async get(subject, day, kind) { return this.counts.get(this._k(subject, day, kind)) || 0; }
  async bump(subject, day, kind, delta, cap) {
    const k = this._k(subject, day, kind), cur = this.counts.get(k) || 0, next = cur + delta;
    if (cap !== undefined && cap !== null && next > cap) return -1;
    if (next < 0) return -1;
    this.counts.set(k, next); if (this.counts.size > 200000) this.counts.delete(this.counts.keys().next().value);
    return next;
  }
  async startReward(r) { this.nonces.set(r.nonce, { ...r, claimedAt: null }); if (this.nonces.size > 50000) this.nonces.delete(this.nonces.keys().next().value); return true; }
  async getReward(nonce) { return this.nonces.get(nonce) || null; }
  async claimReward(nonce, claimedAt) { const r = this.nonces.get(nonce); if (!r || r.claimedAt) return false; r.claimedAt = claimedAt; return true; }
}
export class SupabaseStore {
  constructor({ url, serviceKey, fetchImpl }) { this.url = url.replace(/\/$/, ''); this.key = serviceKey; this.fetch = fetchImpl; this.kind = 'supabase'; }
  async _rpc(name, args) {
    const r = await this.fetch(`${this.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(`supabase_rpc_${name}_${r.status}`);
    return r.json();
  }
  async get(subject, day, kind) { return Number(await this._rpc('monetization_get', { p_subject: subject, p_day: day, p_kind: kind })) || 0; }
  async bump(subject, day, kind, delta, cap) { return Number(await this._rpc('monetization_bump', { p_subject: subject, p_day: day, p_kind: kind, p_delta: delta, p_cap: cap ?? null })); }
  async startReward(r) { return Boolean(await this._rpc('monetization_reward_start', { p_nonce: r.nonce, p_subject: r.subject, p_day: r.day, p_kind: r.type, p_started_at: new Date(r.startedAt).toISOString() })); }
  async getReward(nonce) { const rows = await this._rpc('monetization_reward_get', { p_nonce: nonce }); const x = Array.isArray(rows) ? rows[0] : rows; return x && x.nonce ? { nonce: x.nonce, subject: x.subject, day: x.day, type: x.kind, startedAt: Date.parse(x.started_at), claimedAt: x.claimed_at } : null; }
  async claimReward(nonce, claimedAt) { return Boolean(await this._rpc('monetization_reward_claim', { p_nonce: nonce, p_claimed_at: new Date(claimedAt).toISOString() })); }
  async setMembership(m) { return this._rpc('monetization_set_membership', { p_user_id: m.userId, p_status: m.status, p_period_end: m.periodEnd, p_source: m.source, p_purchase_token: m.purchaseToken || null, p_product_id: m.productId || null }); }
  async userForPurchase(token) { const r = await this._rpc('monetization_user_for_purchase', { p_purchase_token: token }); return typeof r === 'string' ? r : null; }
}

const METRIC_NAMES = new Set(['ad_impression_banner', 'ad_impression_interstitial', 'ad_impression_rewarded', 'ad_no_fill', 'ad_error', 'rewarded_completed', 'rewarded_closed_early', 'reward_granted_ai', 'reward_granted_photo', 'ai_bonus_used', 'photo_after_reward', 'plus_purchase_verified', 'app_open']);

export function createMonetization({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), supabase = null } = {}) {
  const settings = monetizationConfigFromEnv(env);
  const { config } = settings;
  const sb = supabase || { url: String(env.SUPABASE_URL || '').trim().replace(/\/$/, ''), anonKey: String(env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || '').trim() };
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const store = serviceKey && sb.url ? new SupabaseStore({ url: sb.url, serviceKey, fetchImpl }) : new MemoryStore();
  const metrics = new Map();
  const userCache = new Map(), planCache = new Map();

  async function resolveUser(req) {
    const auth = String(req.headers.authorization || '');
    const m = /^Bearer ([A-Za-z0-9_\-.]{20,4096})$/.exec(auth);
    if (!m || !sb.url || !sb.anonKey) return null;
    const token = m[1], cached = userCache.get(token);
    if (cached && cached.exp > now()) return cached.user;
    try {
      const r = await fetchImpl(`${sb.url}/auth/v1/user`, { headers: { apikey: sb.anonKey, Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || typeof j.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(j.id)) return null;
      const user = { id: j.id, token };
      userCache.set(token, { user, exp: now() + 5 * 60000 }); if (userCache.size > 5000) userCache.delete(userCache.keys().next().value);
      return user;
    } catch { return null; }
  }
  // Plus = fila activa y vigente en community_memberships (la escribe solo un proceso verificado de pagos).
  async function planFor(user) {
    if (!user || !sb.url) return { plan: 'free', verified: false, source: null, periodEnd: null };
    const cached = planCache.get(user.id);
    if (cached && cached.exp > now()) return cached.value;
    let value = { plan: 'free', verified: true, source: null, periodEnd: null };
    try {
      const r = await fetchImpl(`${sb.url}/rest/v1/community_memberships?select=tier,status,current_period_end&user_id=eq.${user.id}`, { headers: { apikey: sb.anonKey, Authorization: `Bearer ${user.token}` } });
      if (!r.ok) value = { plan: 'free', verified: false, source: null, periodEnd: null, error: 'membership_unavailable' };
      else {
        const rows = await r.json(), row = Array.isArray(rows) ? rows[0] : null;
        const active = row && ['pro', 'plus'].includes(row.tier) && row.status === 'active' && (!row.current_period_end || Date.parse(row.current_period_end) > now());
        if (active) value = { plan: 'plus', verified: true, source: 'membership', periodEnd: row.current_period_end || null };
      }
    } catch { value = { plan: 'free', verified: false, source: null, periodEnd: null, error: 'membership_unavailable' }; }
    planCache.set(user.id, { value, exp: now() + 2 * 60000 });
    return value;
  }
  // Fotos publicadas hoy: las cuenta la base (las publicaciones van directo del navegador a Supabase).
  // Límites de fotos: la fuente de verdad es monetization_settings (la misma tabla que usa el trigger de la base),
  // así la app nunca ofrece un video que la base después no aceptaría. Sin Supabase se usan las variables de entorno.
  let photoSettingsCache = null;
  async function photoConfig() {
    if (store.kind !== 'supabase') return { limitEnabled: false, config };
    if (photoSettingsCache && photoSettingsCache.exp > now()) return photoSettingsCache.value;
    let value;
    try {
      const r = await fetchImpl(`${store.url}/rest/v1/monetization_settings?select=photo_limit_enabled,photos_free_per_day,photos_plus_per_day,photos_max_extra_per_day`, { headers: { apikey: store.key, Authorization: `Bearer ${store.key}` } });
      const row = r.ok ? (await r.json())[0] : null;
      if (!row) throw new Error('no_settings');
      value = { limitEnabled: row.photo_limit_enabled === true, config: { ...config, photos: M.normalizeConfig({ photos: { freePerDay: row.photos_free_per_day, plusPerDay: row.photos_plus_per_day, maxExtraPerDay: row.photos_max_extra_per_day } }).photos } };
    } catch { value = { limitEnabled: false, config, unavailable: true }; }
    photoSettingsCache = { value, exp: now() + 60000 };
    return value;
  }
  async function photoPosted(userId, day) { return store.kind === 'supabase' ? Number(await store._rpc('monetization_photo_posts', { p_user_id: userId, p_day: day })) || 0 : 0; }
  function subjectFor(user, clientKey) { return user ? `u:${user.id}` : `ip:${crypto.createHash('sha256').update(String(clientKey)).digest('hex').slice(0, 24)}`; }
  // Todos los límites diarios usan la misma zona horaria que la base (APP_TIMEZONE), no la del teléfono.
  const TZ = /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(String(env.APP_TIMEZONE || '')) ? String(env.APP_TIMEZONE) : 'America/Montevideo';
  function dayFor() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now())); } catch { return new Date(now()).toISOString().slice(0, 10); } }

  async function entitlements(req, clientKey) {
    const user = await resolveUser(req), plan = await planFor(user), subject = subjectFor(user, clientKey), day = dayFor(req);
    const [aiUsed, aiBonus, aiVideos, photosPosted, photoExtra] = await Promise.all([
      store.get(subject, day, 'ai_used'), store.get(subject, day, 'ai_bonus'), store.get(subject, day, 'ai_videos'),
      user ? photoPosted(user.id, day) : 0, user ? store.get(`u:${user.id}`, day, 'photo_extra') : 0
    ]);
    const ai = M.aiQuota({ config, plan: plan.plan, used: aiUsed, bonus: aiBonus, rewardedVideos: aiVideos });
    const pc = await photoConfig();
    const photos = { ...M.photoQuota({ config: pc.config, plan: plan.plan, posted: photosPosted, extra: photoExtra }), limitEnabled: pc.limitEnabled };
    if (!pc.limitEnabled) { photos.needsReward = false; photos.extraLeft = 0; }
    const adsOn = config.enabled && plan.plan !== 'plus' && settings.ads.provider !== 'none';
    return {
      enabled: config.enabled, day, signedIn: Boolean(user), plan: plan.plan, planVerified: plan.verified, planSource: plan.source, planPeriodEnd: plan.periodEnd,
      ai, photos, store: store.kind,
      timezone: TZ,
      ads: { show: adsOn, provider: adsOn ? settings.ads.provider : 'none', testMode: settings.ads.testMode, interstitialMinMinutes: config.ads.interstitialMinMinutes, sectionChangesBetweenInterstitials: config.ads.sectionChangesBetweenInterstitials, rewardedAvailable: adsOn && (settings.ads.provider === 'test' || Boolean(settings.ads.slots.rewarded)) },
      payments: { googlePlay: Boolean(settings.play.packageName && settings.play.productIds.length && settings.play.serviceAccount && serviceKey), web: false }
    };
  }
  function publicAdsConfig() {
    const a = settings.ads;
    return { provider: config.enabled ? a.provider : 'none', testMode: a.testMode, networkCode: a.networkCode, slots: a.slots, consent: a.consent };
  }

  // Consume una consulta de IA antes de llamar al modelo; si el modelo falla, se devuelve (refund).
  async function consumeAi(req, clientKey) {
    if (!config.enabled) return { ok: true, skipped: true };
    const user = await resolveUser(req), plan = await planFor(user), subject = subjectFor(user, clientKey), day = dayFor(req);
    const bonus = await store.get(subject, day, 'ai_bonus');
    const limit = (plan.plan === 'plus' ? config.ai.plusPerDay : config.ai.freePerDay) + bonus;
    const used = await store.bump(subject, day, 'ai_used', 1, limit);
    if (used < 0) {
      const q = M.aiQuota({ config, plan: plan.plan, used: limit, bonus, rewardedVideos: await store.get(subject, day, 'ai_videos') });
      return { ok: false, quota: q, plan: plan.plan };
    }
    if (used > (plan.plan === 'plus' ? config.ai.plusPerDay : config.ai.freePerDay)) metric('ai_bonus_used');
    return { ok: true, refund: () => store.bump(subject, day, 'ai_used', -1) };
  }

  // Recompensas: el servidor emite un nonce antes del video y lo canjea una sola vez.
  async function startReward(req, clientKey, type) {
    if (!config.enabled) return { status: 409, body: { error: 'La monetización no está activa.' } };
    if (!['ai', 'photo'].includes(type)) return { status: 400, body: { error: 'Tipo de recompensa inválido.' } };
    const user = await resolveUser(req), plan = await planFor(user);
    if (plan.plan === 'plus') return { status: 409, body: { error: 'Con Plus no hace falta mirar anuncios.' } };
    if (type === 'photo' && !user) return { status: 401, body: { error: 'Iniciá sesión para publicar fotos.' } };
    if (type === 'photo' && store.kind !== 'supabase') return { status: 503, body: { error: 'Las fotos extra necesitan que el servidor registre la recompensa en la base (SUPABASE_SERVICE_ROLE_KEY).' } };
    const subject = subjectFor(user, clientKey), day = dayFor(req);
    if (type === 'ai') {
      const q = M.aiQuota({ config, plan: plan.plan, used: await store.get(subject, day, 'ai_used'), bonus: await store.get(subject, day, 'ai_bonus'), rewardedVideos: await store.get(subject, day, 'ai_videos') });
      if (q.remaining > 0) return { status: 409, body: { error: 'Todavía tenés consultas disponibles hoy.' } };
      if (q.videosLeft <= 0) return { status: 429, body: { error: 'Llegaste al máximo de videos por hoy. Las consultas se renuevan mañana.' } };
    } else {
      const pc = await photoConfig();
      if (!pc.limitEnabled) return { status: 409, body: { error: 'El límite diario de fotos no está activo: podés publicar sin anuncios.' } };
      const q = M.photoQuota({ config: pc.config, plan: plan.plan, posted: await photoPosted(user.id, day), extra: await store.get(subject, day, 'photo_extra') });
      if (q.remaining > 0) return { status: 409, body: { error: 'Todavía podés publicar fotos hoy sin anuncios.' } };
      if (q.extraLeft <= 0) return { status: 429, body: { error: 'Llegaste al máximo de fotos extra por hoy.' } };
    }
    const nonce = crypto.randomBytes(18).toString('base64url');
    await store.startReward({ nonce, subject, day, type, startedAt: now() });
    return { status: 200, body: { nonce, expiresInSeconds: config.ads.rewardNonceTtlSeconds, minWatchSeconds: config.ads.minRewardWatchSeconds } };
  }
  async function claimReward(req, clientKey, nonce) {
    if (!config.enabled) return { status: 409, body: { error: 'La monetización no está activa.' } };
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{20,40}$/.test(nonce)) return { status: 400, body: { error: 'Comprobante inválido.' } };
    const user = await resolveUser(req), subject = subjectFor(user, clientKey), r = await store.getReward(nonce);
    if (!r || r.subject !== subject) return { status: 404, body: { error: 'No se encontró esa recompensa.' } };
    if (r.claimedAt) return { status: 409, body: { error: 'Esta recompensa ya se otorgó.', duplicate: true } };
    const elapsed = (now() - r.startedAt) / 1000;
    if (elapsed > config.ads.rewardNonceTtlSeconds) return { status: 410, body: { error: 'El comprobante venció. Volvé a intentarlo.' } };
    if (elapsed < config.ads.minRewardWatchSeconds) return { status: 409, body: { error: 'El anuncio no se completó.' } };
    if (!(await store.claimReward(nonce, now()))) return { status: 409, body: { error: 'Esta recompensa ya se otorgó.', duplicate: true } };
    if (r.type === 'ai') {
      const videos = await store.bump(subject, r.day, 'ai_videos', 1, config.ai.maxRewardedVideosPerDay);
      if (videos < 0) return { status: 429, body: { error: 'Llegaste al máximo de videos por hoy.' } };
      await store.bump(subject, r.day, 'ai_bonus', config.ai.creditsPerRewardedVideo);
      metric('reward_granted_ai');
      return { status: 200, body: { granted: true, type: 'ai', credits: config.ai.creditsPerRewardedVideo } };
    }
    const extra = await store.bump(subject, r.day, 'photo_extra', 1, (await photoConfig()).config.photos.maxExtraPerDay);
    if (extra < 0) return { status: 429, body: { error: 'Llegaste al máximo de fotos extra por hoy.' } };
    metric('reward_granted_photo');
    return { status: 200, body: { granted: true, type: 'photo', photos: 1 } };
  }

  // ---------- Métricas agregadas (sin datos personales) ----------
  function metric(name, n = 1) {
    if (!METRIC_NAMES.has(name)) return false;
    const day = new Date(now()).toISOString().slice(0, 10), key = `${day}|${name}`;
    metrics.set(key, (metrics.get(key) || 0) + n);
    if (store.kind === 'supabase') store.bump('metrics', day, name, n).catch(() => {});
    return true;
  }
  function metricsSummary(token) {
    if (!settings.metricsToken || token !== settings.metricsToken) return null;
    const out = {};
    for (const [k, v] of metrics) { const [day, name] = k.split('|'); (out[day] ||= {})[name] = v; }
    return { note: 'Impresiones solo cuando el proveedor confirma el anuncio renderizado. Ingresos: consultá el informe de Google Ad Manager.', store: store.kind, days: out };
  }

  // ---------- Google Play Billing (TWA con Digital Goods API) ----------
  let playToken = null;
  async function googleAccessToken() {
    if (playToken && playToken.exp > now() + 60000) return playToken.token;
    const sa = JSON.parse(settings.play.serviceAccount);
    const head = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const iat = Math.floor(now() / 1000);
    const claims = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })).toString('base64url');
    const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claims}`), sa.private_key).toString('base64url');
    const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` }).toString() });
    if (!r.ok) throw new Error('google_oauth_' + r.status);
    const j = await r.json(); playToken = { token: j.access_token, exp: now() + (Number(j.expires_in) || 3600) * 1000 };
    return playToken.token;
  }
  // Estado según subscriptionsv2: ACTIVE y IN_GRACE_PERIOD dan acceso; el resto, no.
  function membershipFromPlay(sub) {
    const active = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(sub?.subscriptionState);
    const expiries = (sub?.lineItems || []).map(li => Date.parse(li.expiryTime)).filter(Number.isFinite);
    const periodEnd = expiries.length ? new Date(Math.max(...expiries)).toISOString() : null;
    const status = active && (!periodEnd || Date.parse(periodEnd) > now()) ? 'active' : sub?.subscriptionState === 'SUBSCRIPTION_STATE_ON_HOLD' ? 'past_due' : sub?.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED' ? 'cancelled' : 'inactive';
    return { status, periodEnd, productIds: (sub?.lineItems || []).map(li => li.productId), acknowledged: sub?.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' };
  }
  async function verifyPlayPurchase(req, body) {
    const p = settings.play;
    if (!(p.packageName && p.productIds.length && p.serviceAccount && store.kind === 'supabase')) return { status: 503, body: { error: 'Los pagos con Google Play todavía no están configurados en el servidor.' } };
    const user = await resolveUser(req);
    if (!user) return { status: 401, body: { error: 'Iniciá sesión para asociar la suscripción a tu cuenta.' } };
    const token = String(body?.purchaseToken || ''), productId = String(body?.productId || '');
    if (!/^[A-Za-z0-9._\-:]{10,600}$/.test(token) || !p.productIds.includes(productId)) return { status: 400, body: { error: 'Compra inválida.' } };
    const owner = await store.userForPurchase(token);
    if (owner && owner !== user.id) return { status: 409, body: { error: 'Esta compra ya está asociada a otra cuenta.' } };
    let sub;
    try {
      const access = await googleAccessToken();
      const r = await fetchImpl(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(p.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${access}` } });
      if (!r.ok) return { status: 502, body: { error: 'Google Play no confirmó la compra. No se activó Plus.' } };
      sub = await r.json();
    } catch { return { status: 502, body: { error: 'No se pudo verificar la compra con Google Play. No se activó Plus.' } }; }
    const m = membershipFromPlay(sub);
    if (!m.productIds.some(id => p.productIds.includes(id))) return { status: 400, body: { error: 'El producto no corresponde a FittForma AI Plus.' } };
    await store.setMembership({ userId: user.id, status: m.status, periodEnd: m.periodEnd, source: 'google_play', purchaseToken: token, productId });
    planCache.delete(user.id);
    if (m.status === 'active' && !m.acknowledged) {
      try { const access = await googleAccessToken(); await fetchImpl(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(p.packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: '{}' }); } catch { /* Google reintenta; se reconoce en la próxima verificación */ }
    }
    if (m.status === 'active') metric('plus_purchase_verified');
    return { status: 200, body: { plan: m.status === 'active' ? 'plus' : 'free', status: m.status, periodEnd: m.periodEnd } };
  }
  // Notificaciones en tiempo real (renovación, cancelación, vencimiento) desde Pub/Sub.
  async function playNotification(token, body) {
    const p = settings.play;
    if (!p.rtdnToken || token !== p.rtdnToken) return { status: 403, body: { error: 'No autorizado.' } };
    if (!(p.packageName && p.serviceAccount && store.kind === 'supabase')) return { status: 503, body: { error: 'No configurado.' } };
    let note;
    try { note = JSON.parse(Buffer.from(String(body?.message?.data || ''), 'base64').toString('utf8')); } catch { return { status: 400, body: { error: 'Mensaje inválido.' } }; }
    const purchaseToken = note?.subscriptionNotification?.purchaseToken;
    if (!purchaseToken || note.packageName !== p.packageName) return { status: 200, body: { ignored: true } };
    const userId = await store.userForPurchase(purchaseToken);
    if (!userId) return { status: 200, body: { ignored: true, reason: 'unknown_purchase' } };
    let r;
    try { const access = await googleAccessToken();
    r = await fetchImpl(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(p.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers: { Authorization: `Bearer ${access}` } }); } catch { return { status: 502, body: { error: 'google_error' } }; }
    if (!r.ok) return { status: 502, body: { error: 'google_error' } };
    const m = membershipFromPlay(await r.json());
    await store.setMembership({ userId, status: m.status, periodEnd: m.periodEnd, source: 'google_play', purchaseToken });
    planCache.delete(userId);
    return { status: 200, body: { updated: true, status: m.status } };
  }

  return { settings, store, entitlements, publicAdsConfig, consumeAi, startReward, claimReward, metric, metricsSummary, verifyPlayPurchase, playNotification, membershipFromPlay, resolveUser, planFor };
}
