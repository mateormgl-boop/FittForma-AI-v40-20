// v62: más interacción en toda la app — lo que muestra un número lleva a su sección (Inicio, Perfil, Progreso).
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v62.e2e.mjs  (solo la app; no necesita la base)
// Lo de Comunidad (chat → perfil, ficha de insignias, datos físicos privados) está en athletes.e2e.mjs.
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const seed = { profile: { equipment: 'gym', level: 'intermediate', goal: 'muscle', currentWeightKg: '75' },
  sessions: [0, 1, 3].map(n => ({ id: 500 + n, date: day(n), status: 'completed', type: 'custom', title: 'Pecho y tríceps', minutes: 40,
    exercises: [{ name: 'Flexiones clásicas', entries: [{ reps: '22', weight: '', done: true }, { reps: '20', weight: '', done: true }] }, { name: 'Press de banca con barra', entries: [{ reps: '10', weight: '40', done: true }] }] })) };
const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY' });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
await page.addInitScript(s => {
  localStorage.setItem('fittforma-welcome-v1', '1');
  if (!sessionStorage.getItem('v62-seed')) { sessionStorage.setItem('v62-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); }
  setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50);
}, JSON.stringify(seed));
const active = v => page.evaluate(v => document.getElementById('view-' + v)?.classList.contains('active'), v);
const progressTab = () => page.evaluate(() => document.querySelector('[data-progress-tab][aria-selected="true"]')?.dataset.progressTab);
const inView = id => page.evaluate(id => { const r = document.getElementById(id)?.getBoundingClientRect(); return !!r && r.top < innerHeight && r.bottom > 0; }, id);
const home = async () => { await page.click('.mobile-nav-item[data-mobile-view="plan"]'); await page.waitForTimeout(300); };

await page.goto(APP + '/'); await page.waitForTimeout(1200);
step('Inicio marca como tocables los números de la semana', (await page.$$('#view-plan [data-go]')).length >= 6, String((await page.$$('#view-plan [data-go]')).length));
await page.click('#view-plan .ws[data-go="hydration"]'); await page.waitForTimeout(900);
step('Tocar «Agua» de la semana abre Nutrición en Hidratación', await active('nutrition') && await inView('hydrationCard'));
await home(); await page.click('#view-plan .ws[data-go="train"]'); await page.waitForTimeout(400);
step('Tocar «Entrenamientos» abre Entrenar', await active('train'));
await home(); await page.click('#view-plan .ws[data-go="calendar"]'); await page.waitForTimeout(900);
step('Tocar «Días activos» abre el calendario del mes', await active('progress') && (await progressTab()) === 'summary' && await inView('monthCalendarCard'));
await home(); await page.click('#view-plan .home-sum[data-go="nutrition"]'); await page.waitForTimeout(400);
step('Los círculos del resumen de hoy llevan a Nutrición', await active('nutrition'));
await home();
const recent = await page.$('#view-plan .recent-item[data-go="progress:history"]');
if (recent) { await recent.click(); await page.waitForTimeout(500); step('Un entrenamiento reciente abre el historial', await active('progress') && (await progressTab()) === 'history'); }
else step('Un entrenamiento reciente abre el historial', false, 'no hay elementos recientes tocables');
await home();
const nextBadge = await page.$('#view-plan [data-go^="badge:"]');
if (nextBadge) { const id = (await nextBadge.getAttribute('data-go')).slice(6); await nextBadge.click(); await page.waitForTimeout(900);
  step('La próxima insignia de Inicio abre su ficha en Insignias', await active('progress') && (await progressTab()) === 'badges' && (await page.inputValue('#badgeExerciseSelect')) === id, id); }
else step('La próxima insignia de Inicio abre su ficha en Insignias', false, 'sin insignia próxima');
// Teclado: Enter sobre un recuadro tocable también navega.
await home(); await page.focus('#view-plan .ws[data-go="train"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
step('Con teclado (Enter) también se navega', await active('train'));
// Perfil: las cifras de arriba llevan a su sección.
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(400);
await page.click('#profileStats [data-go="progress:badges"]'); await page.waitForTimeout(500);
step('Perfil: tocar «Insignias» abre Progreso › Insignias', await active('progress') && (await progressTab()) === 'badges');
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(400);
await page.click('#profileStats [data-go="progress:history"]'); await page.waitForTimeout(500);
step('Perfil: tocar «Entrenamientos» abre el historial', await active('progress') && (await progressTab()) === 'history');
// Progreso: los mosaicos y las series por grupo llevan al detalle.
await page.evaluate(() => document.querySelector('[data-progress-tab="summary"]').click()); await page.waitForTimeout(400);
const tile = await page.$('.p-tile[data-go="calendar"]');
if (tile) { await tile.click(); await page.waitForTimeout(800); step('Mosaico «Constancia» abre el calendario', await inView('monthCalendarCard')); }
else step('Mosaico «Constancia» abre el calendario', false, 'sin mosaico');
const grp = await page.$('[data-go="progress:muscles"]');
if (grp) { await grp.click(); await page.waitForTimeout(800); step('Series por grupo abre Músculos', (await progressTab()) === 'muscles'); }
else step('Series por grupo abre Músculos', false, 'sin series por grupo');
// Un botón dentro de un recuadro tocable hace lo suyo, no navega.
step('Los recuadros tocables se ven como tocables (cursor)', (await page.evaluate(() => getComputedStyle(document.querySelector('[data-go]')).cursor)) === 'pointer');
await page.setViewportSize({ width: 320, height: 720 }); await home();
step('Inicio no se desborda a 320 px', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 321);
step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv62: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
