const CACHE = 'fittforma-ai-static-v57-0';
const ASSETS = ["./", "./index.html", "./i18n.js", "./i18n-extra.js", "./i18n-v48.js", "./i18n-v50.js", "./i18n-v51.js", "./i18n-v52.js", "./i18n-v53.js", "./design.css", "./assets/brand/logo-mark.svg", "./assets/fonts/inter-latin-wght.woff2", "./community.js", "./achievements.js", "./anatomy.js", "./training-core.js", "./body-goals.js", "./muscle-ranks.js", "./athlete-stats.js", "./exercise-guides.js", "./exercise-media.js", "./exercise-gifs.js", "./activity-core.js", "./native-gps.js", "./food-db.js", "./food-core.js", "./nutrition-guides.js", "./ads-config.js", "./monetization-core.js", "./ads.js", "./membership-config.js", "./manifest.json", "./icon.svg", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./supabase-config.js", "./assets/exercises/bench-press.webp", "./assets/exercises/curl.webp", "./assets/exercises/cycling.webp", "./assets/exercises/deadlift.webp", "./assets/exercises/glute-bridge.webp", "./assets/exercises/jogging.webp", "./assets/exercises/lat-pulldown.webp", "./assets/exercises/lunge.webp", "./assets/exercises/plank.webp", "./assets/exercises/push-up.webp", "./assets/exercises/shoulder-press.webp", "./assets/exercises/squat.webp", "./assets/exercises/running-outdoor.webp", "./assets/exercises/walking-outdoor.webp", "./assets/exercises/cycling-outdoor.webp", "./assets/exercises/stretching.webp", "./assets/hero/gym-v20.webp", "./assets/exercises/romanian-deadlift-dumbbells.webp", "./assets/exercises/incline-push-up-reference.webp", "./assets/exercises/seated-cable-row.webp", "./assets/exercises/lateral-raise.webp", "./assets/exercises/cable-triceps-pushdown.webp", "./assets/exercises/bird-dog-reference.webp", "./assets/exercises/treadmill-running.webp", "./assets/exercises/reference-strength.svg", "./assets/exercises/reference-legs.svg", "./assets/exercises/reference-push.svg", "./assets/exercises/reference-pull.svg", "./assets/exercises/reference-shoulders.svg", "./assets/exercises/reference-arms.svg", "./assets/exercises/reference-core.svg", "./assets/exercises/reference-cardio.svg", "./assets/illustrations/meal-desayuno.svg", "./assets/illustrations/meal-almuerzo.svg", "./assets/illustrations/meal-merienda.svg", "./assets/illustrations/meal-cena.svg", "./assets/illustrations/meal-colacion.svg", "./assets/illustrations/nutrition-hero.svg", "./assets/illustrations/community-hero.svg", "./assets/exercises/illustrations/abduccion-de-cadera-acostado-de-lado.svg", "./assets/exercises/illustrations/aperturas-con-mancuernas-en-el-suelo.svg", "./assets/exercises/illustrations/baile-o-cardio-de-bajo-impacto.svg", "./assets/exercises/illustrations/buenos-dias-sin-peso.svg", "./assets/exercises/illustrations/caminata-en-intervalos-dentro-de-casa.svg", "./assets/exercises/illustrations/curl-de-biceps-con-banda.svg", "./assets/exercises/illustrations/dead-bug-con-talones-alternos.svg", "./assets/exercises/illustrations/elevacion-de-brazos-en-y-boca-abajo.svg", "./assets/exercises/illustrations/elevacion-de-cadera-en-marcha.svg", "./assets/exercises/illustrations/elevacion-de-rodillas-de-pie.svg", "./assets/exercises/illustrations/elevacion-de-talones-a-una-pierna-con-apoyo.svg", "./assets/exercises/illustrations/elevacion-de-talones-con-apoyo.svg", "./assets/exercises/illustrations/equilibrio-a-una-pierna-con-apoyo-cercano.svg", "./assets/exercises/illustrations/escaladores-lentos-con-manos-elevadas.svg", "./assets/exercises/illustrations/extension-de-triceps-con-banda.svg", "./assets/exercises/illustrations/flexiones-contra-la-pared.svg", "./assets/exercises/illustrations/flexiones-desde-rodillas.svg", "./assets/exercises/illustrations/flexiones-diamante-desde-rodillas.svg", "./assets/exercises/illustrations/flexiones-escapulares-contra-pared.svg", "./assets/exercises/illustrations/hip-thrust-con-sofa-firme.svg", "./assets/exercises/illustrations/jumping-jacks-de-bajo-impacto.svg", "./assets/exercises/illustrations/marcha-elevando-rodillas.svg", "./assets/exercises/illustrations/marcha-en-el-lugar.svg", "./assets/exercises/illustrations/movilidad-de-cadera-en-el-suelo.svg", "./assets/exercises/illustrations/movilidad-de-tobillo-contra-pared.svg", "./assets/exercises/illustrations/paso-lateral-de-bajo-impacto.svg", "./assets/exercises/illustrations/plancha-alta.svg", "./assets/exercises/illustrations/plancha-con-toque-de-hombros-desde-rodillas.svg", "./assets/exercises/illustrations/plancha-elevada-contra-una-mesa-firme.svg", "./assets/exercises/illustrations/plancha-lateral-con-rodillas-apoyadas.svg", "./assets/exercises/illustrations/press-de-pecho-con-banda.svg", "./assets/exercises/illustrations/pullover-con-mancuerna-en-el-suelo.svg", "./assets/exercises/illustrations/remo-con-banda-elastica-sentado.svg", "./assets/exercises/illustrations/remo-con-mochila-cargada-con-seguridad.svg", "./assets/exercises/illustrations/remo-isometrico-con-toalla-segura.svg", "./assets/exercises/illustrations/retraccion-escapular-de-pie.svg", "./assets/exercises/illustrations/sentadilla-a-una-silla.svg", "./assets/exercises/illustrations/sentadilla-isometrica-en-pared.svg", "./assets/exercises/illustrations/shadow-boxing-de-bajo-impacto.svg", "./assets/exercises/illustrations/subir-y-bajar-un-escalon-estable.svg", "./assets/exercises/illustrations/superman-alternado.svg", "./assets/exercises/illustrations/y-t-w-boca-abajo.svg", "./assets/exercises/illustrations/zancada-hacia-atras-sin-peso.svg", "./assets/exercises/illustrations/zancada-lateral-asistida.svg"];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);const results=await Promise.allSettled(ASSETS.map(asset=>cache.add(asset)));const failed=results.filter(result=>result.status==='rejected').length;if(failed)console.warn(`[FittForma] ${failed} recurso(s) no se pudieron guardar para uso sin conexión.`);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('fittforma-ai-static-')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
const CODE_PATH = /(?:^\/$|\.(?:html|js|mjs|json|css)$)/i;
const NETWORK_TIMEOUT_MS = 5000;
// Codigo y configuracion (index, JS, supabase-config, manifest): siempre se pide primero a la red
// para que una version nueva aparezca sin borrar datos del sitio. Si no hay red, se usa la copia guardada.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS))
    ]);
    if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const home = await cache.match('./index.html');
      if (home) return home;
    }
    return Response.error();
  }
}
// Imagenes y otros recursos pesados que no cambian: copia guardada primero.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch (error) {
    return Response.error();
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // No se guardan respuestas externas (nutricion, CDN) ni datos del backend.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const isCode = request.mode === 'navigate' || CODE_PATH.test(url.pathname);
  event.respondWith(isCode ? networkFirst(request) : cacheFirst(request));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL('./',self.location.href).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if(client.url.startsWith(self.registration.scope)){if('focus' in client)return client.focus();}}
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});
