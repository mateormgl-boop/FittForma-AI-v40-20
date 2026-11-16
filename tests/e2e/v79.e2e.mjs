// v75–v79: menos scroll, compartir como imagen e invitar, gasto real estimado y la etapa nueva (calentamiento y comparar fotos).
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v79.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4', LIVE = 'fittforma-ai-active-session-v1';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ex = (name, group, w, r) => ({ name, group, kind: 'strength', entries: [1, 2, 3].map(() => ({ reps: String(r), weight: String(w), done: true })) });
const sessions = Array.from({ length: 14 }, (_, i) => ({ id: 100 + i, type: 'custom', status: 'completed', date: day(i * 2 + 1), title: `Sesión ${i + 1}`, minutes: 45, exercises: [ex('Press de banca con barra', 'Pecho', 60, 8), ex('Jalón al pecho', 'Espalda', 50, 10)] }));
const meals = Array.from({ length: 21 }, (_, i) => ({ id: `m${i}`, date: day(i + 1), type: 'Almuerzo', name: 'Pollo con arroz', calories: 2300, protein: 120, carbs: 250, fat: 70 }));
const weights = Array.from({ length: 28 }, (_, i) => ({ id: i + 1, date: day(27 - i), kg: Math.round((80 - i * 0.05) * 100) / 100 }));
const seed = { profile: { name: 'Mateo', equipment: 'gym', level: 'intermediate', goal: 'muscle', days: '4', currentWeightKg: 78.6, targetWeightKg: 75 }, nutritionGoals: { calories: 2400, protein: 140, carbs: 280, fat: 80, water: 2500 }, sessions, meals, weights };

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
await page.addInitScript(s => {
  for (const k of ['fittforma-welcome-v1', 'fittforma-tour-v68', 'fittforma-guide-hint-v68', 'fittforma-health-notice-v64', 'fittforma-train-more-v74']) localStorage.setItem(k, '1');
  if (!sessionStorage.getItem('v79-seed')) { sessionStorage.setItem('v79-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); }
  setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50);
}, JSON.stringify(seed));
await page.goto(APP + '/'); await page.waitForTimeout(1000);
const go = async w => { await page.evaluate(x => window.FittFormaGo(x), w); await page.waitForTimeout(500); };
const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);

// v75: Ejercicios agrupados por músculo
await go('exercises');
const groups = await page.$$eval('#exerciseLibraryResults details.ex-group', d => d.map(x => ({ name: x.dataset.exGroup, open: x.open, n: x.querySelectorAll('.exercise-library-item,.exercise-list-row').length })));
step('Ejercicios agrupados por músculo y plegados', groups.length >= 6 && groups.every(g => !g.open && g.n > 0), groups.map(g => `${g.name} ${g.n}`).join(', '));
step('La pantalla de Ejercicios es corta', await page.evaluate(() => document.documentElement.scrollHeight) < 2500);
await page.click('#exerciseLibraryResults details.ex-group summary'); await page.waitForTimeout(200);
step('Abrir un grupo muestra sus ejercicios', await page.isVisible('#exerciseLibraryResults details.ex-group[open] .exercise-library-item'));
await page.fill('#exerciseSearch', 'sentadilla'); await page.waitForTimeout(250);
step('Al buscar, la lista vuelve a ser plana', !(await page.$('#exerciseLibraryResults details.ex-group')) && (await page.$$('#exerciseLibraryResults .exercise-library-item')).length > 0);
await page.fill('#exerciseSearch', ''); await page.waitForTimeout(250);
step('El grupo abierto sigue abierto al volver', (await page.$$('#exerciseLibraryResults details.ex-group[open]')).length === 1);

// v75: historial de a 10
await go('progress:history');
step('Historial: muestra 10 sesiones y «Ver más»', (await page.$$('#historyList .history-item')).length === 10 && /Ver más \(4 de 4 que faltan\)/.test(await page.textContent('#historyList .history-more')));
await page.click('#historyList [data-history-more]'); await page.waitForTimeout(300);
step('«Ver más» muestra el resto', (await page.$$('#historyList .history-item')).length === 14 && !(await page.$('#historyList [data-history-more]')));

// v75: Registrar comida con botones arriba
await go('nutrition:registrar');
step('Registrar: cinco formas de cargar arriba', (await page.$$('.reg-methods .reg-method')).length === 5);
await page.click('[data-reg-go="barcodeCard"]'); await page.waitForTimeout(700);
const bc = await page.$eval('#barcodeCard', el => el.getBoundingClientRect().top);
step('«Escanear» lleva al código de barras', bc >= -5 && bc < 300, `${Math.round(bc)} px`);
await page.click('[data-reg-go="mealFormCard"]'); await page.waitForTimeout(700);
step('«Escribir» pone el cursor en «¿Qué comiste?»', await page.evaluate(() => document.activeElement?.id === 'mealName'));

// v75: Correr con un solo registro sin GPS
await go('running');
step('Correr: «Iniciar GPS» va arriba de los números', await page.evaluate(() => { const b = document.getElementById('gpsStart').getBoundingClientRect().top, s = document.querySelector('.gps-stats').getBoundingClientRect().top; return b < s; }));
step('Un solo «Registro sin GPS», empezando por carrera', (await page.$$('#view-running .eyebrow')).filter(Boolean).length > 0 && await page.isVisible('#runLogForm') && !(await page.isVisible('#activityForm')));
await page.click('[data-manual-kind="Bicicleta"]'); await page.waitForTimeout(150);
step('Elegir «Bicicleta» muestra su formulario', await page.isVisible('#activityForm') && !(await page.isVisible('#runLogForm')) && (await page.inputValue('#manualActivityType')) === 'Bicicleta');
await page.fill('#activityDate', day(0)); await page.fill('#activityDistance', '12'); await page.fill('#activityMinutes', '40'); await page.click('#activityForm button[type=submit]'); await page.waitForTimeout(400);
let s = await st();
step('Se guarda como bicicleta', s.activities?.some(a => a.type === 'Bicicleta' && Number(a.distance) === 12), JSON.stringify(s.activities?.slice(-1)));
step('Las semanas del plan quedan plegadas', !(await page.isVisible('#runningPlanOutput')));

// v75: Progreso y Músculos
await go('progress:summary');
step('Progreso: lo repetido queda en «Más estadísticas»', await page.isVisible('details.progress-more summary') && !(await page.isVisible('#habitChecklist')));
await go('progress:muscles');
step('Músculos: zonas plegadas', (await page.$$('#mrList details.mr-zone')).length >= 3 && !(await page.$('#mrList details.mr-zone[open]')));

// v77: gasto real estimado
await go('nutrition:plan');
const ad = (await page.textContent('#adaptiveCard')).replace(/\s+/g, ' ');
step('Gasto real estimado con comidas y peso', /2\.690 kcal\/día/.test(ad) && /21 días/.test(ad) && /bajó 0,35 kg por semana/.test(ad), ad.slice(0, 200));
step('Sugiere calorías según el objetivo (bajar a 75 kg)', /Para bajar de peso de a poco/.test(ad) && /2\.250 kcal/.test(ad));
await page.click('[data-adaptive-apply]'); await page.waitForTimeout(300);
s = await st();
step('«Usar» cambia el objetivo de calorías', s.nutritionGoals?.calories === 2250 && (await page.inputValue('#calorieGoal')) === '2250');
step('Recetas: primero 6 y «Ver todas»', (await page.$$('#recipeList details.recipe')).length === 6 && await page.isVisible('[data-recipes-all]'));
await go('nutrition:hoy');
await page.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)); return x; }, KEY);

// v79: calentamiento sugerido
// «Repetir» la última sesión: el press de banca ya tiene historial (3 × 8 con 60 kg), así que la app sugiere 62,5 kg
// de trabajo y el calentamiento sale al 50 % y al 70 % de eso, redondeado a 2,5 kg.
await go('plan'); await page.click('#homeGym [data-home-repeat]'); await page.waitForTimeout(600);
const warm = await page.$$eval('.warmup-hint', w => w.map(x => x.textContent));
step('Calentamiento sugerido solo en el primer ejercicio con carga', warm.length === 1 && /Calentamiento sugerido\s*1 × 8 con 32,5 kg · 1 × 5 con 45 kg/.test(warm[0]), warm.join(' | '));
// Completar una serie y terminar para ver «Compartir como imagen».
await page.fill('input[data-e="0"][data-s="0"][data-k="weight"]', '60').catch(() => {});
await page.fill('input[data-e="0"][data-s="0"][data-k="reps"]', '8').catch(() => {});
await page.check('input[data-done][data-e="0"][data-s="0"]').catch(() => {});
await page.click('#finishWorkout'); await page.waitForTimeout(1200);
step('Al terminar aparece «Compartir como imagen»', await page.isVisible('#summaryShareImage'));
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('#summaryShareImage')]);
const file = dl ? await dl.path() : null;
const size = file ? (await import('node:fs')).statSync(file).size : 0;
step('La imagen se genera en el teléfono (PNG)', !!dl && /^fittforma-.*\.png$/.test(dl.suggestedFilename()) && size > 20000, dl ? `${dl.suggestedFilename()} · ${size} bytes` : 'sin descarga');

// v76: invitar
await go('community');
step('Comunidad muestra «Invitá a un amigo»', await page.isVisible('#communityInvite [data-invite]'));
await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
await page.click('#communityInvite [data-invite]'); await page.waitForTimeout(300);
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
step('Sin «compartir» del sistema, copia el enlace de la app', clip.includes(APP) && /Entrená conmigo en FittForma AI/.test(clip), clip.slice(0, 80));

// v79: comparar dos fotos
await go('progress:body');
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 60; c.height = 80; const g = c.getContext('2d');
  for (const [i, color] of ['#c33', '#3c3'].entries()) { g.fillStyle = color; g.fillRect(0, 0, 60, 80); const b = await new Promise(r => c.toBlob(r, 'image/jpeg')); const f = new File([b], `p${i}.jpg`, { type: 'image/jpeg' }); const dt = new DataTransfer(); dt.items.add(f); const inp = document.querySelector('#progressPhotoForm [name=progressPhotoFile]'); inp.files = dt.files; document.querySelector('#progressPhotoForm [name=progressPhotoDate]').value = i ? new Date().toISOString().slice(0, 10) : '2026-09-01'; document.querySelector('#progressPhotoForm button[type=submit]').click(); await new Promise(r => setTimeout(r, 900)); }
});
await page.waitForTimeout(500);
step('Con dos fotos aparece «Comparar dos fotos»', await page.isVisible('details.photo-compare summary'));
await page.click('details.photo-compare summary'); await page.waitForTimeout(200);
step('Muestra las dos lado a lado con los días entre una y otra', (await page.$$('.photo-compare-view img')).length === 2 && /días entre una y otra/.test(await page.textContent('details.photo-compare')));

step('Sin errores de la página', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(failures ? 1 : 0);
