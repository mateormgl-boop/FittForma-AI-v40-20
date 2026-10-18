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
await page.addInitScript(() => { localStorage.setItem('fittforma-welcome-v1', '1'); setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d && d.open) d.close(); }, 50); });
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

step('Sin errores de página', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO PASA');
process.exit(failures ? 1 : 0);
