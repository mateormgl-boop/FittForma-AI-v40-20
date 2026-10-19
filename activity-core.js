/* FittForma AI v50 — núcleo de actividades al aire libre y gasto energético estimado (sin dependencias).
 * Navegador y Node (node --test). Todas las cifras son ESTIMACIONES, nunca mediciones.
 *
 * Métodos (documentados en docs/CALORIAS.md):
 *  - Caminar: ecuación metabólica de la ACSM para caminar  VO2 = 3,5 + 0,1·v + 1,8·v·pendiente  (v en m/min).
 *  - Correr:  ecuación metabólica de la ACSM para correr    VO2 = 3,5 + 0,2·v + 0,9·v·pendiente.
 *    (ACSM's Guidelines for Exercise Testing and Prescription). kcal = VO2 (ml/kg/min) × kg × min / 1000 × 5.
 *  - Bicicleta: MET según la velocidad media, Compendio de Actividades Físicas (Ainsworth et al., 2011, códigos 01010–01070).
 *  - Fuerza: MET 3,5 del Compendio 2011 (código 02054, entrenamiento con pesas, esfuerzo moderado).
 *  kcal = MET × kg × horas. El gasto «neto» descuenta el reposo (1 MET o 3,5 ml/kg/min) para no contarlo dos veces.
 *  La pendiente solo se usa si hay desnivel medido con buena precisión; la frecuencia cardíaca no se usa porque la app
 *  no recibe datos de ningún sensor.
 */
(function (root) {
  'use strict';

  const TYPES = ['Correr', 'Caminar', 'Bicicleta'];
  const kindOf = type => {
    const t = String(type || '').toLowerCase();
    if (/bici|cicl|bike/.test(t)) return 'Bicicleta';
    if (/camin|walk|marcha/.test(t)) return 'Caminar';
    if (/corr|carrera|run|trote/.test(t)) return 'Correr';
    return null;
  };
  // Límites de velocidad plausibles (m/s) para descartar saltos de GPS.
  const MAX_SPEED = { Correr: 8, Caminar: 3.2, Bicicleta: 22 };
  // Por debajo de esta velocidad (m/s) se considera detenido para el «tiempo en movimiento».
  const MOVING_SPEED = { Correr: 0.8, Caminar: 0.45, Bicicleta: 1.2 };

  const validWeight = w => { const n = Number(w); return Number.isFinite(n) && n >= 30 && n <= 300 ? n : null; };
  const round = (n, d = 0) => { const k = 10 ** d; return Math.round(n * k) / k; };

  // MET de bicicleta por velocidad media (km/h), Compendio 2011.
  function cyclingMet(kmh) {
    if (kmh < 16) return { met: 4.0, code: '01010', label: 'menos de 16 km/h, ritmo de paseo' };
    if (kmh < 19.3) return { met: 6.8, code: '01020', label: '16 a 19 km/h, esfuerzo leve' };
    if (kmh < 22.5) return { met: 8.0, code: '01030', label: '19 a 22 km/h, esfuerzo moderado' };
    if (kmh < 25.7) return { met: 10.0, code: '01040', label: '22 a 25 km/h, esfuerzo vigoroso' };
    if (kmh < 30.6) return { met: 12.0, code: '01050', label: '26 a 30 km/h, muy vigoroso' };
    return { met: 15.8, code: '01060', label: 'más de 30 km/h, competitivo' };
  }

  /**
   * Estima el gasto energético de una actividad.
   * @param {object} a { type, distanceKm, minutes, movingMinutes?, weightKg, elevationGainM? }
   * @returns {object} { kcal, netKcal, method, detail, approximate, notes[], inputs } o { kcal:null, reason }
   */
  function estimateActivityCalories(a = {}) {
    const type = kindOf(a.type);
    const kg = validWeight(a.weightKg);
    if (!type) return { kcal: null, reason: 'tipo' };
    if (!kg) return { kcal: null, reason: 'peso' };
    const total = Number(a.minutes), moving = Number(a.movingMinutes);
    const minutes = Number.isFinite(moving) && moving > 0 ? moving : total;
    const km = Number(a.distanceKm);
    if (!(minutes > 0) || !(km > 0)) return { kcal: null, reason: 'datos' };
    const notes = [];
    let approximate = false;
    if (!(Number.isFinite(moving) && moving > 0)) { approximate = true; notes.push('Se usó el tiempo total porque no hay tiempo en movimiento.'); }
    const mPerMin = km * 1000 / minutes, kmh = km / (minutes / 60);
    if (type === 'Bicicleta') {
      const m = cyclingMet(kmh);
      const kcal = m.met * kg * minutes / 60, net = (m.met - 1) * kg * minutes / 60;
      return { kcal: round(kcal), netKcal: round(net), method: 'compendio-2011-bicicleta', detail: `MET ${m.met} (${m.label}, Compendio 2011 código ${m.code})`, approximate, notes, inputs: { weightKg: kg, minutes: round(minutes, 1), distanceKm: round(km, 3), speedKmh: round(kmh, 1), met: m.met } };
    }
    let grade = 0;
    const gain = Number(a.elevationGainM);
    if (Number.isFinite(gain) && gain > 0) grade = Math.min(0.15, gain / (km * 1000));
    else notes.push('Sin desnivel medido: se calculó como terreno plano.');
    // Si «Correr» fue en realidad a paso de caminata, se usa la ecuación de caminar (y al revés).
    let eq = type === 'Correr' ? (mPerMin < 100 ? 'caminar' : 'correr') : (mPerMin > 134 ? 'correr' : 'caminar');
    if (type === 'Correr' && mPerMin >= 100 && mPerMin < 134) { approximate = true; notes.push('Trote muy suave: la ecuación de carrera es menos precisa a esta velocidad.'); }
    if (type === 'Caminar' && mPerMin > 100 && mPerMin <= 134) { approximate = true; notes.push('Caminata muy rápida: la ecuación de caminata es menos precisa por encima de 6 km/h.'); }
    if (eq !== (type === 'Correr' ? 'correr' : 'caminar')) notes.push(`La velocidad media corresponde a ${eq}; se usó esa ecuación.`);
    const vo2 = eq === 'correr' ? 3.5 + 0.2 * mPerMin + 0.9 * mPerMin * grade : 3.5 + 0.1 * mPerMin + 1.8 * mPerMin * grade;
    const kcal = vo2 * kg * minutes / 1000 * 5, net = (vo2 - 3.5) * kg * minutes / 1000 * 5;
    return { kcal: round(kcal), netKcal: round(net), method: eq === 'correr' ? 'acsm-correr' : 'acsm-caminar', detail: `Ecuación de la ACSM para ${eq} · VO₂ ${round(vo2, 1)} ml/kg/min${grade ? ` · pendiente ${round(grade * 100, 1)} %` : ''}`, approximate, notes, inputs: { weightKg: kg, minutes: round(minutes, 1), distanceKm: round(km, 3), speedKmh: round(kmh, 1), grade: round(grade, 3) } };
  }

  // Entrenamiento de fuerza: MET 3,5 × peso × duración.
  function estimateStrengthCalories({ minutes, weightKg } = {}) {
    const kg = validWeight(weightKg), min = Number(minutes);
    if (!kg) return { kcal: null, reason: 'peso' };
    if (!(min > 0)) return { kcal: null, reason: 'datos' };
    const met = 3.5;
    return { kcal: round(met * kg * min / 60), netKcal: round((met - 1) * kg * min / 60), method: 'compendio-2011-fuerza', detail: 'MET 3,5 (entrenamiento con pesas, esfuerzo moderado, Compendio 2011 código 02054)', approximate: true, notes: ['La duración incluye descansos entre series.'], inputs: { weightKg: kg, minutes: round(min, 1), met } };
  }

  // ---------- Estadísticas en vivo del GPS ----------
  function createGpsStats() { return { movingMs: 0, maxSpeed: 0, currentSpeed: 0, window: [], elevationGain: 0, lastAlt: null }; }
  /**
   * Suma un tramo válido (ya filtrado contra saltos) a las estadísticas.
   * @param stats objeto de createGpsStats()
   * @param seg { meters, seconds, at, altitude?, altitudeAccuracy? }
   */
  function addGpsSegment(stats, type, seg) {
    const kind = kindOf(type) || 'Correr', dt = Number(seg.seconds), d = Number(seg.meters);
    if (!(dt > 0) || !(d >= 0)) return stats;
    const speed = d / dt;
    if (speed >= MOVING_SPEED[kind] && speed <= MAX_SPEED[kind]) stats.movingMs += dt * 1000;
    // Velocidad actual: promedio de los últimos ~10 s para suavizar el ruido del GPS.
    stats.window.push({ d, dt, at: Number(seg.at) || 0 });
    let sumT = stats.window.reduce((s, w) => s + w.dt, 0);
    while (stats.window.length > 1 && sumT - stats.window[0].dt >= 10) { sumT -= stats.window[0].dt; stats.window.shift(); }
    const sumD = stats.window.reduce((s, w) => s + w.d, 0);
    stats.currentSpeed = sumT > 0 ? sumD / sumT : 0;
    if (sumT >= 5 && stats.currentSpeed <= MAX_SPEED[kind] && stats.currentSpeed > stats.maxSpeed) stats.maxSpeed = stats.currentSpeed;
    // Desnivel positivo solo con altitud precisa (≤ 10 m) y con histéresis de 3 m para no sumar ruido.
    const alt = Number(seg.altitude), acc = Number(seg.altitudeAccuracy);
    if (Number.isFinite(alt) && Number.isFinite(acc) && acc > 0 && acc <= 10) {
      if (stats.lastAlt == null) stats.lastAlt = alt;
      else if (alt - stats.lastAlt >= 3) { stats.elevationGain += alt - stats.lastAlt; stats.lastAlt = alt; }
      else if (stats.lastAlt - alt >= 3) stats.lastAlt = alt;
    }
    return stats;
  }
  // Una pérdida de señal reinicia la ventana de velocidad (no se calcula velocidad a través del hueco).
  function resetGpsWindow(stats) { stats.window = []; stats.currentSpeed = 0; return stats; }

  function signalQuality(accuracy) {
    const a = Number(accuracy);
    if (!Number.isFinite(a) || a <= 0) return { level: 'none', label: 'Sin señal' };
    if (a <= 10) return { level: 'good', label: 'Señal buena' };
    if (a <= 25) return { level: 'fair', label: 'Señal regular' };
    if (a <= 45) return { level: 'weak', label: 'Señal débil' };
    return { level: 'none', label: 'Señal insuficiente' };
  }

  const paceText = secPerKm => { if (!(secPerKm > 0) || !Number.isFinite(secPerKm)) return '—'; const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60); return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`; };

  // Compara una actividad con las anteriores del mismo tipo (necesita al menos 2 previas con 0,5 km o más).
  function compareWithPrevious(activity, history = []) {
    const kind = kindOf(activity?.type);
    if (!kind) return null;
    const prev = history.filter(a => a !== activity && String(a.id) !== String(activity.id) && kindOf(a.type) === kind && Number(a.distance) >= 0.5 && Number(a.minutes) > 0 && String(a.date || '') <= String(activity.date || '9999')).slice(-5);
    if (prev.length < 2) return null;
    const speed = a => Number(a.distance) / ((Number(a.movingMinutes) || Number(a.minutes)) / 60);
    const avg = prev.reduce((s, a) => s + speed(a), 0) / prev.length, now = speed(activity);
    const avgKm = prev.reduce((s, a) => s + Number(a.distance), 0) / prev.length;
    return { count: prev.length, speedDelta: round(now - avg, 1), avgSpeed: round(avg, 1), distanceDelta: round(Number(activity.distance) - avgKm, 2), avgDistance: round(avgKm, 2), faster: now > avg };
  }

  // ---------- Resúmenes por período ----------
  const startOfWeek = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; };
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function periodRange(period, now = new Date()) {
    const n = new Date(now);
    if (period === 'month') { const s = new Date(n.getFullYear(), n.getMonth(), 1), e = new Date(n.getFullYear(), n.getMonth() + 1, 0); return { from: key(s), to: key(e) }; }
    const s = startOfWeek(n), e = new Date(s); e.setDate(e.getDate() + 6); return { from: key(s), to: key(e) };
  }
  /** Suma calorías ESTIMADAS guardadas en cada registro (no recalcula con el peso actual). */
  function summarizeExpenditure({ activities = [], sessions = [] } = {}, period = 'week', now = new Date()) {
    const { from, to } = periodRange(period, now), inRange = d => { const k = String(d || '').slice(0, 10); return k >= from && k <= to; };
    const rows = { Correr: { kcal: 0, count: 0, missing: 0, km: 0 }, Caminar: { kcal: 0, count: 0, missing: 0, km: 0 }, Bicicleta: { kcal: 0, count: 0, missing: 0, km: 0 }, Fuerza: { kcal: 0, count: 0, missing: 0, km: 0 } };
    for (const a of activities) {
      const k = kindOf(a.type); if (!k || !inRange(a.date)) continue;
      const r = rows[k]; r.count++; r.km += Number(a.distance) || 0;
      if (a.calories && Number.isFinite(Number(a.calories.kcal))) r.kcal += Number(a.calories.kcal); else r.missing++;
    }
    for (const s of sessions) {
      if (s.partial || !inRange(s.date)) continue;
      const r = rows.Fuerza; r.count++;
      if (s.calories && Number.isFinite(Number(s.calories.kcal))) r.kcal += Number(s.calories.kcal); else r.missing++;
    }
    const total = Object.values(rows).reduce((s, r) => s + r.kcal, 0);
    for (const r of Object.values(rows)) { r.kcal = round(r.kcal); r.km = round(r.km, 1); }
    return { period, from, to, rows, total: round(total) };
  }

  const api = { TYPES, MAX_SPEED, MOVING_SPEED, kindOf, cyclingMet, estimateActivityCalories, estimateStrengthCalories, createGpsStats, addGpsSegment, resetGpsWindow, signalQuality, paceText, compareWithPrevious, periodRange, summarizeExpenditure };
  root.FittFormaActivity = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
