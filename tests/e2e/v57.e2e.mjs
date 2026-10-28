// v57: Nutrición con gramos por alimento, insignias Legendario, Músculos desde Bronce, ficha en pestañas y animaciones WebP.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v57.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const today = new Date().toISOString().slice(0, 10);
// Marca real de dominadas (40 repeticiones, declarada) para ver el nivel Legendario; y una sesión para Músculos.
const seed = {
  profile: { equipment: 'gym', level: 'intermediate', goal: 'muscle', currentWeightKg: 70 },
  sessions: [{ id: 1, type: 'custom', status: 'completed', date: today, title: 'Espalda', minutes: 40, exercises: [{ name: 'Remo con barra', group: 'Espalda', kind: 'strength', entries: [{ reps: '10', weight: '40', done: true }, { reps: '10', weight: '40', done: true }] }] }],
  badgeRecords: [{ id: 1, exerciseId: 'exercise-dominadas', exerciseName: 'Dominadas', measure: 'reps', value: 40, unit: 'reps', date: today, source: 'manual' }]
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
await page.addInitScript(s => { localStorage.setItem('fittforma-welcome-v1', '1'); if (!sessionStorage.getItem('v57-seed')) { sessionStorage.setItem('v57-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); } setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); }, JSON.stringify(seed));
await page.goto(APP + '/'); await page.waitForTimeout(800);
const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);

// 1) Nutrición: cantidades por alimento, editables
await page.click('.mobile-nav-item[data-mobile-view="nutrition"]'); await page.waitForTimeout(300);
await page.click('#view-nutrition [data-view-tab="registrar"]'); await page.waitForTimeout(250);
await page.evaluate(() => { const f = document.getElementById('mealForm'); f?.closest('details')?.setAttribute('open', ''); f?.scrollIntoView(); });
await page.fill('#mealName', '100 g de hamburguesa, 2 croquetas de papa y 200 g de pan'); await page.waitForTimeout(300);
const grams = await page.$$eval('#mealParse [data-parse-grams]', n => n.map(x => Number(x.value)));
step('Reconoce los tres alimentos con sus gramos', JSON.stringify(grams) === '[100,90,200]', JSON.stringify(grams));
const kcal1 = Number(await page.inputValue('#mealCalories'));
await page.fill('#mealParse [data-parse-grams="2"]', '100'); await page.waitForTimeout(200);
const kcal2 = Number(await page.inputValue('#mealCalories'));
step('Cambiar los gramos del pan recalcula el total', kcal1 > 0 && kcal2 > 0 && kcal2 < kcal1, `${kcal1} → ${kcal2}`);
await page.click('#mealForm button[type="submit"]'); await page.waitForTimeout(300);
const meal = (await st()).meals?.[0];
step('La comida se guarda con los gramos de cada alimento', meal && Number(meal.calories) === kcal2 && JSON.stringify(meal.items?.map(i => i.grams)) === '[100,90,100]', JSON.stringify(meal?.items?.map(i => i.grams)));
await page.fill('#mealName', 'xyzzy'); await page.waitForTimeout(250);
step('Lo que no reconoce se avisa (no se inventa)', /No reconocí/.test(await page.textContent('#mealParse')));
await page.fill('#mealName', '');

// 2) Insignias: nivel Legendario de material negro
await page.evaluate(() => document.querySelector('[data-show-badges]')?.click()); await page.waitForTimeout(500);
const legend = await page.$$eval('.ff-medal--legend', n => n.length);
step('Dominadas con 40 repeticiones llega a Legendario (medalla negra)', legend > 0, String(legend));
step('Se explican los 15 niveles', /15 niveles/.test(await page.textContent('body')));

// 3) Músculos: desde Bronce hasta Leyenda, mapa grande y comparación
await page.evaluate(() => window.FittFormaShowMuscles?.()); await page.waitForTimeout(400);
const legendText = await page.textContent('#mrLegend');
step('La escalera empieza en Bronce y termina en Leyenda', /Bronce/.test(legendText) && /Leyenda/.test(legendText) && !/Hierro|Madera/.test(legendText), legendText.replace(/\s+/g, ' ').slice(0, 120));
step('Músculos sin series dicen «Sin entrenar»', /Sin entrenar/.test(await page.textContent('#mrList')));
step('La espalda entrenada se pinta en el mapa', (await page.$$('.mr-fig .am-m.is-ranked')).length > 0);
await page.click('[data-mr-view="compare"]'); await page.waitForTimeout(250);
step('«Comparar» muestra frente y espalda por separado', await page.isVisible('.mr-side-chips'));

// 4) Ficha del ejercicio en dos pestañas, con animación WebP
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
await page.evaluate(() => { document.querySelector('[data-library-mode="gym"]')?.click(); const q = document.getElementById('exerciseSearch'); if (q) { q.value = 'Sentadilla trasera'; q.dispatchEvent(new Event('input', { bubbles: true })); } }); await page.waitForTimeout(300);
await page.evaluate(() => [...document.querySelectorAll('[data-exercise-detail]')].find(x => x.dataset.exerciseDetail === 'Sentadilla trasera con barra')?.click());
await page.waitForTimeout(500);
step('Abre la ficha nueva en «Cómo se hace»', /Sentadilla trasera con barra/.test(await page.textContent('#exerciseModal')) && await page.isVisible('#exTabHow') && !(await page.isVisible('#exTabMine')) && (await page.getAttribute('#exTabHowBtn', 'aria-selected')) === 'true');
const img = await page.$eval('#exerciseModal .exercise-gif-hero img', i => ({ src: i.getAttribute('src'), w: i.naturalWidth }));
step('La animación es WebP y carga', /\.webp$/.test(img.src) && img.w > 0, JSON.stringify(img));
await page.click('#exTabMineBtn'); await page.waitForTimeout(200);
step('«Mi progreso» muestra «Lo hice» y el historial', await page.isVisible('#quickLogOpen') && !(await page.isVisible('#exTabHow')));
await page.evaluate(() => window.FittFormaI18n?.setLanguage('en')); await page.waitForTimeout(300);
step('Las pestañas y la ficha nueva se traducen', /How to do it/.test(await page.textContent('#exTabHowBtn')) && /My progress/.test(await page.textContent('#exTabMineBtn')));
await page.click('#exTabHowBtn'); await page.waitForTimeout(200);
step('Los pasos de la ficha nueva quedan en inglés', /Set the bar in the rack at chest height/.test(await page.textContent('#exTabHow')), (await page.textContent('#exTabHow')).replace(/\s+/g, ' ').slice(0, 160));
await page.evaluate(() => window.FittFormaI18n?.setLanguage('es')); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('[data-close-exercise-modal]')?.click()); await page.waitForTimeout(150);

// 5) 320 px sin desborde horizontal
await page.setViewportSize({ width: 320, height: 720 }); await page.waitForTimeout(200);
for (const v of ['nutrition', 'progress', 'train']) {
  await page.click(`.mobile-nav-item[data-mobile-view="${v}"]`); await page.waitForTimeout(250);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  step(`Sin desborde horizontal a 320 px (${v})`, w <= 321, String(w));
}
step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv57: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
