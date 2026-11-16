// v74: primera impresión — bienvenida con dónde entrenás y experiencia, primer entrenamiento listo, Inicio y Entrenar
// con lo de hoy arriba, «Otras formas de entrenar» plegado, consejo de la semana y pantallas vacías con dibujo.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v74.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4', LIVE = 'fittforma-ai-active-session-v1', MORE = 'fittforma-train-more-v74';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ex = (name, group, w, r, n = 3) => ({ name, group, kind: 'strength', entries: Array.from({ length: n }, () => ({ reps: String(r), weight: String(w), done: true })) });
const seed = {
  profile: { name: 'Mateo', equipment: 'gym', level: 'intermediate', goal: 'muscle', days: '4', duration: '60' },
  sessions: [
    { id: 21, type: 'custom', status: 'completed', date: day(1), title: 'Pecho y tríceps', minutes: 55, exercises: [ex('Press de banca con barra', 'Pecho', 60, 8, 4), ex('Extensión de tríceps en polea', 'Brazos', 25, 12)] },
    { id: 22, type: 'custom', status: 'completed', date: day(3), title: 'Espalda y bíceps', minutes: 60, exercises: [ex('Jalón al pecho', 'Espalda', 50, 10), ex('Curl de bíceps con mancuernas', 'Brazos', 12, 12)] },
    { id: 23, type: 'custom', status: 'completed', date: day(5), title: 'Hombros', minutes: 45, exercises: [ex('Press militar con mancuernas', 'Hombros', 14, 10)] }
  ]
};
const TIPS = [['warmup', 'Entrá en calor antes', 'Warm up first'], ['water', 'Tené agua a mano', 'Keep water handy'], ['progress', 'Sumá de a poco', 'Add a little at a time'], ['sleep', 'Dormir también es entrenar', 'Sleep is training too'], ['protein', 'Proteína en cada comida', 'Protein at every meal'], ['rest', 'Respetá los descansos', 'Respect your rest times']];
const now = new Date(), tip = TIPS[Math.floor((Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5) + 3) / 7) % TIPS.length];

const browser = await chromium.launch();
const errors = [];
async function open({ state = null, welcome = true, more = false, lang = '', width = 390 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(([s, welcome, more, lang]) => {
    for (const k of ['fittforma-health-notice-v64', 'fittforma-guide-hint-v68']) localStorage.setItem(k, '1');
    if (welcome) { localStorage.setItem('fittforma-welcome-v1', '1'); localStorage.setItem('fittforma-tour-v68', '1'); }
    if (more) localStorage.setItem('fittforma-train-more-v74', '1');
    if (lang) localStorage.setItem('fittforma-language-v1', lang);
    if (s && !sessionStorage.getItem('v74-seed')) { sessionStorage.setItem('v74-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); }
    setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50);
  }, [state ? JSON.stringify(state) : '', welcome, more, lang]);
  await page.goto(APP + '/'); await page.waitForTimeout(900);
  return { ctx, page };
}
const st = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
const live = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), LIVE);
const go = async (page, where) => { await page.evaluate(w => window.FittFormaGo(w), where); await page.waitForTimeout(400); };
const isActive = (page, id) => page.evaluate(i => !!document.getElementById(i)?.classList.contains('active'), id);
// Dibujos cargados de verdad (los perezosos se traen a la vista antes de mirar).
async function loaded(page, sel) {
  const list = await page.$$(sel); if (!list.length) return false;
  for (const el of list) await el.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(350);
  return page.$$eval(sel, imgs => imgs.every(i => i.complete && i.naturalWidth > 0));
}

// 1) Bienvenida: dónde entrenás, experiencia y «Tu primer entrenamiento está listo» → «Empezar ahora».
let { ctx, page } = await open({ welcome: false });
step('La bienvenida aparece la primera vez', await page.isVisible('#welcomeScreen'));
await page.click('#welcomeStart'); await page.waitForTimeout(250);
step('«Contanos un poco» pregunta dónde entrenás con tres tarjetas con dibujo', (await page.$$('#welcomeStep2 .place-card')).length === 3 && await loaded(page, '#welcomeStep2 .place-card img'));
step('…y la experiencia, con tres opciones', (await page.$$('#welcomeStep2 input[name="welcomeLevel"]')).length === 3);
step('Empieza en gimnasio y principiante (lo de tu perfil)', await page.isChecked('input[name="welcomePlace"][value="gym"]') && await page.isChecked('input[name="welcomeLevel"][value="beginner"]'));
await page.fill('#welcomeName', 'Ana');
await page.click('label.place-card:has(input[value="home"])'); await page.click('label.level-pill:has(input[value="advanced"])'); await page.selectOption('#welcomeDays', '3');
await page.focus('input[name="welcomePlace"][value="home"]'); await page.keyboard.press('ArrowRight');
const kb = await page.isChecked('input[name="welcomePlace"][value="bodyweight"]');
await page.keyboard.press('ArrowLeft');
step('Las tarjetas también se eligen con el teclado', kb && await page.isChecked('input[name="welcomePlace"][value="home"]'));
await page.click('#welcomeSubmit'); await page.waitForTimeout(500);
let s = await st(page);
step('Guarda dónde entrenás y la experiencia', s.profile?.equipment === 'home' && s.profile?.level === 'advanced' && s.profile?.displayName === 'Ana', JSON.stringify({ e: s.profile?.equipment, l: s.profile?.level }));
step('Arma el plan con esos datos', s.plan?.days?.length === 3 && s.plan.days.every(d => d.exercises.length > 0), String(s.plan?.days?.length));
step('Muestra «Tu primer entrenamiento está listo»', await page.isVisible('#welcomeStep3') && !(await page.isVisible('#welcomeStep2')) && /Tu primer entrenamiento está listo/.test(await page.textContent('#welcomeReadyTitle')));
const d0 = s.plan.days[0], meta = (await page.textContent('#welcomeReadyMeta')).trim();
step('Con el día 1 del plan: nombre, cantidad de ejercicios y tiempo estimado', (await page.textContent('#welcomeReadyDay')) === d0.title && new RegExp(`^${d0.exercises.length} ejercicios · ~\\d+ min$`).test(meta), `${d0.title} · ${meta}`);
const items = await page.$$eval('#welcomeReadyList li:not(.welcome-ready-more)', li => li.map(x => x.textContent));
step('Lista los primeros ejercicios (hasta 4)', items.length === Math.min(4, d0.exercises.length) && items[0].includes(d0.exercises[0].name), items[0]);
step('El dibujo es el de «En casa»', (await page.getAttribute('#welcomeReadyIll', 'src')).endsWith('place-home.svg') && await loaded(page, '#welcomeReadyIll'));
await page.click('#welcomeStartNow'); await page.waitForTimeout(700);
let lv = await live(page);
step('«Empezar ahora» abre el entrenamiento del día 1 al instante', !(await page.isVisible('#welcomeScreen')) && lv?.title === d0.title && lv?.type === 'daily', JSON.stringify({ t: lv?.title, type: lv?.type }));
step('Queda en Entrenar, sin el recorrido encima', await isActive(page, 'view-train') && !(await page.isVisible('#tour')));
await ctx.close();

// 2) «Ver mi plan» lleva a Rutinas (y sigue el recorrido de la primera vez).
({ ctx, page } = await open({ welcome: false }));
await page.click('#welcomeStart'); await page.waitForTimeout(200); await page.click('#welcomeSubmit'); await page.waitForTimeout(500);
s = await st(page);
step('Sin tocar nada, arma el plan con gimnasio y principiante', s.profile?.equipment === 'gym' && s.profile?.level === 'beginner' && s.plan?.days?.length === 3);
await page.click('#welcomeSeePlan'); await page.waitForTimeout(800);
step('«Ver mi plan» abre Rutinas con el plan', await isActive(page, 'view-routines') && (await page.textContent('#planOutput')).includes(s.plan.days[0].title));
step('…y empieza el recorrido de la primera vez', await page.isVisible('#tour'));
await ctx.close();

// 3) Inicio: lo de hoy y los accesos rápidos arriba, gym corto y consejo de la semana.
({ ctx, page } = await open({ state: seed }));
const order = await page.$$eval('#view-plan .home-dash > .home-block:not([hidden])', els => els.map(e => e.dataset.homeBlock));
step('Inicio: primero lo de hoy y después los accesos rápidos', order[0] === 'today' && order[1] === 'tiles', order.join(','));
step('El botón grande dice «Empezar entrenamiento»', (await page.textContent('#homeStartBtn')).trim() === 'Empezar entrenamiento' && (await page.getAttribute('#homeStartBtn', 'data-home-action')) === 'week:start');
step('«Lo que hiciste en el gym» muestra solo la última sesión', (await page.$$('#homeGym .home-gym-item')).length === 1 && /Pecho y tríceps/.test(await page.textContent('#homeGym')) && !/Espalda y bíceps/.test(await page.textContent('#homeGym')));
step('Consejo de la semana con su dibujo', (await page.textContent('#homeTipTitle')) === tip[1] && (await page.getAttribute('#homeTipImg', 'src')).endsWith(`tip-${tip[0]}.svg`) && await loaded(page, '#homeTipImg'), tip[1]);
step('Sin la frase fija de antes', !/Disciplina hoy/.test(await page.textContent('#view-plan')));
await page.click('#homeGym .home-gym-all'); await page.waitForTimeout(500);
step('«Ver todo el historial» abre Progreso › Historial', await isActive(page, 'view-progress') && await page.isVisible('#historyList') && (await page.$$('#historyList .history-item')).length === 3);
await go(page, 'plan');
const recTitle = (await page.textContent('#homeTodayTitle')).replace(/^Te recomendamos: /, '').trim();
await page.click('#homeStartBtn'); await page.waitForTimeout(700);
lv = await live(page);
step('El botón grande de Inicio empieza lo de hoy sin pasos de más', lv?.title === recTitle && lv.exercises?.length > 0 && await isActive(page, 'view-train'), JSON.stringify({ rec: recTitle, t: lv?.title }));
await ctx.close();

// 4) Entrenar: lo de hoy arriba con «Empezar»; lo demás plegado y recordado.
({ ctx, page } = await open({ state: seed }));
await go(page, 'train');
step('Entrenar: lo de hoy va antes de los días de la semana', await page.$eval('#weekPlan', el => el.firstElementChild?.className) === 'wp-today');
step('…con «Empezar» y «Ver la sesión»', await page.isVisible('#wpStartNow') && await page.isVisible('#wpStartToday'));
step('Lo demás queda plegado en «Otras formas de entrenar»', await page.isVisible('#trainMore summary') && !(await page.isVisible('#startFreeWorkout')) && !(await page.isVisible('#focusPicker')));
const h = await page.evaluate(() => document.documentElement.scrollHeight);
step('Entrenar es más corto (antes 2.078 px)', h < 1600, `${h} px`);
await page.click('#trainMore summary'); await page.waitForTimeout(250);
step('Al abrirlo: grupos musculares, libre, registrar uno hecho y calculadora', await page.isVisible('#focusPicker') && await page.isVisible('#startFreeWorkout') && await page.isVisible('#openManualLog') && await page.isVisible('#trainMore [data-open-rm]'));
step('Recuerda que lo dejaste abierto', await page.evaluate(k => localStorage.getItem(k), MORE) === '1');
await go(page, 'plan'); await go(page, 'train');
step('Sigue abierto al volver a Entrenar', await page.isVisible('#startFreeWorkout'));
await page.reload(); await page.waitForTimeout(900); await go(page, 'train');
step('…y al abrir la app de nuevo', await page.isVisible('#startFreeWorkout'));
await page.click('#trainMore summary'); await page.waitForTimeout(250);
step('Cerrarlo también se recuerda', await page.evaluate(k => localStorage.getItem(k), MORE) === '0' && !(await page.isVisible('#startFreeWorkout')));
await page.click('#wpStartToday'); await page.waitForTimeout(500);
step('«Ver la sesión» abre lo plegado y muestra los ejercicios', await page.isVisible('#focusPreview .focus-preview') && /ejercicios/.test(await page.textContent('#focusPreview')));
step('Abrirlo así no cambia lo que elegiste', await page.evaluate(k => localStorage.getItem(k), MORE) === '0');
const todayTitle = (await page.textContent('.wp-today .wp-today-text strong')).trim();
await page.click('#wpStartNow'); await page.waitForTimeout(600);
lv = await live(page);
step('«Empezar» arranca lo de hoy directo', lv?.title === todayTitle && lv.exercises?.length > 0, JSON.stringify({ hoy: todayTitle, t: lv?.title }));
await ctx.close();

// 5) Con un plan: el entrenamiento diario va arriba y no se repite una recomendación aparte.
({ ctx, page } = await open({ state: seed }));
await page.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)); x.plan = FittFormaTraining.buildPlan(x.profile); localStorage.setItem(k, JSON.stringify(x)); }, KEY);
await page.reload(); await page.waitForTimeout(900); await go(page, 'train');
const pos = await page.$$eval('.train-launch > *', els => ({ daily: els.findIndex(e => e.classList.contains('daily-card')), week: els.findIndex(e => e.id === 'weekPlan'), more: els.findIndex(e => e.id === 'trainMore') }));
step('Con plan, el entrenamiento diario va arriba de todo', pos.daily >= 0 && pos.daily < pos.week && pos.week < pos.more, JSON.stringify(pos));
step('…y no aparece otra recomendación para hoy', !(await page.$('#weekPlan .wp-today')) && await page.isVisible('#startDaily'));
await ctx.close();

// 6) Si ya ordenaste Inicio a tu gusto, se respeta.
({ ctx, page } = await open({ state: { ...seed, homeLayout: { order: ['week', 'today'], hidden: [] } } }));
const order2 = await page.$$eval('#view-plan .home-dash > .home-block:not([hidden])', els => els.map(e => e.dataset.homeBlock));
step('Un orden propio de Inicio no cambia', order2[0] === 'week' && order2[1] === 'today', order2.slice(0, 3).join(','));
await ctx.close();

// 7) Pantallas vacías con dibujo.
({ ctx, page } = await open({}));
await go(page, 'routines');
step('Mis rutinas vacía, con dibujo', await loaded(page, '#routineList .empty img[src$="empty-routines.svg"]'));
await go(page, 'progress:history');
step('Historial vacío, con dibujo', await loaded(page, '#historyList .empty img[src$="empty-history.svg"]'));
await go(page, 'progress:body'); await page.waitForTimeout(500);
step('Medidas y fotos vacías, con dibujo', await loaded(page, '#measureHistory .empty img[src$="empty-body.svg"]') && await loaded(page, '#progressPhotoList .empty img[src$="empty-photos.svg"]'));
await ctx.close();

// 8) A 320 px la bienvenida y Entrenar entran sin desbordar.
({ ctx, page } = await open({ welcome: false, width: 320 }));
const over = () => page.evaluate(() => { const w = document.getElementById('welcomeScreen'); return Math.max(w.scrollWidth - w.clientWidth, document.documentElement.scrollWidth - innerWidth); });
await page.click('#welcomeStart'); await page.waitForTimeout(250);
step('A 320 px «Contanos un poco» entra sin desbordar', (await over()) <= 0);
await page.$eval('#welcomeSubmit', el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
const top = await page.$eval('#welcomeStep2 h2', el => el.getBoundingClientRect().top + document.getElementById('welcomeScreen').scrollTop);
step('…el título no queda cortado y se llega al botón', top >= 0 && await page.isVisible('#welcomeSubmit'), `${Math.round(top)} px`);
await page.click('#welcomeSubmit'); await page.waitForTimeout(500);
step('A 320 px el primer entrenamiento entra sin desbordar', (await over()) <= 0 && await page.isVisible('#welcomeStep3'));
await page.click('#welcomeLater'); await page.waitForTimeout(400);
await page.evaluate(() => { const t = document.getElementById('tour'); if (t) t.hidden = true; document.body.classList.remove('tour-open'); });
await go(page, 'train');
step('A 320 px Entrenar no desborda', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await ctx.close();

// 9) En inglés.
({ ctx, page } = await open({ state: seed, lang: 'en' }));
await page.waitForFunction(() => window.FittFormaI18n?.packsLoaded?.(), null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(600); await go(page, 'train');
step('En inglés: «Other ways to train»', /Other ways to train/.test(await page.textContent('#trainMore summary')), (await page.textContent('#trainMore summary')).trim().slice(0, 60));
await go(page, 'plan');
step('…y el consejo de la semana traducido', /Tip of the week/.test(await page.textContent('.home-tip')) && (await page.textContent('#homeTipTitle')).trim() === tip[2], (await page.textContent('#homeTipTitle')).trim());
await ctx.close();

step('Sin errores de la página', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(failures ? 1 : 0);
