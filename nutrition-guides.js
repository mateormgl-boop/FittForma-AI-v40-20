/* FittForma AI v55 — guías de alimentación por objetivo y recetas calculadas con la base de alimentos (sin dependencias).
 * Las guías son orientativas y se basan en recomendaciones publicadas (ver «sources» de cada una). No reemplazan a
 * un profesional de la nutrición ni contemplan enfermedades, embarazo o alergias.
 * Las recetas nuevas se calculan sumando sus ingredientes de food-db.js (valores por 100 g de USDA SR28): las
 * calorías y los macros no se escriben a mano.
 */
(function (root) {
  'use strict';

  const SOURCES = {
    issn: { label: 'ISSN, posición sobre proteína y ejercicio (2017)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/' },
    plate: { label: 'Harvard, Plato para comer saludable', url: 'https://nutritionsource.hsph.harvard.edu/healthy-eating-plate' },
    carbs: { label: 'Burke y col. 2011 (tabla de GSSI): carbohidratos según el entrenamiento', url: 'https://www.gssiweb.org/gssiu_content/pdf/FINAL%20Carbohydrate%20Intake%20Recommendations%20for%20Athletes_6.3.21.pdf' }
  };

  // Plato: fracciones del plato principal (verduras y frutas / cereales y tubérculos / proteína).
  const GUIDES = {
    lose: {
      title: 'Bajar grasa', idea: 'Comer un poco menos de lo que gastás, sin pasar hambre y cuidando el músculo.',
      energy: 'Un déficit moderado y sostenible. Tus calorías de referencia están en Perfil › Objetivo y actualidad.',
      protein: { min: 1.6, max: 2.2, note: 'En déficit conviene la parte alta: ayuda a conservar músculo y a sentir saciedad.' },
      plate: { veg: 50, carbs: 20, protein: 30 },
      more: ['Verduras en almuerzo y cena (hojas, brócoli, zapallo, tomate)', 'Proteína magra en cada comida: pollo, pescado, huevo, legumbres, lácteos descremados', 'Frutas enteras en lugar de jugos', 'Agua, café o té sin azúcar'],
      less: ['Bebidas azucaradas y alcohol', 'Ultraprocesados, frituras y snacks', 'Porciones grandes de pan, arroz o fideos (medilas)', 'Picoteo sin registrar'],
      tags: ['lose'], sources: ['issn', 'plate']
    },
    maintain: {
      title: 'Ponerte en forma y mantener', idea: 'Comer variado y en cantidad suficiente para entrenar con energía.',
      energy: 'Calorías cerca de lo que gastás. El peso estable es la mejor señal.',
      protein: { min: 1.4, max: 1.8, note: 'Repartida en 3 o 4 comidas.' },
      plate: { veg: 50, carbs: 25, protein: 25 },
      more: ['Mitad del plato con verduras y frutas de colores', 'Cereales integrales, legumbres y tubérculos', 'Proteína en cada comida', 'Grasas de calidad: aceite de oliva, palta, frutos secos'],
      less: ['Bebidas azucaradas', 'Ultraprocesados frecuentes', 'Carnes procesadas (fiambres, embutidos)'],
      tags: ['maintain'], sources: ['issn', 'plate']
    },
    muscle: {
      title: 'Ganar músculo', idea: 'Un pequeño excedente de calorías, proteína suficiente y entrenamiento de fuerza constante.',
      energy: 'Comer un poco más de lo que gastás. Subir de a poco evita ganar grasa de más.',
      protein: { min: 1.6, max: 2.0, note: 'Repartida en 3 a 5 comidas, también después de entrenar.' },
      plate: { veg: 35, carbs: 35, protein: 30 },
      more: ['Proteína en cada comida: carnes magras, huevos, lácteos, pescado, legumbres, tofu', 'Carbohidratos alrededor del entrenamiento: avena, arroz, fideos, papa, boniato, fruta', 'Colaciones con lácteos, frutos secos o licuados', 'Verduras igual en almuerzo y cena'],
      less: ['Saltearte comidas', 'Ultraprocesados como forma de sumar calorías', 'Alcohol (afecta la recuperación)'],
      tags: ['muscle'], sources: ['issn', 'plate']
    },
    strength: {
      title: 'Ganar fuerza', idea: 'Energía y proteína suficientes para rendir con cargas pesadas y recuperarte.',
      energy: 'Comer lo que gastás o un poco más los días de entrenamiento intenso.',
      protein: { min: 1.4, max: 2.0, note: 'Una comida con proteína y carbohidratos 1–3 horas antes de entrenar ayuda a rendir.' },
      plate: { veg: 40, carbs: 30, protein: 30 },
      more: ['Carbohidratos antes de entrenar: pan integral, avena, arroz, fruta', 'Proteína después de entrenar', 'Hidratación y algo de sal si transpirás mucho', 'Verduras y frutas variadas'],
      less: ['Entrenar en ayunas largas antes de cargas pesadas', 'Comidas muy grasosas justo antes de entrenar'],
      tags: ['strength'], sources: ['issn', 'plate']
    },
    endurance: {
      title: 'Mejorar resistencia', idea: 'Los carbohidratos son el combustible principal: ajustalos a cuánto entrenás.',
      energy: 'Comer lo que gastás; los días largos necesitan más.',
      protein: { min: 1.4, max: 1.8, note: 'Carbohidratos de referencia: 5–7 g/kg con ~1 h de entrenamiento por día y 6–10 g/kg con 1–3 h.' },
      carbs: [{ label: '~1 h por día', min: 5, max: 7 }, { label: '1–3 h por día', min: 6, max: 10 }],
      plate: { veg: 35, carbs: 40, protein: 25 },
      more: ['Avena, arroz, fideos, papa, boniato, pan y fruta, sobre todo los días de entrenamiento', 'Una comida con carbohidratos 2–3 h antes de salidas largas', 'Reponer después: carbohidratos más proteína', 'Agua y sales en sesiones largas o con calor'],
      less: ['Comidas muy fibrosas o grasosas justo antes de correr', 'Entrenamientos largos sin haber comido'],
      tags: ['endurance'], sources: ['carbs', 'issn', 'plate']
    }
  };

  // Qué guía le corresponde a cada objetivo de la app (peso corporal o entrenamiento).
  function guideFor(profile) {
    const p = profile || {};
    if (p.bodyGoal === 'lose') return 'lose';
    if (p.bodyGoal === 'gain') return 'muscle';
    return { muscle: 'muscle', strength: 'strength', endurance: 'endurance', fitness: 'maintain' }[p.goal] || 'maintain';
  }
  // Proteína diaria en gramos para un peso (redondeada a 5 g).
  function proteinRange(guideKey, weightKg) {
    const g = GUIDES[guideKey], w = Number(weightKg);
    if (!g || !(w >= 30 && w <= 300)) return null;
    const r = x => Math.round(x / 5) * 5;
    return { min: r(g.protein.min * w), max: r(g.protein.max * w) };
  }

  // Recetas: ingredientes con id de food-db.js y gramos (peso como se usa: cocido si dice «cocido»).
  const RECIPES = [
    { id: 'bowl-pollo-integral', name: 'Bowl de pollo, arroz integral y brócoli', type: 'Almuerzo', minutes: 25, tags: ['muscle', 'maintain', 'strength'],
      items: [['sr05064', 150, 'Pechuga de pollo asada'], ['sr20037', 180, 'Arroz integral cocido'], ['sr11091', 150, 'Brócoli hervido'], ['sr04053', 10, 'Aceite de oliva']],
      steps: ['Cociná el arroz integral.', 'Cociná el pollo a la plancha y cortalo en tiras.', 'Herví el brócoli 4–5 minutos y armá el bowl con el aceite por encima.'] },
    { id: 'ensalada-atun-garbanzos', name: 'Ensalada completa de atún y garbanzos', type: 'Almuerzo', minutes: 10, tags: ['lose', 'maintain'],
      items: [['sr15121', 120, 'Atún al natural'], ['sr16057', 120, 'Garbanzos cocidos'], ['sr11529', 100, 'Tomate'], ['sr11253', 60, 'Lechuga'], ['sr11124', 50, 'Zanahoria rallada'], ['sr04053', 10, 'Aceite de oliva']],
      steps: ['Enjuagá los garbanzos.', 'Cortá las verduras y mezclá con el atún escurrido.', 'Condimentá con aceite, limón y sal.'] },
    { id: 'merluza-calabaza', name: 'Merluza al horno con calabaza y espinaca', type: 'Cena', minutes: 30, tags: ['lose', 'maintain'],
      items: [['sr15034', 180, 'Merluza'], ['sr11423', 200, 'Calabaza'], ['sr11457', 60, 'Espinaca'], ['sr04053', 10, 'Aceite de oliva']],
      steps: ['Horneá la calabaza en cubos 20 minutos.', 'Sumá la merluza condimentada 12–15 minutos más.', 'Serví sobre la espinaca con el aceite.'] },
    { id: 'guiso-lentejas', name: 'Guiso de lentejas con verduras', type: 'Almuerzo', minutes: 40, tags: ['maintain', 'endurance', 'lose'],
      items: [['sr16070', 250, 'Lentejas cocidas'], ['sr11367', 120, 'Papa'], ['sr11124', 60, 'Zanahoria'], ['sr11282', 50, 'Cebolla'], ['sr11821', 50, 'Morrón rojo'], ['sr04053', 10, 'Aceite de oliva']],
      steps: ['Rehogá cebolla, morrón y zanahoria en el aceite.', 'Agregá la papa en cubos y agua; cociná 15 minutos.', 'Sumá las lentejas cocidas y cociná 10 minutos más.'] },
    { id: 'fideos-carne-tomate', name: 'Fideos integrales con carne magra y tomate', type: 'Cena', minutes: 25, tags: ['muscle', 'endurance', 'strength'],
      items: [['sr20125', 220, 'Fideos integrales cocidos'], ['sr23563', 120, 'Carne picada magra'], ['sr11529', 150, 'Tomate'], ['sr11282', 40, 'Cebolla'], ['sr04053', 5, 'Aceite de oliva']],
      steps: ['Herví los fideos.', 'Dorá la carne con la cebolla y el aceite.', 'Sumá el tomate picado, cociná 10 minutos y mezclá con los fideos.'] },
    { id: 'avena-mani-banana', name: 'Avena con leche, banana y maní', type: 'Desayuno', minutes: 8, tags: ['endurance', 'muscle', 'strength'],
      items: [['sr08120', 70, 'Avena'], ['sr01079', 250, 'Leche semidescremada'], ['sr09040', 120, 'Banana'], ['sr16390', 20, 'Maní']],
      steps: ['Cociná la avena con la leche 4–5 minutos.', 'Agregá la banana en rodajas y el maní picado.'] },
    { id: 'yogur-frutillas-almendras', name: 'Yogur con frutillas y almendras', type: 'Merienda', minutes: 3, tags: ['lose', 'maintain'],
      items: [['sr01118', 250, 'Yogur natural descremado'], ['sr09316', 150, 'Frutillas'], ['sr12061', 20, 'Almendras']],
      steps: ['Serví el yogur.', 'Sumá las frutillas en mitades y las almendras picadas.'] },
    { id: 'revuelto-espinaca', name: 'Revuelto de huevos y espinaca con pan integral', type: 'Desayuno', minutes: 10, tags: ['muscle', 'strength', 'maintain'],
      items: [['sr01123', 150, 'Huevos (3)'], ['sr11457', 60, 'Espinaca'], ['sr18075', 60, 'Pan integral'], ['sr04053', 5, 'Aceite de oliva']],
      steps: ['Saltá la espinaca en el aceite 1 minuto.', 'Agregá los huevos batidos y revolvé a fuego bajo.', 'Serví con el pan tostado.'] },
    { id: 'tostadas-ricota-tomate', name: 'Tostadas integrales con ricota y tomate', type: 'Merienda', minutes: 5, tags: ['lose', 'maintain'],
      items: [['sr18075', 60, 'Pan integral'], ['sr01037', 80, 'Ricota semidescremada'], ['sr11529', 80, 'Tomate']],
      steps: ['Tostá el pan.', 'Untá la ricota y sumá el tomate en rodajas con orégano.'] },
    { id: 'salmon-boniato', name: 'Salmón con boniato y brócoli', type: 'Cena', minutes: 35, tags: ['muscle', 'endurance', 'maintain'],
      items: [['sr15237', 150, 'Salmón al horno'], ['sr11508', 200, 'Boniato al horno'], ['sr11091', 120, 'Brócoli hervido']],
      steps: ['Horneá el boniato en rodajas 25 minutos.', 'Sumá el salmón los últimos 12–15 minutos.', 'Serví con el brócoli hervido.'] },
    { id: 'bowl-quinoa-porotos', name: 'Bowl de quinoa, porotos negros y palta', type: 'Almuerzo', minutes: 20, tags: ['maintain', 'endurance'],
      items: [['sr20137', 180, 'Quinoa cocida'], ['sr16015', 150, 'Porotos negros cocidos'], ['sr09037', 60, 'Palta'], ['sr11529', 100, 'Tomate'], ['sr11282', 30, 'Cebolla']],
      steps: ['Cociná la quinoa 12–15 minutos y enjuagala.', 'Mezclá con los porotos, el tomate y la cebolla picada.', 'Sumá la palta en cubos con limón y sal.'] },
    { id: 'cerdo-papas-ensalada', name: 'Lomo de cerdo con papas y ensalada', type: 'Cena', minutes: 30, tags: ['strength', 'muscle'],
      items: [['sr10061', 150, 'Lomo de cerdo asado'], ['sr11367', 200, 'Papa hervida'], ['sr11253', 60, 'Lechuga'], ['sr11529', 100, 'Tomate'], ['sr04053', 10, 'Aceite de oliva']],
      steps: ['Cociná el lomo a la plancha o al horno.', 'Herví las papas.', 'Serví con la ensalada condimentada con el aceite.'] },
    { id: 'tofu-arroz-verduras', name: 'Tofu salteado con arroz y verduras', type: 'Almuerzo', minutes: 20, tags: ['muscle', 'maintain'],
      items: [['sr16426', 150, 'Tofu firme'], ['sr20045', 180, 'Arroz blanco cocido'], ['sr11091', 100, 'Brócoli'], ['sr11124', 60, 'Zanahoria'], ['sr11821', 60, 'Morrón rojo'], ['sr04053', 10, 'Aceite de oliva']],
      steps: ['Dorá el tofu en cubos con la mitad del aceite.', 'Saltá las verduras con el resto del aceite.', 'Mezclá con el arroz y condimentá con salsa de soja.'] },
    { id: 'licuado-banana-avena', name: 'Licuado de leche, banana y avena', type: 'Colación', minutes: 3, tags: ['endurance', 'muscle'],
      items: [['sr01079', 300, 'Leche semidescremada'], ['sr09040', 120, 'Banana'], ['sr08120', 30, 'Avena']],
      steps: ['Licuá todo hasta que quede cremoso.'] },
    { id: 'hummus-zanahoria', name: 'Hummus con zanahoria y pan integral', type: 'Colación', minutes: 5, tags: ['maintain', 'lose'],
      items: [['sr16158', 80, 'Hummus'], ['sr11124', 100, 'Zanahoria en bastones'], ['sr18075', 40, 'Pan integral']],
      steps: ['Cortá la zanahoria en bastones.', 'Serví con el hummus y el pan tostado.'] },
    { id: 'pollo-zapallo-quinoa', name: 'Ensalada tibia de pollo, zapallo y quinoa', type: 'Cena', minutes: 30, tags: ['lose', 'maintain', 'muscle'],
      items: [['sr05064', 130, 'Pechuga de pollo asada'], ['sr11486', 200, 'Zapallo al horno'], ['sr20137', 120, 'Quinoa cocida'], ['sr11457', 40, 'Espinaca'], ['sr04053', 10, 'Aceite de oliva']],
      steps: ['Horneá el zapallo en cubos 20 minutos.', 'Cociná el pollo y la quinoa.', 'Mezclá todo tibio con la espinaca y el aceite.'] },
    { id: 'huevos-manzana', name: 'Huevos duros con manzana', type: 'Colación', minutes: 12, tags: ['lose', 'maintain'],
      items: [['sr01129', 100, 'Huevos duros (2)'], ['sr09003', 150, 'Manzana']],
      steps: ['Herví los huevos 10 minutos.', 'Acompañalos con la manzana.'] }
  ];

  // Suma los ingredientes de una receta con la base (valores por 100 g). Devuelve null si falta algún alimento.
  function computeRecipe(recipe, db) {
    const byId = new Map((Array.isArray(db) ? db : []).map(f => [f.id, f]));
    let kcal = 0, protein = 0, carbs = 0, fat = 0, grams = 0;
    for (const [id, g] of recipe.items) {
      const f = byId.get(id); if (!f) return null;
      const k = g / 100; grams += g;
      kcal += (Number(f.kcal) || 0) * k; protein += (Number(f.p) || 0) * k; carbs += (Number(f.c) || 0) * k; fat += (Number(f.f) || 0) * k;
    }
    const r1 = x => Math.round(x * 10) / 10;
    return { kcal: Math.round(kcal), protein: r1(protein), carbs: r1(carbs), fat: r1(fat), grams };
  }
  function recipesWithValues(db) {
    return RECIPES.map(r => { const v = computeRecipe(r, db); return v ? { ...r, ...v, portions: 1, computed: true, ingredients: r.items.map(([, g, label]) => `${g} g de ${label.charAt(0).toLowerCase()}${label.slice(1)}`) } : null; }).filter(Boolean);
  }

  // ---------- v58: qué comer hoy según el objetivo y «Completá tu día» ----------
  // Cada opción usa alimentos de la base (USDA o recetas marcadas como estimación). Roles: p = proteína (se ajusta
  // para llegar a la proteína), c = carbohidrato (se ajusta para llegar a las calorías), v = verdura y f = grasa (fijos).
  const ALL = ['lose', 'maintain', 'muscle', 'strength', 'endurance'];
  const MENU_OPTIONS = {
    Desayuno: [
      { id: 'avena-yogur', name: 'Avena con yogur griego y banana', goals: ALL, items: [['sr01256', 170, 'p'], ['sr08120', 40, 'c', 100], ['sr09040', 100, 'c', 150]] },
      { id: 'huevos-tostadas', name: 'Huevos revueltos con pan integral y tomate', goals: ALL, items: [['sr01132', 120, 'p', 200], ['sr18075', 60, 'c'], ['sr11529', 100, 'v']] },
      { id: 'tostadas-ricota', name: 'Tostadas integrales con ricota y fruta', goals: ['lose', 'maintain', 'endurance'], items: [['sr01037', 100, 'p'], ['sr18075', 60, 'c', 120], ['sr09003', 150, 'v']] },
      { id: 'leche-granola', name: 'Leche con granola, maní y banana', goals: ['muscle', 'strength', 'endurance'], items: [['sr01079', 300, 'p', 450], ['sr08037', 50, 'c'], ['sr09040', 100, 'c'], ['sr16390', 15, 'f']] }
    ],
    Almuerzo: [
      { id: 'pollo-arroz', name: 'Pollo con arroz integral y brócoli', goals: ALL, items: [['sr05064', 150, 'p'], ['sr20037', 180, 'c', 400], ['sr11091', 150, 'v'], ['sr04053', 8, 'f']] },
      { id: 'carne-papa', name: 'Carne magra con papa al horno y ensalada', goals: ALL, items: [['sr23563', 150, 'p'], ['sr11674', 200, 'c'], ['sr11253', 60, 'v'], ['sr11529', 100, 'v'], ['sr04053', 8, 'f']] },
      { id: 'atun-garbanzos', name: 'Ensalada de atún, garbanzos y verduras', goals: ['lose', 'maintain', 'endurance'], items: [['sr15121', 120, 'p'], ['sr16057', 150, 'c'], ['sr11253', 60, 'v'], ['sr11529', 120, 'v'], ['sr04053', 8, 'f']] },
      { id: 'fideos-carne', name: 'Fideos integrales con carne picada magra', goals: ['muscle', 'strength', 'endurance', 'maintain'], items: [['sr23563', 130, 'p'], ['sr20125', 220, 'c', 400], ['sr11529', 120, 'v'], ['sr04053', 8, 'f']] }
    ],
    Merienda: [
      { id: 'yogur-fruta', name: 'Yogur griego con frutillas, granola y nueces', goals: ALL, items: [['sr01256', 170, 'p'], ['sr08037', 25, 'c', 70], ['sr09316', 120, 'v'], ['sr12155', 10, 'f']] },
      { id: 'tostada-jamon', name: 'Tostada integral con jamón cocido y queso', goals: ['maintain', 'muscle', 'strength'], items: [['sr07029', 50, 'p'], ['sr01026', 25, 'p'], ['sr18075', 60, 'c']] },
      { id: 'leche-banana', name: 'Licuado de leche descremada y banana', goals: ['lose', 'maintain', 'endurance'], items: [['sr01085', 300, 'p', 450], ['sr09040', 120, 'c', 180]] },
      { id: 'pan-mani', name: 'Pan integral con mantequilla de maní y banana', goals: ['muscle', 'strength', 'endurance'], items: [['sr16398', 20, 'p'], ['sr18075', 70, 'c'], ['sr09040', 100, 'c']] }
    ],
    Cena: [
      { id: 'pescado-calabaza', name: 'Pescado al horno con calabaza y ensalada', goals: ['lose', 'maintain', 'endurance'], items: [['sr15034', 180, 'p'], ['sr11423', 250, 'c', 350], ['sr11253', 60, 'v'], ['sr04053', 8, 'f']] },
      { id: 'salmon-arroz', name: 'Salmón al horno con arroz y ensalada', goals: ['muscle', 'strength', 'maintain', 'endurance'], items: [['sr15237', 150, 'p'], ['sr20045', 200, 'c', 400], ['sr11253', 60, 'v'], ['sr11529', 100, 'v']] },
      { id: 'omelette-verduras', name: 'Omelette de huevo y claras con verduras y pan', goals: ['lose', 'maintain', 'muscle', 'strength'], items: [['sr01123', 100, 'p', 150], ['sr01124', 100, 'p', 200], ['sr18075', 50, 'c'], ['sr11529', 100, 'v'], ['sr11124', 60, 'v']] },
      { id: 'pollo-boniato', name: 'Muslo de pollo con boniato y brócoli', goals: ['maintain', 'muscle', 'strength', 'endurance'], items: [['sr05098', 160, 'p'], ['sr11508', 220, 'c', 400], ['sr11091', 120, 'v'], ['sr04053', 8, 'f']] },
      { id: 'lentejas-arroz', name: 'Lentejas con arroz y verduras', goals: ['lose', 'maintain', 'endurance'], items: [['sr16070', 220, 'p'], ['sr20045', 120, 'c'], ['sr11124', 80, 'v'], ['sr04053', 8, 'f']] }
    ]
  };
  const MEAL_SHARE = { Desayuno: 0.25, Almuerzo: 0.35, Merienda: 0.15, Cena: 0.25 };
  const SNACKS = [
    { id: 'yogur-griego', name: 'Yogur griego descremado', items: [['sr01256', 170, 'p']] },
    { id: 'atun-galletas', name: 'Atún al natural con galletas de agua', items: [['sr15121', 120, 'p'], ['sr18228', 25, 'c']] },
    { id: 'huevos-duros', name: 'Huevos duros', items: [['sr01129', 100, 'p']] },
    { id: 'pollo-frio', name: 'Pechuga de pollo a la plancha', items: [['sr05064', 120, 'p']] },
    { id: 'ricota-fruta', name: 'Ricota con frutillas', items: [['sr01037', 120, 'p'], ['sr09316', 150, 'c']] },
    { id: 'leche-descremada', name: 'Vaso de leche descremada', items: [['sr01085', 300, 'p']] },
    { id: 'pan-mani', name: 'Pan integral con mantequilla de maní', items: [['sr16398', 25, 'p'], ['sr18075', 60, 'c']] },
    { id: 'banana-nueces', name: 'Banana con nueces', items: [['sr09040', 120, 'c'], ['sr12155', 20, 'f']] },
    { id: 'jamon-queso', name: 'Jamón cocido y queso', items: [['sr07029', 60, 'p'], ['sr01026', 30, 'p']] }
  ];
  const r1 = x => Math.round(x * 10) / 10;
  const roundG = g => g >= 100 ? Math.round(g / 10) * 10 : Math.max(5, Math.round(g / 5) * 5);
  function itemsWithValues(items, byId) {
    const out = []; for (const [id, g, role, max] of items) { const f = byId.get(id); if (!f) return null; const k = g / 100; out.push({ foodId: id, name: f.name, variant: f.variant || '', grams: g, role, max: Number(max) || 300, kcal: (Number(f.kcal) || 0) * k, protein: (Number(f.p) || 0) * k, carbs: (Number(f.c) || 0) * k, fat: (Number(f.f) || 0) * k }); }
    return out;
  }
  const totalsOf = items => { const t = items.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }); return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) }; };
  // Ajusta las cantidades: primero la proteína (con los alimentos «p»), después las calorías (con los «c»). Topes para
  // que las porciones sigan siendo razonables; si no alcanza, se informa la diferencia en vez de forzar porciones absurdas.
  function scaleOption(option, target, byId) {
    const base = itemsWithValues(option.items, byId); if (!base) return null;
    const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
    const pItems = base.filter(x => x.role === 'p'), cItems = base.filter(x => x.role === 'c'), fixed = base.filter(x => x.role !== 'p' && x.role !== 'c');
    const pf = Math.max(0.6, Math.min(2.2, (target.protein - sum(fixed, 'protein') - sum(cItems, 'protein')) / Math.max(1, sum(pItems, 'protein'))));
    const kcalAfterP = sum(fixed, 'kcal') + sum(pItems, 'kcal') * pf;
    const cf = cItems.length ? Math.max(0.4, Math.min(2.5, (target.kcal - kcalAfterP) / Math.max(1, sum(cItems, 'kcal')))) : 1;
    const valued = (x, g) => { const f = byId.get(x.foodId), m = g / 100; return { ...x, grams: g, kcal: (Number(f.kcal) || 0) * m, protein: (Number(f.p) || 0) * m, carbs: (Number(f.c) || 0) * m, fat: (Number(f.f) || 0) * m }; };
    let scaled = base.map(x => { const k = x.role === 'p' ? pf : x.role === 'c' ? cf : 1; return valued(x, Math.min(x.role === 'c' || x.role === 'p' ? x.max : 1e9, roundG(x.grams * k))); });
    // Si con los topes faltan calorías, se suma de a poco a la grasa buena (aceite o frutos secos), hasta el doble.
    const short = (target.kcal || 0) - sum(scaled, 'kcal');
    if (short > 80) { const fats = scaled.filter(x => x.role === 'f'), fk = sum(fats, 'kcal'); if (fk > 0) { const ff = Math.min(2, 1 + short / fk); scaled = scaled.map(x => x.role === 'f' ? valued(x, roundG(x.grams * ff)) : x); } }
    return { id: option.id, name: option.name, items: scaled.map(({ max, ...x }) => ({ ...x, kcal: Math.round(x.kcal), protein: r1(x.protein), carbs: r1(x.carbs), fat: r1(x.fat) })), totals: totalsOf(scaled) };
  }
  function optionsFor(type, goal) { const list = MENU_OPTIONS[type] || []; const own = list.filter(o => o.goals.includes(goal)); return own.length ? own : list; }
  // picks = { Desayuno: n, … } elige la opción n (rota). kcal y protein son los objetivos del día.
  function dailyMenu(db, { goal = 'maintain', kcal = 2000, protein = 120 } = {}, picks = {}) {
    const byId = new Map((Array.isArray(db) ? db : []).map(f => [f.id, f])), g = GUIDES[goal] ? goal : 'maintain';
    const K = Math.max(1200, Math.min(4500, Number(kcal) || 2000)), P = Math.max(50, Math.min(300, Number(protein) || 120));
    const meals = Object.keys(MEAL_SHARE).map(type => {
      const opts = optionsFor(type, g), i = ((Number(picks[type]) || 0) % opts.length + opts.length) % opts.length;
      const m = scaleOption(opts[i], { kcal: K * MEAL_SHARE[type], protein: P * MEAL_SHARE[type] }, byId);
      return m ? { type, pick: i, options: opts.length, ...m } : null;
    }).filter(Boolean);
    return { goal: g, target: { kcal: K, protein: P }, meals, totals: totalsOf(meals.map(m => m.totals)) };
  }
  // Lo que falta hoy → hasta 3 opciones concretas que entran en las calorías que quedan. Si ya llegaste, no sugiere comer más.
  function completeDay(db, { goal = 'maintain', kcalLeft = 0, proteinLeft = 0 } = {}) {
    const byId = new Map((Array.isArray(db) ? db : []).map(f => [f.id, f])), kl = Number(kcalLeft) || 0, pl = Number(proteinLeft) || 0;
    if (kl < 80 && pl < 10) return { status: 'done', options: [] };
    if (kl < 80) return { status: 'kcal-reached', options: [] };
    const wantProtein = pl >= 10;
    const scored = SNACKS.map(sn => {
      const base = itemsWithValues(sn.items, byId); if (!base) return null; const t = totalsOf(base);
      const k = Math.min(1.6, Math.max(0.5, Math.min(kl * 0.9 / Math.max(1, t.kcal), wantProtein ? Math.max(1, pl) / Math.max(1, t.protein) : 1.2)));
      const opt = scaleOption({ ...sn, items: sn.items.map(([id, gg, role]) => [id, roundG(gg * k), 'x']) }, { kcal: 0, protein: 0 }, byId);
      if (!opt || opt.totals.kcal > kl + 20) return null;
      const density = opt.totals.protein * 4 / Math.max(1, opt.totals.kcal);
      return { ...opt, score: wantProtein ? density * 10 + Math.min(opt.totals.protein, pl) / 10 : (goal === 'muscle' || goal === 'strength' ? opt.totals.kcal / 100 : 1 - opt.totals.kcal / 1000) };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    return { status: wantProtein ? 'protein' : 'kcal', options: scored.slice(0, 3).map(({ score, ...o }) => o) };
  }

  const api = { SOURCES, GUIDES, RECIPES, guideFor, proteinRange, computeRecipe, recipesWithValues, MENU_OPTIONS, SNACKS, dailyMenu, completeDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FittFormaNutritionGuides = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
