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
  // ---------- v57: lector de comidas escritas («100 g de hamburguesa, 2 croquetas de papa y 200 g de pan») ----------
  const NUM_WORDS = { un: 1, una: 1, uno: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12 };
  // Sinónimos rioplatenses → palabras que sí están en la base. Solo agregan términos de búsqueda.
  const SYN = { coca: 'refresco cola', gaseosa: 'refresco', soda: 'refresco', pancho: 'salchichas', panchos: 'salchichas', tallarines: 'fideos', spaghetti: 'fideos', pasta: 'fideos',
    bife: 'bife', asado: 'asado tira', milanga: 'milanesa', tuco: 'salsa tomate', fritas: 'fritas', pure: 'pure', huevos: 'huevo', tostada: 'pan', tostadas: 'pan', bizcocho: 'factura',
    bizcochos: 'factura', facturas: 'factura', galleta: 'galletas', galletita: 'galletitas', yogurt: 'yogur', mozzarella: 'muzzarella', muzza: 'muzzarella', jamon: 'jamon', pollo: 'pollo',
    molida: 'picada', cafe: 'cafe', te: 'te', birra: 'cerveza', vino: 'vino', papas: 'papa', papitas: 'papa', croqueta: 'croquetas', alfajores: 'alfajor', empanadas: 'empanada',
    hamburguesas: 'hamburguesa', medialunas: 'medialuna', tortas: 'torta', panqueque: 'panqueques', crepe: 'crepes', crepes: 'crepes', helados: 'helado', bananas: 'banana', manzanas: 'manzana' };
  const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'con', 'y', 'a', 'al', 'en', 'mi', 'poco', 'poquito', 'comi', 'tome', 'me', 'algo', 'casera', 'casero']);
  const UNIT_RE = '(kg|kilos?|g|gr|grs|gramos?|ml|cc|mililitros?|l|litros?)';
  const COUNT_UNITS = { unidad: 'unidad', unidades: 'unidad', u: 'unidad', porcion: 'porcion', porciones: 'porcion', plato: 'plato', platos: 'plato', taza: 'taza', tazas: 'taza', vaso: 'vaso', vasos: 'vaso',
    rebanada: 'rebanada', rebanadas: 'rebanada', feta: 'feta', fetas: 'feta', cucharada: 'cucharada', cucharadas: 'cucharada', cucharadita: 'cucharadita', cucharaditas: 'cucharadita',
    lata: 'lata', latas: 'lata', pote: 'pote', potes: 'pote', botella: 'botella', botellas: 'botella', scoop: 'scoop', scoops: 'scoop', rodaja: 'rebanada', rodajas: 'rebanada', pedazo: 'porcion', pedazos: 'porcion', trozo: 'porcion', trozos: 'porcion' };
  // Porción típica cuando no se indica cantidad ni hay porción en la base (gramos). Es una estimación y se marca como tal.
  const DEFAULT_G = { carnes: 150, pescados: 150, cereales: 150, legumbres: 150, verduras: 120, frutas: 130, huevos: 50, lacteos: 150, frutossecos: 30, aceites: 10, bebidas: 250, dulces: 50, preparadas: 250, envasados: 100 };
  const COOKED = /cocid|plancha|hervid|asad|horno|parrilla|frit|revuelt|duro|braseada|salteado/;
  // Peso típico de 1 unidad (u) o de una porción habitual sin cantidad (p), en gramos. Estimaciones de uso común.
  const TYPICAL = [[/^huevo/, 50, 100], [/^pan( |$)/, 30, 60], [/^banana/, 120, 120], [/^manzana/, 180, 180], [/^naranja/, 150, 150], [/^mandarina/, 90, 90], [/^pera/, 170, 170],
    [/^durazno/, 150, 150], [/^kiwi/, 75, 75], [/^galletitas|^galletas/, 8, 30], [/^papa fritas/, 120, 120], [/^papa( |$)/, 170, 200], [/^tomate/, 120, 100], [/^salchichas/, 45, 90], [/^hamburguesa vacuna/, 100, 100],
    [/^granola|^copos/, 40, 40], [/^avena/, 40, 40], [/^mermelada|^dulce de leche|^miel/, 20, 20], [/^manteca|^margarina/, 10, 10], [/^aceite/, 10, 10], [/^mayonesa|^ketchup|^mostaza/, 15, 15],
    [/^azucar/, 5, 5], [/^queso/, 30, 30], [/^jamon|^mortadela|^salame|^paleta|^pechuga de pavo/, 30, 30], [/^yogur/, 170, 170], [/^leche( |$)/, 200, 200], [/^cafe|^te( |$)/, 150, 150],
    [/^refresco|^jugo|^cerveza|^bebida/, 350, 350], [/^vino/, 150, 150], [/^atun|^sardinas/, 120, 120], [/^chorizo|^morcilla/, 100, 100], [/^frutilla|^uva|^arandanos|^frambuesas|^cereza/, 10, 120],
    [/^mani|^nueces|^almendras|^castanas|^avellanas|^pistachos|^semillas/, 1, 30], [/^chocolate/, 10, 25], [/^pop$|^papas chips|^palitos/, 1, 30]];
  const typicalOf = food => { const n = norm(food.name + ' ' + (food.variant || '')); const t = TYPICAL.find(([re]) => re.test(n)); return t ? { unit: t[1], serving: t[2] } : null; };
  function splitMeal(text, db) {
    const pieces = String(text || '').split(/\n|;|,|\s+\+\s+|\s+y\s+|\s+mas\s+|\s+más\s+/i).map(x => x.trim()).filter(Boolean);
    // «fideos con tuco», «arroz con leche», «café con leche»: si existe ese plato, no se parte en «con».
    return pieces.flatMap(p => {
      if (!/\scon\s/i.test(p)) return [p];
      const f = db && matchFood(db, parseQty(p).rest);
      if (f && / con /.test(' ' + norm(f.name) + ' ')) return [p];
      return p.split(/\s+con\s+/i).map(x => x.trim()).filter(Boolean);
    });
  }
  function parseQty(chunk) {
    let t = ' ' + norm(chunk.replace(/(\d),(\d)/g, '$1.$2')).replace(/(\d) (\d)/g, '$1.$2') + ' ';
    t = t.replace(/ 1 2 | ½ /g, ' 0.5 ');
    let m = t.match(new RegExp(' (\\d+(?:\\.\\d+)?) ?' + UNIT_RE + ' '));
    if (m) {
      const v = Number(m[1]), u = m[2]; const mult = /^k/.test(u) ? 1000 : /^(l|litro)/.test(u) ? 1000 : 1;
      return { kind: /^(ml|cc|mili|l|litro)/.test(u) ? 'ml' : 'g', value: v * mult, rest: t.replace(m[0], ' ') };
    }
    m = t.match(/ (\d+(?:\.\d+)?|un|una|uno|medio|media|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce) (?:([a-z]+) )?/);
    if (m) {
      const n = /\d/.test(m[1]) ? Number(m[1]) : NUM_WORDS[m[1]];
      const unit = m[2] && COUNT_UNITS[m[2]];
      return { kind: 'count', value: n, unit: unit || '', rest: t.replace(m[0], unit ? ' ' : ' ' + (m[2] || '') + ' ') };
    }
    return { kind: 'none', value: 0, rest: t };
  }
  function matchFood(db, query) {
    const words = norm(query).split(' ').filter(w => w && !STOP.has(w) && !/^\d/.test(w));
    if (!words.length) return null;
    const expanded = [...new Set(words.flatMap(w => [w, ...(SYN[w] ? SYN[w].split(' ') : []), w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : null, w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : null].filter(Boolean)))];
    const wantRaw = words.some(w => /^crud/.test(w));
    let best = null;
    db.forEach((f, idx) => {
      const name = norm(f.name), hay = norm(`${f.name} ${f.variant || ''} ${f.alias || ''} ${f.brand || ''}`), tokens = new Set(hay.split(' '));
      const nameTokens = name.split(' ').filter(w => !STOP.has(w));
      const hit = w => tokens.has(w) || [...tokens].some(t => t.length > 3 && w.length > 3 && (t.startsWith(w) || w.startsWith(t)));
      const matched = expanded.filter(hit);
      if (!matched.length) return;
      const variantsOf = w => [w, ...(SYN[w] ? SYN[w].split(' ') : []), w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : null, w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : null].filter(Boolean);
      const covered = words.filter(w => variantsOf(w).some(hit)).length;
      const nameCovered = nameTokens.filter(t => expanded.some(w => w === t || (t.length > 3 && w.length > 3 && (t.startsWith(w) || w.startsWith(t))))).length;
      let score = covered * 10 + (nameCovered / Math.max(1, nameTokens.length)) * 12 - Math.max(0, nameTokens.length - nameCovered) * 2;
      if (norm(query).includes(name)) score += 8;
      const v = norm(f.variant || '');
      if (!wantRaw && ['carnes', 'pescados', 'cereales', 'legumbres', 'huevos', 'verduras'].includes(f.cat)) score += COOKED.test(v) ? 2 : /crud|sec/.test(v) ? -3 : 0;
      if (wantRaw && /crud/.test(v)) score += 3;
      if (f.src?.uy) score += 1;
      score -= idx / 100000; // a igual puntaje, el primero de la base (la variante más común)
      if (!best || score > best.score) best = { f, score, covered };
    });
    // Al menos la mitad de las palabras importantes tienen que aparecer, para no adivinar.
    if (!best || best.covered < Math.ceil(words.length / 2)) return null;
    return best.f;
  }
  function portionFor(food, unit) {
    const ps = food.portions || [];
    const want = { unidad: /unidad/, porcion: /porci|plato|unidad/, plato: /plato|porci/, taza: /taza/, vaso: /vaso/, rebanada: /rebanada|feta/, feta: /feta|rebanada/, cucharada: /cucharada$|cucharada /, cucharadita: /cucharadita/, lata: /lata/, pote: /pote/, botella: /botella/, scoop: /porci/ }[unit];
    if (want) { const p = ps.find(x => want.test(norm(x.label))); if (p) return p; }
    if (unit === 'vaso' || unit === 'taza') return { label: unit === 'vaso' ? '1 vaso (200 ml)' : '1 taza (240 ml)', g: unit === 'vaso' ? 200 * (food.ml || 1) : 240 * (food.ml || 1), guessed: true };
    if (unit === 'cucharada') return { label: '1 cucharada (15 g)', g: 15, guessed: true };
    if (unit === 'cucharadita') return { label: '1 cucharadita (5 g)', g: 5, guessed: true };
    return ps.find(x => /unidad|porci|plato/.test(norm(x.label))) || ps[0] || null;
  }
  /** Lee una comida escrita. Devuelve los alimentos reconocidos con gramos aproximados (editables) y lo que no se reconoció. */
  function parseMealText(db, text) {
    const items = [], unknown = [];
    for (const chunk of splitMeal(text, db)) {
      const q = parseQty(chunk), food = matchFood(db, q.rest);
      if (!food) { if (norm(chunk).replace(/\d+/g, '').trim().length >= 3) unknown.push(chunk); continue; }
      let grams, how;
      if (q.kind === 'g') { grams = q.value; how = 'escrito'; }
      else if (q.kind === 'ml') { grams = q.value * (food.ml || 1); how = 'escrito'; }
      else {
        const typ = typicalOf(food), isRecipe = food.src?.type === 'receta';
        if (q.kind === 'count' && q.unit) {
          const p = portionFor(food, q.unit);
          grams = q.value * (p ? p.g : (typ?.unit || DEFAULT_G[food.cat] || 100)); how = p && !p.guessed ? `${q.value} × ${p.label}` : 'porción estimada';
        } else if (q.kind === 'count') {
          const p = (food.portions || []).find(x => /unidad|porci|plato/.test(norm(x.label)));
          if (p) { grams = q.value * p.g; how = `${q.value} × ${p.label}`; }
          else { grams = q.value * (typ?.unit || DEFAULT_G[food.cat] || 100); how = typ ? `${q.value} × unidad (≈${typ.unit} g)` : 'porción estimada'; }
        } else if (isRecipe && food.portions?.[0]) { grams = food.portions[0].g; how = food.portions[0].label; }
        else {
          const first = norm(food.name).split(' ')[0], plural = norm(chunk).split(' ').some(w => w === first + 's' || w === first + 'es') && !/^(papa|frutilla|uva|arandanos|frambuesas|nueces|almendras|semillas|lentejas|garbanzos|porotos|fideos|ravioles|arvejas|chauchas)$/.test(first);
          grams = typ ? (plural && typ.unit >= 20 ? 2 * typ.unit : typ.serving) : (DEFAULT_G[food.cat] || 100); how = 'porción estimada';
        }
      }
      grams = Math.max(1, Math.min(3000, Math.round(grams)));
      items.push({ text: chunk, foodId: food.id, food, grams, how });
    }
    return { items, unknown };
  }
  function totalsFor(items) {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const it of items) { const n = nutrientsFor(it.food, it.grams, 'g'); t.kcal += n.kcal; t.protein += n.protein; t.carbs += n.carbs; t.fat += n.fat; }
    const r1 = v => Math.round(v * 10) / 10;
    return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) };
  }

  root.FittFormaFood = Object.freeze({ CATS, norm, label, search, variantsOf, unitsFor, nutrientsFor, sourceInfo, fromOpenFoodFacts, frequentIds, parseMealText, matchFood, totalsFor, splitMeal });
})(typeof window !== 'undefined' ? window : globalThis);
