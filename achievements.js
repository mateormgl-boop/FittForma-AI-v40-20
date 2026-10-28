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
    { key: 'diamond', name: 'Diamante', roman: ['I', 'II', 'III'] },
    // v57: tres niveles más, de material negro. Los 12 niveles anteriores no cambian (nadie pierde una insignia).
    { key: 'legend', name: 'Legendario', roman: ['I', 'II', 'III'] }
  ];
  const LEVELS = RANKS.length * 3; // 15
  const GENERIC_REP_TARGETS = [1, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100];
  const GENERIC_SECONDS_TARGETS = [10, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 600, 900, 1200, 1800];
  const GENERIC_MINUTE_TARGETS = [3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360];
  const RUN_DISTANCE_TARGETS = [1, 2, 3, 5, 7, 10, 12, 15, 18, 21.1, 30, 42.2, 50, 60, 80];
  const WALK_DISTANCE_TARGETS = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80];
  const BIKE_DISTANCE_TARGETS = [3, 5, 10, 15, 20, 30, 40, 60, 80, 100, 150, 200, 250, 300, 400];
  const ACTIVE_DAY_TARGETS = [1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365];
  const SESSION_COUNT_TARGETS = [1, 3, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500];
  const STREAK_TARGETS = [2, 3, 4, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 365];

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
    { id: 'exercise-flexiones', name: 'Flexiones', group: 'Pecho', category: 'calisthenics', measure: 'reps', thresholds: [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100, 125, 150, 200], max: 250 },
    { id: 'exercise-dominadas', name: 'Dominadas', group: 'Espalda', category: 'calisthenics', measure: 'reps', thresholds: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 25, 30, 40], max: 80 },
    { id: 'exercise-fondos', name: 'Fondos en paralelas', group: 'Brazos', category: 'calisthenics', measure: 'reps', thresholds: [3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120], max: 150 },
    { id: 'exercise-sentadillas', name: 'Sentadillas', group: 'Piernas', category: 'legs', measure: 'reps', thresholds: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500], max: 1000 },
    { id: 'exercise-zancadas', name: 'Zancadas', group: 'Piernas', category: 'legs', measure: 'reps', thresholds: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500], max: 1000 },
    { id: 'exercise-elevacion-talones', name: 'Elevación de talones', group: 'Piernas', category: 'legs', measure: 'reps', thresholds: [15, 25, 35, 45, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750], max: 1000 },
    { id: 'exercise-abdominales', name: 'Abdominales', group: 'Core', category: 'core', measure: 'reps', thresholds: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500], max: 1000 },
    { id: 'exercise-escaladores', name: 'Escaladores', group: 'Core', category: 'core', measure: 'reps', thresholds: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500], max: 1000 },
    { id: 'exercise-plancha-frontal', name: 'Plancha frontal', group: 'Core', category: 'hold', measure: 'seconds', thresholds: [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 900], max: 3600 },
    { id: 'exercise-plancha-lateral', name: 'Plancha lateral', group: 'Core', category: 'hold', measure: 'seconds', thresholds: [10, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600], max: 1800 },
    { id: 'exercise-sentadilla-isometrica-pared', name: 'Sentadilla isométrica en pared', group: 'Piernas', category: 'hold', measure: 'seconds', thresholds: [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 900], max: 2400 },
    { id: 'exercise-equilibrio-pierna', name: 'Equilibrio a una pierna', group: 'Core', category: 'hold', measure: 'seconds', thresholds: [10, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 450, 600, 900], max: 3600 },
    { id: 'exercise-burpees', name: 'Burpees', group: 'Cardio', category: 'cardio', measure: 'reps', thresholds: [3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200], max: 400 },
    { id: 'exercise-jumping-jacks', name: 'Jumping jacks', group: 'Cardio', category: 'cardio', measure: 'reps', thresholds: [20, 40, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 750, 1000, 1500], max: 3000 }
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
    { id: 'load-press-banca', name: 'Press de banca · carga', group: 'Pecho', category: 'strength', measure: 'bw', symbol: 'bench', match: '^press de banca( con barra)?$|^press de banca plano', thresholds: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0, 2.25, 2.5] },
    { id: 'load-sentadilla', name: 'Sentadilla con barra · carga', group: 'Piernas', category: 'strength', measure: 'bw', symbol: 'squatbar', match: '^sentadilla (con barra|trasera)', thresholds: [0.4, 0.5, 0.65, 0.8, 0.95, 1.1, 1.25, 1.4, 1.6, 1.8, 2.0, 2.4, 2.75, 3.0, 3.5] },
    { id: 'load-peso-muerto', name: 'Peso muerto · carga', group: 'Espalda', category: 'strength', measure: 'bw', symbol: 'deadlift', match: '^peso muerto( con barra| convencional)?$', thresholds: [0.5, 0.65, 0.8, 1.0, 1.15, 1.3, 1.5, 1.7, 1.9, 2.1, 2.4, 2.8, 3.0, 3.25, 3.5] },
    { id: 'load-press-militar', name: 'Press militar · carga', group: 'Hombros', category: 'strength', measure: 'bw', symbol: 'ohp', match: '^press militar( con barra| de pie| con barra de pie)?$', thresholds: [0.2, 0.25, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.45, 1.6] }
  ];
  function loadChallengeFor(name) { const n = normalizeName(name); return LOAD_CHALLENGES.find(c => new RegExp(c.match).test(n)) || null; }

  function normalizeName(value) {
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function slug(value) { return normalizeName(value).replace(/\s+/g, '-').slice(0, 64) || 'ejercicio'; }
  function thresholdsForExercise(item = {}) {
    if (Array.isArray(item.thresholds) && (item.thresholds.length === 12 || item.thresholds.length === LEVELS) && item.thresholds.every((v, i, a) => Number.isFinite(Number(v)) && Number(v) > 0 && (i === 0 || Number(v) > Number(a[i - 1])))) return item.thresholds.map(Number);
    if (item.measure === 'seconds') return GENERIC_SECONDS_TARGETS.slice();
    if (item.measure === 'minutes') return GENERIC_MINUTE_TARGETS.slice();
    if (item.measure === 'km') return RUN_DISTANCE_TARGETS.slice();
    if (item.measure === 'days') return ACTIVE_DAY_TARGETS.slice();
    return GENERIC_REP_TARGETS.slice();
  }
  function rankForLevel(index) {
    const safe = Math.max(0, Math.min(LEVELS - 1, Math.floor(Number(index) || 0)));
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
    if (p.complete) return `Completaste los ${LEVELS} niveles de este desafío.`;
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
  // v58: figuras rellenas y con volumen, como el «Sistema de insignias» de referencia (40×40, centro 20,19.5).
  // Clases: gf = relleno; lb = extremidad gruesa; lbx = brazo musculoso; eq = equipamiento; cut/cut2 = detalle en el color de la cara.
  const GLYPHS = {
    pushup: '<path class="eq" d="M4 33.5H36"/><circle class="gf" cx="31.5" cy="15.8" r="3.4"/><path class="gf" d="M27.8 17.2 29.6 22.4 13.4 26.6 12 21.6Z"/><path class="lb" d="M26.8 20.5 27.3 31.2M13.2 24.4 5.5 31.5"/>',
    dumbbell: '<path class="lb" d="M11 20H29"/><rect class="gf" x="4.6" y="11" width="5.2" height="18" rx="1.6"/><rect class="gf" x="30.2" y="11" width="5.2" height="18" rx="1.6"/><rect class="gf" x="9.4" y="13.6" width="3.6" height="12.8" rx="1.2"/><rect class="gf" x="27" y="13.6" width="3.6" height="12.8" rx="1.2"/>',
    legs: '<path class="gf" d="M12.6 3.6H19.4L19.2 15.2C19.2 18 17.6 19.4 17.8 22.4L17.4 31.6H12.4L12.6 23.6C11.4 20.4 10.8 17.6 11.2 14.2Z"/><path class="gf" d="M27.4 3.6H20.6L20.8 15.2C20.8 18 22.4 19.4 22.2 22.4L22.6 31.6H27.6L27.4 23.6C28.6 20.4 29.2 17.6 28.8 14.2Z"/><path class="gf" d="M10.6 31.4H17.8V35.4H8.6Q8.6 32.6 10.6 31.4Z"/><path class="gf" d="M29.4 31.4H22.2V35.4H31.4Q31.4 32.6 29.4 31.4Z"/>',
    core: '<rect class="gf" x="12.4" y="9" width="6.6" height="6.6" rx="2.2"/><rect class="gf" x="21" y="9" width="6.6" height="6.6" rx="2.2"/><rect class="gf" x="12.4" y="17" width="6.6" height="6.6" rx="2.2"/><rect class="gf" x="21" y="17" width="6.6" height="6.6" rx="2.2"/><rect class="gf" x="12.4" y="25" width="6.6" height="6.6" rx="2.2"/><rect class="gf" x="21" y="25" width="6.6" height="6.6" rx="2.2"/><path class="eq" d="M9 6.5Q20 3 31 6.5"/>',
    timer: '<circle class="eq tk" cx="20" cy="21.6" r="11.2"/><path class="gf" d="M17 4.4H23V8.4H17Z"/><path class="lb" d="M20 21.6V14.6M20 21.6 25 25"/><path class="eq" d="M29.4 10.4 31.6 8.2"/>',
    heart: '<path class="gf" d="M20 33S6 24.6 6 14.6A7.4 7.4 0 0 1 20 10.6 7.4 7.4 0 0 1 34 14.6C34 24.6 20 33 20 33Z"/><path class="cut" d="M9.6 19.6H15L17.4 15 21.6 24 24 19.6H30.4"/>',
    run: '<circle class="gf" cx="25" cy="6.4" r="3.4"/><path class="gf" d="M20.4 9.6 27.6 9.8 24.8 20 18 19.4Z"/><path class="lb" d="M22.4 11.6 15.8 15.6 12.8 12.4M25.6 11.8 30.4 17 34 15.2M19.4 19.8 13.4 25.6 8.4 24M22.4 20 27.6 26.4 25 33.6"/>',
    route: '<path class="gf" d="M28 3.6A6.2 6.2 0 0 1 34.2 9.8C34.2 14.4 28 21 28 21S21.8 14.4 21.8 9.8A6.2 6.2 0 0 1 28 3.6Z"/><circle class="cut" cx="28" cy="9.8" r="2.2"/><path class="eq" d="M28 24.6H14.6A4.4 4.4 0 0 0 14.6 33.4H33"/><circle class="gf" cx="9" cy="29" r="3"/>',
    calendar: '<path class="gf" d="M8 9.6H32A2.6 2.6 0 0 1 34.6 12.2V31.6A2.6 2.6 0 0 1 32 34.2H8A2.6 2.6 0 0 1 5.4 31.6V12.2A2.6 2.6 0 0 1 8 9.6Z"/><path class="lb" d="M13 5.6V11M27 5.6V11"/><path class="cut" d="M12.4 23 18 28 28 17.4"/>',
    star: '<path class="gf" d="M20 4.4 24.6 13.8 35 15.3 27.5 22.6 29.3 33 20 28.1 10.7 33 12.5 22.6 5 15.3 15.4 13.8Z"/>',
    bench: '<path class="eq" d="M7 28.5H29M10 28.5V34M26 28.5V34M5 12.5H35"/><rect class="gf" x="6.5" y="7.5" width="3" height="10" rx="1"/><rect class="gf" x="30.5" y="7.5" width="3" height="10" rx="1"/><circle class="gf" cx="31.5" cy="24.2" r="3.1"/><path class="gf" d="M8 22.4H27.6V27H8Z"/><path class="lb" d="M23 23 22.5 13.5M15.5 23 15.8 13.5"/><path class="lb" d="M9 25 4.5 31"/>',
    pullup: '<path class="eq" d="M5 5.5H35"/><path class="lb" d="M12.5 6 15.5 14M27.5 6 24.5 14"/><circle class="gf" cx="20" cy="11.2" r="3.4"/><path class="gf" d="M14.25 14.4Q20 12.8 25.75 14.4L23.55 23.9Q20 25.099999999999998 16.45 23.9Z"/><path class="lb" d="M18 24.5 17.5 33.5M22 24.5 22.5 33.5"/>',
    dips: '<path class="eq" d="M5 18H14M26 18H35M8.5 18V34M31.5 18V34"/><circle class="gf" cx="20" cy="8.6" r="3.4"/><path class="gf" d="M14.5 12Q20 10.4 25.5 12L23.3 21.4Q20 22.599999999999998 16.7 21.4Z"/><path class="lb" d="M15.4 13 12.4 18M24.6 13 27.6 18M18 21.6 16.6 28.4 20.4 31.6M22 21.6 23.4 28.4 27 30.6"/>',
    squat: '<circle class="gf" cx="14.5" cy="8.2" r="3.4"/><path class="gf" d="M11.8 11.6 18.4 10.8 21.4 20.4 14.6 22Z"/><path class="lb" d="M18 13.6 29 15M19.6 20.8 28 23.2M28 23.2 26.2 32.6"/><path class="eq" d="M23.4 34H30.4"/>',
    squatbar: '<path class="eq" d="M5 12.2H31"/><rect class="gf" x="5" y="7.199999999999999" width="3" height="10" rx="1"/><rect class="gf" x="28" y="7.199999999999999" width="3" height="10" rx="1"/><circle class="gf" cx="16.2" cy="8.6" r="3.4"/><path class="gf" d="M12.8 12.6 19.6 12 22 21 15.2 22.4Z"/><path class="lb" d="M14.6 14.6 12 12.6M20.2 21.4 28.4 23.6M28.4 23.6 26.6 32.6"/><path class="eq" d="M23.8 34H30.8"/>',
    deadlift: '<circle class="gf" cx="25.5" cy="7.6" r="3.4"/><path class="gf" d="M22.2 10.4 28.2 11.8 21.2 20.6 15.6 18.4Z"/><path class="lb" d="M24.4 13.6 21.6 27M17.2 19.6 19.8 26.4 17.6 33.6"/><path class="eq" d="M6 28H34"/><circle class="gf" cx="8.5" cy="28" r="5"/><circle class="gf" cx="31.5" cy="28" r="5"/>',
    ohp: '<path class="eq" d="M4 4H36"/><rect class="gf" x="4.5" y="0" width="3" height="8" rx="1"/><rect class="gf" x="32.5" y="0" width="3" height="8" rx="1"/><circle class="gf" cx="20" cy="12.4" r="3.4"/><path class="gf" d="M14.25 15.8Q20 14.200000000000001 25.75 15.8L23.55 25.3Q20 26.5 16.45 25.3Z"/><path class="lb" d="M15 16.5 11.6 10.2 12.4 4.4M25 16.5 28.4 10.2 27.6 4.4M18 26 17.4 34M22 26 22.6 34"/>',
    lunge: '<circle class="gf" cx="20" cy="6.8" r="3.4"/><path class="gf" d="M14.5 10.2Q20 8.6 25.5 10.2L23.3 19.6Q20 20.8 16.7 19.6Z"/><path class="lb" d="M15.6 11.4 13.8 19M24.4 11.4 26.2 19M18.4 20 11.6 25.2 11.6 33.6M21.6 20 27.6 27 32 32.4"/>',
    calf: '<path class="lb" d="M15.5 4 15.5 17M24.5 4 24.5 17"/><ellipse class="gf" cx="15.2" cy="21" rx="3.6" ry="6"/><ellipse class="gf" cx="24.8" cy="21" rx="3.6" ry="6"/><path class="lb" d="M15.6 25 16.6 30.6M24.4 25 23.4 30.6"/><path class="eq" d="M9 34H31"/><path class="gf" d="M14 30.4 20 31.8 19.4 33.2 13.8 33Z"/><path class="gf" d="M26 30.4 20.6 31.8 21 33.2 26.4 33Z"/>',
    abs: '<rect class="gf" x="12.4" y="8" width="6.6" height="6.4" rx="2.2"/><rect class="gf" x="21" y="8" width="6.6" height="6.4" rx="2.2"/><rect class="gf" x="12.4" y="15.4" width="6.6" height="6.4" rx="2.2"/><rect class="gf" x="21" y="15.4" width="6.6" height="6.4" rx="2.2"/><rect class="gf" x="12.4" y="22.8" width="6.6" height="6.4" rx="2.2"/><rect class="gf" x="21" y="22.8" width="6.6" height="6.4" rx="2.2"/><path class="gf" d="M14 30.4 20 35.2 26 30.4Z"/>',
    plank: '<path class="eq" d="M4 33.5H36"/><circle class="gf" cx="32.2" cy="16.6" r="3.4"/><path class="gf" d="M28.6 18 29.4 23 9.6 26.6 8.8 21.8Z"/><path class="lb" d="M27.6 21.6 27.6 28.4 33 28.4M9.6 24 5 31.4"/>',
    sideplank: '<path class="eq" d="M4 34H36"/><circle class="gf" cx="9.6" cy="8.6" r="3.4"/><path class="lb" d="M11.6 12.4 31.6 30.6"/><path class="gf" d="M10.6 11.2 15.6 12.8 26 24.4 22.8 27Z"/><path class="lb" d="M11.4 13.4 11.4 24.4 15.6 24.4M14.4 11 8 5.6"/>',
    wallsit: '<path class="eq" d="M7 3V35"/><circle class="gf" cx="13.4" cy="8.6" r="3.4"/><path class="gf" d="M10 12H17L17 21.6H10Z"/><path class="lb" d="M13 21.4 24.4 21.4M24.4 21.4 24.4 32.6M16 14 21.4 17.6"/><path class="eq" d="M21.6 34H28"/>',
    balance: '<circle class="gf" cx="20" cy="6.8" r="3.4"/><path class="gf" d="M14.5 10.2Q20 8.6 25.5 10.2L23.3 19.6Q20 20.8 16.7 19.6Z"/><path class="lb" d="M15.4 11.4 8 12.6M24.6 11.4 32 12.6M18.6 20.2 18.6 33.6M21.6 20.2 28 23.6 27 30"/>',
    burpee: '<circle class="gf" cx="20" cy="7.4" r="3.4"/><path class="gf" d="M14.5 10.8Q20 9.200000000000001 25.5 10.8L23.3 20.200000000000003Q20 21.400000000000002 16.7 20.200000000000003Z"/><path class="lb" d="M15.4 11.8 10.6 3.6M24.6 11.8 29.4 3.6M18.4 20.6 15 29.6M21.6 20.6 25 29.6"/><path class="eq" d="M8 34.4H32"/>',
    jack: '<circle class="gf" cx="20" cy="7" r="3.4"/><path class="gf" d="M14.5 10.4Q20 8.8 25.5 10.4L23.3 19.8Q20 21 16.7 19.8Z"/><path class="lb" d="M15.4 11.4 8.4 5M24.6 11.4 31.6 5M18.4 20.4 11.4 32.6M21.6 20.4 28.6 32.6"/>',
    climber: '<path class="eq" d="M4 33.6H36"/><circle class="gf" cx="32.4" cy="13.6" r="3.4"/><path class="gf" d="M28.8 15.2 29.6 20.4 12.6 24.8 11.6 19.8Z"/><path class="lb" d="M28 19 28 31M12.4 22.6 5 30M18.6 21.6 24 25.6 21.6 31"/>',
    walk: '<circle class="gf" cx="20" cy="6.4" r="3.4"/><path class="gf" d="M14.8 9.8Q20 8.200000000000001 25.2 9.8L23 19.6Q20 20.8 17 19.6Z"/><path class="lb" d="M16 11.4 13.4 19.6M24 11.4 27 18.4M18.6 20.2 15.2 33.6M21.4 20.2 25.4 33.6"/>',
    bike: '<circle class="eq" cx="10" cy="27" r="6"/><circle class="eq" cx="30" cy="27" r="6"/><path class="eq" d="M10 27 16.6 17H26.6L30 27M16.6 17 20.4 27H10"/><circle class="gf" cx="24.6" cy="6.4" r="3.1"/><path class="lb" d="M23.2 9.6 18.4 16.6M23.4 10.2 29 14.2M18.6 16.6 21 22.6"/>',
    flame: '<path class="gf" d="M20 35.4C12.6 35.4 8.4 30.4 8.4 24.6 8.4 17 15.6 13.2 15.6 4.6 20.6 7.4 23 11.6 23 16.4 24.8 14.8 26 12.4 26.2 10 30 13 31.6 18.6 31.6 23.6 31.6 30.4 27 35.4 20 35.4Z"/><path class="cut2" d="M20 33C17 33 15.2 30.8 15.2 28.2 15.2 24.8 18.2 23 18.6 19.6 21.6 21.6 24.8 24.4 24.8 28.2 24.8 31 23 33 20 33Z"/>',
    checkbell: '<path class="gf" d="M15.6 6.4H24.4A3.4 3.4 0 0 1 27.6 10.6L26.6 13.6A11.2 11.2 0 1 1 13.4 13.6L12.4 10.6A3.4 3.4 0 0 1 15.6 6.4Z"/><path class="cut" d="M15.6 9.4H24.4L23.4 12.4H16.6Z"/><path class="cut" d="M14.6 23.8 18.6 27.6 26 19.6"/>',
    biceps: '<path class="lbx" d="M6.4 28.4 23.6 28.4"/><path class="lbx" d="M25.2 27.2 27.4 10.8"/><ellipse class="gf" cx="15.6" cy="22.4" rx="8" ry="6.2" transform="rotate(-12 15.6 22.4)"/><circle class="gf" cx="27.6" cy="8.4" r="5"/><path class="cut" d="M9.6 25.2Q15 18.8 21.8 22.6M25 6.6 30 7"/>',
    triceps: '<path class="lbx" d="M17 4.6 16.6 21.4"/><path class="lbx" d="M17.6 22.4 27.6 31"/><ellipse class="gf" cx="13.8" cy="13.4" rx="4.8" ry="8.2"/><circle class="gf" cx="29.4" cy="32.6" r="4.2"/><path class="cut" d="M12.2 7.6Q10.6 13.4 13.6 19.4"/>',
    shoulders: '<circle class="gf" cx="20" cy="7" r="3.4"/><path class="gf" d="M7.4 18.4C8.6 13.6 12.4 11.6 16.4 11.4H23.6C27.6 11.6 31.4 13.6 32.6 18.4L33.4 24.4 28.4 25.4 27.6 21 26.6 33.6H13.4L12.4 21 11.6 25.4 6.6 24.4Z"/><path class="cut" d="M20 14.6V26M14.4 17.2Q17 19.4 20 18.4Q23 19.4 25.6 17.2"/>',
    glutes: '<path class="gf" d="M8 8.4H32V13.6C33.6 17.4 33.4 22.2 31.4 25.6 29.2 29.4 24.6 31.2 20.6 29.4L20 28.8 19.4 29.4C15.4 31.2 10.8 29.4 8.6 25.6 6.6 22.2 6.4 17.4 8 13.6Z"/><path class="cut" d="M20 14.4V28.4M8.6 13.4H31.4"/>',
    mobility: '<circle class="gf" cx="13.4" cy="7.4" r="3.4"/><path class="gf" d="M10.6 11 16.2 10.8 18.8 20.2 13.4 21.2Z"/><path class="lb" d="M15.8 12.4 26.4 4.6M17.4 20.4 28.6 24.6 32.4 32.4M15.6 21 9.6 29 9.6 33.4"/><path class="eq" d="M5 34.6H35"/>'
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
  // v58: emblema metálico como el «Sistema de insignias» de referencia: hexágono con borde de metal grueso y bisel,
  // cara con brillo, figura grande del ejercicio y color por rango (bronce cobre, plata acero, oro, diamante azul y
  // legendario negro con corona). Cada rango conserva un contorno propio para reconocerlo también sin color.
  const RANK_RIM = {
    bronze: hexPts(21.5),
    silver: chamfer(hexPts(21.5), 0.1),
    gold: hexPts(21.8, 24, 23, 1.02),
    diamond: hexPts(22.2, 24, 23, 1.04),
    legend: chamfer(hexPts(22, 24, 23.4, 1.04), 0.08)
  };
  const RANK_SHAPES = Object.fromEntries(Object.entries(RANK_RIM).map(([k, pts]) => [k, `<path class="ff-medal-shape" d="${pathOf(pts)}"/>`]));
  const RANK_DECOR = {
    diamond: '<path class="ff-medal-spark" d="M4.5 8v4M2.5 10h4M43.5 6v4M41.5 8h4M44 36v3M42.5 37.5h3"/>',
    legend: '<path class="ff-medal-crown" d="M15.5 4.6 18.8 7.4 21.4 2.6 24 6.6 26.6 2.6 29.2 7.4 32.5 4.6 31.2 11H16.8z"/><circle class="ff-medal-gem" cx="24" cy="8.4" r="1.3"/>'
  };
  const RIM_ID = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', diamond: 'Diamond', legend: 'Legend' };
  function medalSvg({ rankKey = 'bronze', numeral = '', glyph = 'star', locked = false, size = 48, title = '', category = '' } = {}) {
    const key = ['bronze', 'silver', 'gold', 'diamond', 'legend'].includes(rankKey) ? rankKey : 'bronze';
    const g = GLYPHS[glyph] || GLYPHS.star;
    const cat = category || (CATEGORIES.find(c => c.glyph === glyph) || {}).key || 'custom';
    const hue = CATEGORY_HUES[cat] || CATEGORY_HUES.custom;
    const level = ['I', 'II', 'III'].indexOf(numeral) + 1;
    const pips = level > 0 ? Array.from({ length: level }, (_, i) => `<circle class="ff-medal-pip" cx="${24 + (i - (level - 1) / 2) * 5}" cy="51" r="1.8"/>`).join('') : '';
    const label = title ? `<title>${String(title).replace(/[<>&"]/g, '')}</title>` : '';
    const banner = numeral && !locked ? `<path class="ff-medal-banner" d="M15 45.5h18l-2 4 2 4H15l2-4z"/><text class="ff-medal-num" x="24" y="51.2" text-anchor="middle">${numeral}</text>${pips}` : '';
    const rim = RANK_RIM[key], top = hexPts(19.6, 24, 23, rim === RANK_RIM.bronze ? 1 : 1.02), id = RIM_ID[key];
    const shine = `M${top[4][0].toFixed(1)} ${top[4][1].toFixed(1)}L${top[5][0].toFixed(1)} ${top[5][1].toFixed(1)}L${top[0][0].toFixed(1)} ${top[0][1].toFixed(1)}`;
    return `<svg class="ff-medal ff-medal--${key} ff-medal-cat--${cat}${locked ? ' is-locked' : ''}" style="--medal-hue:${hue}" width="${size}" height="${Math.round(size * 56 / 48)}" viewBox="0 0 48 56" role="${title ? 'img' : 'presentation'}"${title ? '' : ' aria-hidden="true"'}>${label}`
      + `<path class="ff-medal-drop" d="${pathOf(rim.map(([x, y]) => [x, y + 1.6]))}"/>${RANK_SHAPES[key]}`
      + `<path class="ff-medal-bevel" d="${pathOf(hexPts(18.4))}" fill="url(#ffBevel${id})"/><path class="ff-medal-inner" d="${pathOf(hexPts(16.3))}"/>`
      + `<path class="ff-medal-ring" d="${pathOf(hexPts(16.3))}"/><ellipse class="ff-medal-glow" cx="24" cy="15.5" rx="10.5" ry="5.5"/>`
      + `<path class="ff-medal-shine" d="${shine}"/><g class="ff-medal-glyph" transform="translate(24 23.4) scale(.78) translate(-20 -19.5)">${g}</g>${RANK_DECOR[key] || ''}${banner}</svg>`;
  }

  root.FittFormaBadgeEngine = Object.freeze({
    RANKS, LEVELS, CATEGORIES, CORE_EXERCISES, ACTIVITY_CHALLENGES, LOAD_CHALLENGES, GENERIC_MAX, GLYPHS, SYMBOL_BY_ID, loadChallengeFor,
    GENERIC_REP_TARGETS, GENERIC_SECONDS_TARGETS, GENERIC_MINUTE_TARGETS,
    RUN_DISTANCE_TARGETS, WALK_DISTANCE_TARGETS, BIKE_DISTANCE_TARGETS, ACTIVE_DAY_TARGETS,
    normalizeName, slug, thresholdsForExercise, rankForLevel, progressForValue, validGpsActivity,
    categoryForLibraryExercise, measureForLibraryExercise, categoryLabel, maxPlausible,
    unitLabel, formatValue, nextStepMessage, validateRecord, evidenceLabel, glyphFor, medalSvg
  });
})(typeof window !== 'undefined' ? window : globalThis);
