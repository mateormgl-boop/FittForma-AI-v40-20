/* FittForma AI v48 — reglas de monetización sin dependencias (navegador, backend y pruebas).
 * Un solo lugar para los límites y la política de anuncios. El backend usa los mismos valores por
 * defecto y los puede cambiar por variables de entorno; el navegador solo los lee del servidor.
 * Ninguna regla de este archivo concede Plus ni recompensas: eso lo decide el servidor.
 */
(function (root) {
  'use strict';

  const DEFAULTS = Object.freeze({
    // Interruptor general: con false todo funciona como antes (sin límites nuevos ni anuncios).
    enabled: false,
    ai: { freePerDay: 6, plusPerDay: 40, creditsPerRewardedVideo: 3, maxRewardedVideosPerDay: 3 },
    photos: { freePerDay: 2, plusPerDay: 10, maxExtraPerDay: 3 },
    ads: { interstitialMinMinutes: 7, sectionChangesBetweenInterstitials: 4, minRewardWatchSeconds: 10, rewardNonceTtlSeconds: 600 }
  });

  const clamp = (n, lo, hi, d) => { const v = Number(n); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  // Normaliza un objeto de configuración parcial (por ejemplo, desde variables de entorno).
  function normalizeConfig(input = {}) {
    const i = input || {};
    return {
      enabled: Boolean(i.enabled),
      ai: {
        freePerDay: Math.round(clamp(i.ai?.freePerDay, 1, 200, DEFAULTS.ai.freePerDay)),
        plusPerDay: Math.round(clamp(i.ai?.plusPerDay, 1, 1000, DEFAULTS.ai.plusPerDay)),
        creditsPerRewardedVideo: Math.round(clamp(i.ai?.creditsPerRewardedVideo, 1, 10, DEFAULTS.ai.creditsPerRewardedVideo)),
        maxRewardedVideosPerDay: Math.round(clamp(i.ai?.maxRewardedVideosPerDay, 0, 20, DEFAULTS.ai.maxRewardedVideosPerDay))
      },
      photos: {
        freePerDay: Math.round(clamp(i.photos?.freePerDay, 0, 50, DEFAULTS.photos.freePerDay)),
        plusPerDay: Math.round(clamp(i.photos?.plusPerDay, 0, 200, DEFAULTS.photos.plusPerDay)),
        maxExtraPerDay: Math.round(clamp(i.photos?.maxExtraPerDay, 0, 20, DEFAULTS.photos.maxExtraPerDay))
      },
      ads: {
        // El intervalo se acota a 5–10 minutos de uso activo, como pide la política de producto.
        interstitialMinMinutes: clamp(i.ads?.interstitialMinMinutes, 5, 10, DEFAULTS.ads.interstitialMinMinutes),
        sectionChangesBetweenInterstitials: Math.round(clamp(i.ads?.sectionChangesBetweenInterstitials, 2, 20, DEFAULTS.ads.sectionChangesBetweenInterstitials)),
        minRewardWatchSeconds: Math.round(clamp(i.ads?.minRewardWatchSeconds, 5, 60, DEFAULTS.ads.minRewardWatchSeconds)),
        rewardNonceTtlSeconds: Math.round(clamp(i.ads?.rewardNonceTtlSeconds, 60, 3600, DEFAULTS.ads.rewardNonceTtlSeconds))
      }
    };
  }

  // Momentos donde un anuncio de pantalla completa NUNCA se muestra.
  const BLOCKING_ACTIVITIES = ['workout', 'rest-timer', 'gps-running', 'meal-logging', 'ai-chat', 'login', 'payment', 'photo-upload', 'saving', 'ad-open', 'ad-loading', 'dialog-open'];
  // Pausas naturales donde se puede evaluar un intersticial (siempre después de guardar).
  const NATURAL_BREAKS = ['workout-saved', 'run-saved', 'activity-saved', 'returned-to-menu', 'section-change', 'badge-earned'];

  /**
   * ¿Se puede pedir un intersticial ahora? Devuelve { allowed, reason }.
   * ctx: { config, plan:'free'|'plus', adsAvailable, event, activities:[], activeMsSinceLast, sectionChangesSinceLast, shownBefore }
   */
  function interstitialDecision(ctx = {}) {
    const cfg = ctx.config || normalizeConfig(DEFAULTS);
    if (!cfg.enabled) return { allowed: false, reason: 'disabled' };
    if (ctx.plan === 'plus') return { allowed: false, reason: 'plus' };
    if (!ctx.adsAvailable) return { allowed: false, reason: 'no-provider' };
    if (!NATURAL_BREAKS.includes(ctx.event)) return { allowed: false, reason: 'not-a-break' };
    const busy = (ctx.activities || []).find(a => BLOCKING_ACTIVITIES.includes(a));
    if (busy) return { allowed: false, reason: 'busy:' + busy };
    const minMs = cfg.ads.interstitialMinMinutes * 60000;
    if (ctx.shownBefore && (Number(ctx.activeMsSinceLast) || 0) < minMs) return { allowed: false, reason: 'interval' };
    if (!ctx.shownBefore && (Number(ctx.activeMsSinceLast) || 0) < minMs) return { allowed: false, reason: 'warmup' };
    if (ctx.event === 'section-change' && (Number(ctx.sectionChangesSinceLast) || 0) < cfg.ads.sectionChangesBetweenInterstitials) return { allowed: false, reason: 'not-enough-navigation' };
    return { allowed: true, reason: 'ok' };
  }

  // Resumen de cuota de IA (lo calcula el servidor; el navegador solo lo muestra).
  function aiQuota({ config, plan, used = 0, bonus = 0, rewardedVideos = 0 }) {
    const cfg = config || normalizeConfig(DEFAULTS);
    const limit = plan === 'plus' ? cfg.ai.plusPerDay : cfg.ai.freePerDay;
    const remaining = Math.max(0, limit + Math.max(0, bonus) - Math.max(0, used));
    const videosLeft = plan === 'plus' ? 0 : Math.max(0, cfg.ai.maxRewardedVideosPerDay - Math.max(0, rewardedVideos));
    return { limit, used, bonus, remaining, videosLeft, canOfferVideo: plan !== 'plus' && remaining === 0 && videosLeft > 0 };
  }
  // Fotos: las primeras N gratis por día; después, una por video completado hasta el máximo diario.
  function photoQuota({ config, plan, posted = 0, extra = 0 }) {
    const cfg = config || normalizeConfig(DEFAULTS);
    const free = plan === 'plus' ? cfg.photos.plusPerDay : cfg.photos.freePerDay;
    const allowed = free + (plan === 'plus' ? 0 : Math.min(Math.max(0, extra), cfg.photos.maxExtraPerDay));
    const remaining = Math.max(0, allowed - Math.max(0, posted));
    const extraLeft = plan === 'plus' ? 0 : Math.max(0, cfg.photos.maxExtraPerDay - Math.max(0, extra));
    return { free, extra, posted, allowed, remaining, needsReward: remaining === 0 && extraLeft > 0, extraLeft };
  }
  // Día local del usuario a partir del desplazamiento horario informado (acotado a ±14 h).
  function localDay(nowMs, tzOffsetMinutes) {
    const off = clamp(tzOffsetMinutes, -840, 840, 0);
    const d = new Date(Number(nowMs) + off * 60000);
    return d.toISOString().slice(0, 10);
  }

  const api = { DEFAULTS, normalizeConfig, BLOCKING_ACTIVITIES, NATURAL_BREAKS, interstitialDecision, aiQuota, photoQuota, localDay };
  root.FittFormaMonetization = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
