// v58: Mi semana y rutinas listas, Inicio personalizable con «Lo que hiciste en el gym», menú según el objetivo,
// «Completá tu día» e insignias con la galería «Sistema de insignias».
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v58.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const today = new Date().toISOString().slice(0, 10), ago = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const ex = (name, group, w, r, n = 3) => ({ name, group, kind: 'strength', entries: Array.from({ length: n }, () => ({ reps: String(r), weight: String(w), done: true })) });
const seed = {
  profile: { name: 'Mateo', equipment: 'gym', level: 'intermediate', goal: 'muscle', bodyGoal: 'muscle', days: '4', duration: '60', currentWeightKg: 75 },
  nutritionGoals: { calories: 2800, protein: 150, carbs: 330, fat: 80, water: 2500 },
  sessions: [{ id: 11, type: 'custom', status: 'completed', date: ago(1), title: 'Pecho y tríceps', minutes: 55, exercises: [ex('Press de banca con barra', 'Pecho', 60, 8, 4), ex('Extensión de tríceps en polea', 'Brazos', 25, 12)] },
    { id: 12, type: 'custom', status: 'completed', date: ago(3), title: 'Espalda y bíceps', minutes: 60, exercises: [ex('Jalón al pecho', 'Espalda', 50, 10), ex('Curl de bíceps con mancuernas', 'Brazos', 12, 12)] }],
  meals: [{ id: 1, date: today, type: 'Almuerzo', name: 'Milanesa con puré', calories: 750, protein: 42, carbs: 70, fat: 30 }],
  badgeRecords: [{ id: 1, exerciseId: 'exercise-dominadas', exerciseName: 'Dominadas', measure: 'reps', value: 40, unit: 'reps', date: ago(2), source: 'manual' }]
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
await page.addInitScript(s => { localStorage.setItem('fittforma-welcome-v1', '1'); if (!sessionStorage.getItem('v58-seed')) { sessionStorage.setItem('v58-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); } setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); }, JSON.stringify(seed));
await page.goto(APP + '/'); await page.waitForTimeout(900);
const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
const wd = await page.evaluate(() => FittFormaTraining.weekdayOf(new Date().toISOString().slice(0, 10)));

// 1) Entrenar: Mi semana y rutinas listas
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(400);
step('«Mi semana» con los 7 días', (await page.$$('#weekPlan .wp-day')).length === 7);
const rec = (await page.textContent('.wp-today')).replace(/\s+/g, ' ');
step('Sin semana armada recomienda según lo que entrenaste', /Te recomendamos para hoy/.test(rec) && /(Piernas|Hombros y core|Glúteos e isquios)/.test(rec) && /(no registraste|no entrenás)/.test(rec), rec.slice(0, 140));
await page.click('#wpProgramsToggle'); await page.waitForTimeout(200);
const top = (await page.textContent('#wpPrograms .wp-program.is-recommended')).replace(/\s+/g, ' ');
step('Rutina recomendada para vos, con sus motivos', /Recomendada para vos/.test(top) && /Pares clásicos 4 días/.test(top) && /Se parece a lo que venís haciendo/.test(top), top.slice(0, 160));
step('Hay al menos 8 rutinas listas para tu equipamiento', (await page.$$('#wpPrograms .wp-program')).length >= 8);
await page.click('#wpPrograms .wp-program.is-recommended [data-wp-program]'); await page.waitForTimeout(300);
let s = await st();
step('«Usar esta» arma la semana', s.weekPlan?.programId === 'pairs4' && s.weekPlan.days[1]?.key === 'chest_triceps' && s.weekPlan.days[2]?.key === 'back_biceps', JSON.stringify(s.weekPlan?.days));
await page.click(`[data-wp-day="${wd}"]`); await page.waitForTimeout(150);
await page.click('[data-wp-set="focus:legs"]'); await page.waitForTimeout(250);
s = await st();
step('Se puede elegir qué entrenar un día puntual', s.weekPlan.days[wd]?.key === 'legs' && s.weekPlan.programId === '', JSON.stringify(s.weekPlan.days[wd]));
step('«Hoy toca» sigue tu semana', /Hoy toca/.test(await page.textContent('.wp-today')) && /Piernas/.test(await page.textContent('.wp-today')));
await page.click('#wpStartToday'); await page.waitForTimeout(300);
const prev = (await page.textContent('#focusPreview')).replace(/\s+/g, ' ');
step('«Ver la sesión» arma la sesión del día', /Piernas/.test(prev) && /ejercicios/.test(prev), prev.slice(0, 100));
await page.click(`[data-wp-day="${wd}"]`); await page.click('.wp-groups summary'); await page.check('[data-wp-group="chest"]'); await page.check('[data-wp-group="calves"]'); await page.click('[data-wp-groups-save]'); await page.waitForTimeout(250);
s = await st();
step('O elegir grupos a mano para ese día', JSON.stringify(s.weekPlan.days[wd]) === JSON.stringify({ kind: 'groups', groups: ['chest', 'calves'] }));

// 2) Inicio: «Hoy toca», lo que hiciste en el gym y personalizar
await page.click('.mobile-nav-item[data-mobile-view="plan"]').catch(() => {}); await page.evaluate(() => document.querySelector('[data-mobile-view="plan"],[data-view="plan"]')?.click()); await page.waitForTimeout(400);
step('Inicio muestra lo que toca hoy', /Hoy toca: Pecho y gemelos/.test(await page.textContent('#homeTodayTitle')), await page.textContent('#homeTodayTitle'));
const gym = (await page.textContent('#homeGym')).replace(/\s+/g, ' ');
step('«Lo que hiciste en el gym» con ejercicios y mejores series', /Pecho y tríceps/.test(gym) && /Press de banca con barra/.test(gym) && /60 kg × 8/.test(gym), gym.slice(0, 140));
await page.click('[data-home-repeat="11"]'); await page.waitForTimeout(400);
const live = await page.evaluate(() => JSON.parse(localStorage.getItem('fittforma-ai-active-session-v1') || 'null'));
step('«Repetir» empieza la misma sesión', live?.title === 'Pecho y tríceps' && live.exercises?.length === 2 && live.exercises[0].sets === 4, JSON.stringify({ t: live?.title, n: live?.exercises?.length }));
await page.click('#cancelWorkout'); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('[data-mobile-view="plan"]')?.click()); await page.waitForTimeout(300);
await page.click('#homeCustomize'); await page.waitForTimeout(150);
await page.uncheck('[data-layout-show="quote"]'); for (let i = 0; i < 2; i++) await page.click('[data-layout-move="gym:-1"]');
await page.click('#homeLayoutDialog button[value="ok"]'); await page.waitForTimeout(200);
s = await st();
step('Personalizar inicio guarda orden y tarjetas ocultas', s.homeLayout?.order?.[0] === 'gym' && s.homeLayout.hidden.includes('quote'), JSON.stringify(s.homeLayout));
await page.reload(); await page.waitForTimeout(800);
const order = await page.$$eval('#view-plan .home-block', n => n.map(x => x.dataset.homeBlock + (x.hidden ? '(oculta)' : '')));
step('Después de recargar se respeta', order[0] === 'gym' && order.includes('quote(oculta)'), order.join(' '));

// 3) Nutrición: «Completá tu día» y menú según el objetivo
await page.click('.mobile-nav-item[data-mobile-view="nutrition"]'); await page.waitForTimeout(400);
const cd = (await page.textContent('#completeDayCard')).replace(/\s+/g, ' ');
step('«Completá tu día» dice cuánto falta y ofrece opciones', /Te faltan 2050 kcal y 108 g de proteína/.test(cd) && (await page.$$('[data-complete-add]')).length >= 2, cd.slice(0, 120));
const mealsBefore = (await st()).meals.length;
await page.click('[data-complete-add="0"]'); await page.waitForTimeout(300);
s = await st(); const added = s.meals[s.meals.length - 1];
step('«Agregar» registra la opción con sus alimentos', s.meals.length === mealsBefore + 1 && added.items?.length >= 1 && added.calories > 0, JSON.stringify({ n: added.name?.slice(0, 50), k: added.calories }));
await page.click('#view-nutrition [data-view-tab="plan"]'); await page.waitForTimeout(300);
step('Menú de ejemplo con 4 comidas y cantidades', (await page.$$('#goalMenu .goal-meal')).length === 4 && /\d+ g/.test(await page.textContent('#goalMenu .goal-meal')));
const first = await page.textContent('#goalMenu .goal-meal strong');
await page.click('[data-goal-swap="Desayuno"]'); await page.waitForTimeout(200);
step('«Otra opción» cambia la comida', first !== await page.textContent('#goalMenu .goal-meal strong'));
const k0 = (await st()).meals.length; await page.click('[data-goal-add="Desayuno"]'); await page.waitForTimeout(200);
step('«Agregar a hoy» la registra', (await st()).meals.length === k0 + 1);

// 4) Insignias
await page.evaluate(() => document.querySelector('[data-show-badges]')?.click()); await page.waitForTimeout(600);
step('Galería «Sistema de insignias» con los 5 rangos', /Sistema de insignias/i.test(await page.textContent('.badge-system')) && (await page.$$('.badge-system .ff-medal')).length === 5);
const row = await page.$('.badge-row-card');
step('Cada desafío muestra su fila de rangos', (await row.$$('.brc-tier')).length === 5 && /DOMINADAS|Dominadas/.test(await row.textContent()));
step('40 dominadas: los 5 rangos encendidos, Legendario con corona', (await row.$$('.brc-tier.is-on')).length === 5 && (await row.$$('.ff-medal--legend .ff-medal-crown')).length === 1);
await row.click(); await page.waitForTimeout(400);
step('La ficha cuenta sobre 15 niveles', /15\/15/.test(await page.textContent('#badgeDetail')));

// 5) Inglés y 320 px
await page.evaluate(() => window.FittFormaI18n?.setLanguage('en')); await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(400);
step('«Mi semana» traducida', /My week/.test(await page.textContent('#weekPlan')) && /Ready-made routines/.test(await page.textContent('#weekPlan')));
await page.evaluate(() => window.FittFormaI18n?.setLanguage('es')); await page.waitForTimeout(200);
await page.setViewportSize({ width: 320, height: 720 }); await page.waitForTimeout(200);
for (const v of ['plan', 'train', 'nutrition', 'progress']) {
  await page.evaluate(v => document.querySelector(`.mobile-nav-item[data-mobile-view="${v}"]`)?.click(), v); await page.waitForTimeout(300);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  step(`Sin desborde horizontal a 320 px (${v})`, w <= 321, String(w));
}
step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv58: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
