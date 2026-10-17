/* FittForma AI v40.21 — motor local de insignias. No requiere dependencias ni conexión externa. */
(function (root) {
  'use strict';
  const RANKS = [
    { key: 'bronze', name: 'Bronce', roman: ['I', 'II', 'III'] },
    { key: 'silver', name: 'Plata', roman: ['I', 'II', 'III'] },
    { key: 'gold', name: 'Oro', roman: ['I', 'II', 'III'] },
    { key: 'diamond', name: 'Diamante', roman: ['I', 'II', 'III'] }
  ];
  const GENERIC_REP_TARGETS = [1, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50];
  const GENERIC_SECONDS_TARGETS = [10, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 600];
  const GENERIC_MINUTE_TARGETS = [3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180];
  const RUN_DISTANCE_TARGETS = [1, 2, 3, 5, 7, 10, 12, 15, 18, 21.1, 30, 42.2];
  const WALK_DISTANCE_TARGETS = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50];
  const BIKE_DISTANCE_TARGETS = [3, 5, 10, 15, 20, 30, 40, 60, 80, 100, 150, 200];
  const ACTIVE_DAY_TARGETS = [1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120];

  function normalizeName(value) {
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function slug(value) { return normalizeName(value).replace(/\s+/g, '-').slice(0, 64) || 'ejercicio'; }
  function thresholdsForExercise(item = {}) {
    if (Array.isArray(item.thresholds) && item.thresholds.length === 12 && item.thresholds.every((v, i, a) => Number.isFinite(Number(v)) && Number(v) > 0 && (i === 0 || Number(v) > Number(a[i - 1])))) return item.thresholds.map(Number);
    if (item.measure === 'seconds') return GENERIC_SECONDS_TARGETS.slice();
    if (item.measure === 'minutes') return GENERIC_MINUTE_TARGETS.slice();
    if (item.measure === 'km') return RUN_DISTANCE_TARGETS.slice();
    if (item.measure === 'days') return ACTIVE_DAY_TARGETS.slice();
    return GENERIC_REP_TARGETS.slice();
  }
  function rankForLevel(index) {
    const safe = Math.max(0, Math.min(11, Math.floor(Number(index) || 0)));
    const rank = RANKS[Math.floor(safe / 3)];
    const numeral = rank.roman[safe % 3];
    return { key: rank.key, name: rank.name, numeral, label: `${rank.name} ${numeral}`, index: safe };
  }
  function progressForValue(value, thresholds) {
    const list = Array.isArray(thresholds) && thresholds.length ? thresholds.map(Number) : GENERIC_REP_TARGETS;
    const n = Number(value);
    const safe = Number.isFinite(n) && n > 0 ? n : 0;
    let highest = -1;
    for (let i = 0; i < list.length; i++) if (safe >= list[i]) highest = i;
    const complete = highest >= list.length - 1;
    const nextTarget = complete ? null : list[Math.max(0, highest + 1)];
    let pct = 0;
    if (complete) pct = 100;
    else if (highest >= 0) {
      const current = list[highest], next = list[highest + 1];
      pct = Math.max(0, Math.min(100, Math.round(((safe - current) / (next - current)) * 100)));
    } else if (safe > 0) pct = Math.max(1, Math.min(99, Math.round(safe / list[0] * 100)));
    return { value: safe, highest, complete, nextTarget, pct, unlocked: highest + 1 };
  }
  function validGpsActivity(activity, expectedType) {
    if (!activity || activity.source !== 'gps') return false;
    if (expectedType && normalizeName(activity.type) !== normalizeName(expectedType)) return false;
    const km = Number(activity.distance);
    const seconds = Number(activity.durationSeconds) || Number(activity.minutes) * 60;
    const route = Array.isArray(activity.route) ? activity.route : [];
    if (!Number.isFinite(km) || km < (normalizeName(expectedType) === 'bicicleta' ? 0.2 : 0.1)) return false;
    if (!Number.isFinite(seconds) || seconds < 60 || route.length < 5) return false;
    const valid = route.filter(p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lon)) <= 180 && Number.isFinite(Number(p.accuracy)) && Number(p.accuracy) <= 45);
    const locations = new Set(valid.map(p => `${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`));
    if (valid.length < 5 || locations.size < 4) return false;
    const speed = km / (seconds / 3600);
    const type = normalizeName(expectedType || activity.type);
    const speedLimit = type === 'bicicleta' ? 80 : type === 'caminar' ? 12 : 25;
    if (!Number.isFinite(speed) || speed < 0.1 || speed > speedLimit) return false;
    // Check obvious teleportation using consecutive GPS samples and their timestamps.
    let validSegments = 0;
    for (let i = 1; i < valid.length; i++) {
      const a = valid[i - 1], b = valid[i];
      const atA = Number(a.at), atB = Number(b.at);
      if (Number.isFinite(atA) && Number.isFinite(atB) && atB <= atA) continue;
      const lat1 = Number(a.lat) * Math.PI / 180, lat2 = Number(b.lat) * Math.PI / 180;
      const dLat = lat2 - lat1, dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      const meters = 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
      const dt = Number.isFinite(atA) && Number.isFinite(atB) ? (atB - atA) / 1000 : 0;
      if (dt > 0 && dt <= 120 && meters / dt > (type === 'bicicleta' ? 23 : 11)) return false;
      if (meters >= 2) validSegments++;
    }
    return validSegments >= 3;
  }
  root.FittFormaBadgeEngine = Object.freeze({
    RANKS, GENERIC_REP_TARGETS, GENERIC_SECONDS_TARGETS, GENERIC_MINUTE_TARGETS,
    RUN_DISTANCE_TARGETS, WALK_DISTANCE_TARGETS, BIKE_DISTANCE_TARGETS, ACTIVE_DAY_TARGETS,
    normalizeName, slug, thresholdsForExercise, rankForLevel, progressForValue, validGpsActivity
  });
})(typeof window !== 'undefined' ? window : globalThis);
