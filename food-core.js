/* FittForma AI v50 — búsqueda de alimentos y cálculo de nutrientes por cantidad (sin dependencias, probado con node --test).
 * Fuentes: base local food-db.js (USDA SR28 + recetas estimadas) y, con conexión, productos envasados de Open Food Facts.
 */
(function (root) {
  'use strict';
  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const CATS = { frutas: 'Frutas', verduras: 'Verduras', carnes: 'Carnes', pescados: 'Pescados', huevos: 'Huevos', lacteos: 'Lácteos', cereales: 'Cereales, panes y pastas', legumbres: 'Legumbres', frutossecos: 'Frutos secos y semillas', aceites: 'Aceites y grasas', bebidas: 'Bebidas', dulces: 'Dulces y snacks', preparadas: 'Comidas preparadas', envasados: 'Productos envasados' };
  const label = f => f.variant ? `${f.name} · ${f.variant}` : f.name;

  /** Busca por nombre, variante y sinónimos. Todas las palabras deben aparecer; prioriza coincidencias al inicio. */
  function search(db, query, { cat = '', limit = 40 } = {}) {
    const q = norm(query), words = q ? q.split(' ') : [];
    const out = [];
    for (const f of db) {
      if (cat && f.cat !== cat) continue;
      const hay = norm(`${f.name} ${f.variant || ''} ${f.alias || ''} ${f.brand || ''}`);
      if (words.length && !words.every(w => hay.includes(w))) continue;
      const name = norm(f.name);
      let score = 0;
      if (q && name === q) score += 100;
      if (q && name.startsWith(q)) score += 50;
      if (q && hay.split(' ').some(t => t.startsWith(words[0]))) score += 20;
      if (!f.variant || /crud|natural|enter|comun/.test(norm(f.variant))) score += 3;
      if (f.src?.type === 'receta') score -= 2;
      if (f.src?.uy) score += 30; // productos vendidos en Uruguay primero
      out.push({ f, score });
    }
    out.sort((a, b) => b.score - a.score || label(a.f).localeCompare(label(b.f), 'es'));
    return out.slice(0, limit).map(x => x.f);
  }
  const variantsOf = (db, food) => db.filter(f => f.base === food.base && f.cat === food.cat);

  /** Unidades disponibles: gramos, mililitros (solo si hay densidad conocida) y porciones con su peso. */
  function unitsFor(food) {
    const u = [{ key: 'g', label: 'gramos (g)', g: 1 }];
    if (food.ml) u.push({ key: 'ml', label: 'mililitros (ml)', g: food.ml });
    (food.portions || []).forEach((p, i) => u.push({ key: 'p' + i, label: `${p.label} (${Math.round(p.g)} g)`, g: p.g }));
    return u;
  }
  /** Nutrientes para una cantidad. amount en la unidad elegida; devuelve también los gramos equivalentes. */
  function nutrientsFor(food, amount, unitKey = 'g') {
    const unit = unitsFor(food).find(u => u.key === unitKey) || unitsFor(food)[0];
    const qty = Math.max(0, Number(amount) || 0), grams = qty * unit.g, k = grams / 100;
    const r1 = n => Math.round(n * 10) / 10;
    return { grams: Math.round(grams * 10) / 10, kcal: Math.round((food.kcal || 0) * k), protein: r1((food.p || 0) * k), carbs: r1((food.c || 0) * k), fat: r1((food.f || 0) * k), fiber: food.fib != null ? r1(food.fib * k) : null, unit: unit.key, unitLabel: unit.label };
  }
  /** Texto de procedencia: dato verificado (USDA o etiqueta) o estimación (receta). */
  function sourceInfo(food) {
    const s = food.src || {};
    if (s.type === 'receta') return { kind: 'estimate', label: 'Estimación por receta', detail: `Calculada con ingredientes de la base USDA para ${s.yield} g de preparación. ${s.note || ''}`.trim() };
    if (s.db === 'USDA SR28') return { kind: 'verified', label: `Dato USDA SR28 · NDB ${s.ndb}`, detail: `USDA National Nutrient Database for Standard Reference 28: «${s.desc}».` };
    if (s.db === 'Open Food Facts') return { kind: 'label', label: 'Etiqueta del producto (Open Food Facts)', detail: `Valores por 100 g cargados por la comunidad desde la etiqueta${s.code ? ' · código ' + s.code : ''}. Verificá el envase.` };
    return { kind: 'user', label: 'Cargado por vos', detail: '' };
  }
  /** Convierte un producto de Open Food Facts en alimento; null si faltan calorías o proteínas por 100 g. */
  function fromOpenFoodFacts(p) {
    if (!p) return null;
    const n = p.nutriments || {}, kcal = Number(n['energy-kcal_100g']), prot = Number(n.proteins_100g);
    if (!Number.isFinite(kcal) || !Number.isFinite(prot) || kcal < 0 || kcal > 950) return null;
    const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const name = String(p.product_name || p.product_name_es || '').trim();
    if (!name) return null;
    const serving = Number(p.serving_quantity);
    return { id: 'off' + String(p.code || '').replace(/\D/g, ''), name: name.slice(0, 80), variant: '', brand: String(p.brands || '').split(',')[0].trim().slice(0, 40), base: name, cat: 'envasados', kcal: Math.round(kcal), p: num(prot), c: num(n.carbohydrates_100g), f: num(n.fat_100g), fib: Number.isFinite(Number(n.fiber_100g)) ? Number(n.fiber_100g) : null, src: { db: 'Open Food Facts', code: String(p.code || ''), uy: Array.isArray(p.countries_tags) && p.countries_tags.includes('en:uruguay') }, portions: Number.isFinite(serving) && serving > 0 && serving < 2000 ? [{ label: '1 porción del envase', g: serving }] : undefined };
  }
  /** Alimentos más usados en los registros (por id), de mayor a menor. */
  function frequentIds(meals = [], limit = 12) {
    const count = new Map();
    for (const m of meals) for (const it of (Array.isArray(m.items) ? m.items : [])) if (it && it.foodId) count.set(it.foodId, (count.get(it.foodId) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  }
  root.FittFormaFood = Object.freeze({ CATS, norm, label, search, variantsOf, unitsFor, nutrientsFor, sourceInfo, fromOpenFoodFacts, frequentIds });
})(typeof window !== 'undefined' ? window : globalThis);
