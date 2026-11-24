// Señales prudentes para FittAI, calculadas únicamente a partir de series completadas y compartidas.
const cleanName = value => typeof value === 'string'
  ? value.replace(/[<>]/g, '').trim().slice(0, 70)
  : '';

export function deriveTrainingInsights(sessions) {
  const byExercise = new Map();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const date = String(session?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const exercise of Array.isArray(session?.exercises) ? session.exercises : []) {
      const name = cleanName(exercise?.name);
      const kind = String(exercise?.kind || 'strength');
      if (!name || kind === 'cardio' || kind === 'mobility') continue;
      const entries = (Array.isArray(exercise.entries) ? exercise.entries : []).filter(entry => {
        const reps = Number(entry?.reps), weight = Number(entry?.weight || 0);
        return entry?.done === true && Number.isFinite(reps) && reps > 0 && reps <= 300 &&
          Number.isFinite(weight) && weight >= 0 && weight <= 1000;
      });
      if (!entries.length) continue;
      const weighted = entries.filter(entry => Number(entry.weight) > 0);
      // For loaded exercises, use a modest Epley estimate from valid logged sets.
      // For bodyweight exercises, use mean completed reps. These are trend signals, not max tests.
      const score = weighted.length
        ? Math.max(...weighted.map(entry => Number(entry.weight) * (1 + Math.min(Number(entry.reps), 15) / 30)))
        : entries.reduce((sum, entry) => sum + Number(entry.reps), 0) / entries.length;
      const rir = entries.map(entry => Number(entry.rir))
        .filter(value => Number.isInteger(value) && value >= 0 && value <= 5);
      const key = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (!byExercise.has(key)) byExercise.set(key, { name, records: [] });
      byExercise.get(key).records.push({
        date,
        score,
        averageRir: rir.length ? rir.reduce((a, b) => a + b, 0) / rir.length : null
      });
    }
  }

  const insights = [];
  for (const group of byExercise.values()) {
    const records = group.records.sort((a, b) => a.date.localeCompare(b.date));
    if (records.length < 2) continue;
    const first = records[0], last = records[records.length - 1];
    const changePct = first.score > 0 ? Math.round((last.score / first.score - 1) * 100) : null;
    const window = records.slice(-4);
    const spanDays = window.length >= 4
      ? (Date.parse(window.at(-1).date + 'T12:00:00Z') - Date.parse(window[0].date + 'T12:00:00Z')) / 86400000
      : 0;
    // A "plateau" hint needs 4 exposures over at least 3 weeks and a change within ±3%.
    const plateau = window.length >= 4 && spanDays >= 21 &&
      Math.abs((window.at(-1).score / window[0].score) - 1) <= 0.03;
    const recentRir = records.slice(-2).map(record => record.averageRir).filter(value => value !== null);
    insights.push({
      exercise: group.name,
      exposures: records.length,
      trend: changePct === null ? 'unknown' : changePct >= 5 ? 'improving' : changePct <= -5 ? 'declining' : 'stable',
      changePct,
      plateau,
      highEffort: recentRir.length > 0 && recentRir.every(value => value <= 1.5),
      lastDate: last.date
    });
  }
  return insights.sort((a, b) => Number(b.plateau) - Number(a.plateau) || b.exposures - a.exposures).slice(0, 8);
}
