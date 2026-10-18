/* FittForma AI v48 — publicidad, recompensas y Plus en el navegador.
 * Integración única (no hay otro SDK ni otras unidades). El servidor decide plan, cuotas y recompensas
 * (/api/entitlements, /api/rewards/*); este archivo solo muestra anuncios cuando corresponde.
 * Proveedores: 'none' (sin anuncios), 'gam' (Google Ad Manager / GPT web) y 'test' (solo pruebas,
 * etiquetado «Anuncio de prueba», nunca genera ingresos). Nada se muestra si el servidor no lo habilita.
 */
(() => {
  const M = window.FittFormaMonetization;
  let cfg = { provider: 'none', slots: {}, consent: 'google-cmp' }, ent = null, gptPromise = null, cmpLoaded = false;
  let lastAdAt = 0, activeMsSinceLast = 0, sectionChanges = 0, adOpen = false, lastTick = Date.now(), entLoadedAt = 0;
  const shownBanners = new Set();
  let communitySlot = null;

  async function authHeader() { try { return (await window.FittFormaAuthHeader?.()) || {}; } catch { return {}; } }
  async function api(path, body) {
    const headers = { Accept: 'application/json', ...(await authHeader()) };
    const init = body ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { headers, cache: 'no-store' };
    const r = await fetch(path, init); const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: j };
  }
  function metric(name) { fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), keepalive: true }).catch(() => {}); }
  const t = s => (window.FittFormaI18n?.translate?.(s) || s);
  const toast = m => window.toast?.(m);

  // ---------- Estado del servidor ----------
  async function refresh(force = false) {
    if (!force && ent && Date.now() - entLoadedAt < 60000) return ent;
    try {
      const pc = await fetch('/api/public-config', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
      if (pc?.monetization?.ads) cfg = pc.monetization.ads;
      const r = await api('/api/entitlements');
      if (r.ok) { ent = r.data; entLoadedAt = Date.now(); }
    } catch { /* sin red: sin anuncios ni recompensas, la app sigue igual */ }
    renderPlan(); renderCoachUsage(); syncBanners();
    return ent;
  }
  const adsOn = () => Boolean(ent?.enabled && ent?.ads?.show && ent?.plan !== 'plus' && cfg.provider !== 'none');
  const isPlus = () => ent?.plan === 'plus' && ent?.planVerified === true;

  // ---------- Proveedor: Google Ad Manager (GPT) ----------
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.async = true; s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
  function loadGpt() {
    if (gptPromise) return gptPromise;
    gptPromise = (async () => {
      window.googletag = window.googletag || { cmd: [] };
      await loadScript('https://securepubads.g.doubleclick.net/tag/js/gpt.js');
      await new Promise(r => window.googletag.cmd.push(r));
      const pubads = window.googletag.pubads();
      // Sin CMP confirmada se piden anuncios no personalizados (más respetuoso de la privacidad).
      if (cfg.consent !== 'none' && !cmpLoaded) pubads.setPrivacySettings?.({ nonPersonalizedAds: true });
      pubads.enableLazyLoad?.({ fetchMarginPercent: 50, renderMarginPercent: 20, mobileScaling: 2 });
      pubads.collapseEmptyDivs(true);
      pubads.addEventListener('slotRenderEnded', e => { if (e.slot.__ff === 'banner') metric(e.isEmpty ? 'ad_no_fill' : 'ad_impression_banner'); if (e.isEmpty) e.slot.__el?.closest('.ad-slot')?.classList.remove('is-visible'); });
      window.googletag.enableServices();
      return window.googletag;
    })();
    gptPromise.catch(() => metric('ad_error'));
    return gptPromise;
  }

  // ---------- Banners (Inicio, Comunidad, Explorar) ----------
  // Uno por pantalla, con alto reservado (sin saltos), solo cuando el contenedor se ve.
  const BANNER_PLACES = { home: 'adSlotHome', community: 'adSlotCommunity', explore: 'adSlotExplore' };
  function syncBanners() {
    for (const [place, id] of Object.entries(BANNER_PLACES)) {
      const box = document.getElementById(id); if (!box) continue;
      const allowed = adsOn() && (cfg.provider === 'test' || Boolean(cfg.slots?.[place]));
      box.classList.toggle('is-reserved', allowed);
      if (!allowed) { box.classList.remove('is-visible'); continue; }
      if (shownBanners.has(place)) continue;
      const io = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting) || shownBanners.has(place)) return;
        io.disconnect(); shownBanners.add(place); renderBanner(place, box);
      }, { rootMargin: '120px' });
      io.observe(box);
    }
  }
  async function renderBanner(place, box) {
    const content = box.querySelector('.ad-slot-content'); if (!content) return;
    if (cfg.provider === 'test') {
      if (window.__ffAdsTest === 'nofill') { metric('ad_no_fill'); box.classList.remove('is-reserved'); return; }
      content.innerHTML = `<div class="ad-test-banner">${t('Anuncio de prueba')} · ${place} · ${t('no genera ingresos')}</div>`;
      box.classList.add('is-visible'); return;
    }
    try {
      const gpt = await loadGpt(); const id = content.id || `adContent-${place}`; content.id = id;
      gpt.cmd.push(() => { const slot = gpt.defineSlot(cfg.slots[place], [[320, 100], [320, 50], [300, 250], [728, 90]], id); if (!slot) return; slot.__ff = 'banner'; slot.__el = content; slot.addService(gpt.pubads()); box.classList.add('is-visible'); gpt.display(id); });
    } catch { box.classList.remove('is-reserved', 'is-visible'); }
  }

  // En Comunidad el anuncio va entre publicaciones (después de la tercera), nunca encima de una.
  window.addEventListener('fittforma:feedrendered', () => {
    // Se guarda la referencia: si el feed se vuelve a dibujar, el mismo anuncio se reubica (no se pide otro).
    const slot = (communitySlot ||= document.getElementById('adSlotCommunity')), feed = document.getElementById('communityFeed'); if (!slot || !feed) return;
    const posts = [...feed.children].filter(el => el !== slot);
    if (posts.length >= 3) posts[2].after(slot); else feed.after(slot);
  });

  // ---------- Intersticiales ----------
  // Se cuenta solo el tiempo de uso activo (pestaña visible). Nunca durante entrenamiento, descanso,
  // GPS, comidas, IA, inicio de sesión, pagos, fotos o guardado.
  setInterval(() => { const now = Date.now(); if (document.visibilityState === 'visible' && !adOpen) activeMsSinceLast += now - lastTick; lastTick = now; }, 1000);
  function activities() { try { return (window.FittFormaActivities?.() || []).concat(adOpen ? ['ad-open'] : []); } catch { return ['unknown']; } }
  async function maybeInterstitial(event) {
    if (event === 'section-change') sectionChanges++;
    if (!ent || !adsOn() || !M) return { shown: false, reason: 'off' };
    const config = M.normalizeConfig({ enabled: ent.enabled, ads: { interstitialMinMinutes: ent.ads.interstitialMinMinutes, sectionChangesBetweenInterstitials: ent.ads.sectionChangesBetweenInterstitials } });
    const d = M.interstitialDecision({ config, plan: ent.plan, adsAvailable: cfg.provider === 'test' || Boolean(cfg.slots?.interstitial), event, activities: activities(), activeMsSinceLast, sectionChangesSinceLast: sectionChanges, shownBefore: lastAdAt > 0 });
    if (!d.allowed) return { shown: false, reason: d.reason };
    adOpen = true;
    try {
      const shown = cfg.provider === 'test' ? await testInterstitial() : await gamInterstitial();
      if (shown) { lastAdAt = Date.now(); activeMsSinceLast = 0; sectionChanges = 0; metric('ad_impression_interstitial'); }
      else metric('ad_no_fill');
      return { shown, reason: shown ? 'ok' : 'no-fill' };
    } catch { metric('ad_error'); return { shown: false, reason: 'error' }; }
    finally { adOpen = false; }
  }
  // GPT web: el intersticial lo muestra Google con sus propios disparadores (no se puede forzar desde la app).
  async function gamInterstitial() {
    const gpt = await loadGpt();
    return new Promise(resolve => gpt.cmd.push(() => {
      const slot = gpt.defineOutOfPageSlot(cfg.slots.interstitial, gpt.enums.OutOfPageFormat.INTERSTITIAL);
      if (!slot) { resolve(false); return; }
      slot.addService(gpt.pubads()); gpt.display(slot);
      const done = e => { if (e.slot === slot) { gpt.pubads().removeEventListener('slotRenderEnded', done); resolve(!e.isEmpty); } };
      gpt.pubads().addEventListener('slotRenderEnded', done);
      setTimeout(() => resolve(false), 8000);
    }));
  }
  function overlay(html) {
    const el = document.createElement('div'); el.className = 'ad-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="ad-overlay-panel">${html}</div>`; document.body.appendChild(el); return el;
  }
  function testInterstitial() {
    if (window.__ffAdsTest === 'nofill') return Promise.resolve(false);
    return new Promise(resolve => {
      const el = overlay(`<p class="ad-test-label">${t('Anuncio de prueba')} · ${t('no genera ingresos')}</p><p>${t('Así se vería un anuncio de pantalla completa. Cerralo para seguir.')}</p><button type="button" class="btn" data-ad-close>${t('Cerrar anuncio')}</button>`);
      el.querySelector('[data-ad-close]').onclick = () => { el.remove(); resolve(true); };
    });
  }

  // ---------- Videos recompensados ----------
  // Flujo: explicar → aceptar → comprobante del servidor → video → canje único en el servidor.
  function confirmReward(text) {
    return new Promise(resolve => {
      const el = overlay(`<h3>${t('Mirar un video voluntario')}</h3><p>${text}</p><p class="muted small">${t('Solo se otorga si el video se completa. Si lo cerrás antes o falla, no se suma nada y no perdés lo que estabas haciendo.')}</p><div class="btn-row"><button type="button" class="btn" data-ok>${t('Mirar video')}</button><button type="button" class="btn ghost" data-no>${t('Ahora no')}</button></div>`);
      el.querySelector('[data-ok]').onclick = () => { el.remove(); resolve(true); };
      el.querySelector('[data-no]').onclick = () => { el.remove(); resolve(false); };
      el.querySelector('[data-ok]').focus();
    });
  }
  // Devuelve 'granted' | 'closed' | 'unavailable' | 'error'.
  function playRewarded() {
    if (cfg.provider === 'test') {
      const mode = window.__ffAdsTest || 'fill';
      if (mode === 'nofill') return Promise.resolve('unavailable');
      if (mode === 'error') return Promise.resolve('error');
      return new Promise(resolve => {
        const secs = Math.max(1, Number(window.__ffAdsTestSeconds) || 10);
        const el = overlay(`<p class="ad-test-label">${t('Video de prueba')} · ${t('no genera ingresos')}</p><p class="ad-test-count" aria-live="polite"></p><button type="button" class="btn ghost" data-ad-close>${t('Cerrar')}</button>`);
        let left = secs; const out = el.querySelector('.ad-test-count');
        const tick = () => { out.textContent = left > 0 ? `${t('Termina en')} ${left} s` : t('Video completado'); };
        tick(); const iv = setInterval(() => { left--; tick(); if (left <= 0) { clearInterval(iv); el.remove(); resolve('granted'); } }, 1000);
        el.querySelector('[data-ad-close]').onclick = () => { clearInterval(iv); el.remove(); resolve('closed'); };
      });
    }
    if (!cfg.slots?.rewarded) return Promise.resolve('unavailable');
    return loadGpt().then(gpt => new Promise(resolve => gpt.cmd.push(() => {
      const slot = gpt.defineOutOfPageSlot(cfg.slots.rewarded, gpt.enums.OutOfPageFormat.REWARDED);
      if (!slot) { resolve('unavailable'); return; }
      slot.addService(gpt.pubads()); let granted = false, settled = false;
      const finish = r => { if (settled) return; settled = true; ['rewardedSlotReady', 'rewardedSlotGranted', 'rewardedSlotClosed', 'slotRenderEnded'].forEach(n => gpt.pubads().removeEventListener(n, h[n])); gpt.destroySlots([slot]); resolve(r); };
      const h = {
        rewardedSlotReady: e => { if (e.slot === slot) { metric('ad_impression_rewarded'); e.makeRewardedVisible(); } },
        rewardedSlotGranted: e => { if (e.slot === slot) granted = true; },
        rewardedSlotClosed: e => { if (e.slot === slot) finish(granted ? 'granted' : 'closed'); },
        slotRenderEnded: e => { if (e.slot === slot && e.isEmpty) finish('unavailable'); }
      };
      Object.entries(h).forEach(([n, fn]) => gpt.pubads().addEventListener(n, fn));
      gpt.display(slot);
      setTimeout(() => { if (!granted) finish('unavailable'); }, 20000);
    }))).catch(() => 'error');
  }
  let rewardBusy = false;
  async function earnReward(type) {
    if (rewardBusy) return { ok: false, reason: 'busy' };
    rewardBusy = true; adOpen = true;
    try {
      const start = await api('/api/rewards/start', { type });
      if (!start.ok) return { ok: false, reason: 'server', message: start.data?.error };
      const result = await playRewarded();
      if (result !== 'granted') { metric(result === 'closed' ? 'rewarded_closed_early' : result === 'unavailable' ? 'ad_no_fill' : 'ad_error'); return { ok: false, reason: result }; }
      metric('rewarded_completed');
      const claim = await api('/api/rewards/claim', { nonce: start.data.nonce });
      await refresh(true);
      return claim.ok ? { ok: true, data: claim.data } : { ok: false, reason: claim.data?.duplicate ? 'duplicate' : 'server', message: claim.data?.error };
    } catch { return { ok: false, reason: 'error' }; }
    finally { rewardBusy = false; adOpen = false; }
  }

  // ---------- IA: consultas diarias ----------
  function renderCoachUsage() {
    const text = document.getElementById('coachUsageText'), button = document.getElementById('watchRewardedAd'); if (!text || !button) return;
    if (!ent || !ent.enabled) { text.textContent = t('Sin límites nuevos: la monetización no está activa.'); button.hidden = true; return; }
    const q = ent.ai;
    if (isPlus()) { text.textContent = `${t('Plus')}: ${q.remaining} ${t('consultas disponibles hoy')} (${q.limit} ${t('por día')}).`; button.hidden = true; return; }
    text.textContent = q.remaining > 0 ? `${t('Consultas de IA disponibles hoy')}: ${q.remaining}. ${t('Se renuevan cada día.')}` : q.canOfferVideo && ent.ads.rewardedAvailable ? t('Usaste tus consultas gratuitas de hoy. Podés esperar a que se renueven mañana o mirar un video voluntario para sumar consultas.') : t('Usaste tus consultas de hoy. Se renuevan mañana.');
    button.hidden = !(q.remaining === 0 && q.canOfferVideo && ent.ads.rewardedAvailable);
  }
  async function onWatchForAi() {
    if (!(await confirmReward(t('Al terminar un video corto sumás 3 consultas de IA para hoy. Tu conversación queda guardada.')))) return;
    const r = await earnReward('ai');
    if (r.ok) toast(t('¡Listo! Se sumaron 3 consultas de IA. Tu mensaje sigue en el cuadro de texto.'));
    else toast(r.reason === 'closed' ? t('El video no se completó: no se sumaron consultas.') : r.reason === 'unavailable' ? t('No hay videos disponibles ahora. Podés esperar a mañana; tu conversación queda guardada.') : r.message || t('No se pudo completar. No se sumaron consultas.'));
    renderCoachUsage();
  }
  function showAiQuota(quota) { if (quota && ent) ent.ai = quota; renderCoachUsage(); document.getElementById('coachUsage')?.scrollIntoView({ block: 'nearest' }); }

  // ---------- Comunidad: fotos ----------
  async function earnPhoto() {
    if (!(await confirmReward(t('Al terminar un video corto podés publicar 1 foto más hoy. Tu foto y tu texto quedan en el formulario; después tocás «Publicar».')))) return false;
    const r = await earnReward('photo');
    if (r.ok) { toast(t('Listo: ya podés publicar una foto más. Tocá «Publicar» cuando quieras.')); return true; }
    toast(r.reason === 'closed' ? t('El video no se completó: no se desbloqueó la foto. Tu publicación sigue en el formulario.') : r.reason === 'unavailable' ? t('No hay videos disponibles ahora. Tu publicación sigue en el formulario; podés publicarla mañana.') : r.message || t('No se pudo completar. Tu publicación sigue en el formulario.'));
    return false;
  }

  // ---------- Plus ----------
  function renderPlan() {
    const box = document.getElementById('membershipStatus'); if (!box) return;
    const signed = ent?.signedIn;
    box.innerHTML = !ent ? t('No se pudo consultar el estado del plan.')
      : isPlus() ? `<strong>${t('Tu plan: FittForma AI Plus')}</strong> · ${t('verificado')}${ent.planPeriodEnd ? ` · ${t('vigente hasta')} ${new Date(ent.planPeriodEnd).toLocaleDateString()}` : ''}`
        : `<strong>${t('Tu plan: Gratis')}</strong>${signed ? '' : ` · ${t('iniciá sesión para asociar una suscripción a tu cuenta')}`}`;
    const buy = document.getElementById('plusBuyGooglePlay'); if (buy) buy.hidden = !(ent?.payments?.googlePlay && 'getDigitalGoodsService' in window && signed && !isPlus());
    const restore = document.getElementById('plusRestore'); if (restore) restore.hidden = !(ent?.payments?.googlePlay && 'getDigitalGoodsService' in window && signed);
  }
  // Google Play (app de Android como TWA): Digital Goods API + Payment Request; el servidor verifica.
  async function buyPlusGooglePlay() {
    try {
      const productId = (window.FittFormaMembershipConfig?.googlePlayProductIds || [])[0];
      if (!productId) { toast(t('Falta configurar el producto de Google Play.')); return; }
      const service = await window.getDigitalGoodsService('https://play.google.com/billing');
      const [details] = await service.getDetails([productId]);
      if (!details) { toast(t('Google Play no encontró el producto.')); return; }
      const request = new PaymentRequest([{ supportedMethods: 'https://play.google.com/billing', data: { sku: productId } }], { total: { label: 'FittForma AI Plus', amount: details.price } });
      const response = await request.show();
      const v = await api('/api/billing/play/verify', { purchaseToken: response.details.purchaseToken, productId });
      await response.complete(v.ok ? 'success' : 'fail');
      await refresh(true);
      toast(v.ok && v.data.plan === 'plus' ? t('¡Plus activo! Verificado con Google Play.') : v.data?.error || t('No se pudo verificar la compra. No se activó Plus.'));
    } catch (e) { if (e?.name !== 'AbortError') toast(t('No se completó la compra. No se hizo ningún cobro desde la app.')); }
  }
  async function restorePlus() {
    try {
      const service = await window.getDigitalGoodsService('https://play.google.com/billing');
      const purchases = await service.listPurchases(); let ok = false;
      for (const p of purchases) { const v = await api('/api/billing/play/verify', { purchaseToken: p.purchaseToken, productId: p.itemId }); ok = ok || (v.ok && v.data.plan === 'plus'); }
      await refresh(true); toast(ok ? t('Suscripción restaurada.') : t('No encontramos una suscripción activa en esta cuenta de Google Play.'));
    } catch { toast(t('No se pudo consultar Google Play.')); }
  }

  // Compatibilidad con la API anterior (index.html).
  function canAskCoach() { return true; }       // la cuota la aplica el servidor
  function recordCoachSuccess() { if (ent?.ai) { ent.ai.remaining = Math.max(0, ent.ai.remaining - 1); renderCoachUsage(); } }
  function init() {
    document.getElementById('watchRewardedAd')?.addEventListener('click', onWatchForAi);
    document.getElementById('plusBuyGooglePlay')?.addEventListener('click', buyPlusGooglePlay);
    document.getElementById('plusRestore')?.addEventListener('click', restorePlus);
    document.getElementById('membershipInfoButton')?.addEventListener('click', () => refresh(true));
    refresh(true); metric('app_open');
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  }
  window.FittFormaAds = Object.freeze({ init, refresh, canAskCoach, recordCoachSuccess, renderCoachUsage, showAiQuota, earnPhoto, maybeInterstitial, isPlus, entitlements: () => ent, showRewarded: () => earnReward('ai') });
})();
