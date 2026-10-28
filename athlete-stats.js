/* FittForma AI v53 — estadísticas deportivas que se pueden mostrar en Comunidad, sin dependencias (navegador y Node).
 * Calcula, a partir de los registros reales de la app, solo datos de ENTRENAMIENTO: nivel elegido, nivel de XP,
 * rango general del Mapa de avances, insignias, constancia y running de los últimos 30 días y la mejor serie de
 * cuatro ejercicios de peso corporal. Nunca lee ni devuelve peso corporal, altura, medidas, objetivos ni fotos.
 * Las categorías del ranking y las filas de la comparación salen de las mismas definiciones, para que la app,
 * el servidor (supabase/migrations/2026-10-27_v53_athlete_community.sql) y la documentación digan lo mismo.
 */
(function (root) {
  'use strict';

  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const LEVELS = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' };
  const XP_PER_LEVEL = 300;
  const RUN_RE = /correr|carrera|running|\brun\b/i;
  const WINDOW_DAYS = 30;

  // Ejercicios con una sola definición: mismo movimiento, sin lastre, misma unidad.
  const EXERCISES = {
    pushups: { names: ['flexiones clasicas', 'flexiones', 'push-ups', 'push ups'], measure: 'reps', column: 'best_pushups', max: 300 },
    pullups: { names: ['dominadas', 'pull-ups', 'pull ups'], measure: 'reps', column: 'best_pullups', max: 120 },
    squats: { names: ['sentadilla al aire', 'sentadillas', 'sentadilla', 'sentadillas al aire'], measure: 'reps', column: 'best_air_squats', max: 1000 },
    plank: { names: ['plancha frontal', 'plancha', 'plancha con apoyo de antebrazos'], measure: 'seconds', column: 'best_plank_seconds', max: 7200 }
  };

  const CATEGORIES = [
    { key: 'rank', label: 'Rango general', unit: '', period: 'Todo tu historial',
      measures: 'El rango del Mapa de avances: la mediana de series efectivas de tus 20 músculos (de Bronce a Leyenda).',
      order: 'Del rango más alto al más bajo; a igual rango, primero quien tiene más músculos con rango.' },
    { key: 'constancy', label: 'Constancia', unit: 'días', period: 'Últimos 30 días',
      measures: 'Días distintos con al menos un entrenamiento o una actividad completada.',
      order: 'De más a menos días activos. Solo cuentan datos actualizados en los últimos 3 días.' },
    { key: 'badges', label: 'Insignias', unit: 'insignias', period: 'Histórico',
      measures: 'Desafíos distintos en los que conseguiste al menos una insignia.',
      order: 'De más a menos desafíos con insignia.' },
    { key: 'level', label: 'Nivel de XP', unit: 'nivel', period: 'Histórico',
      measures: 'Nivel de experiencia de la app: 300 XP por nivel, sumados por entrenamientos, actividades, insignias y hábitos.',
      order: 'Del nivel más alto al más bajo.' },
    { key: 'running', label: 'Running', unit: 'km', period: 'Últimos 30 días',
      measures: 'Kilómetros corridos registrados en la app (manual o con GPS). Se descartan registros con un ritmo imposible.',
      order: 'De más a menos kilómetros. Solo cuentan datos actualizados en los últimos 3 días.' },
    { key: 'pushups', label: 'Flexiones', unit: 'rep', period: 'Mejor marca',
      measures: 'Más repeticiones en una serie completada de «Flexiones clásicas», sin peso extra.',
      order: 'De más a menos repeticiones.' },
    { key: 'pullups', label: 'Dominadas', unit: 'rep', period: 'Mejor marca',
      measures: 'Más repeticiones en una serie completada de «Dominadas», sin asistencia ni peso extra.',
      order: 'De más a menos repeticiones.' },
    { key: 'squats', label: 'Sentadillas', unit: 'rep', period: 'Mejor marca',
      measures: 'Más repeticiones en una serie completada de «Sentadilla al aire», sin peso.',
      order: 'De más a menos repeticiones.' },
    { key: 'plank', label: 'Plancha', unit: 's', period: 'Mejor marca',
      measures: 'Mayor tiempo en una serie completada de «Plancha frontal».',
      order: 'De más a menos segundos.' }
  ];

  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // Lunes de la semana de «today» (AAAA-MM-DD).
  function weekStart(today) {
    const d = new Date(String(today) + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return dayKey(d);
  }
  function windowStart(today) {
    const d = new Date(String(today) + 'T12:00:00');
    d.setDate(d.getDate() - (WINDOW_DAYS - 1));
    return dayKey(d);
  }
  const num = v => { const n = Number.parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '').slice(0, 10));

  // Una carrera cuenta si tiene distancia, duración y un ritmo humano (2,5 min/km o más lento) y no supera 150 km.
  function plausibleRun(a) {
    const km = num(a && a.distance), min = num(a && a.minutes);
    return km > 0 && km <= 150 && min >= km * 2.5;
  }

  function exerciseKey(name, canonical) {
    const c = norm(typeof canonical === 'function' ? canonical(name) : name), raw = norm(name);
    for (const [key, def] of Object.entries(EXERCISES)) if (def.names.includes(c) || def.names.includes(raw)) return key;
    return null;
  }

  function bestSets(sessions, canonical) {
    const best = { pushups: 0, pullups: 0, squats: 0, plank: 0 };
    for (const s of Array.isArray(sessions) ? sessions : []) {
      if (!s || (s.status && s.status !== 'completed' && s.status !== 'partial')) continue; // series hechas, como el Mapa de avances
      for (const ex of Array.isArray(s && s.exercises) ? s.exercises : []) {
        const key = exerciseKey(ex && ex.name, canonical); if (!key) continue;
        const def = EXERCISES[key];
        for (const e of Array.isArray(ex.entries) ? ex.entries : []) {
          if (!e || e.done === false) continue;
          if (def.measure === 'reps' && num(e.weight) > 0) continue; // con lastre no es la misma marca
          const v = Math.floor(num(e.reps));
          if (v > best[key]) best[key] = Math.min(v, def.max);
        }
      }
    }
    return best;
  }

  /**
   * @param {object} input
   *  sessions, activities: registros de la app; badges: lista de FittFormaShareableBadges();
   *  xp: XP total; trainingLevel: perfil.level; muscle: {overall, ranked} del Mapa de avances;
   *  today: 'AAAA-MM-DD'; canonical: función de nombres canónicos de la biblioteca.
   * @returns fila lista para community_athlete_stats (sin user_id ni stats_public).
   */
  function compute(input) {
    const o = input || {};
    const today = validDate(o.today) ? String(o.today).slice(0, 10) : dayKey(new Date());
    const start = windowStart(today);
    const inWindow = d => validDate(d) && String(d).slice(0, 10) >= start && String(d).slice(0, 10) <= today;
    const sessions = (Array.isArray(o.sessions) ? o.sessions : []).filter(s => s && (!s.status || s.status === 'completed'));
    const activities = (Array.isArray(o.activities) ? o.activities : []).filter(a => a && validDate(a.date));
    // v54: semana actual, de lunes a hoy (la misma semana que fija el servidor con date_trunc('week')).
    const wStart = weekStart(today), inWeek = d => inWindow(d) && String(d).slice(0, 10) >= wStart;
    const days = new Set(), wDays = new Set(); let w30 = 0, wCount = 0, wKm = 0;
    for (const s of sessions) if (inWindow(s.date)) { w30++; days.add(String(s.date).slice(0, 10)); if (inWeek(s.date)) { wCount++; wDays.add(String(s.date).slice(0, 10)); } }
    let runs = 0, km = 0, minutes = 0;
    for (const a of activities) {
      if (!inWindow(a.date)) continue;
      w30++; days.add(String(a.date).slice(0, 10));
      const week = inWeek(a.date); if (week) { wCount++; wDays.add(String(a.date).slice(0, 10)); }
      if (RUN_RE.test(String(a.type || '')) && plausibleRun(a)) { runs++; km += num(a.distance); minutes += num(a.minutes); if (week) wKm += num(a.distance); }
    }
    const best = bestSets(o.sessions, o.canonical);
    const badges = (Array.isArray(o.badges) ? o.badges : []).map(b => b && b.payload ? b.payload : b).filter(b => b && b.exerciseName)
      .sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0))
      .slice(0, 60)
      .map(b => ({
        exerciseId: String(b.exerciseId || '').slice(0, 80), exerciseName: String(b.exerciseName).slice(0, 72),
        category: String(b.category || '').replace(/[^a-z]/g, '').slice(0, 20), rank: String(b.rank || '').slice(0, 20),
        level: clamp(Math.round(Number(b.level) || 1), 1, 15), measure: String(b.measure || 'reps').slice(0, 12),
        evidence: ['gps_device', 'session', 'declared'].includes(b.evidence) ? b.evidence : 'declared',
        earnedAt: validDate(b.earnedAt) ? String(b.earnedAt).slice(0, 10) : null
      }));
    const total = sessions.length + activities.length;
    const workouts30 = clamp(w30, 0, 180);
    const kmR = Math.round(km * 100) / 100;
    return {
      training_level: LEVELS[o.trainingLevel] ? o.trainingLevel : null,
      xp_level: clamp(Math.floor((Number(o.xp) || 0) / XP_PER_LEVEL) + 1, 1, 2000),
      overall_rank: clamp(Number.isInteger(o.muscle && o.muscle.overall) ? o.muscle.overall : -1, -1, 8),
      ranked_muscles: clamp(Number(o.muscle && o.muscle.ranked) || 0, 0, 20),
      badges_count: clamp(Array.isArray(o.badges) ? o.badges.length : 0, 0, 1000),
      badges,
      workouts_total: clamp(Math.max(total, workouts30), 0, 100000),
      workouts_30d: workouts30,
      active_days_30d: Math.min(days.size, 30, workouts30),
      run_count_30d: Math.min(runs, 120, workouts30),
      run_km_30d: Math.min(kmR, 1500, Math.min(runs, 120) * 150),
      run_minutes_30d: clamp(Math.ceil(minutes), 0, 20000),
      best_pushups: best.pushups, best_pullups: best.pullups, best_air_squats: best.squats, best_plank_seconds: best.plank,
      muscle_ranks: muscleRanks(o.muscle && o.muscle.byMuscle),
      ...weekFields(),
      stats_date: today
    };
    function weekFields() {
      const workoutsWeek = Math.min(wCount, 60, workouts30), activeWeek = Math.min(wDays.size, 7, workoutsWeek, Math.min(days.size, 30, workouts30));
      return { workouts_week: workoutsWeek, active_days_week: activeWeek, run_km_week: Math.min(Math.round(wKm * 100) / 100, 500, Math.min(kmR, 1500, Math.min(runs, 120) * 150)) };
    }
  }

  // v53.1: rango de cada músculo del Mapa de avances (-1 a 8), para el mapa del perfil. Sin datos corporales.
  function muscleRanks(map) {
    const out = {};
    if (!map || typeof map !== 'object') return out;
    for (const [k, v] of Object.entries(map).slice(0, 30)) {
      const n = Number(v);
      if (/^[a-z_]{2,30}$/.test(k) && Number.isInteger(n)) out[k] = clamp(n, -1, 8);
    }
    return out;
  }

  // Valor de una categoría del ranking para una fila de estadísticas (mismo criterio que el servidor).
  function categoryValue(key, s) {
    if (!s) return null;
    const v = { rank: s.overall_rank, constancy: s.active_days_30d, badges: s.badges_count, level: s.xp_level, running: s.run_km_30d,
      pushups: s.best_pushups, pullups: s.best_pullups, squats: s.best_air_squats, plank: s.best_plank_seconds }[key];
    return v == null ? null : Number(v);
  }

  // Filas de «Tu progreso» vs. «Progreso de tu amigo»: la misma métrica, la misma unidad y el mismo período.
  // null = «Sin datos disponibles» (no se estima nada). Las de 30 días exigen datos frescos de cada lado.
  const COMPARE = [
    { key: 'training_level', label: 'Nivel de entrenamiento', kind: 'text', period: 'Elegido por cada persona' },
    { key: 'overall_rank', label: 'Rango general', kind: 'rank', period: 'Todo el historial' },
    { key: 'xp_level', label: 'Nivel de XP', kind: 'num', unit: '', period: 'Histórico' },
    { key: 'badges_count', label: 'Insignias', kind: 'num', unit: '', period: 'Histórico' },
    { key: 'active_days_30d', label: 'Días activos', kind: 'num', unit: 'días', period: 'Últimos 30 días', fresh: true },
    { key: 'workouts_30d', label: 'Entrenamientos y actividades', kind: 'num', unit: '', period: 'Últimos 30 días', fresh: true },
    { key: 'run_km_30d', label: 'Distancia corriendo', kind: 'num', unit: 'km', period: 'Últimos 30 días', fresh: true, zeroIsMissing: true },
    { key: 'run_minutes_30d', label: 'Tiempo corriendo', kind: 'num', unit: 'min', period: 'Últimos 30 días', fresh: true, zeroIsMissing: true },
    { key: 'best_pushups', label: 'Flexiones clásicas', kind: 'num', unit: 'rep', period: 'Mejor serie', zeroIsMissing: true },
    { key: 'best_pullups', label: 'Dominadas', kind: 'num', unit: 'rep', period: 'Mejor serie', zeroIsMissing: true },
    { key: 'best_air_squats', label: 'Sentadilla al aire', kind: 'num', unit: 'rep', period: 'Mejor serie', zeroIsMissing: true },
    { key: 'best_plank_seconds', label: 'Plancha frontal', kind: 'num', unit: 's', period: 'Mejor serie', zeroIsMissing: true }
  ];
  function side(row, def) {
    if (!row || row.stats_visible === false) return null;
    if (def.fresh && row.stats_fresh === false) return null;
    const v = row[def.key];
    if (v == null || v === '') return null;
    if (def.kind === 'text') return LEVELS[v] ? v : null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (def.kind === 'rank') return n >= 0 ? n : null;
    if (def.zeroIsMissing && n <= 0) return null;
    return n;
  }
  function compare(mine, theirs) {
    return COMPARE.map(def => {
      const a = side(mine, def), b = side(theirs, def);
      const both = a != null && b != null && def.kind !== 'text';
      return { ...def, mine: a, theirs: b, diff: both ? Math.round((a - b) * 100) / 100 : null };
    });
  }

  const api = { CATEGORIES, EXERCISES, LEVELS, COMPARE, XP_PER_LEVEL, compute, muscleRanks, weekStart, compare, categoryValue, exerciseKey, plausibleRun, windowStart };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FittFormaAthleteStats = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
