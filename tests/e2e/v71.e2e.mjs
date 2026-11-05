// v71: coronita de miembros, «Próxima serie» y récord al momento en la sesión, «Lo de siempre» en Nutrición y tendencia del peso.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v71.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TYPES = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'];
const weights = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, date: day(29 - i), kg: Math.round((80 - i * 0.05 + (i % 3 ? 0.5 : -0.5)) * 10) / 10 }));
const seed = {
  profile: { equipment: 'gym', level: 'intermediate', goal: 'muscle', currentWeightKg: 78 },
  sessions: [{ id: 1, type: 'custom', status: 'completed', date: day(3), title: 'Pecho', minutes: 40, exercises: [{ name: 'Press de banca con mancuernas', group: 'Pecho', kind: 'strength', entries: [{ reps: '10', weight: '20', done: true }, { reps: '10', weight: '20', done: true }, { reps: '10', weight: '20', done: true }] }] }],
  meals: TYPES.flatMap(t => [1, 2, 4].map(n => ({ id: `${t}-${n}`, date: day(n), type: t, name: `Plato de siempre ${t.toLowerCase()}`, calories: 400, protein: 25, carbs: 40, fat: 12 }))),
  weights
};
const browser = await chromium.launch();
const errors = [];
const open = async (state, width = 390) => {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(s => { for (const k of ['fittforma-welcome-v1', 'fittforma-tour-v68', 'fittforma-guide-hint-v68', 'fittforma-health-notice-v64']) localStorage.setItem(k, '1'); if (!sessionStorage.getItem('v71-seed')) { sessionStorage.setItem('v71-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); } setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); }, JSON.stringify(state));
  await page.goto(APP + '/'); await page.waitForTimeout(900);
  return page;
};

// 1) Coronita: «Miembros» con la corona sin rellenar; al tocar abre la membresía con «Próximamente».
let page = await open(seed);
const chipVisible = await page.isVisible('#planChip');
step('Arriba se ve la coronita con «Miembros»', chipVisible && (await page.textContent('#planChipText')).trim() === 'Miembros' && !!(await page.$('#planChip svg.crown')));
step('No aparece «Gratis» en la insignia', !/Gratis/.test(await page.textContent('#planChip')));
step('La coronita no está rellena sin membresía verificada', !(await page.getAttribute('#planChip', 'class')).includes('is-plus'));
await page.click('#planChip'); await page.waitForTimeout(700);
step('Tocarla abre la membresía y avisa «Próximamente»', await page.isVisible('#membershipCard') && await page.isVisible('#membershipSoon') && /Próximamente/.test(await page.textContent('#membershipSoon')));
await page.close();
page = await open(seed, 320);
const box = await page.$eval('#planChip', el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), label: el.getAttribute('aria-label') }; });
step('A 320 px queda solo la corona (el nombre sigue para lectores de pantalla)', box.w < 44 && /Membresía/.test(box.label), JSON.stringify(box));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
step('A 320 px no hay desborde horizontal', !overflow);
await page.close();

// 2) Sesión: «Próxima serie» con la última vez y récord al momento.
page = await open(seed);
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
await page.click('[data-focus="chest_triceps"]'); await page.waitForTimeout(200); await page.click('#focusStart'); await page.waitForTimeout(500);
const exName = await page.textContent('[data-ex-card="0"] h3');
const hint1 = (await page.textContent('[data-next-set="0"]')).trim();
step('Antes de empezar sugiere la serie 1 con la última vez', exName === 'Press de banca con mancuernas' && /^Serie 1 · La última vez 20 kg × 10 → probá \d/.test(hint1), hint1);
await page.fill('input[data-e="0"][data-s="0"][data-k="weight"]', '22'); await page.fill('input[data-e="0"][data-s="0"][data-k="reps"]', '10');
await page.check('input[data-done][data-e="0"][data-s="0"]'); await page.waitForTimeout(400);
const t1 = await page.textContent('#toast');
step('Al batir el récord avisa en el momento', /¡Nuevo récord personal en Press de banca con mancuernas! 22 kg × 10/.test(t1), t1);
step('La serie muestra la etiqueta Récord', await page.isVisible('[data-set-row="0:0"] .set-pr'));
step('El contador de récords sube', (await page.textContent('#workoutPrCount')).trim() === '1');
const hint2 = (await page.textContent('[data-next-set="0"]')).trim();
step('La sugerencia pasa a la serie 2 y respeta la carga de hoy', /^Serie 2 · La última vez 20 kg × 10 → probá 22 kg × 10$/.test(hint2), hint2);
await page.uncheck('input[data-done][data-e="0"][data-s="0"]'); await page.waitForTimeout(150);
await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
await page.check('input[data-done][data-e="0"][data-s="0"]'); await page.waitForTimeout(400);
step('El mismo récord no se anuncia dos veces', !/Nuevo récord/.test(await page.textContent('#toast')), await page.textContent('#toast'));
await page.fill('input[data-e="0"][data-s="1"][data-k="weight"]', '22'); await page.fill('input[data-e="0"][data-s="1"][data-k="reps"]', '4');
await page.check('input[data-done][data-e="0"][data-s="1"]'); await page.waitForTimeout(300);
const hint3 = (await page.textContent('[data-next-set="0"]')).trim();
step('Si la serie quedó corta, no sugiere subir la carga', /^Serie 3: la anterior quedó por debajo del rango\. Mantené 22 kg × \d+, sin subir la carga\.$/.test(hint3), hint3);
const nSets = await page.$$eval('[data-ex-card="0"] input[data-done]', x => x.length);
for (let s = 2; s < nSets; s++) await page.check(`input[data-done][data-e="0"][data-s="${s}"]`);
await page.waitForTimeout(300);
step('Con todas las series hechas la sugerencia se oculta', await page.isHidden('[data-next-set="0"]'));
await page.close();

// 3) Nutrición: «Lo de siempre» según la hora, con un toque.
page = await open(seed);
await page.click('.mobile-nav-item[data-mobile-view="nutrition"]'); await page.waitForTimeout(500);
const expectType = await page.evaluate(() => FittFormaFood.mealTypeForHour(new Date().getHours() + new Date().getMinutes() / 60));
const usual = (await page.textContent('#usualMeals')).replace(/\s+/g, ' ');
step('Aparece «Lo de siempre» del momento del día', await page.isVisible('#usualMeals') && usual.includes(`Lo de siempre · ${expectType}`) && usual.includes(`Plato de siempre ${expectType.toLowerCase()}`), usual.slice(0, 120));
step('Muestra cuántas veces lo registraste', /400 kcal · P 25 g · 3 veces/.test(usual));
step('No sugiere comidas de otros momentos', TYPES.filter(t => t !== expectType).every(t => !usual.includes(`Plato de siempre ${t.toLowerCase()}`)));
await page.click('[data-usual-add="0"]'); await page.waitForTimeout(400);
const st = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const added = st.meals.filter(m => m.date === (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })());
step('Un toque lo registra hoy con sus valores', added.length === 1 && added[0].type === expectType && added[0].calories === 400 && added[0].source === 'usual');
step('Ya registrado, deja de sugerirse', await page.isHidden('#usualMeals'));
await page.close();

// 4) Progreso: tendencia del peso.
page = await open(seed);
await page.click('.mobile-nav-item[data-mobile-view="progress"]'); await page.waitForTimeout(400);
await page.evaluate(() => document.getElementById('weightChart')?.scrollIntoView());
await page.waitForTimeout(300);
step('El gráfico del peso dibuja la línea de tendencia', !!(await page.$('#weightChart path.wc-trend')));
const note = (await page.textContent('#weightChart .wc-trend-note').catch(() => '')) || '';
step('Indica el ritmo por semana de las últimas 4 semanas', /Tendencia: −0,3\d? kg por semana \(últimas 4 semanas\)/.test(note), note);
await page.close();

step('Sin errores de la página', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(failures ? 1 : 0);
