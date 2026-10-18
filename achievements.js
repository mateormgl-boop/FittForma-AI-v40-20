/* FittForma AI v41.0 — motor de insignias. Fuente única de reglas: catálogo, umbrales,
 * categorías, validación de marcas, evidencia y mensajes de progreso. Sin dependencias.
 *
 * Criterio de dificultad (documentado en docs/INSIGNIAS.md):
 *   Bronce I–III   → primeras marcas alcanzables por una persona que empieza.
 *   Plata  I–III   → base consolidada tras algunas semanas de práctica regular.
 *   Oro    I–III   → nivel intermedio sostenido.
 *   Diamante I–III → nivel avanzado; Diamante III es una marca destacada para un aficionado.
 * Cada actividad usa su propia métrica (repeticiones seguidas, segundos sostenidos, km en una
 * sola actividad o días distintos con actividad). Nunca se suman series para obtener un nivel.
 *
 * Evidencia: 'declared' (marca manual o serie anotada en una sesión) y 'gps_device'
 * (ruta GPS que pasa controles básicos en el dispositivo). Ninguna de las dos es una
 * verificación independiente: no existe todavía verificación del lado del servidor.
 */
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

  // Valores por encima de estos topes se rechazan como marca de una sola serie/actividad.
  const GENERIC_MAX = { reps: 300, seconds: 3600, minutes: 360, km: 100, days: 100000 };

  const CATEGORIES = [
    { key: 'calisthenics', label: 'Calistenia', glyph: 'pushup' },
    { key: 'strength', label: 'Fuerza', glyph: 'dumbbell' },
    { key: 'legs', label: 'Tren inferior', glyph: 'legs' },
    { key: 'core', label: 'Zona abdominal y core', glyph: 'core' },
    { key: 'hold', label: 'Duración y control', glyph: 'timer' },
    { key: 'cardio', label: 'Resistencia cardiovascular', glyph: 'heart' },
    { key: 'running', label: 'Running', glyph: 'run' },
    { key: 'outdoor', label: 'Caminata y ciclismo', glyph: 'route' },
    { key: 'consistency', label: 'Constancia', glyph: 'calendar' },
    { key: 'custom', label: 'Mis ejercicios', glyph: 'star' }
  ];

  // Ejercicios principales con umbrales propios. Los IDs y umbrales se conservan desde v40.20
  // para no alterar insignias ya obtenidas; la categoría y el tope de plausibilidad son nuevos.
  const CORE_EXERCISES = [
    { id: 'exercise-flexiones', name: 'Flexiones', group: 'Pecho', category: 'calisthenics', measure: 'reps', thresholds: [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100], max: 250 },
    { id: 'exercise-dominadas', name: 'Dominadas', group: 'Espalda', category: 'calisthenics', measure: 'reps', thresholds: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20], max: 80 },
    { id: 'exercise-fondos', name: 'Fondos en paralelas', group: 'Brazos', category: 'calisthenics', measure: 'reps', thresholds: [3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60], max: 150 },
    { id: 'exercise-sentadillas', name: 'Sentadillas', group: 'Piernas', category: 'legs', measure: 'reps', thresholds: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250], max: 1000 },
    { id: 'exercise-zancadas', name: 'Zancadas', group: 'Piernas', category: 'legs', measure: 'reps', thresholds: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250], max: 1000 },
    { id: 'exercise-elevacion-talones', name: 'Elevación de talones', group: 'Piernas', category: 'legs', measure: 'reps', thresholds: [15, 25, 35, 45, 60, 75, 100, 125, 150, 200, 250, 300], max: 1000 },
    { id: 'exercise-abdominales', name: 'Abdominales', group: 'Core', category: 'core', measure: 'reps', thresholds: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250], max: 1000 },
    { id: 'exercise-escaladores', name: 'Escaladores', group: 'Core', category: 'core', measure: 'reps', thresholds: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250], max: 1000 },
    { id: 'exercise-plancha-frontal', name: 'Plancha frontal', group: 'Core', category: 'hold', measure: 'seconds', thresholds: [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360], max: 3600 },
    { id: 'exercise-plancha-lateral', name: 'Plancha lateral', group: 'Core', category: 'hold', measure: 'seconds', thresholds: [10, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300], max: 1800 },
    { id: 'exercise-sentadilla-isometrica-pared', name: 'Sentadilla isométrica en pared', group: 'Piernas', category: 'hold', measure: 'seconds', thresholds: [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360], max: 2400 },
    { id: 'exercise-equilibrio-pierna', name: 'Equilibrio a una pierna', group: 'Core', category: 'hold', measure: 'seconds', thresholds: [10, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300], max: 3600 },
    { id: 'exercise-burpees', name: 'Burpees', group: 'Cardio', category: 'cardio', measure: 'reps', thresholds: [3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 75], max: 400 },
    { id: 'exercise-jumping-jacks', name: 'Jumping jacks', group: 'Cardio', category: 'cardio', measure: 'reps', thresholds: [20, 40, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500], max: 3000 }
  ];
  const ACTIVITY_CHALLENGES = [
    { id: 'activity-running', name: 'Running · distancia', group: 'Running', category: 'running', measure: 'km', activityType: 'Correr', thresholds: RUN_DISTANCE_TARGETS, max: 100 },
    { id: 'activity-walking', name: 'Caminata · distancia', group: 'Caminata', category: 'outdoor', measure: 'km', activityType: 'Caminar', thresholds: WALK_DISTANCE_TARGETS, max: 80 },
    { id: 'activity-cycling', name: 'Ciclismo · distancia', group: 'Ciclismo', category: 'outdoor', measure: 'km', activityType: 'Bicicleta', thresholds: BIKE_DISTANCE_TARGETS, max: 400 },
    { id: 'consistency-active-days', name: 'Días con actividad registrada', group: 'Constancia', category: 'consistency', measure: 'days', thresholds: ACTIVE_DAY_TARGETS }
  ];

  function normalizeName(value) {
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
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

  /* Categoría para ejercicios de la biblioteca que no están en CORE_EXERCISES. */
  function categoryForLibraryExercise(exercise = {}, measure = 'reps') {
    const group = normalizeName(exercise.group);
    if (measure === 'seconds') return 'hold';
    if (exercise.kind === 'cardio' || measure === 'minutes' || group === 'cardio') return 'cardio';
    if (group === 'core') return 'core';
    if (group === 'piernas' || group === 'gluteos') return 'legs';
    return 'strength';
  }
  function measureForLibraryExercise(exercise = {}) {
    const n = normalizeName(exercise.name);
    if (/plancha|isometr|equilibrio|superman estatico|mantener la posicion|aguante/.test(n)) return 'seconds';
    return exercise.kind === 'cardio' ? 'minutes' : 'reps';
  }
  function categoryLabel(key) { return (CATEGORIES.find(c => c.key === key) || { label: 'Otros' }).label; }
  function maxPlausible(item = {}) {
    const m = Number(item.max);
    return Number.isFinite(m) && m > 0 ? m : (GENERIC_MAX[item.measure] || GENERIC_MAX.reps);
  }

  function unitLabel(measure, value, short = false) {
    const one = Number(value) === 1;
    if (measure === 'seconds') return short ? 's' : (one ? 'segundo' : 'segundos');
    if (measure === 'minutes') return short ? 'min' : (one ? 'minuto' : 'minutos');
    if (measure === 'km') return 'km';
    if (measure === 'days') return one ? 'día activo' : 'días activos';
    return short ? 'reps' : (one ? 'repetición' : 'repeticiones');
  }
  function formatNumber(value, measure) {
    const n = Number(value) || 0;
    if (measure === 'km') return (Math.round(n * 100) / 100).toLocaleString('es-UY', { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 2 });
    return String(Math.round(n));
  }
  function formatValue(value, measure) { return `${formatNumber(value, measure)} ${unitLabel(measure, value)}`; }

  /* Mensaje concreto basado en datos reales; nunca promete algo que no se calcula. */
  function nextStepMessage(value, thresholds, measure) {
    const list = thresholdsForExercise({ thresholds, measure });
    const p = progressForValue(value, list);
    if (p.complete) return 'Completaste los 12 niveles de este desafío.';
    const next = rankForLevel(p.highest + 1).label;
    if (p.value <= 0) return `Tu primera marca de ${formatValue(list[0], measure)} desbloquea ${next}.`;
    const missing = Math.max(0, p.nextTarget - p.value);
    const shown = measure === 'km' ? Math.ceil(missing * 100) / 100 : Math.ceil(missing);
    return `Te ${shown === 1 ? 'falta' : 'faltan'} ${formatValue(shown, measure)} para ${next}.`;
  }

  /* Valida una marca declarada antes de guardarla. */
  function validateRecord(item, value, existing = [], date = '') {
    if (!item || item.activityType || item.measure === 'days') return { ok: false, reason: 'Este desafío se actualiza solo con tus actividades registradas.' };
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return { ok: false, reason: 'Ingresá un valor mayor que cero.' };
    if (item.measure !== 'km' && !Number.isInteger(n)) return { ok: false, reason: 'Ingresá un número entero.' };
    const max = maxPlausible(item);
    if (n > max) return { ok: false, reason: `${formatValue(n, item.measure)} en una sola serie supera el máximo admitido para ${item.name} (${formatValue(max, item.measure)}). Si fue la suma de varias series, registrá solo la mejor.` };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, reason: 'Fecha inválida.' };
    const dup = (Array.isArray(existing) ? existing : []).some(r => r && String(r.exerciseId) === String(item.id) && Number(r.value) === n && String(r.date) === String(date));
    if (dup) return { ok: false, reason: 'Ya registraste esa misma marca hoy.' };
    return { ok: true, value: n };
  }

  function evidenceLabel(evidence) {
    return evidence === 'gps_device' ? 'Con ruta GPS' : 'Declarada';
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

  /* Medalla SVG reutilizable (Progreso, Perfil, Inicio y Comunidad). Sin emojis. */
  const GLYPHS = {
    pushup: '<path d="M7 26h26M11 26l5-7h9l4 7M16 19l3-5"/><circle cx="21" cy="12" r="2.2"/>',
    dumbbell: '<path d="M12 15v10M8.5 17v6M28 15v10M31.5 17v6M12 20h16"/>',
    legs: '<path d="M17 9v9l-3 9M23 9v9l3 9M14 27h-3M26 27h3"/>',
    core: '<rect x="14" y="10" width="12" height="18" rx="4"/><path d="M20 10v18M14 16h12M14 22h12"/>',
    timer: '<circle cx="20" cy="21" r="8"/><path d="M20 21v-4M18 10h4M20 10v3"/>',
    heart: '<path d="M20 28s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 28 17c0 6-8 11-8 11z"/>',
    run: '<circle cx="23" cy="10.5" r="2.2"/><path d="M14 28l4-6 3 2 1-6 4 4h3M18 22l1-6 4 1"/>',
    route: '<circle cx="13" cy="26" r="2"/><circle cx="27" cy="13" r="2"/><path d="M15 26h7a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h7"/>',
    calendar: '<rect x="12" y="12" width="16" height="15" rx="2.5"/><path d="M12 17h16M16 10v4M24 10v4"/>',
    star: '<path d="M20 11l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'
  };
  function glyphFor(item = {}) { return (CATEGORIES.find(c => c.key === item.category) || { glyph: 'star' }).glyph; }
  // v48: cada rango tiene una forma propia (no solo color) y cada categoría su color e ícono.
  // Bronce: disco dentado · Plata: escudo facetado · Oro: roseta con laureles · Diamante: gema facetada.
  // El nivel (I–III) se ve en la cinta con 1–3 marcas además del número romano.
  const CATEGORY_HUES = { calisthenics: '#2f6bff', strength: '#6a4cf2', legs: '#0b8a6b', core: '#c47a00', hold: '#0a8fd0', cardio: '#d1384f', running: '#0a8a4f', outdoor: '#5d8a12', consistency: '#4f46e5', custom: '#bd2b84' };
  const RANK_SHAPES = {
    bronze: '<path class="ff-medal-shape" d="M24 4l3.1 2.3 3.8-.7 1.9 3.4 3.7 1.1.2 3.9 3 2.4-1.2 3.7 1.7 3.5-2.9 2.6-.2 3.9-3.8.9-2 3.3-3.8-.9-3.4 1.9-3.2-2.2-3.8.6-1.8-3.4-3.7-1.2-.1-3.9-3-2.5 1.3-3.7-1.6-3.5 3-2.5.2-3.9 3.8-1 2-3.3 3.8.9z"/><circle class="ff-medal-inner" cx="24" cy="23" r="13"/>',
    silver: '<path class="ff-medal-shape" d="M24 3l17 6.5v13.7c0 9.6-7.3 16.7-17 19.8-9.7-3.1-17-10.2-17-19.8V9.5z"/><path class="ff-medal-facet" d="M24 3v40M7 9.5l17 9 17-9"/><path class="ff-medal-inner" d="M24 8.5l12.5 4.8v10c0 7-5.2 12.3-12.5 14.8-7.3-2.5-12.5-7.8-12.5-14.8v-10z"/>',
    gold: '<path class="ff-medal-laurel" d="M9 33c-4-5-4.5-12-1-18M39 33c4-5 4.5-12 1-18M7.5 27l-3 1.5M7 21l-3-.5M8.5 15.5 6 13.5M40.5 27l3 1.5M41 21l3-.5M39.5 15.5 42 13.5"/><path class="ff-medal-shape" d="M24 3l3.6 4.6 5.6-1.7.9 5.8 5.5 2.1-2.4 5.3 3.4 4.7-5 3 .6 5.9-5.8-.1-2.5 5.3-4.9-3.2-4.9 3.2-2.5-5.3-5.8.1.6-5.9-5-3 3.4-4.7-2.4-5.3 5.5-2.1.9-5.8 5.6 1.7z"/><circle class="ff-medal-inner" cx="24" cy="23" r="12"/>',
    diamond: '<path class="ff-medal-spark" d="M6 8v4M4 10h4M42 6v4M40 8h4M43 30v3M41.5 31.5h3"/><path class="ff-medal-shape" d="M14 5h20l9 11-19 27L5 16z"/><path class="ff-medal-facet" d="M5 16h38M14 5l5 11 5-11 5 11 5-11M19 16l5 27 5-27"/><path class="ff-medal-inner" d="M24 11.5l10 7.5-10 15-10-15z"/>'
  };
  function medalSvg({ rankKey = 'bronze', numeral = '', glyph = 'star', locked = false, size = 48, title = '', category = '' } = {}) {
    const key = ['bronze', 'silver', 'gold', 'diamond'].includes(rankKey) ? rankKey : 'bronze';
    const g = GLYPHS[glyph] || GLYPHS.star;
    const cat = category || (CATEGORIES.find(c => c.glyph === glyph) || {}).key || 'custom';
    const hue = CATEGORY_HUES[cat] || CATEGORY_HUES.custom;
    const level = ['I', 'II', 'III'].indexOf(numeral) + 1;
    const pips = level > 0 ? Array.from({ length: level }, (_, i) => `<circle class="ff-medal-pip" cx="${24 + (i - (level - 1) / 2) * 4.2}" cy="48" r="1.3"/>`).join('') : '';
    const label = title ? `<title>${String(title).replace(/[<>&"]/g, '')}</title>` : '';
    const ribbon = locked ? '' : `<path class="ff-medal-ribbon" d="M15 40l-3 13 6-3 4 4 2-11M33 40l3 13-6-3-4 4-2-11"/>`;
    const banner = numeral && !locked ? `<path class="ff-medal-banner" d="M14 44h20l-2 4 2 4H14l2-4z"/><text class="ff-medal-num" x="24" y="49.6" text-anchor="middle">${numeral}</text>${pips}` : '';
    return `<svg class="ff-medal ff-medal--${key} ff-medal-cat--${cat}${locked ? ' is-locked' : ''}" style="--medal-hue:${hue}" width="${size}" height="${Math.round(size * 56 / 48)}" viewBox="0 0 48 56" role="${title ? 'img' : 'presentation'}"${title ? '' : ' aria-hidden="true"'}>${label}${ribbon}${RANK_SHAPES[key]}<g class="ff-medal-glyph" transform="translate(24 23) scale(.7) translate(-20 -19)">${g}</g>${banner}</svg>`;
  }


  root.FittFormaBadgeEngine = Object.freeze({
    RANKS, CATEGORIES, CORE_EXERCISES, ACTIVITY_CHALLENGES, GENERIC_MAX,
    GENERIC_REP_TARGETS, GENERIC_SECONDS_TARGETS, GENERIC_MINUTE_TARGETS,
    RUN_DISTANCE_TARGETS, WALK_DISTANCE_TARGETS, BIKE_DISTANCE_TARGETS, ACTIVE_DAY_TARGETS,
    normalizeName, slug, thresholdsForExercise, rankForLevel, progressForValue, validGpsActivity,
    categoryForLibraryExercise, measureForLibraryExercise, categoryLabel, maxPlausible,
    unitLabel, formatValue, nextStepMessage, validateRecord, evidenceLabel, glyphFor, medalSvg
  });
})(typeof window !== 'undefined' ? window : globalThis);
