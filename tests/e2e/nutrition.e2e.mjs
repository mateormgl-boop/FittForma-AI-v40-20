// v50: buscador de alimentos — búsqueda, variantes, porciones, registro, favoritos, frecuentes, edición y
// productos envasados (Open Food Facts simulado; sin conexión la base local sigue funcionando).
// Uso: APP_URL=http://localhost:8787 node tests/e2e/nutrition.e2e.mjs
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
let offMode = 'ok';
await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
await page.route(/world\.openfoodfacts\.org\/cgi\/search\.pl/, r => offMode === 'down' ? r.abort() : r.fulfill({ contentType: 'application/json', body: JSON.stringify({ products: [
  { code: '0000000000001', product_name: 'Galletitas de ejemplo', brands: 'Marca A', countries_tags: ['en:argentina'], nutriments: { 'energy-kcal_100g': 450, proteins_100g: 7, carbohydrates_100g: 68, fat_100g: 16 } },
  { code: '0000000000002', product_name: 'Yogur bebible de ejemplo', brands: 'Marca UY', countries_tags: ['en:uruguay'], serving_quantity: 200, nutriments: { 'energy-kcal_100g': 80, proteins_100g: 3, carbohydrates_100g: 13, fat_100g: 1.5 } },
  { code: '0000000000003', product_name: 'Sin datos', brands: 'X', nutriments: { proteins_100g: 2 } }] }) }));
await page.addInitScript(() => localStorage.setItem('fittforma-welcome-v1', '1'));
await page.goto(APP + '/'); await page.waitForTimeout(500);
const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
await page.click('.mobile-nav-item[data-mobile-view="nutrition"]'); await page.waitForTimeout(300);
await page.evaluate(() => { const t = document.querySelector('[data-view-tab="registrar"],[data-tab="registrar"],[aria-controls*="registrar"]'); if (t) t.click(); else document.querySelectorAll('[data-view-panel]').forEach(p => p.hidden = p.dataset.viewPanel !== 'registrar'); });
await page.waitForTimeout(300);
step('La base local informa su tamaño', /\d{3} alimentos/.test(await page.textContent('#foodFinderIntro')), await page.textContent('#foodFinderIntro'));
await page.fill('#foodSearch', 'papa'); await page.waitForTimeout(200);
const results = await page.$$eval('#foodResults .food-result', n => n.map(x => x.textContent));
step('Búsqueda rápida con resultados y datos por 100 g', results.length >= 4 && results.every(r => /kcal/.test(r)), results.slice(0, 3).join(' | '));
await page.click('#foodResults .food-result'); await page.waitForTimeout(200);
step('Variantes de preparación visibles', (await page.$$('#foodVariants [data-food-id]')).length >= 4);
await page.click('#foodVariants [data-food-id]:has-text("Hervida")'); await page.waitForTimeout(150);
step('Fuente verificable USDA con número NDB', /USDA SR28 · NDB \d{5}/.test(await page.textContent('#foodSource')));
await page.selectOption('#foodUnit', 'g'); await page.fill('#foodAmount', '200'); await page.waitForTimeout(150);
const kcal = Number((await page.textContent('#foodMacros .stat strong')).trim());
step('Calorías según la cantidad (papa hervida 200 g = 172 kcal)', kcal === 172, String(kcal));
await page.selectOption('#foodMealType', 'Cena'); await page.click('#foodAddMeal'); await page.waitForTimeout(300);
let s = await st(); let meal = s.meals?.[s.meals.length - 1];
step('Se registra en la comida elegida con sus nutrientes', meal?.type === 'Cena' && meal.calories === 172 && meal.items?.[0]?.grams === 200, JSON.stringify(meal));
// Sinónimo + receta estimada
await page.fill('#foodSearch', 'chivito'); await page.waitForTimeout(150); await page.click('#foodResults .food-result'); await page.waitForTimeout(150);
step('Receta típica marcada como estimación', /Estimación por receta/.test(await page.textContent('#foodSource')));
await page.click('#foodFav'); await page.waitForTimeout(150);
await page.fill('#foodAmount', '1'); await page.selectOption('#foodMealType', 'Almuerzo'); await page.click('#foodAddMeal'); await page.waitForTimeout(250);
s = await st(); meal = s.meals[s.meals.length - 1];
step('Porción (1 unidad) y aviso de estimación en el registro', meal.estimated === true && meal.items[0].unit === 'p0' && /Estimación/.test(await page.textContent('#mealList')));
// Bebida en ml
await page.fill('#foodSearch', 'leche'); await page.waitForTimeout(150);
await page.click('#foodResults .food-result:has-text("Leche")'); await page.waitForTimeout(150);
await page.click('#foodVariants [data-food-id]:has-text("Entera")'); await page.waitForTimeout(100);
await page.selectOption('#foodUnit', 'ml'); await page.fill('#foodAmount', '250'); await page.waitForTimeout(100);
step('Mililitros con densidad real (250 ml de leche ≈ 258 g)', /25[78](\.\d)? g en total/.test(await page.textContent('#foodEstimate')), await page.textContent('#foodEstimate'));
// Favoritos y frecuentes
await page.fill('#foodSearch', ''); await page.waitForTimeout(150);
const quick = await page.textContent('#foodQuick');
step('Favoritos y frecuentes visibles al abrir el buscador', /Favoritos[\s\S]*Chivito[\s\S]*Frecuentes[\s\S]*Papa/.test(quick), quick.replace(/\s+/g, ' ').slice(0, 120));
// Cargar en el formulario → editar → guardar conserva los items
await page.fill('#foodSearch', 'banana'); await page.waitForTimeout(150); await page.click('#foodResults .food-result'); await page.waitForTimeout(100);
await page.click('#useFood'); await page.waitForTimeout(100);
step('Carga los valores en el formulario', Number(await page.inputValue('#mealCalories')) > 0 && /Banana/.test(await page.inputValue('#mealName')));
await page.click('#mealForm button[type="submit"]'); await page.waitForTimeout(250);
s = await st(); step('El registro desde el formulario conserva el alimento', s.meals[s.meals.length - 1].items?.[0]?.foodId?.startsWith('sr'));
const before = s.meals.length;
await page.evaluate(() => document.querySelector('#mealList .removeMeal').click()); await page.waitForTimeout(250); s = await st();
step('Eliminar un registro', s.meals.length === before - 1);
// Productos envasados (simulado) y caída del servicio
await page.fill('#foodSearch', 'ejemplo'); await page.click('#foodOnline'); await page.waitForTimeout(400);
const off = await page.$$eval('#foodResults .food-result', n => n.map(x => x.textContent));
step('Productos envasados: solo con datos suficientes y los de Uruguay primero', off.length === 2 && /Marca UY/.test(off[0]) && off.every(x => /Etiqueta/.test(x)), off.join(' | '));
await page.click('#foodResults .food-result'); await page.waitForTimeout(100);
step('Producto envasado con porción del envase', /1 porción del envase \(200 g\)/.test(await page.textContent('#foodUnit')));
offMode = 'down'; await page.fill('#foodSearch', 'arroz'); await page.click('#foodOnline'); await page.waitForTimeout(400);
step('Si la API falla, se avisa y la base local sigue funcionando', /base local sigue disponible/.test(await page.textContent('#foodOnlineStatus')) && (await page.$$('#foodResults .food-result')).length > 0);
step('Sin errores de página', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO PASA');
process.exit(failures ? 1 : 0);
