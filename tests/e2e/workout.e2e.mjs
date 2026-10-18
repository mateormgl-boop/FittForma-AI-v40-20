// v49: entrenamiento en curso, récords reales, registro manual por serie y ficha con mapa muscular.
// Requiere `npm start` en otra terminal. Uso: APP_URL=http://localhost:8787 node tests/e2e/workout.e2e.mjs
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
const KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
// La pantalla de logro se registra (para comprobar que aparece una sola vez) y se cierra para seguir.
await page.addInitScript(() => { localStorage.setItem('fittforma-welcome-v1', '1'); window.__celebrations = JSON.parse(sessionStorage.getItem('cel') || '[]'); setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d && d.open) { window.__celebrations.push(document.getElementById('badgeCelebrationName')?.textContent + ' · ' + document.getElementById('badgeCelebrationRank')?.textContent); sessionStorage.setItem('cel', JSON.stringify(window.__celebrations)); d.close(); } }, 50); });
await page.goto(APP + '/'); await page.evaluate(k => localStorage.removeItem(k), KEY); await page.reload(); await page.waitForTimeout(600);
const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
const go = async v => { await page.click(`.mobile-nav-item[data-mobile-view="${v}"]`); await page.waitForTimeout(250); };
const addExercise = async name => { await page.fill('#sessionAddExerciseName', name); await page.click('#sessionAddExerciseForm button'); await page.waitForTimeout(250); };
const setRow = async (e, s, kg, reps) => {
  if (kg !== null) await page.fill(`input[data-e="${e}"][data-s="${s}"][data-k="weight"]`, String(kg));
  await page.fill(`input[data-e="${e}"][data-s="${s}"][data-k="reps"]`, String(reps));
  await page.check(`input[data-done][data-e="${e}"][data-s="${s}"]`); await page.waitForTimeout(80);
};

// 1. Dos series con pesos distintos se guardan por separado.
await go('train'); await page.click('#startFreeWorkout'); await page.waitForTimeout(200);
await addExercise('Press de banca con barra');
step('La sesión muestra el mapa muscular del ejercicio', await page.$$eval('[data-ex-card="0"] .anatomy-map .am-m.is-primary', n => n.length) > 0);
step('Columnas Anterior / Kg / Reps', /Anterior[\s\S]*Kg[\s\S]*Reps/.test(await page.textContent('[data-ex-card="0"] .set-head')));
await setRow(0, 0, 20, 10); await setRow(0, 1, 40, 8);
step('Volumen en vivo = 20×10 + 40×8', (await page.textContent('#workoutVolumeLive')).trim() === '520 kg', await page.textContent('#workoutVolumeLive'));
step('Sin historial no se declara ningún récord', (await page.textContent('#workoutPrCount')).trim() === '0');
await page.evaluate(() => document.getElementById('finishWorkout').click()); await page.waitForTimeout(500);
let s = await st();
const saved = s.sessions?.[0]?.exercises?.find(e => e.name === 'Press de banca con barra');
step('Cada serie conserva su propio peso', saved && saved.entries[0].weight === '20' && saved.entries[1].weight === '40' && saved.entries[0].reps === '10' && saved.entries[1].reps === '8', JSON.stringify(saved?.entries));
step('Volumen guardado correcto', s.sessions[0].volumeKg === 520, String(s.sessions[0].volumeKg));

// 2. Récord: 40 kg es el mejor peso real (no el volumen).
await go('progress'); await page.waitForTimeout(300);
const records = await page.textContent('#personalRecords');
step('Récord de peso 40 kg (no 520 de volumen)', /40 kg/.test(records) && !/520 kg/.test(records), records.replace(/\s+/g, ' ').slice(0, 160));

// 3. Nueva sesión: superar 40 kg marca récord; 30 kg no. La plancha se registra en segundos y sin kg.
await go('train'); await page.click('#startFreeWorkout'); await page.waitForTimeout(200);
await addExercise('Press de banca con barra'); await addExercise('Plancha frontal');
step('La columna «Anterior» muestra la serie previa', (await page.textContent('[data-set-row="0:1"] .set-prev')).includes('40 kg × 8'));
await setRow(0, 0, 45, 5); await setRow(0, 1, 30, 5);
step('45 kg supera el récord real de 40 kg', await page.isVisible('[data-set-row="0:0"] .set-pr'));
step('30 kg no es récord', !(await page.isVisible('[data-set-row="0:1"] .set-pr')));
step('Plancha: sin campo de kg y en segundos', !(await page.$('input[data-e="1"][data-s="0"][data-k="weight"]')) && (await page.getAttribute('input[data-e="1"][data-s="0"][data-k="reps"]', 'placeholder')) === 'seg');
await setRow(1, 0, null, 75);
step('Contador de récords en la sesión', (await page.textContent('#workoutPrCount')).trim() === '1');
await page.evaluate(() => document.getElementById('finishWorkout').click()); await page.waitForTimeout(500);
s = await st();
const plank = s.sessions[0].exercises.find(e => e.name === 'Plancha frontal');
step('La plancha se guarda como medida en segundos', plank?.measure === 'seconds' && plank.entries[0].reps === '75', JSON.stringify(plank));

// 4. Ficha del ejercicio con mapa muscular, chips y dosis.
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.exerciseDetail = 'Dominadas'; b.dataset.exerciseGroup = 'Espalda'; b.dataset.exerciseKind = 'strength'; document.body.appendChild(b); b.click(); });
await page.waitForTimeout(300);
const sheet = await page.evaluate(() => ({ primary: [...document.querySelectorAll('#exerciseModalMap .am-m.is-primary')].length, chips: document.getElementById('exerciseModalChips').textContent, start: document.getElementById('exerciseModalStart').hidden ? '' : document.getElementById('exerciseModalStart').textContent, steps: document.querySelectorAll('#exerciseModalProgression .exercise-progression-step').length, dose: document.getElementById('exerciseModalDose').textContent }));
step('Ficha: músculo principal resaltado', sheet.primary > 0);
step('Ficha: equipamiento, nivel y tipo de movimiento', /Equipamiento/.test(sheet.chips) && /Tipo de movimiento[\s\S]*Tirón/.test(sheet.chips), sheet.chips);
step('Ficha: posición inicial y pasos numerados', sheet.start.length > 20 && sheet.steps >= 3);
step('Ficha: series, repeticiones y descanso', /Series[\s\S]*Repeticiones[\s\S]*Descanso/.test(sheet.dose), sheet.dose);
await page.click('#exerciseModal .modal-close');

// 5. Registro manual con un peso por serie; queda en su fecha y no como «última vez».
await page.click('#openManualLog'); await page.waitForTimeout(200);
await page.fill('#manualDate', '2026-01-10'); await page.fill('#manualMinutes', '40'); await page.fill('#manualTitle', 'Pecho viejo');
await page.fill('#manualRows [data-m="name"]', 'Press de banca con barra'); await page.fill('#manualRows [data-m="sets"]', '3');
await page.fill('#manualRows [data-m="reps"]', '10, 8, 6'); await page.fill('#manualRows [data-m="weight"]', '40, 45, 50');
await page.click('#manualLogForm button[type="submit"]'); await page.waitForTimeout(400);
s = await st();
const manual = s.sessions.find(x => x.type === 'manual');
step('Registro manual: un peso por serie', manual && manual.exercises[0].entries.map(e => e.weight).join(',') === '40,45,50', JSON.stringify(manual?.exercises?.[0]?.entries));
step('Registro manual: volumen real (1060 kg)', manual?.volumeKg === 1060, String(manual?.volumeKg));
step('Registro atrasado ubicado por fecha, no como el más reciente', s.sessions[0].type !== 'manual' && s.sessions[s.sessions.length - 1].type === 'manual');

// 6. Insignia por carga: 80 kg en press de banca con 80 kg de peso corporal = 1,00× → Oro II.
await page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); s.profile = { ...(s.profile || {}), currentWeightKg: 80 }; localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem('cel', '[]'); }, KEY);
await page.reload(); await page.waitForTimeout(600);
await go('train'); await page.click('#startFreeWorkout'); await page.waitForTimeout(200);
await addExercise('Press de banca con barra');
await setRow(0, 0, 80, 3);
await page.evaluate(() => document.getElementById('finishWorkout').click()); await page.waitForTimeout(800);
s = await st();
const loadUnlocks = Object.values(s.badgeUnlocks || {}).filter(u => u.exerciseId === 'load-press-banca').sort((a, b) => a.level - b.level);
step('Press de banca 80 kg × 3 con 80 kg corporales → hasta Oro II', loadUnlocks.length === 8 && loadUnlocks[7].rank === 'Oro', loadUnlocks.map(u => u.level).join(','));
step('El historial conserva Bronce I a Oro I', loadUnlocks.slice(0, 7).every((u, i) => u.level === i + 1));
// Niveles 1–4 ya los daba el registro manual de 50 kg (0,62×): quedan como «declarada». 5–8 salen de la sesión.
step('Fuente honesta: manual = declarada; sesión = registrada en sesión', loadUnlocks.slice(0, 4).every(u => u.evidence === 'declared') && loadUnlocks.slice(4).every(u => u.evidence === 'session'), loadUnlocks.map(u => u.evidence).join(','));
let cel = await page.evaluate(() => window.__celebrations);
step('Pantalla de logro con la insignia nueva más alta', cel.some(c => /Press de banca · carga · Oro II/.test(c)), cel.join(' | '));
step('La celebración queda marcada como vista', loadUnlocks.slice(4).every(u => u.celebratedAt));
const celCount = cel.length;
await page.reload(); await page.waitForTimeout(800); await go('profile'); await go('progress'); await page.waitForTimeout(300);
cel = await page.evaluate(() => window.__celebrations);
step('Al recargar y abrir el perfil no se repite', cel.length === celCount, `${celCount} → ${cel.length}`);
const featured = await page.$$eval('#featuredBadges .ff-medal', n => n.length);
step('Perfil: como máximo 3 insignias destacadas', featured > 0 && featured <= 3, String(featured));
step('El emblema destacado usa el símbolo de la actividad', await page.$$eval('#featuredBadges svg', n => n.some(x => /ff-medal--gold/.test(x.getAttribute('class')))));

step('Sin errores de página', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO PASA');
process.exit(failures ? 1 : 0);
