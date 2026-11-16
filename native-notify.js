/* FittForma AI v72 — notificaciones locales en la app de Android (Capacitor).
 * En el navegador o la PWA no hace nada: available() devuelve false y la app sigue con las notificaciones web
 * (que solo avisan con la app abierta) y el calendario (.ics).
 * En la app de Android, @capacitor/local-notifications deja los avisos programados en el sistema: llegan aunque
 * la app esté cerrada y se vuelven a programar si el teléfono se reinicia. Cada grupo usa un rango de
 * identificadores propio, así se reemplaza un grupo (por ejemplo, el agua) sin tocar los otros.
 */
(function (root) {
  'use strict';
  const RANGES = Object.freeze({ workout: [71000, 71099], water: [72000, 72199], test: [79000, 79009] });
  const SMALL_ICON = 'ic_stat_fittforma';
  function plugin() {
    const cap = root.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    try { return cap.Plugins?.LocalNotifications || (typeof cap.registerPlugin === 'function' ? cap.registerPlugin('LocalNotifications') : null); } catch { return null; }
  }
  const inRange = (id, range) => Number.isInteger(id) && id >= range[0] && id <= range[1];
  // Normaliza lo que pide la app: solo fechas futuras (al menos 20 s), en orden, y como mucho lo que entra en el rango.
  function prepare(group, items, now = Date.now()) {
    const range = RANGES[group];
    if (!range) return [];
    return (Array.isArray(items) ? items : [])
      .filter(item => item && item.at instanceof Date && Number.isFinite(item.at.getTime()) && item.at.getTime() > now + 20000 && item.title)
      .sort((a, b) => a.at - b.at)
      .slice(0, range[1] - range[0] + 1)
      .map((item, k) => ({ id: range[0] + k, title: String(item.title).slice(0, 80), body: String(item.body || '').slice(0, 240), schedule: { at: item.at, allowWhileIdle: true }, smallIcon: SMALL_ICON, extra: { group } }));
  }
  const api = {
    RANGES,
    prepare,
    available() { return !!plugin(); },
    /** 'granted' | 'denied' | 'prompt' | 'unavailable'. Con request=true el sistema pide permiso (Android 13 o más). */
    async permission(request = false) {
      const p = plugin();
      if (!p) return 'unavailable';
      try {
        let status = await p.checkPermissions();
        if (status?.display !== 'granted' && request) status = await p.requestPermissions();
        const value = String(status?.display || 'denied');
        return value.startsWith('prompt') ? 'prompt' : value;
      } catch { return 'denied'; }
    },
    /** Reemplaza todos los avisos pendientes de un grupo por la lista nueva [{at: Date, title, body}]. Devuelve cuántos quedaron. */
    async replace(group, items) {
      const p = plugin(), range = RANGES[group];
      if (!p || !range) return 0;
      const pending = await p.getPending().catch(() => ({ notifications: [] }));
      const old = (pending?.notifications || []).map(n => Number(n.id)).filter(id => inRange(id, range)).map(id => ({ id }));
      if (old.length) await p.cancel({ notifications: old }).catch(() => {});
      const list = prepare(group, items);
      if (list.length) await p.schedule({ notifications: list });
      return list.length;
    },
    /** Avisos pendientes de un grupo, ordenados por hora: [{id, title, at: Date}]. */
    async pending(group) {
      const p = plugin(), range = RANGES[group];
      if (!p || !range) return [];
      const result = await p.getPending().catch(() => ({ notifications: [] }));
      return (result?.notifications || []).filter(n => inRange(Number(n.id), range))
        .map(n => ({ id: Number(n.id), title: n.title || '', at: new Date(n.schedule?.at || n.at || 0) }))
        .filter(n => Number.isFinite(n.at.getTime())).sort((a, b) => a.at - b.at);
    },
    /** Aviso de prueba: aparece en unos segundos aunque cierres la app. */
    async test(title, body) {
      return api.replace('test', [{ at: new Date(Date.now() + 25000), title, body }]);
    },
  };
  root.FittFormaNativeNotify = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
