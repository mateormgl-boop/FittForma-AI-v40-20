// v50: animaciones propias para cada ejercicio de la biblioteca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const load = file => { const ctx = { window: {} }; ctx.globalThis = ctx; vm.runInNewContext(readFileSync(file, 'utf8'), ctx); return ctx; };
const gifs = load('exercise-gifs.js').window.FittFormaExerciseGifs;
const trainingCtx = load('training-core.js');
const T = trainingCtx.FittFormaTraining || trainingCtx.window.FittFormaTraining;

test('cada ejercicio de la biblioteca tiene su propia animación GIF', () => {
  const names = new Set(Object.values(T.LIBRARY).flat().map(e => e.name));
  for (const n of names) assert.ok(gifs[n], `falta animación: ${n}`);
  const files = Object.values(gifs).map(g => g.file);
  assert.equal(new Set(files).size, files.length, 'no se reutiliza un GIF para otro ejercicio');
  for (const f of files) {
    const path = 'assets/exercises/' + f;
    assert.ok(existsSync(path), path);
    const head = readFileSync(path).subarray(0, 6).toString('latin1');
    assert.equal(head, 'GIF89a', `${path} es un GIF`);
  }
});

test('cada animación indica músculos principales reales del mapa anatómico', () => {
  const anatomy = load('anatomy.js').window.FittFormaAnatomy;
  const ids = new Set(Object.keys(anatomy.MUSCLES));
  for (const [n, g] of Object.entries(gifs)) {
    assert.ok(g.muscles.length > 0, `${n} sin músculos`);
    for (const m of [...g.muscles, ...g.secondary]) assert.ok(ids.has(m), `${n}: músculo desconocido ${m}`);
  }
});

test('la ficha y las tarjetas usan la animación y conservan las fotos reales como complemento', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<script src="\.\/exercise-gifs\.js"><\/script>/);
  assert.match(html, /function exerciseGif\(name\)/);
  assert.match(html, /exercise-gif-hero/);
  assert.match(html, /Ver fotos reales/);
  assert.match(readFileSync('sw.js', 'utf8'), /exercise-gifs\.js/);
  assert.match(readFileSync('backend/server.mjs', 'utf8'), /'\/exercise-gifs\.js'/);
});

// ---------- v50 Etapa 2: actividades, GPS y calorías ----------
const A = load('activity-core.js').window.FittFormaActivity;

test('calorías: cada actividad usa su propio método reconocido', () => {
  const run = A.estimateActivityCalories({ type: 'Correr', distanceKm: 10, minutes: 60, movingMinutes: 60, weightKg: 70 });
  const walk = A.estimateActivityCalories({ type: 'Caminar', distanceKm: 5, minutes: 60, movingMinutes: 60, weightKg: 70 });
  const bike = A.estimateActivityCalories({ type: 'Bicicleta', distanceKm: 20, minutes: 60, movingMinutes: 60, weightKg: 70 });
  assert.equal(run.method, 'acsm-correr');
  assert.equal(walk.method, 'acsm-caminar');
  assert.equal(bike.method, 'compendio-2011-bicicleta');
  // ACSM correr a 166,7 m/min: VO2 = 3,5 + 0,2·166,7 = 36,8 ml/kg/min → 36,8·70·60/1000·5 ≈ 773 kcal.
  assert.ok(Math.abs(run.kcal - 773) <= 2, String(run.kcal));
  // ACSM caminar a 83,3 m/min: VO2 = 3,5 + 8,33 = 11,83 → ≈ 248 kcal.
  assert.ok(Math.abs(walk.kcal - 248) <= 2, String(walk.kcal));
  // Bicicleta 20 km/h → MET 8,0 (Compendio 2011) → 8·70·1 = 560 kcal.
  assert.equal(bike.kcal, 560);
  assert.ok(run.netKcal < run.kcal && walk.netKcal < walk.kcal && bike.netKcal < bike.kcal, 'el neto descuenta el reposo');
});

test('calorías: sin peso no se inventa un valor; sin tiempo en movimiento queda como aproximado', () => {
  assert.equal(A.estimateActivityCalories({ type: 'Correr', distanceKm: 5, minutes: 30 }).kcal, null);
  assert.equal(A.estimateActivityCalories({ type: 'Correr', distanceKm: 5, minutes: 30 }).reason, 'peso');
  const approx = A.estimateActivityCalories({ type: 'Correr', distanceKm: 5, minutes: 30, weightKg: 70 });
  assert.equal(approx.approximate, true);
  assert.ok(approx.notes.some(n => /tiempo total/.test(n)));
  assert.equal(A.estimateStrengthCalories({ minutes: 60 }).kcal, null);
  assert.equal(A.estimateStrengthCalories({ minutes: 60, weightKg: 80 }).kcal, 280); // 3,5 MET · 80 kg · 1 h
});

test('calorías: la pendiente medida suma esfuerzo y un peso distinto cambia solo los cálculos nuevos', () => {
  const flat = A.estimateActivityCalories({ type: 'Caminar', distanceKm: 4, minutes: 50, movingMinutes: 50, weightKg: 70 });
  const hill = A.estimateActivityCalories({ type: 'Caminar', distanceKm: 4, minutes: 50, movingMinutes: 50, weightKg: 70, elevationGainM: 120 });
  assert.ok(hill.kcal > flat.kcal);
  const heavier = A.estimateActivityCalories({ type: 'Caminar', distanceKm: 4, minutes: 50, movingMinutes: 50, weightKg: 90 });
  assert.ok(heavier.kcal > flat.kcal);
  // El resumen suma lo GUARDADO en cada registro: no recalcula con el peso actual.
  const now = new Date('2026-10-14T12:00:00');
  const sum = A.summarizeExpenditure({ activities: [{ type: 'Caminar', date: '2026-10-13', distance: 4, calories: { kcal: flat.kcal } }, { type: 'Bicicleta', date: '2026-10-01', distance: 10, calories: { kcal: 300 } }], sessions: [{ date: '2026-10-14', minutes: 50, calories: { kcal: 200 } }, { date: '2026-10-14', minutes: 10 }] }, 'week', now);
  assert.equal(sum.rows.Caminar.kcal, flat.kcal);
  assert.equal(sum.rows.Bicicleta.kcal, 0, 'fuera de la semana');
  assert.equal(sum.rows.Fuerza.kcal, 200);
  assert.equal(sum.rows.Fuerza.missing, 1);
  const month = A.summarizeExpenditure({ activities: [{ type: 'Bicicleta', date: '2026-10-01', distance: 10, calories: { kcal: 300 } }] }, 'month', now);
  assert.equal(month.rows.Bicicleta.kcal, 300);
});

test('GPS: tiempo en movimiento, velocidad máxima suavizada y desnivel solo con altitud precisa', () => {
  const st = A.createGpsStats();
  for (let i = 0; i < 10; i++) A.addGpsSegment(st, 'Bicicleta', { meters: 7, seconds: 1, at: i * 1000, altitude: 10 + i, altitudeAccuracy: 5 });
  for (let i = 0; i < 5; i++) A.addGpsSegment(st, 'Bicicleta', { meters: 0, seconds: 2, at: 10000 + i * 2000 });
  assert.equal(st.movingMs, 10000, 'las detenciones no suman tiempo en movimiento');
  assert.ok(Math.abs(st.maxSpeed - 7) < 0.01, String(st.maxSpeed));
  assert.equal(st.elevationGain, 9);
  // Un pico imposible no se toma como velocidad máxima.
  A.addGpsSegment(st, 'Bicicleta', { meters: 400, seconds: 1, at: 30000 });
  assert.ok(st.maxSpeed < A.MAX_SPEED.Bicicleta);
  const noisy = A.createGpsStats();
  A.addGpsSegment(noisy, 'Caminar', { meters: 5, seconds: 4, at: 0, altitude: 40, altitudeAccuracy: 30 });
  A.addGpsSegment(noisy, 'Caminar', { meters: 5, seconds: 4, at: 4000, altitude: 60, altitudeAccuracy: 30 });
  assert.equal(noisy.elevationGain, 0, 'altitud imprecisa no suma desnivel');
  assert.equal(A.signalQuality(6).level, 'good');
  assert.equal(A.signalQuality(60).level, 'none');
});

test('GPS: comparación con actividades anteriores del mismo tipo', () => {
  const hist = [{ id: 1, type: 'Bicicleta', date: '2026-10-01', distance: 20, minutes: 60 }, { id: 2, type: 'Bicicleta', date: '2026-10-03', distance: 22, minutes: 60 }, { id: 3, type: 'Correr', date: '2026-10-04', distance: 5, minutes: 30 }];
  const now = { id: 4, type: 'Bicicleta', date: '2026-10-05', distance: 25, minutes: 60, movingMinutes: 55 };
  const c = A.compareWithPrevious(now, [...hist, now]);
  assert.equal(c.count, 2);
  assert.equal(c.faster, true);
  assert.equal(A.compareWithPrevious({ id: 9, type: 'Caminar', date: '2026-10-05', distance: 3, minutes: 30 }, hist), null);
});

test('GPS nativo: puente seguro en la web y app Android preparada', () => {
  const ctx = load('native-gps.js');
  assert.equal(ctx.window.FittFormaNativeGps.available(), false, 'en el navegador no simula un servicio en segundo plano');
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<script src="\.\/activity-core\.js"><\/script>/);
  assert.match(html, /<script src="\.\/native-gps\.js"><\/script>/);
  assert.match(html, /function clearGpsWatch\(\)/);
  assert.match(html, /id="gpsSignal"/);
  assert.match(html, /id="expenditureCard"/);
  assert.match(html, /no suma automáticamente las calorías de ejercicio/);
});

// ---------- v50 Etapa 3: base de alimentos ----------
const FOOD = (() => { const c = { window: {} }; c.globalThis = c; vm.runInNewContext(readFileSync('food-db.js', 'utf8'), c); vm.runInNewContext(readFileSync('food-core.js', 'utf8'), c); return { db: c.window.FittFormaFoodDb, F: c.window.FittFormaFood }; })();

test('alimentos: base amplia por categorías, sin duplicados y con fuente verificable', () => {
  const { db, F } = FOOD;
  assert.ok(db.length >= 250, String(db.length));
  for (const cat of ['frutas', 'verduras', 'carnes', 'pescados', 'huevos', 'lacteos', 'cereales', 'legumbres', 'frutossecos', 'aceites', 'bebidas', 'dulces', 'preparadas']) assert.ok(db.some(f => f.cat === cat), cat);
  const keys = db.map(f => `${f.name}|${f.variant}`); assert.equal(new Set(keys).size, keys.length, 'sin productos duplicados');
  const ids = db.map(f => f.id); assert.equal(new Set(ids).size, ids.length);
  for (const f of db) {
    assert.ok(f.kcal >= 0 && f.kcal <= 950 && f.p >= 0 && f.c >= 0 && f.f >= 0, f.name);
    // Coherencia energética para detectar errores groseros (columnas cambiadas): kcal ≈ 4·P + 4·(C − fibra) + 9·G.
    // La USDA usa factores de Atwater específicos por alimento, por eso la tolerancia es amplia.
    const atwater = 4 * f.p + 4 * (f.c - (f.fib || 0)) + 9 * f.f;
    if (!/whisky|cerveza|vino/i.test(f.name)) assert.ok(Math.abs(atwater - f.kcal) <= Math.max(30, f.kcal * 0.3), `${f.name}: ${f.kcal} vs ${Math.round(atwater)}`);
    const s = F.sourceInfo(f);
    assert.ok(s.kind === 'verified' || s.kind === 'estimate', f.name);
    if (s.kind === 'verified') assert.match(f.src.ndb, /^\d{5}$/);
  }
  // Uruguay: típicos presentes, y las recetas quedan marcadas como estimación.
  for (const n of ['Dulce de leche', 'Chivito al pan', 'Milanesa de carne', 'Fainá', 'Torta frita', 'Empanada de carne', 'Asado de tira', 'Morcilla', 'Boniato', 'Choclo'])
    assert.ok(db.some(f => f.name === n), n);
  assert.equal(F.sourceInfo(db.find(f => f.name === 'Chivito al pan')).kind, 'estimate');
  assert.equal(F.sourceInfo(db.find(f => f.name === 'Dulce de leche')).kind, 'verified');
});

test('alimentos: búsqueda con sinónimos, variantes de preparación y filtros', () => {
  const { db, F } = FOOD;
  assert.equal(F.search(db, 'platano')[0].name, 'Banana');
  assert.equal(F.search(db, 'palta')[0].name, 'Palta');
  const papa = F.variantsOf(db, db.find(f => f.name === 'Papa'));
  assert.ok(papa.length >= 4 && papa.some(v => /Hervida/.test(v.variant)) && papa.some(v => /Puré/.test(v.variant)));
  const huevo = F.search(db, 'huevo frito');
  assert.equal(F.label(huevo[0]), 'Huevo · Frito');
  assert.ok(F.search(db, '', { cat: 'pescados' }).every(f => f.cat === 'pescados'));
  assert.equal(F.search(db, 'zzzz').length, 0);
});

test('alimentos: nutrientes según cantidad en g, ml, unidades y porciones', () => {
  const { db, F } = FOOD;
  const arroz = db.find(f => f.name === 'Arroz blanco' && f.variant === 'Cocido');
  const r = F.nutrientsFor(arroz, 150, 'g');
  assert.equal(r.kcal, Math.round(arroz.kcal * 1.5));
  assert.equal(r.protein, Math.round(arroz.p * 1.5 * 10) / 10);
  const leche = db.find(f => f.name === 'Leche' && f.variant === 'Entera');
  assert.ok(leche.ml > 1 && leche.ml < 1.1, 'densidad de la leche desde la taza USDA');
  assert.ok(F.unitsFor(leche).some(u => u.key === 'ml'));
  const ml = F.nutrientsFor(leche, 250, 'ml'); assert.ok(Math.abs(ml.grams - 250 * leche.ml) < 0.2);
  const huevo = db.find(f => f.name === 'Huevo' && f.variant === 'Duro');
  const units = F.unitsFor(huevo); assert.ok(units.length > 1, 'porciones de USDA');
  const p = F.nutrientsFor(huevo, 2, 'p0'); assert.equal(p.grams, Math.round(2 * units[1].g * 10) / 10);
  assert.ok(!F.unitsFor(db.find(f => f.name === 'Manzana')).some(u => u.key === 'ml'), 'sin ml para sólidos');
});

test('alimentos: productos envasados de Open Food Facts solo con datos suficientes; frecuentes desde el historial', () => {
  const { F } = FOOD;
  const ok = F.fromOpenFoodFacts({ code: '7730205000011', product_name: 'Yogur bebible frutilla', brands: 'Conaprole', serving_quantity: 200, nutriments: { 'energy-kcal_100g': 80, proteins_100g: 3, carbohydrates_100g: 13, fat_100g: 1.5 } });
  assert.equal(ok.cat, 'envasados'); assert.equal(ok.brand, 'Conaprole'); assert.equal(F.sourceInfo(ok).kind, 'label'); assert.equal(ok.portions[0].g, 200);
  assert.equal(F.fromOpenFoodFacts({ code: '1', product_name: 'Sin datos', nutriments: { proteins_100g: 3 } }), null, 'sin calorías no se inventan');
  assert.equal(F.fromOpenFoodFacts({ code: '2', product_name: '', nutriments: { 'energy-kcal_100g': 80, proteins_100g: 3 } }), null);
  const meals = [{ items: [{ foodId: 'a' }] }, { items: [{ foodId: 'b' }, { foodId: 'a' }] }, { name: 'sin items' }];
  assert.deepEqual([...F.frequentIds(meals)], ['a', 'b']);
});

test('alimentos: el buscador está integrado en Nutrición y funciona sin conexión', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const s of ['<script src="./food-db.js"></script>', '<script src="./food-core.js"></script>', 'id="foodFinder"', 'id="foodAddMeal"', 'id="foodOnline"', 'id="foodUnit"']) assert.ok(html.includes(s), s);
  assert.match(html, /La base local sigue disponible/);
  assert.match(readFileSync('sw.js', 'utf8'), /food-db\.js/);
});

// ---------- v50 Etapa 4: Comunidad ----------
test('comunidad: perfiles públicos por defecto, directorio y privacidad también en la base', () => {
  const js = readFileSync('community.js', 'utf8'), html = readFileSync('index.html', 'utf8');
  const mig = readFileSync('supabase/migrations/2026-10-24_v50_community_directory.sql', 'utf8');
  assert.match(js, /visibility:'public'\}/, 'el perfil creado desde la app nace público');
  assert.match(html, /<option value="public">Público[^<]*<\/option><option value="private">/);
  assert.match(mig, /alter column visibility set default 'public'/);
  assert.match(mig, /function public\.community_directory\(/);
  assert.match(mig, /function public\.community_profile_basic\(/);
  assert.match(mig, /community_media_read_avatar_basic/);
  assert.doesNotMatch(mig, /disable row level security|drop table|delete from/i, 'migración aditiva, sin desactivar RLS');
  assert.match(js, /client\.rpc\('community_directory',\{p_search:peopleTerm,p_after:peopleAfter,p_limit:20\}\)/, 'carga progresiva');
  assert.match(js, /Este perfil es privado/);
  assert.match(js, /async function removeAvatar\(\)/);
  assert.match(html, /id="communityAvatarRemove"/);
  assert.match(html, /id="communityPeopleMore"/);
});
