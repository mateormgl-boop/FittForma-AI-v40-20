// v56: Hidratación, ejercicios nuevos, biblioteca (filtros, lista, búsqueda por músculo), ficha (historial, agregar a
// rutina, alternativas), progresión con números, división semanal, calendario del mes, series por grupo,
// repetir comidas de ayer y Perfil. Solo la app; no necesita la base.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v56.e2e.mjs
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
await page.addInitScript(() => {
  localStorage.setItem('fittforma-welcome-v1', '1'); setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50);
  if (sessionStorage.getItem('v56-seed')) return; sessionStorage.setItem('v56-seed', '1');
  const d = n => { const x = new Date(); x.setDate(x.getDate() - n); const z = new Date(x.getTime() - x.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const ex = (name, group, w, r, n = 3) => ({ name, group, kind: 'strength', entries: Array.from({ length: n }, () => ({ reps: String(r), weight: String(w), done: true })) });
  localStorage.setItem('fittforma-ai-v4', JSON.stringify({
    sessions: [
      { id: 1, type: 'custom', status: 'completed', date: d(0), title: 'Empuje', minutes: 50, exercises: [ex('Press de banca con mancuernas', 'Pecho', 24, 12), ex('Press militar con mancuernas', 'Hombros', 14, 10)] },
      { id: 2, type: 'custom', status: 'completed', date: d(3), title: 'Tracción', minutes: 45, exercises: [ex('Jalón al pecho', 'Espalda', 45, 10)] },
      { id: 3, type: 'manual', status: 'completed', date: d(7), title: 'Pecho', minutes: 40, exercises: [ex('Press de banca con mancuernas', 'Pecho', 22, 10)] }],
    activities: [{ id: 9, date: d(1), type: 'Correr', distance: 5, minutes: 30 }],
    meals: [{ id: 11, date: d(1), type: 'Desayuno', name: 'Avena con banana', calories: 420, protein: 15, carbs: 70, fat: 9 }, { id: 12, date: d(1), type: 'Almuerzo', name: 'Pollo con arroz', calories: 620, protein: 45, carbs: 66, fat: 15 }],
    routines: [{ id: 'r1', name: 'Pecho A', notes: '', exercises: [], createdAt: '2026-10-01', updatedAt: '2026-10-01' }],
    profile: { goal: 'muscle', currentWeightKg: 72, heightCm: 175, age: 30, equipment: 'gym', level: 'intermediate', duration: '45' }
  }));
});
await page.goto(APP + '/'); await page.waitForTimeout(700);
const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
step('Datos de prueba cargados', (await st()).sessions?.length === 3);

// Hidratación
const tile = await page.textContent('[data-home-quick="water"]');
step('Inicio: el acceso se llama «Hidratación»', /Hidratación/.test(tile) && !/\+1 vaso de agua/.test(tile), tile.replace(/\s+/g, ' ').trim());

// Biblioteca
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('[data-subview="exercises"]')?.click()); await page.waitForTimeout(300);
await page.click('[data-library-mode="gym"]'); await page.waitForTimeout(200);
const total = Number((await page.textContent('#exerciseResultCount')).match(/\d+/)[0]);
step('Gimnasio: 104 ejercicios (24 nuevos)', total === 104, String(total));
await page.selectOption('#exerciseSort', 'new'); await page.waitForTimeout(200);
step('«Nuevos primero» muestra los nuevos con su etiqueta', /Nuevo/.test(await page.textContent('#exerciseLibraryResults .exercise-library-item')));
await page.selectOption('#exerciseLevelFilter', '1'); await page.waitForTimeout(150);
const beginners = Number((await page.textContent('#exerciseResultCount')).match(/\d+/)[0]);
step('Filtro por nivel', beginners > 0 && beginners < total, `${beginners} de ${total}`);
await page.selectOption('#exerciseLevelFilter', 'all'); await page.selectOption('#exerciseKindFilter', 'cardio'); await page.waitForTimeout(150);
step('Filtro por tipo (cardio incluye «Saltar la cuerda»)', /Saltar la cuerda/.test(await page.textContent('#exerciseLibraryResults')));
await page.selectOption('#exerciseKindFilter', 'all'); await page.fill('#exerciseSearch', 'glúteo medio'); await page.waitForTimeout(200);
step('Búsqueda por músculo («glúteo medio»)', (await page.$$('#exerciseLibraryResults .exercise-library-item')).length >= 2, await page.textContent('#exerciseResultCount'));
await page.fill('#exerciseSearch', ''); await page.selectOption('#exerciseSort', 'done'); await page.waitForTimeout(200);
const firstDone = await page.textContent('#exerciseLibraryResults .exercise-library-item');
step('«Más hechos» pone primero lo que más hiciste, con su uso', /Press de banca con mancuernas/.test(firstDone) && /Lo hiciste 2 veces/.test(firstDone));
await page.click('[data-library-view="list"]'); await page.waitForTimeout(200);
step('Vista en lista', (await page.$$('#exerciseLibraryResults .exercise-list-row')).length === total && await page.evaluate(() => localStorage.getItem('fittforma-library-view') === 'list'));

// Ficha: historial, agregar a rutina y alternativas
await page.click('#exerciseLibraryResults .exercise-list-main'); await page.waitForTimeout(400);
const hist = await page.textContent('#exerciseModalHistory');
step('Ficha: «Tu historial» con mejor marca y fuerza estimada', /Veces registrado\s*2/.test(hist) && /24 kg × 12/.test(hist) && /Fuerza máxima estimada/.test(hist), hist.replace(/\s+/g, ' ').slice(0, 140));
// v57: historial y «Agregar a la rutina» están en la pestaña «Mi progreso»; las alternativas, en «Cómo se hace».
await page.click('#exTabMineBtn'); await page.waitForTimeout(100);
await page.selectOption('#exAddRoutineSel', 'r1'); await page.click('#exAddRoutineBtn'); await page.waitForTimeout(200);
let s = await st();
step('«Agregar a la rutina» lo suma a la rutina elegida', s.routines[0].exercises.some(e => e.name === 'Press de banca con mancuernas'), await page.textContent('#exAddRoutineStatus'));
await page.click('#exAddRoutineBtn'); await page.waitForTimeout(150);
step('No lo agrega dos veces', /Ya está en/.test(await page.textContent('#exAddRoutineStatus')));
await page.click('#exTabHowBtn'); await page.waitForTimeout(100);
const altName = await page.getAttribute('#exerciseModalAlternatives .ex-alt', 'data-exercise-detail');
await page.click('#exerciseModalAlternatives .ex-alt'); await page.waitForTimeout(300);
step('Las alternativas abren su propia ficha', (await page.textContent('#exerciseModalTitle')) === altName, altName);
await page.evaluate(() => document.querySelector('[data-close-exercise-modal]')?.click()); await page.waitForTimeout(150);

// Ejercicio nuevo: ficha completa
await page.fill('#exerciseSearch', 'búlgara'); await page.waitForTimeout(200);
await page.click('#exerciseLibraryResults .exercise-list-main'); await page.waitForTimeout(400);
const bulg = await page.textContent('#exerciseModal');
step('Ejercicio nuevo con animación, fotos, músculos y ficha', await page.isVisible('#exerciseModal .exercise-gif-hero img') && /Cuádriceps/.test(bulg) && /Posición inicial/.test(bulg) && /Errores comunes/.test(bulg));
await page.evaluate(() => document.querySelector('[data-close-exercise-modal]')?.click()); await page.waitForTimeout(150);
await page.click('[data-library-view="grid"]'); await page.fill('#exerciseSearch', '');

// División semanal y progresión con números
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
await page.selectOption('#focusSplitPlan', 'ppl'); await page.waitForTimeout(300);
step('Elegir la división la guarda en el perfil', (await st()).profile.splitPlan === 'ppl');
const today = await page.textContent('.focus-today');
step('«Hoy toca» la que sigue a la última (Empuje → Tracción)', /Tracción/.test(today) && /La última fue Empuje/.test(today), today.replace(/\s+/g, ' ').trim());
await page.click('.focus-today [data-focus]'); await page.waitForTimeout(200);
await page.click('#focusStart'); await page.waitForTimeout(400);
const live = await page.locator('.workout-exercise:visible').first().textContent();
step('En la sesión: sugerencia concreta para «Jalón al pecho» (45 kg × 10 → 47,5 kg × 6)', /Probá 47,5 kg × 6 en cada serie/.test(live), live.replace(/\s+/g, ' ').match(/Probá[^.]*\./)?.[0] || '');
const ph = await page.locator('.workout-exercise:visible input[data-k="weight"]').first().getAttribute('placeholder');
const val = await page.locator('.workout-exercise:visible input[data-k="weight"]').first().inputValue();
step('El peso sugerido es solo una guía (placeholder), no un valor cargado', ph === '47.5' && val === '', `${ph} / «${val}»`);
await page.click('#cancelWorkout'); await page.waitForTimeout(300);

// Progreso
await page.click('.mobile-nav-item[data-mobile-view="progress"]'); await page.waitForTimeout(300);
const cal = await page.textContent('#monthCalendarCard');
const marked = await page.$$eval('#monthCalendarCard .mc-cell.is-train, #monthCalendarCard .mc-cell.is-act, #monthCalendarCard .mc-cell.is-both', n => n.length);
step('Calendario del mes con días activos', /días activos en el mes/.test(cal) && marked >= 2, `${marked} días marcados`);
await page.click('#monthCalendarCard .mc-cell.is-train'); await page.waitForTimeout(150);
step('Tocar un día muestra lo que hiciste', (await page.$('#monthCalendarCard .mc-day li')) !== null);
await page.click('[data-mc-nav="-1"]'); await page.waitForTimeout(150);
step('Se puede ver el mes anterior y no el futuro', await page.isEnabled('[data-mc-nav="1"]'));
const mw = await page.textContent('#muscleWeekCard');
step('Series por grupo muscular de esta semana', /Series por grupo muscular/.test(mw) && /Pecho/.test(mw), mw.replace(/\s+/g, ' ').slice(0, 120));

// Nutrición: repetir comidas de ayer
await page.click('.mobile-nav-item[data-mobile-view="nutrition"]'); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#view-nutrition [data-view-tab="hoy"]')?.click()); await page.waitForTimeout(200);
step('Ofrece repetir las comidas de ayer', /Ayer registraste 2 comidas \(1040 kcal\)/.test(await page.textContent('.meal-repeat')));
await page.click('#repeatYesterdayMeals'); await page.waitForTimeout(300);
s = await st(); const todayKey = s.meals.map(m => m.date).sort().pop();
step('Copia las 2 comidas a hoy', s.meals.filter(m => m.date === todayKey).length === 2 && s.meals.length === 4);
await page.click('#repeatYesterdayMeals'); await page.waitForTimeout(200);
step('No las duplica si ya están', (await st()).meals.length === 4);

// Perfil
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(300);
step('Perfil: el formulario de datos queda plegado si ya están completos', !(await page.evaluate(() => document.getElementById('bodyEditDetails').open)) && await page.isVisible('.profile-settings-link')); // v69: los ajustes pasaron a su propia sección

// 320 px
await page.setViewportSize({ width: 320, height: 720 }); await page.waitForTimeout(200);
for (const v of ['train', 'progress', 'nutrition', 'profile']) {
  await page.click(`.mobile-nav-item[data-mobile-view="${v}"]`); await page.waitForTimeout(250);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  step(`Sin desborde horizontal a 320 px (${v})`, w <= 321, String(w));
}
step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv56: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
