/* FittForma AI v51 — «Objetivo y actualidad»: cálculos corporales sin dependencias (navegador y Node).
 * Todo son referencias orientativas para adultos sanos, no indicaciones médicas:
 *  - IMC (OMS): <18,5 bajo peso · 18,5–24,9 normal · 25–29,9 sobrepeso · ≥30 obesidad. En menores de 18 no se clasifica.
 *  - Cintura/altura: por debajo de 0,5 es la referencia habitual.
 *  - Metabolismo basal: Mifflin-St Jeor (+5 hombre, −161 mujer). Sin sexo indicado se usa el promedio (−78) y se avisa.
 *    Con % de grasa se usa Katch-McArdle (370 + 21,6 × masa magra).
 *  - Gasto diario: basal × factor de actividad (1,2 · 1,375 · 1,55 · 1,725).
 *  - Cambio de peso: ~7700 kcal por kg. El déficit se limita al 25 % del gasto y nunca baja de 1200 kcal (1500 hombre);
 *    el superávit se limita a 500 kcal.
 *  - Proteína: 1,8 g/kg para bajar o subir, 1,4 g/kg para mantener (con IMC ≥30 se usa el peso de IMC 25).
 *  - Agua: 30–35 ml por kg (se usa el punto medio redondeado a 50 ml).
 */
(function (root) {
  'use strict';
  const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null; };
  const round = (v, step = 1) => Math.round(v / step) * step;
  const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
  const KCAL_PER_KG = 7700;

  function bmi(weightKg, heightCm) {
    const w = num(weightKg), h = num(heightCm);
    if (!w || !h || w < 25 || w > 350 || h < 100 || h > 250) return null;
    return Math.round(w / ((h / 100) ** 2) * 10) / 10;
  }
  function bmiCategory(value, age) {
    if (value == null) return null;
    const a = num(age);
    if (a != null && a < 18) return { key: 'minor', label: 'En menores de 18 años el IMC se interpreta con tablas por edad' };
    if (value < 18.5) return { key: 'under', label: 'Bajo peso' };
    if (value < 25) return { key: 'normal', label: 'Rango normal' };
    if (value < 30) return { key: 'over', label: 'Sobrepeso' };
    return { key: 'obese', label: 'Obesidad' };
  }
  function waistToHeight(waistCm, heightCm) {
    const w = num(waistCm), h = num(heightCm);
    if (!w || !h || w < 40 || w > 250 || h < 100 || h > 250) return null;
    const ratio = Math.round(w / h * 100) / 100;
    return { ratio, ok: ratio < 0.5 };
  }
  function bmr({ sex = '', weightKg, heightCm, age, bodyFatPct } = {}) {
    const w = num(weightKg), h = num(heightCm), a = num(age), bf = num(bodyFatPct);
    if (!w || w < 25 || w > 350) return null;
    if (bf != null && bf >= 3 && bf <= 60) return { kcal: round(370 + 21.6 * w * (1 - bf / 100), 10), method: 'katch', approximate: false };
    if (!h || !a || h < 100 || h > 250 || a < 13 || a > 100) return null;
    const base = 10 * w + 6.25 * h - 5 * a;
    const s = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
    return { kcal: round(base + s, 10), method: 'mifflin', approximate: sex !== 'male' && sex !== 'female' };
  }
  function tdee(bmrKcal, activityLevel) {
    if (!bmrKcal) return null;
    return round(bmrKcal * (ACTIVITY[activityLevel] || ACTIVITY.light), 10);
  }
  function goalDirection(goal, currentKg, targetKg) {
    if (goal === 'lose' || goal === 'maintain' || goal === 'gain') return goal;
    const c = num(currentKg), t = num(targetKg);
    if (c == null || t == null) return 'maintain';
    return t < c - 0.3 ? 'lose' : t > c + 0.3 ? 'gain' : 'maintain';
  }
  function addDays(dateKey, days) { const d = new Date(dateKey + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + Math.round(days)); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }

  /**
   * Resumen completo a partir del perfil. today = 'AAAA-MM-DD'. Devuelve valores en null cuando faltan datos (nunca inventa).
   */
  function summary(profile = {}, today = new Date().toISOString().slice(0, 10)) {
    const p = profile || {};
    const weight = num(p.currentWeightKg), height = num(p.heightCm), age = num(p.age), target = num(p.targetWeightKg);
    const out = { missing: [], warnings: [] };
    if (weight == null) out.missing.push('peso'); if (height == null) out.missing.push('altura'); if (age == null) out.missing.push('edad');
    out.bmi = bmi(weight, height); out.bmiCategory = bmiCategory(out.bmi, age);
    out.waist = waistToHeight(p.waistCm, height);
    out.bmr = bmr({ sex: p.sex, weightKg: weight, heightCm: height, age, bodyFatPct: p.bodyFatPct });
    out.tdee = out.bmr ? tdee(out.bmr.kcal, p.activityLevel) : null;
    out.direction = goalDirection(p.bodyGoal, weight, target);
    out.minor = age != null && age < 18;
    if (out.minor) out.warnings.push('Para menores de 18 años no calculamos calorías ni ritmos de cambio de peso: pedí orientación profesional.');
    // Ritmo: el elegido, o el necesario para llegar en la fecha indicada.
    let rate = num(p.weeklyRateKg);
    const diff = weight != null && target != null ? Math.round((target - weight) * 10) / 10 : null;
    out.diffKg = diff;
    if (diff != null && out.direction !== 'maintain' && Math.sign(diff) !== (out.direction === 'lose' ? -1 : 1) && Math.abs(diff) > 0.3)
      out.warnings.push(out.direction === 'lose' ? 'Tu meta de peso es mayor que tu peso actual, pero elegiste bajar.' : 'Tu meta de peso es menor que tu peso actual, pero elegiste subir.');
    if (p.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(p.targetDate) && diff != null && Math.abs(diff) > 0.3) {
      const days = daysBetween(today, p.targetDate);
      if (days > 0) { out.requiredRateKg = Math.round(Math.abs(diff) / (days / 7) * 100) / 100; if (rate == null) rate = out.requiredRateKg; }
      else out.warnings.push('La fecha objetivo ya pasó: elegí una fecha futura.');
    }
    if (out.direction === 'maintain') rate = 0;
    else if (rate == null) rate = out.direction === 'lose' ? 0.5 : 0.25;
    out.weeklyRateKg = rate;
    if (weight != null && out.direction === 'lose' && rate > weight * 0.01) out.warnings.push(`Bajar más de ~1 % de tu peso por semana (${(Math.round(weight * 0.01 * 10) / 10).toString().replace('.', ',')} kg) es agresivo y difícil de sostener.`);
    if (out.direction === 'gain' && rate > 0.5) out.warnings.push('Subir más de 0,5 kg por semana suele sumar más grasa que músculo.');
    if (target != null && height != null) { const tb = bmi(target, height); if (tb != null && tb < 18.5 && !out.minor) out.warnings.push('Tu meta queda por debajo de un IMC de 18,5; conviene revisarla con un profesional.'); out.targetBmi = tb; }
    // Calorías sugeridas
    if (out.tdee && !out.minor) {
      const floor = p.sex === 'male' ? 1500 : 1200;
      let delta = rate * KCAL_PER_KG / 7;
      if (out.direction === 'lose') delta = -Math.min(delta, out.tdee * 0.25);
      else if (out.direction === 'gain') delta = Math.min(delta, 500);
      else delta = 0;
      out.calories = round(Math.max(floor, Math.min(4500, out.tdee + delta)), 50);
      out.dailyDeltaKcal = out.calories - out.tdee;
      out.calorieFloorApplied = out.tdee + delta < floor;
      // Ritmo real con las calorías finales (puede ser menor por los límites).
      out.effectiveRateKg = Math.round(Math.abs(out.dailyDeltaKcal) * 7 / KCAL_PER_KG * 100) / 100;
    } else { out.calories = null; out.effectiveRateKg = out.direction === 'maintain' ? 0 : rate; }
    // Proteína y agua
    if (weight != null) {
      const ref = out.bmi != null && out.bmi >= 30 && height ? 25 * (height / 100) ** 2 : weight;
      out.proteinG = round(ref * (out.direction === 'maintain' ? 1.4 : 1.8), 5);
      out.waterMl = Math.min(4500, round(weight * 32.5, 50));
    } else { out.proteinG = null; out.waterMl = null; }
    // Fecha estimada
    if (diff != null && Math.abs(diff) > 0.3 && out.direction !== 'maintain' && !out.minor) {
      const r = out.calories ? out.effectiveRateKg : rate;
      if (r > 0) { out.weeksToGoal = Math.ceil(Math.abs(diff) / r); out.etaDate = addDays(today, out.weeksToGoal * 7); }
    }
    return out;
  }
  // Progreso hacia la meta: desde el primer peso registrado (o el actual) hasta la meta. 0–100.
  function goalProgress(startKg, currentKg, targetKg) {
    const s = num(startKg), c = num(currentKg), t = num(targetKg);
    if (s == null || c == null || t == null || Math.abs(t - s) < 0.1) return null;
    return Math.max(0, Math.min(100, Math.round((s - c) / (s - t) * 100)));
  }
  const api = { ACTIVITY, bmi, bmiCategory, waistToHeight, bmr, tdee, goalDirection, summary, goalProgress, addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FittFormaBody = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
