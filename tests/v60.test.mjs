// v60: avisos según Mi semana y calendario semanal, sesión (aviso de descanso, discos, superseries) y lo aplicable de la
// lista de lanzamiento web: 404 propia, robots.txt, títulos por sección, vista previa al compartir, ayuda y privacidad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const load = (...files) => { const ctx = { window: {} }; ctx.globalThis = ctx; for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), ctx); return ctx.window; };
const T = load('training-core.js').FittFormaTraining;
const html = readFileSync('index.html', 'utf8'), css = readFileSync('design.css', 'utf8'), server = readFileSync('backend/server.mjs', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');
const plain = v => JSON.parse(JSON.stringify(v));
function extract(name, next) {
  const start = html.indexOf(`function ${name}(`); assert.ok(start >= 0, name);
  const end = html.indexOf(`\n  function ${next}(`, start); assert.ok(end > start, next);
  return html.slice(start, end);
}

test('calculadora de discos: por lado, con barra, y lo más cercano si no se arma exacto', () => {
  assert.deepEqual(plain(T.platesPerSide(60)), { ok: true, exact: true, side: [20], bar: 20, loaded: 60, missing: 0 });
  assert.deepEqual(plain(T.platesPerSide(102.5).side), [25, 15, 1.25]);
  assert.deepEqual(plain(T.platesPerSide(40, 15).side), [10, 2.5]);
  const near = T.platesPerSide(61);
  assert.equal(near.exact, false); assert.equal(near.loaded, 60); assert.equal(near.missing, 1, 'avisa cuánto falta, no inventa un disco de 0,5');
  assert.equal(T.platesPerSide(20).side.length, 0, 'solo la barra');
  assert.equal(T.platesPerSide(15).reason, 'menos-que-barra');
  assert.equal(T.platesPerSide('abc').ok, false);
});

test('superseries: se pasa al siguiente sin descanso y se descansa al cerrar la ronda', () => {
  const ex = [{ superset: true, entries: [{ done: true }, { done: false }] }, { entries: [{ done: false }, { done: false }] }, { entries: [{}] }];
  assert.deepEqual(plain(T.supersetGroup(ex, 0)), [0, 1]); assert.deepEqual(plain(T.supersetGroup(ex, 1)), [0, 1]);
  assert.deepEqual(plain(T.supersetGroup(ex, 2)), [2], 'el tercero no está en la superserie');
  assert.deepEqual(plain(T.supersetNext(ex, 0)), { rest: false, next: 1, set: 0 });
  assert.deepEqual(plain(T.supersetNext(ex, 1)), { rest: true }, 'después del último de la ronda, descanso');
  assert.deepEqual(plain(T.supersetNext(ex, 2)), { rest: true });
  assert.match(html, /const ss=inp\.checked\?FittFormaTraining\.supersetNext\(activeSession\.exercises,e\):\{rest:true\}/);
  assert.match(html, /if\(restAfter>0&&ss\.rest\)startRestTimer\(restAfter\)/, 'no arranca el descanso en medio de la ronda');
});

test('aviso al terminar el descanso: vibración y pitido, desactivables y sin sonar sin un toque previo', () => {
  assert.match(html, /toast\('Terminó el descanso\.'\);restEndAlert\(\);/);
  assert.match(html, /navigator\.vibrate\(\[220,120,220\]\)/);
  assert.match(html, /function startRestTimer\(seconds=60\)\{unlockRestAudio\(\);/, 'el audio se habilita con el toque que inicia el descanso');
  assert.match(html, /id="restAlertSound"/); assert.match(html, /id="restAlertVibrate"/);
});

test('calendario de Mi semana: un evento semanal por día de entrenamiento con lo que toca', () => {
  const build = Function('weekDayLabel', `${extract('buildWeekPlanIcs', 'downloadWeekPlanIcs')}; return buildWeekPlanIcs;`)(d => ({ legs: 'Piernas', chest_triceps: 'Pecho y tríceps' }[d.key] || 'Libre'));
  const wed = new Date(2026, 9, 28, 9, 0, 0); // miércoles
  const ics = build({ 1: { kind: 'focus', key: 'chest_triceps' }, 3: { kind: 'focus', key: 'legs' }, 4: { kind: 'rest' } }, '18:30', wed);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2, 'el descanso no crea evento');
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO/); assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=WE/);
  assert.match(ics, /DTSTART:20261028T183000/, 'hoy miércoles, si la hora no pasó'); assert.match(ics, /DTSTART:20261102T183000/);
  assert.match(ics, /SUMMARY:Hoy toca: Piernas/); assert.match(ics, /TRIGGER:-PT10M/);
  for (const line of ics.split('\r\n').filter(Boolean)) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.throws(() => build({ 2: { kind: 'rest' } }, '18:00', wed), /al menos un día/);
  assert.throws(() => build({ 1: { kind: 'focus', key: 'legs' } }, '25:00', wed), /hora válida/);
});

test('recordatorios: dicen lo que toca y no avisan en los días de descanso de Mi semana', () => {
  assert.match(html, /const wk=weekPlanToday\(now\);if\(wk==='rest'\)return;/);
  assert.match(html, /showWorkoutNotification\('Hoy toca: '\+wk\.label,/);
  assert.match(html, /data-wp-remind-cal/); assert.match(html, /id="downloadWeekPlanIcs"/);
});

test('404 propia para personas, JSON para la app; robots.txt sin /api/', () => {
  assert.ok(existsSync('404.html'));
  const page = readFileSync('404.html', 'utf8');
  assert.match(page, /<meta name="robots" content="noindex">/); assert.match(page, /href="\/"[^>]*>Volver al inicio/);
  assert.match(server, /async function notFound\(req,res\)\{\s*if\(String\(req\.headers\.accept\|\|''\)\.includes\('text\/html'\)\)/);
  assert.match(server, /if\(!isPublicAssetPath\(requested\)\)return notFound\(req,res\);/);
  for (const f of ['/404.html', '/robots.txt', '/privacidad.html', '/legal-config.js', '/og-image.png']) assert.ok(server.includes(`'${f}'`), f);
  const robots = readFileSync('robots.txt', 'utf8');
  assert.match(robots, /User-agent: \*/); assert.match(robots, /Disallow: \/api\//);
});

test('títulos por sección, enlaces directos y vista previa al compartir (sin reseñas ni puntajes inventados)', () => {
  assert.match(html, /function setViewTitle\(name\)/); assert.match(html, /setViewTitle\(name\);/);
  assert.match(html, /window\.addEventListener\('hashchange',openHash\)/);
  for (const m of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'twitter:card']) assert.match(html, new RegExp(`(property|name)="${m}"`), m);
  assert.match(html, /"@type":"WebApplication"/);
  assert.doesNotMatch(html, /aggregateRating|"review"|ratingValue/i);
  assert.ok(existsSync('og-image.png') && readFileSync('og-image.png').length > 10000);
  assert.match(server, /const SITE_URL=\(\(\)=>\{try\{const u=new URL\(String\(process\.env\.PUBLIC_SITE_URL\|\|''\)\);return u\.protocol==='https:'/, 'solo https');
});

test('política de privacidad según el código, sin responsable ni correo inventados', () => {
  const page = readFileSync('privacidad.html', 'utf8'), legal = readFileSync('legal-config.js', 'utf8');
  for (const s of ['Supabase', 'Gemini', 'Open Food Facts', 'Render', 'Eliminar mi cuenta en la nube', 'nunca se publican solos']) assert.ok(page.includes(s), s);
  assert.match(legal, /ownerName: ''/); assert.match(legal, /contactEmail: ''/);
  assert.match(page, /todavía no completó su nombre y correo de contacto/);
  assert.match(html, /href="\/privacidad\.html"/);
  assert.doesNotMatch(page, /@(gmail|hotmail|outlook|fittforma)\./i, 'no hay un correo puesto a mano');
});

test('ayuda: preguntas frecuentes en Perfil y textos nuevos traducidos', () => {
  assert.equal((html.match(/class="faq-item"/g) || []).length, 7);
  assert.equal((html.match(/<details class="ff-group"/g) || []).length, 10, 'la ayuda va dentro de un grupo existente (v69: Ajustes suma Agua, Inicio y Privacidad)');
  for (const s of ['Ayuda y privacidad', '¿Mis datos se guardan en la nube?', '¿Cómo borro mis datos?', 'Que te avise', 'Agregar al calendario', 'Superserie con el siguiente', '¿Qué discos pongo?', 'Sonido', 'Vibración'])
    assert.ok(i18n.includes(JSON.stringify(s) + ','), s);
  assert.match(css, /\.pc-plate\{/); assert.match(css, /\.ss-badge\{/); assert.match(css, /\.wp-remind\{/);
});
