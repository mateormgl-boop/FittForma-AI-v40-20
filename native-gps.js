/* FittForma AI v50 — puente de GPS en segundo plano para la app nativa (Capacitor).
 * En el navegador o la PWA no hace nada: available() devuelve false y la app usa navigator.geolocation,
 * que el sistema suspende con la pantalla bloqueada. En la app Android, el complemento
 * @capacitor-community/background-geolocation mantiene un servicio en primer plano con una notificación
 * visible mientras dure la actividad, y entrega posiciones aunque la pantalla esté apagada.
 */
(function (root) {
  'use strict';
  function plugin() {
    const cap = root.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    try { return cap.Plugins?.BackgroundGeolocation || (typeof cap.registerPlugin === 'function' ? cap.registerPlugin('BackgroundGeolocation') : null); } catch { return null; }
  }
  const api = {
    available() { return !!plugin(); },
    platform() { return root.Capacitor?.getPlatform?.() || 'web'; },
    /**
     * Empieza a recibir posiciones. onPosition recibe un objeto con la misma forma que GeolocationPosition
     * ({coords:{latitude, longitude, accuracy, altitude, altitudeAccuracy, speed}, timestamp}).
     * onError recibe {code, message} con los mismos códigos que la API web (1 = permiso denegado).
     */
    async start(onPosition, onError, { title = 'FittForma AI registra tu actividad', message = 'Tu ubicación se usa solo para medir el recorrido. Tocá para volver a la app.' } = {}) {
      const p = plugin();
      if (!p) throw new Error('GPS nativo no disponible');
      return p.addWatcher({ backgroundTitle: title, backgroundMessage: message, requestPermissions: true, stale: false, distanceFilter: 3 }, (location, error) => {
        if (error) { onError?.({ code: error.code === 'NOT_AUTHORIZED' ? 1 : 2, message: error.message || 'Error de ubicación', raw: error }); return; }
        if (!location) return;
        onPosition?.({ coords: { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, altitude: location.altitude ?? null, altitudeAccuracy: location.altitudeAccuracy ?? null, speed: location.speed ?? null }, timestamp: location.time || Date.now() });
      });
    },
    async stop(id) { const p = plugin(); if (p && id) { try { await p.removeWatcher({ id }); } catch { /* ya detenido */ } } },
    async openSettings() { const p = plugin(); if (p?.openSettings) await p.openSettings(); },
  };
  root.FittFormaNativeGps = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
