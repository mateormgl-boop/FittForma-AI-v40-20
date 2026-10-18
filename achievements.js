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
  const SESSION_COUNT_TARGETS = [1, 3, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150];
  const STREAK_TARGETS = [2, 3, 4, 5, 7, 10, 14, 21, 30, 45, 60, 90];

  // Valores por encima de estos topes se rechazan como marca de una sola serie/actividad.
  const GENERIC_MAX = { reps: 300, seconds: 3600, minutes: 360, km: 100, days: 100000, bw: 5, sessions: 100000, streak: 100000 };

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
    { id: 'consistency-active-days', name: 'Días con actividad registrada', group: 'Constancia', category: 'consistency', measure: 'days', thresholds: ACTIVE_DAY_TARGETS },
    // v49: entrenamientos completos (no parciales) y racha de días seguidos con actividad.
    { id: 'consistency-sessions', name: 'Entrenamientos completados', group: 'Constancia', category: 'consistency', measure: 'sessions', thresholds: SESSION_COUNT_TARGETS, symbol: 'checkbell' },
    { id: 'consistency-streak', name: 'Racha de días activos', group: 'Constancia', category: 'consistency', measure: 'streak', thresholds: STREAK_TARGETS, symbol: 'flame' }
  ];

  /* v49: marcas con carga. Nivel = mejor serie válida (completada, reps ≥ 1, peso > 0) ÷ peso corporal del perfil.
   * Sin peso corporal cargado no se calcula (no se inventan umbrales absolutos). Umbrales configurables, en
   * múltiplos del peso corporal; criterio documentado en docs/INSIGNIAS.md. El volumen de la sesión nunca cuenta. */
  const LOAD_CHALLENGES = [
    { id: 'load-press-banca', name: 'Press de banca · carga', group: 'Pecho', category: 'strength', measure: 'bw', symbol: 'bench', match: '^press de banca( con barra)?$|^press de banca plano', thresholds: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.5, 1.75] },
    { id: 'load-sentadilla', name: 'Sentadilla con barra · carga', group: 'Piernas', category: 'strength', measure: 'bw', symbol: 'squatbar', match: '^sentadilla (con barra|trasera)', thresholds: [0.4, 0.5, 0.65, 0.8, 0.95, 1.1, 1.25, 1.4, 1.6, 1.8, 2.0, 2.4] },
    { id: 'load-peso-muerto', name: 'Peso muerto · carga', group: 'Espalda', category: 'strength', measure: 'bw', symbol: 'deadlift', match: '^peso muerto( con barra| convencional)?$', thresholds: [0.5, 0.65, 0.8, 1.0, 1.15, 1.3, 1.5, 1.7, 1.9, 2.1, 2.4, 2.8] },
    { id: 'load-press-militar', name: 'Press militar · carga', group: 'Hombros', category: 'strength', measure: 'bw', symbol: 'ohp', match: '^press militar( con barra| de pie)?$', thresholds: [0.2, 0.25, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15] }
  ];
  function loadChallengeFor(name) { const n = normalizeName(name); return LOAD_CHALLENGES.find(c => new RegExp(c.match).test(n)) || null; }

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
    if (measure === 'bw') return '× tu peso corporal';
    if (measure === 'sessions') return one ? 'entrenamiento' : 'entrenamientos';
    if (measure === 'streak') return one ? 'día seguido' : 'días seguidos';
    return short ? 'reps' : (one ? 'repetición' : 'repeticiones');
  }
  function formatNumber(value, measure) {
    const n = Number(value) || 0;
    if (measure === 'km') return (Math.round(n * 100) / 100).toLocaleString('es-UY', { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 2 });
    if (measure === 'bw') return (Math.round(n * 100) / 100).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    if (measure === 'bw') return `Llegá a ${formatValue(p.nextTarget, measure)} en una serie completa para ${next}.`;
    const missing = Math.max(0, p.nextTarget - p.value);
    const shown = measure === 'km' ? Math.ceil(missing * 100) / 100 : Math.ceil(missing);
    return `Te ${shown === 1 ? 'falta' : 'faltan'} ${formatValue(shown, measure)} para ${next}.`;
  }

  /* Valida una marca declarada antes de guardarla. */
  function validateRecord(item, value, existing = [], date = '') {
    if (!item || item.activityType || ['days', 'sessions', 'streak'].includes(item.measure)) return { ok: false, reason: 'Este desafío se actualiza solo con tus actividades registradas.' };
    if (item.measure === 'bw') return { ok: false, reason: 'Esta insignia se calcula con las series de tus entrenamientos (peso y repeticiones) y tu peso corporal.' };
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

  // Ninguna fuente es una verificación independiente: se indica de dónde sale el dato, sin decir «verificada».
  function evidenceLabel(evidence) {
    return evidence === 'gps_device' ? 'Con ruta GPS' : evidence === 'session' ? 'Registrada en sesión' : 'Declarada';
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

  /* v49: emblema hexagonal con relieve. El marco cambia por rango (no solo el color) y el símbolo por actividad.
   * Bronce: hexágono liso · Plata: hexágono biselado · Oro: hexágono con puntas y laureles · Diamante: gema
   * hexagonal facetada con destellos. El nivel I–III se ve con 1–3 marcas debajo. Sin emojis. */
  const GLYPHS = {
    pushup: '<path d="M7 26h26M11 26l5-7h9l4 7M16 19l3-5"/><circle class="gf" cx="21" cy="12" r="2.2"/>',
    dumbbell: '<path d="M12 15v10M8.5 17v6M28 15v10M31.5 17v6M12 20h16"/>',
    legs: '<path d="M17 9v9l-3 9M23 9v9l3 9M14 27h-3M26 27h3"/>',
    core: '<rect x="14" y="10" width="12" height="18" rx="4"/><path d="M20 10v18M14 16h12M14 22h12"/>',
    timer: '<circle cx="20" cy="21" r="8"/><path d="M20 21v-4M18 10h4M20 10v3"/>',
    heart: '<path d="M20 28s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 28 17c0 6-8 11-8 11z"/>',
    run: '<circle class="gf" cx="23" cy="10.5" r="2.2"/><path d="M14 28l4-6 3 2 1-6 4 4h3M18 22l1-6 4 1"/>',
    route: '<circle cx="13" cy="26" r="2"/><circle cx="27" cy="13" r="2"/><path d="M15 26h7a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h7"/>',
    calendar: '<rect x="12" y="12" width="16" height="15" rx="2.5"/><path d="M12 17h16M16 10v4M24 10v4M16 22l3 2 5-4"/>',
    star: '<path d="M20 11l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    bench: '<path d="M8 13h24M11 10v6M29 10v6M9 11.5v3M31 11.5v3"/><path d="M11 25h18M14 25v5M26 25v5M14 21h9"/><circle class="gf" cx="27" cy="21" r="2"/>',
    pullup: '<path d="M8 9h24M14 9l3 6M26 9l-3 6M17 15h6M18 15v8l-2 7M22 15v8l2 7"/><circle class="gf" cx="20" cy="12.6" r="2"/>',
    dips: '<path d="M9 18h7M24 18h7M12 18v12M28 18v12M16 18l1-4h6l1 4M20 14v8l-3 4M20 22l3 4"/><circle class="gf" cx="20" cy="10.5" r="2"/>',
    squat: '<circle class="gf" cx="17" cy="9.5" r="2.2"/><path d="M17 12.5v7l7 2-1 8M17 19.5l-4 4 4 6M13 15h10"/>',
    squatbar: '<path d="M8 12h24M11 9v6M29 9v6"/><circle class="gf" cx="18" cy="9.2" r="2"/><path d="M17 12v7l6 2-1 8M17 19l-4 4 4 6"/>',
    deadlift: '<path d="M8 29h24M11 26v6M29 26v6M21 29l-2-8M19 21l-3-5 6-4M19 21l5 2M16 16l-2 2"/><circle class="gf" cx="24.5" cy="11" r="2"/>',
    ohp: '<path d="M8 8h24M11 5v6M29 5v6M15 8l2 7M25 8l-2 7M17 15h6v6l-2 8M23 21l1 8"/><circle class="gf" cx="20" cy="12.8" r="2"/>',
    lunge: '<circle class="gf" cx="20" cy="9" r="2.2"/><path d="M20 12v8l-6 3v6M20 20l6 4 1 5M16 15h8"/>',
    calf: '<path d="M16 8v14l-1 6h8M24 8v14"/><path d="M12 31h16"/>',
    abs: '<rect x="13" y="9" width="14" height="22" rx="5"/><path d="M20 9v22M13 16h14M13 23h14"/>',
    plank: '<circle class="gf" cx="10" cy="16" r="2.2"/><path d="M12.5 18l17 4.5M12.5 18v8M10 26h5M29.5 22.5l2.5 3.5"/>',
    sideplank: '<circle class="gf" cx="13" cy="10" r="2.2"/><path d="M14 13l13 15M14 13v13M11 26h6M14 13l-5-3"/>',
    wallsit: '<path d="M10 7v24"/><circle class="gf" cx="14" cy="9.5" r="2.2"/><path d="M12 13v8h9v9M14 15l5 2"/>',
    balance: '<circle class="gf" cx="20" cy="8.5" r="2.2"/><path d="M20 11.5v9l-1 9M20 20.5l6 3M12 14h16"/>',
    burpee: '<circle class="gf" cx="20" cy="7.5" r="2.2"/><path d="M20 10.5v8M14 8l6 4 6-4M20 18.5l-4 6M20 18.5l4 6M10 31h20"/>',
    jack: '<circle class="gf" cx="20" cy="8" r="2.2"/><path d="M20 11v9M20 13l-7-5M20 13l7-5M20 20l-6 9M20 20l6 9"/>',
    climber: '<circle class="gf" cx="9" cy="15" r="2.2"/><path d="M11 17l18 3M11 17v8M20 18.5l-3 7M27 20l2 6"/>',
    walk: '<circle class="gf" cx="20" cy="8.5" r="2.2"/><path d="M20 11.5v9l-3 9M20 20.5l3 9M20 14l-4 4M20 14l4 3"/>',
    bike: '<circle cx="12" cy="25" r="5"/><circle cx="28" cy="25" r="5"/><path d="M12 25l5-9h7l4 9M17 16l3 9h-8M22 12h4"/>',
    flame: '<path d="M20 31c-5 0-8-3-8-7 0-5 5-7 5-12 3 2 4 4 4 7 1-1 2-3 2-4 3 2 5 5 5 9 0 4-3 7-8 7z"/>',
    checkbell: '<path d="M12 15v10M8.5 17v6M28 15v10M31.5 17v6M12 20h16"/><path d="M15 29l3 2 7-5"/>',
    biceps: '<path d="M11 29c1-6 2-12 6-15 3-2 6 0 5 3l-3 2c4-1 8 0 9 4 1 5-3 7-8 7z"/>',
    triceps: '<path d="M14 31V19l5-8 5 3M14 19l6 2M20 21l-2 10"/><path d="M22 9l5 3"/>',
    shoulders: '<path d="M8 19c3-5 7-6 12-6s9 1 12 6M12 19v10h16V19"/><circle class="gf" cx="20" cy="9" r="2.6"/>',
    glutes: '<path d="M11 13c0 9 4 15 9 15s9-6 9-15M20 15v13"/>',
    mobility: '<circle class="gf" cx="14" cy="9" r="2.2"/><path d="M14 12l3 8 9 4M17 20l-5 9M14 14l10-6"/>'
  };
  // Símbolo propio por desafío (la categoría solo queda como respaldo).
  const SYMBOL_BY_ID = {
    'exercise-flexiones': 'pushup', 'exercise-dominadas': 'pullup', 'exercise-fondos': 'dips', 'exercise-sentadillas': 'squat',
    'exercise-zancadas': 'lunge', 'exercise-elevacion-talones': 'calf', 'exercise-abdominales': 'abs', 'exercise-escaladores': 'climber',
    'exercise-plancha-frontal': 'plank', 'exercise-plancha-lateral': 'sideplank', 'exercise-sentadilla-isometrica-pared': 'wallsit',
    'exercise-equilibrio-pierna': 'balance', 'exercise-burpees': 'burpee', 'exercise-jumping-jacks': 'jack',
    'activity-running': 'run', 'activity-walking': 'walk', 'activity-cycling': 'bike', 'consistency-active-days': 'calendar'
  };
  const GROUP_SYMBOL = { pecho: 'bench', espalda: 'pullup', hombros: 'shoulders', brazos: 'biceps', piernas: 'legs', gluteos: 'glutes', core: 'abs', cardio: 'heart', movilidad: 'mobility' };
  function glyphFor(item = {}) {
    if (item.symbol && GLYPHS[item.symbol]) return item.symbol;
    if (SYMBOL_BY_ID[item.id]) return SYMBOL_BY_ID[item.id];
    const n = normalizeName(item.name);
    if (item.measure === 'seconds') return /lateral/.test(n) ? 'sideplank' : /pared|isometric/.test(n) ? 'wallsit' : /equilibrio/.test(n) ? 'balance' : 'plank';
    if (/triceps|fondos|press frances/.test(n)) return 'triceps';
    if (/curl|biceps/.test(n)) return 'biceps';
    if (/zancada|estocada|bulgara/.test(n)) return 'lunge';
    if (/sentadilla/.test(n)) return 'squat';
    if (/dominada|jalon/.test(n)) return 'pullup';
    if (/flexion/.test(n)) return 'pushup';
    if (GROUP_SYMBOL[normalizeName(item.group)]) return GROUP_SYMBOL[normalizeName(item.group)];
    return (CATEGORIES.find(c => c.key === item.category) || { glyph: 'star' }).glyph;
  }
  const CATEGORY_HUES = { calisthenics: '#2f6bff', strength: '#6a4cf2', legs: '#0b8a6b', core: '#c47a00', hold: '#0a8fd0', cardio: '#d1384f', running: '#0a8a4f', outdoor: '#5d8a12', consistency: '#4f46e5', custom: '#bd2b84' };
  // Geometría: hexágono con punta arriba, centro (24, 23).
  const hexPts = (r, cx = 24, cy = 23, sy = 1) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 90); return [cx + r * Math.cos(a), cy + r * Math.sin(a) * sy]; });
  const pathOf = pts => 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L') + 'Z';
  function chamfer(pts, t) { const out = []; pts.forEach((p, i) => { const prev = pts[(i + 5) % 6], next = pts[(i + 1) % 6]; out.push([p[0] + (prev[0] - p[0]) * t, p[1] + (prev[1] - p[1]) * t], [p[0] + (next[0] - p[0]) * t, p[1] + (next[1] - p[1]) * t]); }); return out; }
  function spiked(r) { const out = []; for (let i = 0; i < 12; i++) { const a = Math.PI / 180 * (30 * i - 90), rr = i % 2 ? r * 0.93 : r * 1.06; out.push([24 + rr * Math.cos(a), 23 + rr * Math.sin(a)]); } return out; }
  const OUTER = hexPts(20), FACE = hexPts(14.6);
  const RANK_SHAPES = {
    bronze: `<path class="ff-medal-shape" d="${pathOf(OUTER)}"/>`,
    silver: `<path class="ff-medal-shape" d="${pathOf(chamfer(OUTER, 0.16))}"/><path class="ff-medal-facet" d="${pathOf(hexPts(17.4))}"/>`,
    gold: `<path class="ff-medal-laurel" d="M7 36c-4-5-5-12-2-19M41 36c4-5 5-12 2-19M5.5 30l-3 1M5 24l-3-.5M6 18.5 3.5 17M42.5 30l3 1M43 24l3-.5M42 18.5l2.5-1.5"/><path class="ff-medal-shape" d="${pathOf(spiked(20.5))}"/><path class="ff-medal-facet" d="${pathOf(hexPts(17.6))}"/>`,
    diamond: `<path class="ff-medal-spark" d="M5 6v4M3 8h4M43 5v4M41 7h4M44 33v3M42.5 34.5h3"/><path class="ff-medal-shape" d="${pathOf(hexPts(20.5, 24, 23, 1.06))}"/><path class="ff-medal-facet" d="${pathOf(hexPts(20.5, 24, 23, 1.06)).replace(/[MZ]/g, '').split('L').map(p => `M24 23L${p}`).join('')}"/>`
  };
  function medalSvg({ rankKey = 'bronze', numeral = '', glyph = 'star', locked = false, size = 48, title = '', category = '' } = {}) {
    const key = ['bronze', 'silver', 'gold', 'diamond'].includes(rankKey) ? rankKey : 'bronze';
    const g = GLYPHS[glyph] || GLYPHS.star;
    const cat = category || (CATEGORIES.find(c => c.glyph === glyph) || {}).key || 'custom';
    const hue = CATEGORY_HUES[cat] || CATEGORY_HUES.custom;
    const level = ['I', 'II', 'III'].indexOf(numeral) + 1;
    const pips = level > 0 ? Array.from({ length: level }, (_, i) => `<circle class="ff-medal-pip" cx="${24 + (i - (level - 1) / 2) * 5}" cy="50" r="1.7"/>`).join('') : '';
    const label = title ? `<title>${String(title).replace(/[<>&"]/g, '')}</title>` : '';
    const banner = numeral && !locked ? `<path class="ff-medal-banner" d="M15 44.5h18l-2 4 2 4H15l2-4z"/><text class="ff-medal-num" x="24" y="50.2" text-anchor="middle">${numeral}</text>${pips}` : '';
    return `<svg class="ff-medal ff-medal--${key} ff-medal-cat--${cat}${locked ? ' is-locked' : ''}" style="--medal-hue:${hue}" width="${size}" height="${Math.round(size * 56 / 48)}" viewBox="0 0 48 56" role="${title ? 'img' : 'presentation'}"${title ? '' : ' aria-hidden="true"'}>${label}${RANK_SHAPES[key]}<path class="ff-medal-inner" d="${pathOf(FACE)}"/><path class="ff-medal-ring" d="${pathOf(hexPts(12.6))}"/><path class="ff-medal-shine" d="M12.5 15.5 24 8.8l11.5 6.7"/><g class="ff-medal-glyph" transform="translate(24 23) scale(.62) translate(-20 -19.5)">${g}</g>${banner}</svg>`;
  }

  root.FittFormaBadgeEngine = Object.freeze({
    RANKS, CATEGORIES, CORE_EXERCISES, ACTIVITY_CHALLENGES, LOAD_CHALLENGES, GENERIC_MAX, GLYPHS, SYMBOL_BY_ID, loadChallengeFor,
    GENERIC_REP_TARGETS, GENERIC_SECONDS_TARGETS, GENERIC_MINUTE_TARGETS,
    RUN_DISTANCE_TARGETS, WALK_DISTANCE_TARGETS, BIKE_DISTANCE_TARGETS, ACTIVE_DAY_TARGETS,
    normalizeName, slug, thresholdsForExercise, rankForLevel, progressForValue, validGpsActivity,
    categoryForLibraryExercise, measureForLibraryExercise, categoryLabel, maxPlausible,
    unitLabel, formatValue, nextStepMessage, validateRecord, evidenceLabel, glyphFor, medalSvg
  });
})(typeof window !== 'undefined' ? window : globalThis);
