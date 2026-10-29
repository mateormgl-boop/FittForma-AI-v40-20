// v64: entrenamiento — orden real de los ejercicios, trapecio y antebrazos, más de 60 minutos con tiempo estimado,
// calculadora de RM, aviso de salud y «Cómo la armamos».
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v64.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const seed = { profile: { equipment: 'gym', level: 'intermediate', goal: 'muscle', days: '4', duration: '45', currentWeightKg: '75' },
  sessions: [{ id: 640, date: day(2), status: 'completed', type: 'custom', title: 'Pecho', minutes: 40, exercises: [{ name: 'Press de banca con barra', entries: [{ reps: '8', weight: '80', done: true }, { reps: '10', weight: '70', done: true }] }] }] };
const browser = await chromium.launch();
const errors = [];
const open = async (lang = '') => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(([s, l]) => {
    localStorage.setItem('fittforma-welcome-v1', '1'); if (l) localStorage.setItem('fittforma-language-v1', l);
    if (!sessionStorage.getItem('v64-seed')) { sessionStorage.setItem('v64-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); }
    setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50);
  }, [JSON.stringify(seed), lang]);
  return { ctx, page };
};
let { ctx, page } = await open();
await page.goto(APP + '/'); await page.waitForTimeout(1200);

// 1) Crear mi rutina con 90 minutos: explica cómo se armó y muestra el tiempo estimado de cada día.
await page.evaluate(() => window.FittFormaGo('routines')); await page.waitForTimeout(400);
const durations = await page.$$eval('#duration option', o => o.map(x => x.textContent.trim()));
step('Duración: además de 20–60, hay 75, 90 y «Más de 90 minutos»', ['75 minutos', '90 minutos', 'Más de 90 minutos'].every(x => durations.includes(x)), durations.join(', '));
await page.selectOption('#duration', '90'); await page.click('#makePlan'); await page.waitForTimeout(800);
const plan = await page.textContent('#planOutput');
step('La rutina explica cómo se armó según las opciones', /Cómo la armamos/.test(plan) && /Ganar masa muscular/.test(plan) && /Cada grupo muscular se termina antes/.test(plan));
const est = await page.$$eval('#planOutput .est-min', l => l.map(x => Number(x.textContent.replace(/\D/g, ''))));
step('Cada día del plan muestra el tiempo estimado real', est.length >= 3 && est.every(n => n >= 40 && n <= 100), est.join(', '));

// 2) Elegir grupos: trapecio y antebrazos; pecho + tríceps en orden.
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(400);
await page.evaluate(() => { const d = document.querySelector('details.focus-custom'); if (d) d.open = true; }); await page.waitForTimeout(150);
const labels = await page.$$eval('details.focus-custom .focus-group span', l => l.map(x => x.textContent.trim()));
step('«Elegí vos los grupos» incluye Trapecio y Antebrazos', labels.includes('Trapecio') && labels.includes('Antebrazos'), labels.join(', '));
await page.check('[data-focus-group="chest"]'); await page.check('[data-focus-group="triceps"]'); await page.click('#focusBuildCustom'); await page.waitForTimeout(400);
const names = await page.$$eval('.focus-preview ol li span', l => l.map(x => x.textContent.trim()));
const firstTri = names.findIndex(n => /tr[ií]ceps/i.test(n));
step('Pecho y tríceps: primero todo el pecho y después el tríceps (no intercalados)', firstTri > 0 && names.slice(firstTri).every(n => /tr[ií]ceps/i.test(n)), names.join(' | '));
step('El primer ejercicio es un press (el más pesado)', /press/i.test(names[0] || ''), names[0]);
step('La vista previa muestra el tiempo estimado', /~\d+ min/.test(await page.textContent('.focus-preview')));

// 3) Calculadora de RM desde Entrenar
await page.click('[data-open-rm]'); await page.waitForTimeout(300);
step('«Calculadora de RM» se abre desde Entrenar', await page.isVisible('#rmDialog') && /Calculadora de RM/.test(await page.textContent('#rmDialogTitle')));
await page.fill('#rmWeight', '100'); await page.fill('#rmReps', '10'); await page.waitForTimeout(150);
step('100 kg × 10 → 1RM estimado ≈ 133 kg', /133/.test(await page.textContent('#rmDialog .rm-one')), await page.textContent('#rmDialog .rm-one'));
step('Muestra la tabla de 2RM a 15RM y los porcentajes', (await page.$$('#rmDialog .rm-grid div')).length >= 20 && /15RM/.test(await page.textContent('#rmDialog')) && /Porcentajes del 1RM/.test(await page.textContent('#rmDialog')));
await page.fill('#rmTarget', '90'); await page.waitForTimeout(150);
step('«Con 90 kg harías, en teoría, unas 14 repeticiones»', /Con 90 kg harías, en teoría, unas 14 repeticiones/.test(await page.textContent('#rmAnswer')), await page.textContent('#rmAnswer'));
await page.fill('#rmTarget', '150'); await page.waitForTimeout(150);
step('Un peso mayor que el 1RM: avisa que no saldría ninguna', /supera tu 1RM estimado/.test(await page.textContent('#rmAnswer')));
step('Aclara que es una estimación (Epley) y que no hace falta probar el máximo', /fórmula de Epley/.test(await page.textContent('#rmDialog')));
await page.click('#rmDialog [data-rm-close]'); await page.waitForTimeout(200);

// 4) Sesión: aviso de salud la primera vez y RM con la mejor serie
await page.click('#focusStart'); await page.waitForTimeout(600);
step('La primera vez que se entrena aparece «Antes de empezar» con el aviso de salud', await page.isVisible('.health-notice') && /consultá con un profesional de la salud/.test(await page.textContent('.health-notice')));
const rmBtn = await page.$('[data-session-rm]');
step('Cada ejercicio con peso tiene «Calcular RM»', !!rmBtn);
if (rmBtn) { await rmBtn.click(); await page.waitForTimeout(300); step('Desde la sesión se abre la calculadora con el nombre del ejercicio', await page.isVisible('#rmDialog') && (await page.textContent('#rmDialog .plate-head small')).length > 3); await page.click('#rmDialog [data-rm-close]'); }
await page.click('[data-health-ok]'); await page.waitForTimeout(200);
step('«Entendido» lo cierra', !(await page.isVisible('.health-notice')));
await page.reload(); await page.waitForTimeout(1200); await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(400);
step('No vuelve a aparecer en cada entrenamiento', !(await page.isVisible('.health-notice')));

// 5) Ficha del ejercicio: aviso visible y RM con la mejor marca
await page.evaluate(() => window.FittFormaGo('exercises')); await page.waitForTimeout(500);
await page.click('#view-exercises [data-library-mode="gym"]'); await page.waitForTimeout(300);
await page.fill('#exerciseSearch', 'banca'); await page.waitForTimeout(400);
const bench = page.locator('#view-exercises [data-exercise-detail="Press de banca con barra"]:visible').first();
await (await bench.count() ? bench : page.locator('#view-exercises [data-exercise-detail]:visible').first()).click(); await page.waitForTimeout(500);
step('La ficha de cada ejercicio muestra el aviso de molestias', await page.isVisible('#exerciseModal .ex-health'));
await page.click('#exTabMineBtn').catch(() => {}); await page.waitForTimeout(300);
const exRm = await page.$('#exerciseModal [data-ex-rm]');
if (exRm) { await exRm.click(); await page.waitForTimeout(300); step('«Mi progreso» abre la calculadora con la mejor marca registrada', (await page.inputValue('#rmWeight')) === '80' && (await page.inputValue('#rmReps')) === '8'); await page.click('#rmDialog [data-rm-close]'); }
else step('«Mi progreso» abre la calculadora con la mejor marca registrada', false, 'sin botón (¿no abrió el press de banca?)');
await page.setViewportSize({ width: 320, height: 720 }); await page.keyboard.press('Escape'); await page.evaluate(() => window.FittFormaRm()); await page.waitForTimeout(300);
step('A 320 px la calculadora entra sin desbordarse', await page.evaluate(() => { const r = document.getElementById('rmDialog').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }));
await ctx.close();

// 6) En inglés
({ ctx, page } = await open('en'));
await page.goto(APP + '/'); await page.waitForTimeout(1500);
await page.evaluate(() => window.FittFormaRm()); await page.waitForTimeout(400);
step('En inglés, la calculadora está traducida', /1RM calculator/.test(await page.textContent('#rmDialogTitle')), await page.textContent('#rmDialogTitle'));
await ctx.close();

step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv64: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
