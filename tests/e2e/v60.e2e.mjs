// v60: avisos según Mi semana y calendario semanal, sesión (superserie, discos, aviso al terminar el descanso),
// 404 propia, robots.txt, títulos y enlaces por sección, vista previa al compartir, ayuda y política de privacidad.
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v60.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
import fs from 'node:fs';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const wd = ((new Date().getDay() + 6) % 7) + 1, next = wd % 7 + 1;
const browser = await chromium.launch();
const errors = [];
const open = async (state, { stubNotify = false } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, locale: 'es-UY' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(([s, stub]) => {
    localStorage.setItem('fittforma-welcome-v1', '1'); window.__vib = []; navigator.vibrate = x => { window.__vib.push(x); return true; };
    if (stub) { window.__notes = []; class N { static permission = 'granted'; static requestPermission() { return Promise.resolve('granted'); } constructor(t, o) { window.__notes.push(t + ' | ' + (o?.body || '')); } } window.Notification = N;
      Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: () => Promise.resolve(null), register: () => Promise.resolve({}), addEventListener() {} }, configurable: true }); }
    if (s && !sessionStorage.getItem('v60-seed')) { sessionStorage.setItem('v60-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); }
    setInterval(() => { const d = document.getElementById('badgeCelebration'); if (d?.open) d.close(); }, 50);
  }, [state ? JSON.stringify(state) : null, stubNotify]);
  return { ctx, page };
};

// 1) Avisos según Mi semana
const base = { profile: { equipment: 'gym', level: 'intermediate', goal: 'muscle', currentWeightKg: 75 }, sessions: [], reminders: { enabled: true, time: '00:01', days: [], missedEnabled: false } };
let { ctx, page } = await open({ ...base, weekPlan: { days: { [wd]: { kind: 'focus', key: 'legs' }, [next]: { kind: 'rest' }, 1: { kind: 'focus', key: 'chest_triceps' } } } }, { stubNotify: true });
await page.goto(APP + '/'); await page.waitForTimeout(2500);
const notes = await page.evaluate(() => window.__notes);
step('El aviso dice lo que toca hoy según Mi semana', notes.length === 1 && /^Hoy toca: Piernas/.test(notes[0]), JSON.stringify(notes));
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
step('Mi semana ofrece «Que te avise»', await page.isVisible('.wp-remind') && /Avisos activados a las 00:01/.test(await page.textContent('.wp-remind')));
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-wp-remind-cal]')]);
const ics = fs.readFileSync(await dl.path(), 'utf8');
step('«Agregar al calendario» descarga la semana con un evento por día de entrenamiento', dl.suggestedFilename() === 'fittforma-mi-semana.ics' && (ics.match(/BEGIN:VEVENT/g) || []).length === (wd === 1 ? 1 : 2) && /SUMMARY:Hoy toca: Piernas/.test(ics));
await ctx.close();
({ ctx, page } = await open({ ...base, weekPlan: { days: { [wd]: { kind: 'rest' } } } }, { stubNotify: true }));
await page.goto(APP + '/'); await page.waitForTimeout(2500);
step('En un día de descanso de Mi semana no avisa', (await page.evaluate(() => window.__notes)).length === 0);
await ctx.close();

// 2) Sesión: superserie, discos y aviso al terminar el descanso
({ ctx, page } = await open(base));
await page.goto(APP + '/'); await page.waitForTimeout(800);
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(300);
await page.click('[data-focus="chest_triceps"]'); await page.waitForTimeout(200); await page.click('#focusStart'); await page.waitForTimeout(500);
await page.click('[data-session-superset="0"]'); await page.waitForTimeout(300);
step('Superserie marcada en los dos ejercicios', JSON.stringify(await page.$$eval('.ss-badge', n => n.map(x => x.textContent))) === JSON.stringify(['Superserie A · 1/2', 'Superserie A · 2/2']));
await page.check('input[data-done][data-e="0"][data-s="0"]'); await page.waitForTimeout(250);
step('En la superserie se pasa al siguiente sin descanso', /Superserie: ahora/.test(await page.textContent('#toast')) && !/Descanso en curso/.test(await page.textContent('#restTimerStatus')));
await page.check('input[data-done][data-e="1"][data-s="0"]'); await page.waitForTimeout(250);
step('Al cerrar la ronda empieza el descanso', /Descanso en curso/.test(await page.textContent('#restTimerStatus')));
await page.fill('#sessionAddExerciseName', 'Press de banca con barra'); await page.click('#sessionAddExerciseForm button[type=submit]'); await page.waitForTimeout(500);
await page.click('[data-session-plates]'); await page.waitForTimeout(250); await page.fill('#plateTotal', '102.5'); await page.waitForTimeout(150);
step('Discos: 102,5 kg con barra de 20 = 25 + 15 + 1,25 por lado', /Por lado: 25 \+ 15 \+ 1,25 kg/.test(await page.textContent('#plateResult')));
await page.fill('#plateTotal', '61'); await page.waitForTimeout(150);
step('Discos: si no se arma exacto, avisa cuánto falta', /Más cercano: 60 kg \(faltan 1 kg/.test(await page.textContent('#plateResult')));
await page.click('[data-plate-close]'); await page.waitForTimeout(150);
await page.click('#resetRestTimer'); await page.selectOption('#restSeconds', '30'); await page.click('#startRestTimer');
await page.waitForTimeout(31500);
step('Al terminar el descanso vibra', JSON.stringify(await page.evaluate(() => window.__vib)) === '[[220,120,220]]' && /Descanso terminado/.test(await page.textContent('#restTimerStatus')));
await page.uncheck('#restAlertVibrate'); await page.waitForTimeout(100);
step('La vibración se puede apagar (se recuerda en el dispositivo)', await page.evaluate(() => JSON.parse(localStorage.getItem('fittforma-rest-alert')).vibrate === false));
await ctx.close();

// 3) Web: 404, robots, títulos, enlaces, vista previa, ayuda y privacidad
const r404 = await fetch(APP + '/esto-no-existe', { headers: { Accept: 'text/html' } });
step('Una dirección inexistente muestra la página 404 propia', r404.status === 404 && /Esta página no existe/.test(await r404.text()));
const rApi = await fetch(APP + '/esto-no-existe');
step('Sin pedir HTML sigue respondiendo JSON', rApi.status === 404 && /application\/json/.test(rApi.headers.get('content-type')));
step('robots.txt existe y no indexa /api/', /Disallow: \/api\//.test(await (await fetch(APP + '/robots.txt')).text()));
const og = await fetch(APP + '/og-image.png');
step('La imagen para compartir se sirve', og.status === 200 && og.headers.get('content-type') === 'image/png');
({ ctx, page } = await open(base));
await page.goto(APP + '/#nutrition'); await page.waitForTimeout(1200);
step('Un enlace con #nutrition abre Nutrición', await page.evaluate(() => document.getElementById('view-nutrition').classList.contains('active')));
step('La pestaña del navegador dice la sección', (await page.title()) === 'Nutrición · FittForma AI', await page.title());
await page.click('.mobile-nav-item[data-mobile-view="train"]'); await page.waitForTimeout(250);
step('Al cambiar de sección cambia el título; la dirección queda limpia (recargar abre Inicio)', (await page.title()) === 'Entrenar · FittForma AI' && !page.url().includes('#'));
step('Vista previa al compartir con imagen', (await page.getAttribute('meta[property="og:image"]', 'content')) === '/og-image.png');
await page.evaluate(() => window.FittFormaGo('settings:help')); await page.waitForTimeout(400);
step('Ajustes › Ayuda tiene 7 preguntas frecuentes y el enlace a la política', (await page.$$('#faqCard .faq-item')).length === 7 && await page.isVisible('#privacyPolicyLink'));
await page.goto(APP + '/privacidad.html'); await page.waitForTimeout(400);
step('La política no inventa responsable ni correo', /todavía no publicado/.test(await page.textContent('#ownerName')) && /todavía no completó/.test(await page.textContent('#legalOwner')));
await page.goto(APP + '/no-existe/ruta'); await page.waitForTimeout(300);
await page.click('.btn'); await page.waitForTimeout(800);
step('«Volver al inicio» lleva a la app', new URL(page.url()).pathname === '/' && await page.isVisible('#view-plan'));
await page.setViewportSize({ width: 320, height: 720 }); await page.goto(APP + '/privacidad.html'); await page.waitForTimeout(300);
step('La política no se desborda a 320 px', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 321);
await ctx.close();

step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv60: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
