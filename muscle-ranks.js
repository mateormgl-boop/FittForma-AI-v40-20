/* FittForma AI v52 — rangos por músculo («Mapa de avances»). Sin dependencias (navegador y Node).
 * Cada serie completada suma a los músculos del ejercicio: 1 al principal y 0,5 a cada secundario.
 * La suma acumulada (series efectivas) define el rango de cada músculo, de Hierro a Leyenda.
 * El rango general es el del músculo «mediano»: para subirlo hay que entrenar todo el cuerpo, no solo un grupo.
 * El equilibrio (0–100) mide qué tan parejos están los músculos entre sí.
 */
(function (root) {
  'use strict';
  const RANKS = [
    { key: 'hierro', name: 'Hierro', min: 1, color: '#9aa3ad', glow: '#c9d1d9' },
    { key: 'bronce', name: 'Bronce', min: 10, color: '#c98a5a', glow: '#f0b384' },
    { key: 'plata', name: 'Plata', min: 25, color: '#c7d3e0', glow: '#ffffff' },
    { key: 'oro', name: 'Oro', min: 50, color: '#f2b631', glow: '#ffe08a' },
    { key: 'rubi', name: 'Rubí', min: 90, color: '#e8384f', glow: '#ff8a9a' },
    { key: 'esmeralda', name: 'Esmeralda', min: 150, color: '#2fbf71', glow: '#8ef0b8' },
    { key: 'diamante', name: 'Diamante', min: 240, color: '#5fb8ff', glow: '#c4e6ff' },
    { key: 'campeon', name: 'Campeón', min: 360, color: '#9b5cf6', glow: '#d2b8ff' },
    { key: 'leyenda', name: 'Leyenda', min: 520, color: '#1f8bff', glow: '#ffd66b' },
  ];
  // Los 20 músculos del mapa (mismos identificadores que anatomy.js).
  const MUSCLES = ['pectorales', 'deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior', 'biceps', 'triceps', 'antebrazos', 'abdominales', 'oblicuos', 'trapecio',
    'espalda_media', 'dorsales', 'lumbares', 'gluteos', 'gluteo_medio', 'cuadriceps', 'aductores', 'isquiotibiales', 'gemelos', 'tibiales'];
  // Respaldo para ejercicios propios sin ficha: según su grupo.
  const GROUP_MUSCLES = {
    Piernas: [['cuadriceps', 'isquiotibiales', 'gluteos'], ['gemelos', 'aductores']], Glúteos: [['gluteos'], ['isquiotibiales', 'gluteo_medio']],
    Pecho: [['pectorales'], ['triceps', 'deltoides_anterior']], Espalda: [['dorsales', 'espalda_media'], ['biceps', 'deltoides_posterior']],
    Hombros: [['deltoides_anterior', 'deltoides_lateral'], ['triceps', 'trapecio']], Brazos: [['biceps', 'triceps'], ['antebrazos']],
    Core: [['abdominales'], ['oblicuos', 'lumbares']],
  };

  function rankFor(score) {
    let r = -1;
    for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i].min) r = i;
    return r; // -1 = sin rango todavía
  }
  // Progreso (0–1) hacia el rango siguiente y cuánto falta.
  function nextStep(score) {
    const i = rankFor(score), next = RANKS[i + 1];
    if (!next) return { next: null, missing: 0, pct: 1 };
    const from = i < 0 ? 0 : RANKS[i].min;
    return { next, missing: Math.max(0, Math.ceil((next.min - score) * 2) / 2), pct: Math.max(0, Math.min(1, (score - from) / (next.min - from))) };
  }

  // Series que cuentan: las marcadas como hechas; en sesiones viejas sin la marca «hecha», las que tienen repeticiones.
  function countedSets(exercise) {
    const entries = Array.isArray(exercise?.entries) ? exercise.entries : [];
    if (entries.some(e => e && typeof e.done === 'boolean')) return entries.filter(e => e && e.done === true).length;
    if (entries.length) return entries.filter(e => Number(String(e?.reps ?? '').replace(',', '.')) > 0).length;
    const n = Number(exercise?.completedSets ?? exercise?.sets);
    return Number.isFinite(n) && n > 0 && exercise?.done ? Math.min(20, n) : 0;
  }

  /**
   * sessions: historial de la app. musclesOf(nombre, grupo) → { primary: [...], secondary: [...] }.
   * until (AAAA-MM-DD, opcional): solo cuenta sesiones hasta esa fecha (para el «antes»).
   */
  function compute(sessions, musclesOf, until) {
    const score = Object.fromEntries(MUSCLES.map(m => [m, 0]));
    for (const s of Array.isArray(sessions) ? sessions : []) {
      if (!s || (s.status && s.status !== 'completed' && s.status !== 'partial')) continue;
      if (until && String(s.date || '') > until) continue;
      for (const ex of Array.isArray(s.exercises) ? s.exercises : []) {
        const sets = countedSets(ex); if (!sets) continue;
        const mm = musclesOf(ex?.name, ex?.group) || {};
        const prim = (mm.primary || []).filter(m => m in score), sec = (mm.secondary || []).filter(m => m in score && !prim.includes(m));
        for (const m of prim) score[m] += sets;
        for (const m of sec) score[m] += sets * 0.5;
      }
    }
    const muscles = MUSCLES.map(id => ({ id, score: Math.round(score[id] * 10) / 10, rank: rankFor(score[id]) }));
    const sorted = muscles.map(m => m.score).sort((a, b) => a - b);
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const total = sorted.reduce((a, b) => a + b, 0), mean = total / sorted.length;
    // Equilibrio: 100 = todos los músculos con el mismo trabajo; baja cuanto más dispares son (coeficiente de variación).
    const sd = Math.sqrt(sorted.reduce((a, v) => a + (v - mean) ** 2, 0) / sorted.length);
    const balance = total ? Math.max(0, Math.round(100 - Math.min(100, (sd / (mean || 1)) * 60))) : 0;
    const overall = rankFor(median);
    const weakest = muscles.slice().sort((a, b) => a.score - b.score).slice(0, 3);
    return { muscles, byId: Object.fromEntries(muscles.map(m => [m.id, m])), overall, median, total: Math.round(total * 10) / 10, balance, weakest, ranked: muscles.filter(m => m.rank >= 0).length };
  }

  // Músculos que subieron de rango entre dos cálculos (para avisar al guardar un entrenamiento).
  function rankUps(before, after) {
    return after.muscles.filter(m => m.rank > (before.byId[m.id]?.rank ?? -1)).map(m => ({ id: m.id, rank: m.rank }));
  }

  // Emblema propio de cada rango (SVG): forma que se vuelve más elaborada al subir, alas desde Oro y corona desde Rubí.
  function emblemSvg(rankIndex, size = 64, title = '') {
    const r = RANKS[rankIndex];
    if (!r) return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="52" r="26" fill="none" stroke="#5b6680" stroke-width="4" stroke-dasharray="6 6"/></svg>`;
    const id = 'mr' + rankIndex + '_' + Math.random().toString(36).slice(2, 7);
    const poly = n => Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return `${(50 + 26 * Math.cos(a)).toFixed(1)},${(54 + 26 * Math.sin(a)).toFixed(1)}`; }).join(' ');
    const shapes = [
      `<polygon points="50,26 78,74 22,74"/>`,
      `<path d="M28 32h44v20c0 16-10 26-22 30-12-4-22-14-22-30z"/>`,
      `<polygon points="50,24 78,54 50,84 22,54"/>`,
      `<polygon points="${poly(5)}"/>`,
      `<polygon points="${poly(6)}"/>`,
      `<polygon points="${poly(8)}"/>`,
      `<polygon points="50,22 76,44 66,82 34,82 24,44"/>`,
      `<polygon points="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 13 : 30; return `${(50 + rr * Math.cos(a)).toFixed(1)},${(54 + rr * Math.sin(a)).toFixed(1)}`; }).join(' ')}"/>`,
      `<circle cx="50" cy="54" r="25"/>`,
    ];
    const wing = rankIndex >= 3 ? `<g fill="${r.color}" opacity=".9"><path d="M24 50c-10-2-18-8-20-16 6 3 12 4 18 3-5-3-8-7-9-12 6 5 12 7 18 8z"/><path d="M76 50c10-2 18-8 20-16-6 3-12 4-18 3 5-3 8-7 9-12-6 5-12 7-18 8z"/></g>` : '';
    const crown = rankIndex >= 4 ? `<path d="M38 22l5 6 7-9 7 9 5-6-2 12H40z" fill="#ffd66b" stroke="#a87a10" stroke-width="1"/>` : '';
    const star = `<polygon points="50,44 53,51 60,51 54.5,55.5 56.5,62.5 50,58.5 43.5,62.5 45.5,55.5 40,51 47,51" fill="#fff" opacity=".85"/>`;
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${title || 'Rango ' + r.name}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${r.glow}"/><stop offset=".55" stop-color="${r.color}"/><stop offset="1" stop-color="#0b1222"/></linearGradient></defs>${wing}<g fill="url(#${id})" stroke="${r.glow}" stroke-width="2.5" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px ${r.color})">${shapes[rankIndex]}</g>${star}${crown}</svg>`;
  }

  const api = { RANKS, MUSCLES, GROUP_MUSCLES, rankFor, nextStep, countedSets, compute, rankUps, emblemSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FittFormaMuscleRanks = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
