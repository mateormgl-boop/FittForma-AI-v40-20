// v68: «Cómo usar la app» (desde Más, Perfil e Inicio) y recorrido inicial después de la bienvenida.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v68.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const browser = await chromium.launch();
const errors = [];
const open = async ({ lang = '', welcome = false, width = 390 } = {}) => {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'es-UY', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(([l, w]) => { if (!w) localStorage.setItem('fittforma-welcome-v1', '1'); if (l) localStorage.setItem('fittforma-language-v1', l); }, [lang, welcome]);
  await page.goto(APP + '/'); await page.waitForTimeout(1300);
  return { ctx, page };
};
const ringOn = page => page.evaluate(sel => { const r = document.getElementById('tourRing').getBoundingClientRect(), t = document.querySelector(sel).getBoundingClientRect(); return Math.abs((r.left + r.width / 2) - (t.left + t.width / 2)) < 4 && Math.abs((r.top + r.height / 2) - (t.top + t.height / 2)) < 4; }, '.mobile-nav-item[data-mobile-view="train"]');

// 1) Primera vez: bienvenida → «Seguir sin cuenta» → recorrido de 6 pasos.
let { ctx, page } = await open({ welcome: true });
step('La bienvenida aparece la primera vez', await page.isVisible('#welcomeScreen'));
await page.click('#welcomeStart'); await page.waitForTimeout(300); await page.click('#welcomeSkip'); await page.waitForTimeout(900);
step('Al cerrar la bienvenida empieza el recorrido (7 pasos)', await page.isVisible('#tour') && /Paso 1 de 7/.test(await page.textContent('#tourCount')) && (await page.textContent('#tourTitle')) === 'Inicio');
await page.click('#tourNext'); await page.waitForTimeout(300);
step('Paso 2: Entrenar, con el botón de abajo resaltado', (await page.textContent('#tourTitle')) === 'Entrenar' && await ringOn(page));
step('El texto explica qué tocar', /Empezar ahora/.test(await page.textContent('#tourText')));
step('La tarjeta del recorrido entra en la pantalla', await page.evaluate(() => { const r = document.getElementById('tourCard').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
for (let i = 0; i < 5; i++) { await page.click('#tourNext'); await page.waitForTimeout(250); }
step('Paso 7: «Más», y el botón dice «Listo»', (await page.textContent('#tourTitle')) === 'Más' && (await page.textContent('#tourNext')) === 'Listo');
await page.click('#tourNext'); await page.waitForTimeout(400);
step('Al terminar se cierra y avisa dónde está la guía', !(await page.isVisible('#tour')) && /Cómo usar la app/.test(await page.textContent('#toast')));
await page.reload(); await page.waitForTimeout(1300);
step('No vuelve a aparecer al abrir la app de nuevo', !(await page.isVisible('#tour')) && !(await page.isVisible('#welcomeScreen')));

// 2) Inicio: aviso para quien recién empieza → abre la guía.
step('Inicio muestra «¿Primera vez en FittForma?»', await page.isVisible('#guideHint'));
await page.click('#guideHint [data-guide-open]'); await page.waitForTimeout(300);
step('Abre «Cómo usar la app» con las 10 secciones (v69 suma Ajustes)', await page.isVisible('#guideSheet') && (await page.$$('#guideSheet .guide-item')).length === 10);
await page.click('#guideSheet .guide-item:nth-child(2) summary'); await page.waitForTimeout(200);
step('Cada sección explica cómo se usa', /marcá cada serie al terminarla/.test(await page.textContent('#guideSheet .guide-item:nth-child(2)')));
await page.click('#guideSheet [data-guide-go="train"]'); await page.waitForTimeout(500);
step('«Ir a Entrenar» cierra la guía y lleva a Entrenar', !(await page.isVisible('#guideSheet')) && await page.isVisible('#view-train'));
await page.click('.mobile-nav-item[data-mobile-view="plan"]'); await page.waitForTimeout(300);
await page.click('#guideHintDismiss'); await page.waitForTimeout(200);
step('El aviso de Inicio se puede ocultar', !(await page.isVisible('#guideHint')));
await page.reload(); await page.waitForTimeout(1200);
step('…y queda oculto', !(await page.isVisible('#guideHint')));

// 3) Desde «Más» y desde Perfil; volver a ver el recorrido.
await page.click('#mobileMoreToggle'); await page.waitForTimeout(300);
await page.click('#moreGuide'); await page.waitForTimeout(300);
step('«Más» → «Cómo usar la app» abre la guía', await page.isVisible('#guideSheet') && await page.isHidden('#mobileMoreMenu'));
await page.click('#guideSheet [data-tour-start]'); await page.waitForTimeout(400);
step('«Ver el recorrido por la app» lo vuelve a mostrar', await page.isVisible('#tour') && !(await page.isVisible('#guideSheet')));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
step('Escape cierra el recorrido', !(await page.isVisible('#tour')));
await page.evaluate(() => window.FittFormaGo('settings:help')); await page.waitForTimeout(400);
step('Ajustes → Ayuda tiene «Cómo usar la app»', await page.$('#guideCard [data-guide-open]') !== null && await page.$('#guideCard [data-tour-start]') !== null);
await ctx.close();

// 4) A 320 px y en inglés.
({ ctx, page } = await open({ width: 320 }));
await page.evaluate(() => document.querySelector('[data-tour-start]').click()); await page.waitForTimeout(400);
step('A 320 px la tarjeta del recorrido entra sin desbordarse', await page.evaluate(() => { const r = document.getElementById('tourCard').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
await ctx.close();
({ ctx, page } = await open({ lang: 'en' }));
await page.waitForTimeout(800);
await page.evaluate(() => document.querySelector('[data-tour-start]').click()); await page.waitForTimeout(500);
step('En inglés el recorrido está traducido', (await page.textContent('#tourCount')).trim() === 'Step 1 of 7' && (await page.textContent('#tourTitle')).trim() === 'Home' && (await page.textContent('#tourNext')).trim() === 'Next', `${await page.textContent('#tourCount')} | ${await page.textContent('#tourTitle')}`);
await page.keyboard.press('Escape');
await page.evaluate(() => document.querySelector('[data-guide-open]').click()); await page.waitForTimeout(400);
step('…y la guía también', (await page.textContent('#guideTitle')).trim() === 'How to use the app' && /Train with friends\./.test(await page.textContent('#guideSheet')));
await ctx.close();

step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv68: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
