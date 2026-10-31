// v69: Ajustes en un solo lugar (engranaje al lado de «Más», con buscador), el Muro dentro de Amigos y Perfil con «Este mes».
// Uso: APP_URL=http://localhost:8787 node tests/e2e/v69.e2e.mjs  (solo la app; no necesita la base)
import { createRequire } from 'module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:8787';
let failures = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASA' : 'FALLA'}  ${name}${detail !== '' ? ' — ' + detail : ''}`); if (!ok) failures++; };
const now = new Date(), inMonth = n => { const d = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - n)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const seed = { profile: { equipment: 'gym', level: 'intermediate', goal: 'muscle', currentWeightKg: '75' },
  sessions: [0, 1, 2].map(n => ({ id: 690 + n, date: inMonth(n), status: 'completed', type: 'custom', title: 'Fuerza', minutes: 40, exercises: [{ name: 'Sentadilla goblet', entries: [{ reps: '10', weight: '20', done: true }] }] })),
  activities: [{ id: 699, type: 'Correr', date: inMonth(0), distance: 5, minutes: 30 }] };
const browser = await chromium.launch();
const errors = [];
const open = async ({ lang = '', width = 390 } = {}) => {
  const ctx = await browser.newContext({ viewport: { width, height: 820 }, locale: 'es-UY', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
  await page.addInitScript(([s, l]) => {
    localStorage.setItem('fittforma-welcome-v1', '1'); localStorage.setItem('fittforma-tour-v68', '1');
    if (l) localStorage.setItem('fittforma-language-v1', l);
    if (!sessionStorage.getItem('v69-seed')) { sessionStorage.setItem('v69-seed', '1'); localStorage.setItem('fittforma-ai-v4', s); }
  }, [JSON.stringify(seed), lang]);
  await page.goto(APP + '/'); await page.waitForTimeout(1300);
  return { ctx, page };
};
const visibleGroups = page => page.$$eval('[data-settings-group]', l => l.filter(g => !g.hidden).map(g => g.dataset.settingsGroup));

// 1) El engranaje está al lado de «Más» (no adentro) y abre Ajustes.
let { ctx, page } = await open();
const head = await page.$$eval('header .header-actions > *', l => l.filter(x => getComputedStyle(x).display !== 'none').map(x => x.id || x.className));
step('Arriba a la derecha: el engranaje y al lado «Más»', head.join(',') === 'settingsToggle,mobileMoreToggle', head.join(','));
await page.click('#mobileMoreToggle'); await page.waitForTimeout(200);
step('«Más» no tiene un acceso a Ajustes adentro', !/Ajustes/.test(await page.textContent('#mobileMoreMenu')));
await page.click('#mobileMoreToggle'); await page.waitForTimeout(150);
await page.click('#settingsToggle'); await page.waitForTimeout(500);
step('El engranaje abre Ajustes', await page.isVisible('#view-settings') && (await page.title()) === 'Ajustes · FittForma AI' && await page.evaluate(() => document.getElementById('settingsToggle').classList.contains('active')));
const order = await visibleGroups(page);
step('Ajustes junta todo en 10 grupos', order.join(',') === 'account,training,appearance,reminders,water,home,privacy,help,membership,version', order.join(','));

// 2) Buscador
await page.fill('#settingsSearch', 'agua'); await page.waitForTimeout(200);
let vis = await visibleGroups(page);
step('Buscar «agua» deja Agua (y lo abre)', vis.includes('water') && !vis.includes('membership') && await page.evaluate(() => document.querySelector('[data-settings-group="water"]').open), vis.join(','));
await page.fill('#settingsSearch', 'IDIOMA'); await page.waitForTimeout(200);
step('Buscar «IDIOMA» (sin importar mayúsculas) lleva a Apariencia e idioma', (await visibleGroups(page)).join(',') === 'appearance');
await page.fill('#settingsSearch', 'contrasena'); await page.waitForTimeout(200);
step('Sin tildes también encuentra (contraseña → Cuenta)', (await visibleGroups(page)).includes('account'));
await page.fill('#settingsSearch', 'zzzz'); await page.waitForTimeout(200);
step('Si no hay nada, lo dice', (await visibleGroups(page)).length === 0 && await page.isVisible('#settingsSearchEmpty'));
await page.fill('#settingsSearch', ''); await page.waitForTimeout(200);
step('Al borrar la búsqueda vuelven todos', (await visibleGroups(page)).length === 10);

// 3) Apariencia: el tema se cambia desde Ajustes.
await page.evaluate(() => { document.querySelector('[data-settings-group="appearance"]').open = true; });
const before = await page.evaluate(() => document.documentElement.dataset.theme);
await page.selectOption('#themeSelect', before === 'dark' ? 'light' : 'dark'); await page.waitForTimeout(200);
step('El tema claro u oscuro se elige en Ajustes', (await page.evaluate(() => document.documentElement.dataset.theme)) !== before);

// 4) Agua: en Nutrición queda el resumen y el acceso.
await page.evaluate(() => window.FittFormaGo('hydration')); await page.waitForTimeout(500);
step('Hidratación: «Recordatorios de agua: 3 por día» y «Ajustes del agua»', /Recordatorios de agua: 3 por día/.test(await page.textContent('#hydroSettingsLink')) && !(await page.isVisible('#hydroRemind')));
await page.click('#hydroSettingsLink [data-go]'); await page.waitForTimeout(600);
step('«Ajustes del agua» abre Ajustes › Agua (con el objetivo y el vaso)', await page.isVisible('#hydroRemind') && await page.evaluate(() => document.querySelector('[data-settings-group="water"]').contains(document.getElementById('waterGoalMl'))));
await page.click('[data-water-count="2"]'); await page.waitForTimeout(150);
await page.evaluate(() => window.FittFormaGo('hydration')); await page.waitForTimeout(400);
step('El cambio se ve en Nutrición', /2 por día/.test(await page.textContent('#hydroSettingsLink')));

// 5) Inicio: qué tarjetas ver, desde Ajustes.
await page.evaluate(() => window.FittFormaGo('settings:home')); await page.waitForTimeout(400);
await page.click('[data-settings-group="home"] [data-home-customize]'); await page.waitForTimeout(300);
step('Ajustes › Inicio abre «Personalizar inicio»', await page.isVisible('#homeLayoutDialog'));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);

// 6) Privacidad en Comunidad
await page.evaluate(() => window.FittFormaGo('settings:privacy')); await page.waitForTimeout(500);
step('Ajustes › Privacidad: estadísticas, mapa de músculos y datos físicos', await page.isVisible('#communityStatsPublic') && await page.isVisible('#communityShowMuscles') && await page.isVisible('#communityBodyWeight'));
step('Los datos físicos siguen apagados por defecto', !(await page.isChecked('#communityBodyWeight')) && !(await page.isChecked('#communityBodyHeight')));
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(700);
await page.click('#communityTabProfile'); await page.waitForTimeout(500);
step('Comunidad › Mi perfil deja el acceso «Abrir privacidad»', await page.isVisible('.cm-privacy-link [data-go="settings:privacy"]'));
await page.click('.cm-privacy-link [data-go="settings:privacy"]'); await page.waitForTimeout(500);
step('…que lleva a Ajustes › Privacidad', await page.isVisible('#communityStatsPublic'));

// 7) Amigos: Muro, Desafíos y Mis amigos.
await page.click('.mobile-nav-item[data-mobile-view="community"]'); await page.waitForTimeout(600);
step('Comunidad tiene tres pestañas: Todos, Ranking y Amigos', (await page.$$eval('.cm-tabs [role=tab]', t => t.map(x => x.textContent.trim()).join('|'))) === 'Todos|Ranking|Amigos');
await page.click('#communityTabFriends'); await page.waitForTimeout(800);
const shown = id => page.evaluate(i => !document.getElementById(i).hidden, id);
step('Amigos abre en el Muro', (await page.getAttribute('[data-friends-part="wall"]', 'aria-pressed')) === 'true' && await shown('communityFriendsWall') && !(await shown('communityFriendsChallenges')) && !(await shown('communityFriendsList')));
await page.click('[data-friends-part="challenges"]'); await page.waitForTimeout(400);
step('«Desafíos» muestra los desafíos y oculta el muro', await shown('communityFriendsChallenges') && !(await shown('communityFriendsWall')));
await page.click('[data-friends-part="list"]'); await page.waitForTimeout(400);
step('«Mis amigos» muestra la lista', await shown('communityFriendsList') && !(await shown('communityFriendsChallenges')));

// 8) Perfil: lo tuyo, «Este mes» y acceso a Ajustes.
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(400);
step('Perfil ya no tiene los grupos de ajustes', (await page.$$('#view-profile details.ff-group')).length === 0);
const month = (await page.innerText('#profileMonth')).replace(/\s+/g, ' ');
step('Perfil muestra «Este mes» con racha, entrenamientos, días activos y km', /Este mes/.test(month) && /4 entrenamientos/.test(month) && /5 km corriendo/.test(month) && /días? seguidos?/.test(month), month);
await page.click('#profileMonth [data-go="progress:history"]'); await page.waitForTimeout(400);
step('Tocar «entrenamientos» abre el historial', await page.isVisible('#view-progress'));
await page.click('.mobile-nav-item[data-mobile-view="profile"]'); await page.waitForTimeout(300);
await page.click('.profile-settings-link'); await page.waitForTimeout(400);
step('Perfil tiene el acceso a Ajustes', await page.isVisible('#view-settings'));
await ctx.close();

// 9) 320 px y en inglés.
({ ctx, page } = await open({ width: 320 }));
await page.click('#settingsToggle'); await page.waitForTimeout(500);
step('A 320 px el encabezado y Ajustes entran sin desbordarse', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && await page.isVisible('#mobileMoreToggle') && await page.isVisible('#settingsToggle'));
await ctx.close();
({ ctx, page } = await open({ lang: 'en' }));
await page.waitForTimeout(800);
await page.click('#settingsToggle'); await page.waitForTimeout(500);
step('En inglés: «Settings» y el buscador traducido', /Settings/.test(await page.textContent('#view-settings h2')) && /Search a setting/.test(await page.getAttribute('#settingsSearch', 'placeholder')));
await page.fill('#settingsSearch', 'water'); await page.waitForTimeout(200);
step('En inglés el buscador encuentra «water»', (await visibleGroups(page)).includes('water'));
await ctx.close();

step('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\nv69: ${failures ? failures + ' fallan' : 'todo pasa'}`);
process.exit(failures ? 1 : 0);
