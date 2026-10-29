// v67: en español no se descargan las traducciones; al elegir otro idioma se descargan y la app se traduce.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v67.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const pick = (page, l) => page.evaluate(v => { const s = document.getElementById('languageSelect'); s.value = v; s.dispatchEvent(new Event('change')); }, l);
const PACK = /\/i18n-(extra|v48|v50|v51|v52|v53)\.js/;
const browser = await chromium.launch();
const errors = [];
const open = async lang => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const packs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (PACK.test(new URL(r.url()).pathname)) packs.push(new URL(r.url()).pathname); });
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(l => { localStorage.setItem('fittforma-welcome-v1', '1'); if (l) localStorage.setItem('fittforma-language-v1', l); }, lang);
  return { ctx, page, packs };
};

// 1) Español: no se pide ninguna traducción y todo funciona.
let { ctx, page, packs } = await open('');
await page.goto(APP + '/'); await page.waitForTimeout(1500);
step('En español no se descarga ninguna traducción', packs.length === 0, packs.join(', '));
step('La app funciona en español', /Inicio/.test(await page.textContent('.mobile-nav-item[data-mobile-view="plan"]')) && await page.evaluate(() => window.FittFormaI18n.getLanguage()) === 'es');
const bytes = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /i18n/.test(e.name)).reduce((n, e) => n + (e.encodedBodySize || e.transferSize || 0), 0));
step('Solo se descarga i18n.js (menos de 200 KB de traducciones)', bytes < 200_000, `${bytes} bytes`);

// 2) Cambiar a inglés con el selector de idioma: se descargan una vez y la app se traduce.
await pick(page, 'en'); await page.waitForTimeout(1500);
step('Al elegir inglés se descargan las seis partes de las traducciones', new Set(packs).size === 6, [...new Set(packs)].join(', '));
step('…y la app queda en inglés (también textos de las partes nuevas)', /Workout|Train/.test(await page.textContent('.mobile-nav-item[data-mobile-view="train"]')) && (await page.textContent('#communityTabWall')).trim() === 'Wall');
step('Textos armados con números (reglas de las partes nuevas) también', await page.evaluate(() => window.FittFormaI18n.translate('18 series')) === '18 sets');
await pick(page, 'pt'); await page.waitForTimeout(600);
step('Cambiar a portugués no vuelve a descargarlas', packs.length === 6 && (await page.textContent('#communityTabWall')).trim() === 'Mural');
await pick(page, 'es'); await page.waitForTimeout(400);
step('Volver a español restaura los textos originales', (await page.textContent('#communityTabWall')).trim() === 'Muro');
await ctx.close();

// 3) Abrir la app ya en alemán: se traduce sola al cargar.
({ ctx, page, packs } = await open('de'));
await page.goto(APP + '/'); await page.waitForTimeout(2000);
step('Abierta en alemán: se traduce sola al cargar', (await page.textContent('#communityTabWall')).trim() === 'Pinnwand' && await page.evaluate(() => document.documentElement.lang) === 'de', String(await page.textContent('#communityTabWall')).trim());
await ctx.close();

step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv67: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
