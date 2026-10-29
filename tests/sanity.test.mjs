import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const html = await read('index.html');
const server = await read('backend/server.mjs');
const i18n = await read('i18n.js');
const sw = await read('sw.js');


test('cada recurso del precaché del service worker existe', async () => {
  const match = sw.match(/const ASSETS = (\[[\s\S]*?\]);/);
  assert.ok(match, 'No se encontró la lista ASSETS');
  const assets = JSON.parse(match[1]);
  for (const item of assets) {
    if (item === './') continue;
    await access(path.join(root, item.replace(/^\.\//, '')));
  }
});

test('el GPS simplifica rutas largas conservando los extremos', () => {
  assert.match(html, /const GPS_ROUTE_POINT_LIMIT=2500/);
  assert.match(html, /function compactGpsRoutePoints\(points\)/);
  assert.match(html, /function appendGpsRoutePoint\(point\)/);
  assert.match(html, /points\[0\]/);
  assert.match(html, /pts\[pts\.length-1\]/);
  assert.match(html, /route:gpsPoints\.slice\(\)/);
});

test('rutinas de fuerza separan tren superior/inferior y cardio', () => {
  // v48: el generador vive en training-core.js (probado en v48.test.mjs).
  const core = readFileSync(path.join(root, 'training-core.js'), 'utf8');
  assert.match(core, /4: \['upperA', 'lowerA', 'upperB', 'lowerB'\]/);
  assert.match(core, /title: 'Tren superior A'/);
  assert.match(core, /if \(profile\.goal === 'endurance'\) return buildEndurancePlan/);
  assert.match(html, /state\.plan=FittFormaTraining\.buildPlan\(p\)/);
});

test('el mapa usa URL canónica y permite un Referer válido', () => {
  assert.match(html, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(server, /setHeader\('Referrer-Policy','strict-origin-when-cross-origin'\)/);
});

test('el idioma se manda al entrenador y a la estimación de comida', () => {
  assert.match(html, /language:window\.FittFormaI18n\?\.getLanguage\?\.\(\)\|\|'es'/);
  assert.match(server, /IDIOMA OBLIGATORIO DE RESPUESTA/);
  for (const code of ['es','en','pt','fr','it','de']) assert.ok(i18n.includes(code));
});

test('el backend comprueba origen, limita solicitudes y no incluye una clave privada literal', () => {
  assert.match(server, /Origen no permitido/);
  assert.match(server, /rateLimited\(req\)/);
  assert.doesNotMatch(server, /AIza[0-9A-Za-z_-]{30,}/);
});

test('todos los botones estáticos y de plantillas declaran su tipo para no enviar formularios por accidente', async () => {
  const html=await read('index.html');
  const buttons=[...html.matchAll(/<button\b((?:(?!>).)*)>/gis)];
  const missing=buttons.filter(match=>! /\btype\s*=/.test(match[1]));
  assert.deepEqual(missing.map(m=>m[0]),[],'Cada botón debe declarar type=button o type=submit explícitamente');
});

test('versiones visibles del pie de página y traducciones están alineadas', () => {
  assert.match(html, /Versión 67\.0/);
  assert.match(i18n, /VERSION 67\.0 · ONLINE FITNESS COMMUNITY/);
  assert.doesNotMatch(html, /Versión 26\.0|Versión 25\.0|Versión 24\.0|Versión 23\.0/);
  assert.doesNotMatch(i18n, /Version 23\.0|Versão 23\.0|Versione 23\.0/);
});




test('v42 presenta seis destinos móviles; FittAI y Correr quedan en Más y en Entrenar', () => {
  const nav = html.match(/<nav class="mobile-app-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const destinations = [...nav.matchAll(/data-mobile-view="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(destinations, ['plan', 'train', 'nutrition', 'progress', 'community', 'profile']);
  assert.match(html, /id="mobileMoreToggle"[\s\S]*?aria-controls="mobileMoreMenu"/);
  const menu = html.match(/<div class="mobile-more-menu" id="mobileMoreMenu"[\s\S]*?<\/div>/)?.[0] || '';
  for (const view of ['coach', 'running']) assert.match(menu, new RegExp(`data-mobile-view="${view}"`), `${view} debe estar en Más`);
  assert.match(html, /data-shortcut-view="coach" aria-label="Consultar a la IA"/);
  assert.match(html, /\.mobile-app-nav\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important\}/);
  assert.match(html, /id="installBtn"/);
  assert.match(html, /env\(safe-area-inset-bottom/);
  const planStart = html.indexOf('<section class="view active" id="view-plan">');
  const exercisesStart = html.indexOf('<section class="view" id="view-exercises">');
  assert.ok(planStart >= 0 && exercisesStart > planStart);
  assert.ok(html.indexOf('class="home-dash"', planStart) < exercisesStart, 'El panel debe quedar dentro de Inicio');
});

test('v28 GPS mantiene fresca la marca temporal sin sumar jitter de menos de 2 m', () => {
  // v50: además conserva anchorAt (hora de la posición desde la que se mide) para no perder tiempo en movimiento.\n  assert.match(html, /if\(delta<2\)\{[\s\S]*?gpsLastPoint=\{\.\.\.gpsLastPoint,at:point\.at,anchorAt:gpsLastPoint\.anchorAt\?\?gpsLastPoint\.at,accuracy:point\.accuracy\};[\s\S]*?return;/);
  assert.match(html, /rawTimeDelta>15\|\|delta>allowedDistance/);
  assert.match(html, /point\.accuracy>45/);
  assert.match(html, /function persistGpsDraft\(/);
  assert.match(html, /function restoreGpsDraft\(/);
  assert.match(html, /function downloadActivityGpx\(/);
});

test('la navegación de app móvil y la instalación PWA están configuradas', async () => {
  assert.match(html, /id="mobileAppNav"/);
  assert.match(html, /id="mobileMoreMenu"/);
  assert.match(html, /safe-area-inset-bottom/);
  const manifest = JSON.parse(await read('manifest.json'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.src === 'icon-192.png'));
  await access(path.join(root, 'icon-180.png'));
  await access(path.join(root, 'icon-192.png'));
  await access(path.join(root, 'icon-512.png'));
});


test('la biblioteca contiene al menos 150 ejercicios únicos y conserva las tres modalidades', () => {
  // v48: la biblioteca vive en training-core.js, depurada de duplicados con otro nombre.
  const source = readFileSync(path.join(root, 'training-core.js'), 'utf8');
  const names = [...source.matchAll(/[SCM]\('([^']+)'/g)].map(m => m[1]);
  const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const unique = new Set(names.map(normalize));
  assert.ok(source.includes('gym: [') && source.includes('home: [') && source.includes('bodyweight: ['));
  assert.match(html, /const library = FittFormaTraining\.LIBRARY;/);
  assert.ok(unique.size >= 150, `Se encontraron ${unique.size} ejercicios únicos; se esperan al menos 150`);
});

test('las fichas de ejercicio muestran una secuencia visual de tres etapas', () => {
  assert.match(html, /id="exerciseModalProgression"/);
  assert.match(html, /exercise-progression-step/);
  assert.match(html, /Preparación/);
  assert.match(html, /Ejecución/);
  assert.match(html, /Regreso y control/);
});


test('v40.7: los SVG generados sin verificar siguen en cuarentena: no se usan ni se precargan', async () => {
  assert.doesNotMatch(html, /assets\/exercises\/unverified-generated/);
  assert.doesNotMatch(sw, /assets\/exercises\/unverified-generated/);
});

test('la PWA tolera recursos estáticos opcionales no disponibles durante la instalación', () => {
  assert.match(sw, /Promise\.allSettled\(ASSETS\.map\(asset=>cache\.add\(asset\)\)\)/);
  assert.match(sw, /fittforma-ai-static-v67-0/);
});

test('los estilos móviles protegen desbordamientos y el scroll de menús/modales', () => {
  assert.match(html, /overflow-x:clip/);
  assert.match(html, /overscroll-behavior:contain/);
  assert.match(html, /safe-area-inset-bottom,0px/);
});


test('las fichas detallan dosis, descanso, respiración y errores frecuentes', () => {
  assert.match(html, /id="exerciseModalBreathing"/);
  assert.match(html, /id="exerciseModalErrors"/);
  assert.match(html, /function exerciseBreathing\(/);
  assert.match(html, /function exerciseErrors\(/);
  assert.match(html, /function exerciseRest\(/);
  assert.match(html, /function findExercisePrescription\(/);
  assert.match(html, /exerciseMuscles\(name,group\)/);
  assert.match(html, /exerciseEquipment\(e.name,libraryMode\).*includes\(q\)/);
});


test('v27 recupera una rutina activa tras recargar y guarda los borradores en el dispositivo', () => {
  assert.match(html, /const ACTIVE_SESSION_DRAFT_KEY = 'fittforma-ai-active-session-v1'/);
  assert.match(html, /function persistActiveSessionDraft\(/);
  assert.match(html, /function restoreActiveSessionDraft\(/);
  assert.match(html, /document\.addEventListener\('visibilitychange'/);
  assert.match(html, /session\.pausedAt\)return base/);
  assert.match(html, /window\.addEventListener\('pagehide'/);
  assert.match(html, /restoreActiveSessionDraft\(\);[\s\S]*?\}\)\(\);/);
  assert.match(html, /clearActiveSessionDraft\(\);resetRestTimer\(\);lastWorkoutSummary=null/);
});

test('v27 muestra referencias de rendimiento anterior y progresión prudente por ejercicio', () => {
  assert.match(html, /function lastLoggedExercise\(/);
  assert.match(html, /if\(activeSession\)\{toast\('Ya hay una sesión en curso/);
  assert.match(html, /function lastPerformanceMarkup\(/);
  assert.match(html, /Siguiente paso:/);
  assert.match(html, /incremento mínimo de carga disponible/);
  assert.match(html, /sumar 1 repetición por serie/);
});

test('v27 registra notas y series en cada cambio y calcula duración activa sin contar el tiempo fuera de la app', () => {
  assert.match(html, /activeSession\.exercises\[e\]\.entries\[s\]\[k\]=inp\.value;persistActiveSessionDraft\(\)/);
  assert.match(html, /activeSession\.exercises\[e\]\.entries\[s\]\.done=inp\.checked;updateWorkoutProgress\(\);persistActiveSessionDraft\(\)/);
  assert.match(html, /activeSession\.notes=\$\('sessionNotes'\)\.value;persistActiveSessionDraft\(\)/);
  assert.match(html, /activeSessionElapsedMs\(activeSession\)/);
  assert.match(html, /Borrador guardado automáticamente en este dispositivo/);
});


test('v29 envía al entrenador un resumen limitado del historial reciente', () => {
  assert.match(html, /sessions:\(state\.sessions\|\|\[\]\)\.slice\(0,5\)/);
  assert.match(html, /activities:\(state\.activities\|\|\[\]\)\.slice\(-5\)\.reverse\(\)/);
  assert.match(html, /weights:\(state\.weights\|\|\[\]\)\.slice\(-5\)\.reverse\(\)/);
  assert.match(server, /function sanitizeTrainingContext\(body\)/);
  assert.match(server, /recentSessions:sessions,recentActivities:activities,recentWeights:weights/);
  assert.match(server, /Diferenciá los datos registrados de las inferencias/);
});

test('v29 limita campos del historial antes de incorporarlos al contexto de Gemini', () => {
  assert.match(server, /body\.sessions\.slice\(0,5\)/);
  assert.match(server, /body\.activities\.slice\(0,5\)/);
  assert.match(server, /body\.weights\.slice\(0,5\)/);
  assert.match(server, /cleanText\(s\?\.notes,180\)/);
  assert.match(server, /exercises\.slice\(0,8\)/);
});


test('v30 adapta el menú a calorías y proteínas y muestra diferencias respecto a ambos objetivos', () => {
  assert.match(html, /const targetCalories=Math\.max\(800,Math\.min\(6000,Number\(goals\.calories\)\|\|2400\)\)/);
  assert.match(html, /const targetProtein=Math\.max\(20,Math\.min\(400,Number\(goals\.protein\)\|\|120\)\)/);
  assert.match(html, /const proteinFactor=Math\.max\(0\.75,Math\.min\(1\.4,targetProtein\/Math\.max\(1,baseTotals\.protein\*calorieFactor\)\)\)/);
  assert.match(html, /Diferencia de esta propuesta:[\s\S]*?g de proteína/);
});

test('v30 estima cantidades escritas como gramos o mililitros antes del alimento', () => {
  assert.match(html, /Supports both \"100 g arroz\" and the natural wording \"100 g de arroz\"/);
  assert.match(html, /const measured=\[\.\.\.before\.matchAll/);
  assert.match(html, /g\|gr\|gramos\|ml\|mililitros/);
});


test('v31 incluye comparativa de 7 días, resumen mensual y récords personales', () => {
  assert.match(html, /id="weeklyComparison"/);
  assert.match(html, /id="monthlySummary"/);
  assert.match(html, /id="personalRecords"/);
  assert.match(html, /function calculateProgressInsights\(/);
  assert.match(html, /function deriveExerciseRecords\(/);
  assert.match(html, /offsetDate\(-13\),offsetDate\(-7\)/);
  assert.match(html, /renderTrainingInsights\(\)/);
  assert.match(html, /No son pruebas máximas supervisadas/);
});


test('v32 deja la publicidad desactivada hasta configurar unidades reales', async () => {
  const config = await read('ads-config.js');
  const ads = await read('ads.js');
  assert.match(config, /enabled: false/);
  // v48: las cuotas y recompensas las concede el servidor (/api/rewards/*), no el navegador.
  const core = await read('monetization-core.js');
  assert.match(core, /enabled: false/);
  assert.match(core, /freePerDay: 6, plusPerDay: 40, creditsPerRewardedVideo: 3, maxRewardedVideosPerDay: 3/);
  assert.match(ads, /\/api\/rewards\/claim/);
  assert.doesNotMatch(ads, /credits\s*\+=/);
  assert.match(html, /id="adSlotHome"/);
  assert.match(html, /id="adSlotNutrition"/);
  assert.match(html, /Ver anuncio y obtener 3 consultas/);
  assert.match(html, /canAskCoach\(\)/);
});

test('v32 no coloca anuncios en la vista de entrenamiento ni en la vista GPS', () => {
  const train = html.slice(html.indexOf('id="view-train"'), html.indexOf('id="view-running"'));
  const running = html.slice(html.indexOf('id="view-running"'), html.indexOf('id="view-nutrition"'));
  assert.doesNotMatch(train, /adSlot/);
  assert.doesNotMatch(running, /adSlot/);
});


test('v33 presenta Free/Pro sin simular pagos ni activar membresías desde el cliente', async () => {
  const config = await read('membership-config.js');
  assert.match(config, /paymentsEnabled: false/);
  assert.match(config, /provider: 'not-configured'/);
  assert.match(html, /id="membershipCard"/);
  assert.match(html, /id="membershipStatus">Plan gratuito · activo/);
  assert.match(html, /precio orientativo, aún no definitivo/);
  assert.match(html, /No se hará ningún cobro desde esta pantalla/);
  assert.match(html, /no se hace ningún cobro/);
  assert.match(html, /membership-config\.js/);
  assert.match(sw, /"\.\/membership-config\.js"/);
  assert.match(config, /Nunca conceder Pro por una bandera local/);
});


test('v34 incluye endurecimiento del backend y no habilita pagos por cliente', async () => {
  const membership = await read('membership-config.js');
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /function isPublicAssetPath\(/);
  assert.match(server, /MAX_TRACKED_CLIENTS=5000/);
  assert.match(server, /cf-connecting-ip/);
  assert.doesNotMatch(server, /x-forwarded-for'\]\|\|''\)\.split/, 'v44: no se confía en X-Forwarded-For');
  assert.match(server, /total\+=buffer\.length/);
  assert.match(server, /server\.requestTimeout=30_000/);
  assert.match(server, /server\.headersTimeout=15_000/);
  assert.match(membership, /paymentsEnabled: false/);
  assert.match(server, /if\(!isJsonObject\(body\)\)/);
});

test('v36.1 mantiene válidos los metadatos y las traducciones del perfil/Pro', async () => {
  assert.match(i18n, /meta\.content=descMap\[active\];/);
  assert.doesNotMatch(i18n, /meta\.content=descMap\[active,\[/);
  const block = i18n.slice(i18n.indexOf('const languageRows='), i18n.indexOf('const labels='));
  const rows = Function(`${block}; return languageRows;`)();
  const bySource = new Map(rows.map(row => [row[0], row]));
  const expected = [
    'Tu membresía',
    'Pro todavía no se puede contratar: falta conectar y verificar el proveedor de pagos. No se realizó ningún cobro.',
    'Tu progreso, a tu manera',
    'Cómo querés que te llamemos',
    'Tu nombre o apodo',
    'Objetivo principal (opcional)',
    'Aumentar fuerza',
    'Perder grasa gradualmente',
    'Crear el hábito de entrenar',
    'Guardar mi perfil',
    'Tu nombre y objetivo se guardan en este dispositivo. No se publica un perfil ni se comparte con otros usuarios.',
    'Perfil guardado en este dispositivo.'
  ];
  for (const source of expected) {
    const row = bySource.get(source);
    assert.ok(row, `Falta traducción para: ${source}`);
    assert.equal(row.length, 6, `Se esperan seis idiomas para: ${source}`);
  }
  const manifest = JSON.parse(await read('manifest.json'));
  const rootPackage = JSON.parse(await read('package.json'));
  const backendPackage = JSON.parse(await read('backend/package.json'));
  assert.equal(rootPackage.version, '0.67.0');
  assert.equal(backendPackage.version, '0.67.0');
  assert.equal(manifest.theme_color, '#f3f6fb');
  assert.equal(manifest.background_color, '#f3f6fb');
  assert.match(i18n, /VERSION 67\.0 · ONLINE FITNESS COMMUNITY/i);
  assert.match(server, /GEMINI_MODEL\|\|'gemini-3\.8-flash'/);
  assert.match(await read('render.yaml'), /value: gemini-3\.8-flash/);
  assert.match(sw, /const CACHE = 'fittforma-ai-static-v67-0'/);
});


test('el esquema base de Supabase puede volver a aplicarse sin fallar por políticas ya existentes', async () => {
  const schema = await read('supabase/schema.sql');
  for (const policy of ['Users can read their own app data', 'Users can insert their own app data', 'Users can update their own app data']) {
    assert.match(schema, new RegExp(`drop policy if exists \"${policy}\" on public\.user_app_data`, 'i'));
    assert.match(schema, new RegExp(`create policy \"${policy}\"`, 'i'));
  }
  assert.match(schema, /alter table public\.user_app_data enable row level security/i);
  assert.match(schema, /auth\.uid\(\) = user_id/i);
});

test('v40.7 recupera estados guardados anteriores si la clave actual está corrupta y no deja la nube sin manejo de errores', () => {
  assert.match(html, /for\(const storageKey of candidates\)/);
  assert.match(html, /if\(storageKey!==STORAGE\)[\s\S]*?localStorage\.setItem\(STORAGE,JSON\.stringify\(restored\)\)/);
  assert.match(html, /No se pudieron guardar los datos por un problema de conexión/);
  assert.match(html, /No se pudieron cargar los datos por un problema de conexión/);
  assert.match(html, /supabaseClient\.auth\.getSession\(\)[\s\S]*?\.catch\(\(\)=>\{/);
});

test('v36.1 conserva identidad visual propia y perfil local editable', () => {
  assert.match(html, /brand-logo/);
  assert.match(html, /profileIdentityCard/);
  assert.match(html, /identityForm/);
  assert.match(html, /displayName/);
  assert.match(html, /focusGoal/);
  assert.match(sw, /fittforma-ai-static-v67-0/);
});


test('v36.1 incluye preferencias completas de recordatorios y estado de permisos', async () => {
  assert.match(html, /id="workoutReminderCard"/);
  assert.match(html, /id="workoutReminderForm"/);
  assert.match(html, /id="allowReminderNotifications"/);
  assert.match(html, /id="testReminderNotification"/);
  assert.match(html, /No se garantiza la entrega si queda en segundo plano o cerrada/);
  assert.match(html, /id="reminderTime"/);
  assert.match(html, /id="reminderMissedTime"/);
  assert.match(html, /data-reminder-day="0"/);
  for (const day of [1, 2, 3, 4, 5, 6]) assert.match(html, new RegExp(`data-reminder-day="${day}"`));
  assert.match(html, /Notification\.requestPermission\(\)/);
  assert.match(html, /registration\.showNotification/);
  assert.match(sw, /notificationclick/);
  assert.match(sw, /fittforma-ai-static-v67-0/);
});

test('v36.1 evita avisos duplicados y no marca entrenamientos como pendientes si hubo actividad', () => {
  assert.match(html, /function workoutLoggedOn\(day\)/);
  assert.match(html, /function getReminderType\(cfg,now,today,hasTraining,hasPlanned\)/);
  assert.match(html, /function shouldSkipReminderForRest\(todaysPlans\)/);
  assert.match(html, /cfg\.lastMissedNoticeDate!==today\?'missed':null/);
  assert.match(html, /cfg\.lastTrainingNoticeDate!==today\)return 'training'/);
  assert.match(html, /state\.reminders\.lastMissedNoticeDate=today;state\.reminders\.lastTrainingNoticeDate=today/);
  assert.match(html, /missedTime<=time/);
});

test('v36.1 preserva recordatorios al cargar estado antiguo, importar y sincronizar en nube', async () => {
  assert.match(html, /reminders:\{enabled:false,time:'18:00',days:\[1,3,5\]/);
  assert.match(html, /reminders:\{\.\.\.defaults\.reminders,\.\.\.\(parsed\.reminders\|\|\{\}\)/);
  assert.match(html, /reminders:\{\.\.\.defaults\.reminders,\.\.\.\(data\.reminders\|\|\{\}\)/);
  assert.match(html, /workoutReminderForm'\)\.addEventListener\('submit'/);
  const manifest=JSON.parse(await read('manifest.json'));
  assert.equal(manifest.display,'standalone');
});

test('las traducciones de recordatorios cubren seis idiomas', () => {
  const block=i18n.slice(i18n.indexOf('const languageRows='),i18n.indexOf('const labels='));
  const rows=Function(`${block}; return languageRows;`)();
  const bySource=new Map(rows.map(row=>[row[0],row]));
  for(const source of ['Recordatorios de entrenamiento','Activar recordatorios','Hora del entrenamiento','Días de entrenamiento','Permitir notificaciones','Probar notificación','Guardar recordatorios','Lun','Dom','En iPhone, agregá FittForma a la pantalla de inicio para habilitar las notificaciones web compatibles (iOS 16.4 o posterior). Después aceptá el permiso y probá el aviso.']){
    assert.equal(bySource.get(source)?.length,6,`Faltan traducciones para: ${source}`);
  }
});

test('las reglas de recordatorios distinguen hora principal, aviso tardío y sesión completada', () => {
  const source = html;
  const extractFunction = (name, nextName) => {
    const start = source.indexOf(`function ${name}(`);
    const nextPattern = new RegExp(`\\n  (?:async )?function ${nextName}\\(`);
    const nextMatch = nextPattern.exec(source.slice(start + 1));
    const end = nextMatch ? start + 1 + nextMatch.index : -1;
    assert.ok(start >= 0 && end > start, `No se encontró la función ${name}`);
    return source.slice(start, end).trim();
  };
  const normalizeDays = Function(`${extractFunction('normalizeReminderDays', 'reminderPermissionMessage')}; return normalizeReminderDays;`)();
  const timeHasPassed = Function(`${extractFunction('timeHasPassed', 'workoutLoggedOn')}; return timeHasPassed;`)();
  const getReminderType = Function('normalizeReminderDays', 'timeHasPassed', `${extractFunction('getReminderType', 'showWorkoutNotification')}; return getReminderType;`)(normalizeDays, timeHasPassed);
  const monday = new Date(2026, 9, 12, 18, 30); // Lunes, hora local del equipo
  const base = { enabled:true, days:[1,3,5], time:'18:00', missedEnabled:true, missedTime:'21:00', lastTrainingNoticeDate:'', lastMissedNoticeDate:'' };
  assert.equal(getReminderType(base, monday, '2026-10-12', false, false), 'training');
  assert.equal(getReminderType(base, new Date(2026, 9, 12, 21, 10), '2026-10-12', false, false), 'missed');
  assert.equal(getReminderType(base, new Date(2026, 9, 12, 21, 10), '2026-10-12', true, false), null);
  assert.equal(getReminderType({...base, lastTrainingNoticeDate:'2026-10-12'}, monday, '2026-10-12', false, false), null);
  assert.equal(getReminderType({...base, days:[]}, monday, '2026-10-12', false, false), null);
  assert.equal(getReminderType({...base, days:[]}, monday, '2026-10-12', false, true), 'training');
  assert.deepEqual(normalizeDays([1,1,9,-1,'3','a']), [1,3]);
});


test('un día de descanso no bloquea avisos si también hay una actividad de entrenamiento planificada', () => {
  const start=html.indexOf('function shouldSkipReminderForRest(');
  const end=html.indexOf('\n  function getReminderType',start);
  assert.ok(start>=0&&end>start);
  const shouldSkip=Function(`${html.slice(start,end)}; return shouldSkipReminderForRest;`)();
  assert.equal(shouldSkip([{type:'Descanso'}]),true);
  assert.equal(shouldSkip([{type:'Descanso'},{type:'Gimnasio'}]),false);
  assert.equal(shouldSkip([{type:'Correr'}]),false);
  assert.equal(shouldSkip([]),false);
});
