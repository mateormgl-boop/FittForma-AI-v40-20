// v55: entrenar por grupos musculares, «Lo hice» desde la ficha, Músculos con «Entrenar esto hoy» y guía de alimentación.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v55.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
await page.addInitScript(() => { localStorage.setItem('fittforma-welcome-v1', '1'); setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); });
await page.goto(APP + '/'); await page.waitForTimeout(500);
const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
// Perfil de prueba antes de que cargue la app (si se escribe con la app abierta, la app lo pisa al guardar).
await page.addInitScript(() => { if (sessionStorage.getItem('v55-seed')) return; sessionStorage.setItem('v55-seed', '1'); const s = JSON.parse(localStorage.getItem('fittforma-ai-v4') || '{}'); s.sessions = s.sessions || []; s.profile = { ...(s.profile || {}), equipment: 'gym', level: 'intermediate', goal: 'muscle', duration: '45', currentWeightKg: 70 }; localStorage.setItem('fittforma-ai-v4', JSON.stringify(s)); });
await page.reload(); await page.waitForTimeout(500);
step('Perfil de prueba cargado', (await st()).profile?.goal === 'muscle');

// 1) Entrenar por grupos musculares
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
const splits = await page.$$eval('#focusPicker .focus-split small', n => n.map(x => x.textContent));
step('Combinaciones habituales agrupadas por división', splits.includes('Empuje · Tracción · Piernas') && splits.includes('Torso · Tren inferior') && splits.includes('Pares clásicos'), splits.join(' | '));
await page.click('[data-focus="back_biceps"]'); await page.waitForTimeout(200);
const prev = await page.textContent('#focusPreview');
step('«Espalda y bíceps» muestra la sesión antes de empezar', /Espalda y bíceps/.test(prev) && /Jalón|Remo/.test(prev) && /Curl/.test(prev), prev.replace(/\s+/g, ' ').slice(0, 140));
await page.click('#focusSave'); await page.waitForTimeout(200);
let s = await st();
step('«Guardar como rutina» la agrega a Mis rutinas', s.routines?.[0]?.name === 'Espalda y bíceps' && s.routines[0].exercises.length >= 4);
await page.click('#focusPicker .focus-custom summary'); await page.waitForTimeout(100);
await page.check('[data-focus-group="chest"]'); await page.check('[data-focus-group="calves"]'); await page.click('#focusBuildCustom'); await page.waitForTimeout(200);
const custom = await page.textContent('#focusPreview');
step('Elegir grupos a mano arma una sesión con esos grupos', /Elegido por vos/.test(custom) && /Pecho · Gemelos/.test(custom), custom.replace(/\s+/g, ' ').slice(0, 140));
await page.click('#focusStart'); await page.waitForTimeout(300);
const live = await page.evaluate(() => JSON.parse(localStorage.getItem('fittforma-ai-active-session-v1') || 'null'));
step('«Empezar ahora» abre una sesión en curso con esos ejercicios', live?.type === 'custom' && live.exercises?.length >= 4 && live.exercises.some(e => /Pecho/.test(e.group)), JSON.stringify({ t: live?.title, n: live?.exercises?.length }));
// Se descarta la sesión desde la propia app (Cancelar entrenamiento), como lo haría la persona.
await page.click('#cancelWorkout'); await page.waitForTimeout(300);
await page.reload(); await page.waitForTimeout(500);
step('Sin sesión en curso para seguir', await page.evaluate(() => !localStorage.getItem('fittforma-ai-active-session-v1')));

// 2) «Lo hice» desde la ficha del ejercicio
const before = (await st()).sessions?.length || 0;
await page.evaluate(() => { const all = [...document.querySelectorAll('[data-exercise-detail]')]; const b = all.find(x => /Press de banca/.test(x.dataset.exerciseDetail)) || all.find(x => (x.dataset.exerciseKind || 'strength') === 'strength' && !/plancha|isométric/i.test(x.dataset.exerciseDetail)); b?.click(); });
await page.waitForTimeout(300);
step('La ficha del ejercicio ofrece «Lo hice»', await page.isVisible('#quickLogOpen'), JSON.stringify(await page.evaluate(() => [document.querySelectorAll('[data-exercise-detail]').length, document.querySelector('.view.active')?.id, document.getElementById('exerciseModal')?.open, [...document.querySelectorAll('dialog[open]')].map(d => d.id)])));
await page.click('#quickLogOpen'); await page.fill('#qlSets', '3'); await page.fill('#qlValue', '10'); await page.fill('#qlWeight', '40');
await page.click('#quickLogForm button[type="submit"]'); await page.waitForTimeout(300);
s = await st(); const q = s.sessions?.find(x => x.source === 'quick');
step('Se guarda como registro suelto en el historial', s.sessions.length === before + 1 && q?.type === 'manual' && q.exercises?.[0]?.entries?.length === 3 && q.exercises[0].entries.every(e => e.done && String(e.weight) === '40'), JSON.stringify(q?.exercises?.[0]?.entries?.[0]));
step('Sin minutos cargados no se estima la duración', q?.minutes === 0);
await page.click('#quickLogOpen'); await page.fill('#qlValue', ''); await page.click('#quickLogForm button[type="submit"]'); await page.waitForTimeout(150);
step('Valida antes de guardar (sin repeticiones no guarda)', /Poné las repeticiones/.test(await page.textContent('#qlStatus')) && (await st()).sessions.length === before + 1);
await page.evaluate(() => document.querySelector('[data-close-exercise-modal]')?.click()); await page.waitForTimeout(150);
step('La ficha se cierra', !(await page.isVisible('#exerciseModal')));

// 3) Músculos: explicado y con «Entrenar esto hoy»
await page.evaluate(() => window.FittFormaShowMuscles?.()); await page.waitForTimeout(400);
const next = await page.textContent('#mrNext');
step('Músculos explica qué entrenar para subir', /entrenar/i.test(next) && (await page.$$('#mrList .mr-zones, #mrList [class*="zone"]')).length >= 0, next.replace(/\s+/g, ' ').slice(0, 120));
step('Leyenda de colores por rango', (await page.$$('#mrLegend li, #mrLegend span')).length >= 3);
if (await page.$('#mrTrainWeak')) {
  await page.click('#mrTrainWeak'); await page.waitForTimeout(400);
  const okView = await page.isVisible('#focusPicker'), pv = (await page.textContent('#focusPreview').catch(() => '')) || '';
  step('«Entrenar esto hoy» lleva a Entrenar con la sesión armada', okView && /ejercicios/.test(pv), `${okView} ${pv.replace(/\s+/g, ' ').slice(0, 120)}`);
} else step('«Entrenar esto hoy» disponible', false, 'no apareció el botón');

// 4) Nutrición: guía por objetivo y recetas
await page.click('.mobile-nav-item[data-mobile-view="nutrition"]'); await page.waitForTimeout(300);
await page.click('#view-nutrition [data-view-tab="plan"]'); await page.waitForTimeout(200);
const guide = await page.textContent('#nutritionGuideCard');
step('La guía elige el objetivo de la persona y calcula proteína con su peso', /Ganar músculo|músculo/i.test(guide) && /unos 1[12]\d–1[34]\d g/.test(guide), (await st()).profile?.goal + ' ' + guide.replace(/\s+/g, ' ').slice(0, 160));
step('Muestra fuentes y el aviso de que es orientativa', (await page.$$('#nutritionGuideCard .ng-sources a')).length >= 1 && /no reemplaza a un profesional/.test(guide));
await page.click('#nutritionGuideCard [data-guide="lose"]'); await page.waitForTimeout(150);
step('Se puede ver la guía de otro objetivo', /Bajar grasa|grasa/i.test(await page.textContent('#nutritionGuideCard h3')));
const all = (await page.$$('#recipeList details.recipe')).length;
await page.click('[data-recipe-filter="goal"]'); await page.waitForTimeout(150);
const some = (await page.$$('#recipeList details.recipe')).length;
step('Más recetas y filtro por objetivo', all >= 20 && some > 0 && some < all, `${all} → ${some}`);
step('Las recetas nuevas indican que están calculadas con la base de alimentos', /calculado con la base de alimentos \(USDA\)/.test(await page.textContent('#recipeList')));
const plate = await page.$eval('.ng-plate', el => getComputedStyle(el).backgroundImage);
step('El plato se dibuja (gráfico de proporciones)', /conic-gradient/.test(plate));

// 5) 320 px sin desborde horizontal
await page.setViewportSize({ width: 320, height: 720 }); await page.waitForTimeout(200);
for (const v of ['nutrition', 'train']) {
  await page.click(`.mobile-nav-item[data-mobile-view="${v}"]`); await page.waitForTimeout(250);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  step(`Sin desborde horizontal a 320 px (${v})`, w <= 321, String(w));
}
step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv55: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
