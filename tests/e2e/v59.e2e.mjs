// v59: calorías al completar cada ejercicio y al terminar, tarjeta diaria en espera sin círculo negro, Mi semana compacta
// con hoja para elegir el día, y sin desbordes en el celular.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v59.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787', KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const seed = { profile: { equipment: 'gym', level: 'intermediate', goal: 'muscle', currentWeightKg: 75 },
  sessions: [{ id: 1, type: 'custom', status: 'completed', date: day(3), title: 'Pecho', minutes: 40, exercises: [{ name: 'Press de banca con mancuernas', group: 'Pecho', kind: 'strength', entries: [{ reps: '10', weight: '20', done: true }] }] }] };
const browser = await chromium.launch();
const errors = [];
const open = async (state, theme = 'dark') => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(([s, t]) => { localStorage.setItem('fittforma-welcome-v1', '1'); localStorage.setItem('fittforma-theme', t); if (!sessionStorage.getItem('v59-seed')) { sessionStorage.setItem('v59-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); } setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); }, [JSON.stringify(state), theme]);
  await page.goto(APP + '/'); await page.waitForTimeout(800);
  return page;
};

// 1) Calorías: al completar un ejercicio y en el resumen final
let page = await open(seed);
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
await page.click('[data-focus="chest_triceps"]'); await page.waitForTimeout(200); await page.click('#focusStart'); await page.waitForTimeout(400);
const n = await page.$$eval('[data-ex-card="0"] input[data-done]', x => x.length);
for (let s = 0; s < n; s++) { await page.fill(`input[data-e="0"][data-s="${s}"][data-k="weight"]`, '22').catch(() => {}); await page.fill(`input[data-e="0"][data-s="${s}"][data-k="reps"]`, '10').catch(() => {}); await page.check(`input[data-done][data-e="0"][data-s="${s}"]`); await page.waitForTimeout(80); }
await page.waitForTimeout(250);
const toastText = await page.textContent('#toast');
step('Al completar el ejercicio avisa las calorías estimadas', /completo! ≈ \d+ kcal \(estimación\)/.test(toastText), toastText);
step('Las calorías se ven en vivo durante la sesión', /≈ \d+ kcal/.test(await page.textContent('#workoutKcalLive')));
await page.click('#finishWorkout'); await page.waitForTimeout(800);
const summary = (await page.textContent('.workout-live-card')).replace(/\s+/g, ' ');
step('El resumen final muestra las calorías gastadas', /Calorías gastadas \(estimación\)\s*≈ \d+ kcal/.test(summary), summary.slice(0, 160));
step('El resumen detalla las calorías por ejercicio', (await page.$$('.ws-kcal-list li')).length >= 1);
step('El resumen marca el récord nuevo (22 kg × 10, antes 20 kg)', /Récord nuevo/.test(summary) && /22 kg × 10 \(antes 20 kg\)/.test(summary));
const saved = (await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY)).sessions[0];
step('La sesión guardada lleva las calorías estimadas', saved?.calories?.kcal > 0 && saved.calories.approximate === true, JSON.stringify(saved?.calories?.kcal));
step('Sin emojis en el resumen', !/[\u{1F300}-\u{1FAFF}]/u.test(summary));
await page.close();

// 2) Sin peso no se inventan calorías: se pide cargarlo
page = await open({ ...seed, profile: { ...seed.profile, currentWeightKg: null } });
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
await page.click('[data-focus="arms"]'); await page.waitForTimeout(200); await page.click('#focusStart'); await page.waitForTimeout(400);
const n2 = await page.$$eval('[data-ex-card="0"] input[data-done]', x => x.length);
for (let s = 0; s < n2; s++) { await page.check(`input[data-done][data-e="0"][data-s="${s}"]`); await page.waitForTimeout(60); }
await page.waitForTimeout(200);
step('Sin peso: pide cargarlo en vez de inventar', /Cargá tu peso en Perfil/.test(await page.textContent('#toast')) && /Cargá tu peso/.test(await page.textContent('#workoutKcalLive')));
await page.click('#finishWorkout'); await page.waitForTimeout(700);
step('Sin peso: el resumen ofrece «Cargar peso»', await page.isVisible('[data-go-profile-weight]'));
await page.click('[data-go-profile-weight]'); await page.waitForTimeout(400);
step('«Cargar peso» lleva al campo de peso en Perfil', await page.evaluate(() => document.activeElement?.id === 'profileCurrentWeight'));
await page.close();

// 3) Tarjeta diaria en espera: anillo dibujado, no un círculo negro
const now = Date.now();
page = await open({ sessions: [], profile: { name: 'Mateo', equipment: 'gym', level: 'intermediate', goal: 'muscle', days: '4', duration: '60', currentWeightKg: 75 }, daily: { seq: 43, lastCompletedAt: new Date(now - 1.5 * 3600e3).toISOString(), nextAvailableAt: new Date(now + 10.5 * 3600e3).toISOString() } });
await page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); s.plan = FittFormaTraining.buildPlan(s.profile); localStorage.setItem(k, JSON.stringify(s)); location.reload(); }, KEY);
await page.waitForTimeout(1200);
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(400);
const ring = await page.evaluate(() => { const svg = document.querySelector('.daily-card.is-waiting .daily-ring svg'), c = svg?.querySelector('circle.fg'); if (!svg) return null; const r = svg.getBoundingClientRect(); return { w: Math.round(r.width), fill: getComputedStyle(c).fill }; });
step('La espera muestra un anillo de 88 px sin relleno negro', ring && ring.w === 88 && /none/.test(ring.fill), JSON.stringify(ring));
step('Dice cuánto falta y cuándo se habilita', /para el próximo/.test(await page.textContent('.daily-card')) && /Se habilita el/.test(await page.textContent('.daily-card')));
await page.close();

// 4) Mi semana compacta con hoja para elegir
page = await open({ ...seed, weekPlan: { days: { 1: { kind: 'focus', key: 'chest_triceps' }, 3: { kind: 'rest' } } } });
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
const rowTops = await page.$$eval('.wp-day', n => [...new Set(n.map(x => Math.round(x.getBoundingClientRect().top)))]);
step('Los 7 días entran en una sola fila', rowTops.length === 1 && (await page.$$('.wp-day')).length === 7, JSON.stringify(rowTops));
step('Cada día entrenado tiene su dibujo de músculos', (await page.$$('[data-wp-day="1"] .anatomy-map')).length === 1);
await page.click('[data-wp-day="2"]'); await page.waitForTimeout(300);
step('Tocar un día abre la hoja para elegir', await page.evaluate(() => document.getElementById('wpSheet')?.open === true));
step('La hoja muestra las opciones con dibujos', (await page.$$('#wpSheet .wp-opt .anatomy-map')).length >= 10);
await page.click('#wpSheet [data-wp-set="focus:back_biceps"]'); await page.waitForTimeout(300);
const wp = (await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY)).weekPlan;
step('Elegir una opción guarda el día y cierra la hoja', wp?.days?.[2]?.key === 'back_biceps' && !(await page.evaluate(() => document.getElementById('wpSheet')?.open)), JSON.stringify(wp?.days?.[2]));
await page.click('[data-wp-day="2"]'); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
step('Escape cierra la hoja sin cambiar nada', !(await page.evaluate(() => document.getElementById('wpSheet')?.open)) && (await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY)).weekPlan.days[2].key === 'back_biceps');
await page.evaluate(() => window.FittFormaI18n?.setLanguage('en')); await page.waitForTimeout(300);
step('Mi semana se traduce', /Tap a day to change it\./.test(await page.textContent('#weekPlan')) && /Mon/.test(await page.textContent('#weekPlan')));
await page.evaluate(() => window.FittFormaI18n?.setLanguage('es')); await page.waitForTimeout(200);

// 5) 320 px sin desborde horizontal
await page.setViewportSize({ width: 320, height: 720 }); await page.waitForTimeout(200);
for (const v of ['plan', 'train', 'nutrition', 'progress', 'community', 'profile']) {
  await page.click(`.mobile-nav-item[data-mobile-view="${v}"]`).catch(() => {}); await page.waitForTimeout(250);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  step(`Sin desborde horizontal a 320 px (${v})`, w <= 321, String(w));
}
await page.close();
step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv59: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
