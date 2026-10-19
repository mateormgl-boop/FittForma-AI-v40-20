// v51: «Objetivo y actualidad» (Perfil) y la hidratación renovada, de punta a punta en el navegador.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/body-goals.e2e.mjs  (con `npm start` en otra terminal)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
const KEY = 'fittforma-ai-v4';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };

const browser = await chromium.launch();
for (const w of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(() => { localStorage.setItem('fittforma-welcome-v1', '1'); setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50); });
  await page.goto(APP + '/'); await page.waitForTimeout(700);
  const st = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
  const go = v => page.evaluate(v => document.querySelector(`[data-view="${v}"]`)?.click(), v);
  console.log(`— ancho ${w}px`);

  step('Inicio invita a completar el objetivo', /Completar/.test(await page.textContent('#homeBodyGoal')));
  await page.click('#homeBodyGoal'); await page.waitForTimeout(500);
  step('El acceso de Inicio abre Perfil', await page.evaluate(() => document.querySelector('.view.active')?.id) === 'view-profile');
  step('Sin datos no se muestran cálculos inventados', (await page.textContent('#bodyGoalResults')).includes('falta: peso, altura, edad'));

  await page.selectOption('#profileSex', 'female'); await page.fill('#profileAge', '30'); await page.fill('#profileHeight', '1.65');
  await page.fill('#profileCurrentWeight', '60'); await page.fill('#profileWaist', '400');
  await page.click('#saveBodyProfile'); await page.waitForTimeout(200);
  step('Valida la cintura fuera de rango', !(await st()).profile?.waistCm);
  await page.fill('#profileWaist', '74'); await page.selectOption('#profileActivityLevel', 'light');
  await page.selectOption('#profileBodyGoal', 'lose'); await page.fill('#profileTargetWeight', '56'); await page.selectOption('#profileWeeklyRate', '0.25');
  await page.click('#saveBodyProfile'); await page.waitForTimeout(400);
  let s = await st();
  step('Guarda sexo, cintura, objetivo, ritmo y altura en cm', s.profile.sex === 'female' && s.profile.waistCm === '74' && s.profile.bodyGoal === 'lose' && s.profile.weeklyRateKg === '0.25' && s.profile.heightCm === '165', JSON.stringify(s.profile));
  await page.reload(); await page.waitForTimeout(700); await go('profile'); await page.waitForTimeout(300);
  step('Persiste tras recargar', await page.inputValue('#profileSex') === 'female' && await page.inputValue('#profileWaist') === '74');
  const res = await page.textContent('#bodyGoalResults');
  // Mujer 30 años, 165 cm, 60 kg, ligera: basal 1320 · gasto 1820 · −275 → 1550 kcal; proteína 110 g; agua 1950 ml.
  step('IMC 22 y rango normal', /22/.test(res) && /Rango normal/.test(res), res.slice(0, 80));
  step('Basal 1320 y gasto 1820 kcal', /1\.?320 kcal/.test(res) && /1\.?820 kcal/.test(res));
  step('Calorías sugeridas 1550 kcal', /1\.?550 kcal/.test(res));
  step('Fecha estimada visible', /semanas/.test(res));
  await page.click('#applyBodyGoals'); await page.waitForTimeout(300); s = await st();
  step('Aplica calorías, proteína y agua', s.nutritionGoals.calories === 1550 && s.nutritionGoals.protein === 110 && s.hydration.goalMl === 1950, JSON.stringify([s.nutritionGoals, s.hydration.goalMl]));
  await go('plan'); await page.waitForTimeout(300);
  step('Inicio muestra peso actual → meta', /60 kg → 56 kg/.test(await page.textContent('#homeBodyGoal')));
  step('El perfil no se publica en Comunidad', !(await page.evaluate(() => [...document.querySelectorAll('#view-community *')].some(e => /cintura|74 cm|Femenino/.test(e.textContent || '')))));

  // Hidratación renovada
  await go('nutrition'); await page.waitForTimeout(300);
  await page.click('[data-water-add="750"]'); await page.click('#addWater'); await page.waitForTimeout(200);
  const tl = await page.$$eval('#waterTimeline li', l => l.map(x => x.textContent));
  step('Línea de tiempo con 2 registros y acumulado', tl.length === 2 && /1000 ml/.test(tl[1]), JSON.stringify(tl));
  step('Barra de progreso proporcional', (await page.$eval('#hydroBar', e => e.style.width)) === `${Math.round(1000 / 1950 * 100)}%`);
  step('Gráfico semanal con línea de objetivo', await page.$('.hydro-goal-line') !== null && (await page.$$('#waterWeek .hydro-day')).length === 7);
  step('Botella de tamaño fijo', (await page.$eval('#hydroBottle', e => Math.round(e.getBoundingClientRect().width))) <= 104);
  step('Sin errores de página', errors.length === 0, errors.join(' | '));
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} fallas` : '\nTodo pasa');
process.exit(failures ? 1 : 0);
