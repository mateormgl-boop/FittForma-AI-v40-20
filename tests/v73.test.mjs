// v73: velocidad. El servidor comprime el código (brotli o gzip) y responde «no cambió» (304) con ETag por contenido.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}
// fetch descomprime solo; para ver lo que manda el servidor de verdad se usa http.get.
function raw(base, pathname, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(base + pathname, { method, headers }, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })); });
    req.on('error', reject); req.end();
  });
}

test('v73: compresión, ETag y 304 en los archivos de la app', async t => {
  const port = await unusedPort(), base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['backend/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), GEMINI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  const original = readFileSync(path.join(root, 'index.html'));

  const br = await raw(base, '/', { 'Accept-Encoding': 'gzip, deflate, br' });
  assert.equal(br.status, 200);
  assert.equal(br.headers['content-encoding'], 'br', 'prefiere brotli si el navegador lo acepta');
  assert.equal(br.headers.vary, 'Accept-Encoding');
  assert.ok(br.body.length < original.length / 3, `index.html comprimido (${br.body.length} de ${original.length} bytes)`);
  assert.deepEqual(brotliDecompressSync(br.body), original, 'descomprimido es idéntico');
  assert.equal(Number(br.headers['content-length']), br.body.length);
  assert.equal(br.headers['cache-control'], 'no-cache', 'el código se sigue revalidando siempre');
  assert.match(br.headers.etag, /^"[A-Za-z0-9_-]{32}"$/);
  assert.ok(br.headers['content-security-policy'], 'las cabeceras de seguridad siguen');

  const gz = await raw(base, '/community.js', { 'Accept-Encoding': 'gzip' });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.deepEqual(gunzipSync(gz.body), readFileSync(path.join(root, 'community.js')));

  const plain = await raw(base, '/community.js');
  assert.equal(plain.headers['content-encoding'], undefined, 'sin Accept-Encoding, sin comprimir');
  assert.deepEqual(plain.body, readFileSync(path.join(root, 'community.js')));
  assert.equal(plain.headers.etag, gz.headers.etag, 'mismo contenido, mismo ETag aunque cambie la compresión');

  const refused = await raw(base, '/community.js', { 'Accept-Encoding': 'br;q=0, gzip;q=0' });
  assert.equal(refused.headers['content-encoding'], undefined, 'respeta q=0');

  const same = await raw(base, '/', { 'If-None-Match': br.headers.etag, 'Accept-Encoding': 'br' });
  assert.equal(same.status, 304, '«no cambió»');
  assert.equal(same.body.length, 0);
  assert.equal(same.headers.etag, br.headers.etag);
  const weak = await raw(base, '/', { 'If-None-Match': `W/${br.headers.etag}, "otro"` });
  assert.equal(weak.status, 304, 'acepta la forma débil y listas');
  const other = await raw(base, '/', { 'If-None-Match': '"otro"' });
  assert.equal(other.status, 200, 'si el ETag no coincide, manda el archivo');

  const img = await raw(base, '/icon-192.png', { 'Accept-Encoding': 'br, gzip' });
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-encoding'], undefined, 'las imágenes ya vienen comprimidas: no se recomprimen');
  assert.equal(img.headers['cache-control'], 'public, max-age=3600');
  assert.ok(img.headers.etag);
  assert.equal((await raw(base, '/icon-192.png', { 'If-None-Match': img.headers.etag })).status, 304);

  const head = await raw(base, '/', { 'Accept-Encoding': 'br' }, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0, 'HEAD sin cuerpo');

  const missing = await raw(base, '/no-existe.js');
  assert.equal(missing.status, 404, 'lo que no existe sigue dando 404');
  const secret = await raw(base, '/backend/server.mjs');
  assert.equal(secret.status, 404, 'el código del servidor sigue sin publicarse');
});

test('v73: arreglos de experiencia de la auditoría', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8'), css = readFileSync(path.join(root, 'design.css'), 'utf8'), ads = readFileSync(path.join(root, 'ads.js'), 'utf8'), community = readFileSync(path.join(root, 'community.js'), 'utf8');
  assert.match(html, /\$\{ovR\?esc\(ovR\.name\):now\.total>0\?`En camino a \$\{esc\(MR\.RANKS\[0\]\.name\)\}`:'Sin entrenar'\}/, 'Músculos: «Sin entrenar» solo sin series');
  assert.match(html, /<strong>FittAI:<\/strong> <span id="coachConnection" role="status">Comprobando conexión…<\/span><details class="tech-detail"><summary>Detalle técnico<\/summary>/, 'FittAI: lo técnico queda plegado');
  assert.doesNotMatch(html, /coachConnection'\)\.textContent='(Backend disponible|El servidor respondió|Modo demostración)/, 'ningún texto técnico va directo al estado visible');
  assert.doesNotMatch(ads, /t\('Sin límites nuevos: la monetización no está activa\.'\)/, 'sin el texto técnico de monetización');
  assert.match(html, /<small>Plan gratuito y FittForma AI Plus<\/small>/);
  assert.doesNotMatch(html, /FittForma Pro/, 'un solo nombre para el plan pago');
  assert.doesNotMatch(html, /Tu rutina empieza acá/, 'Rutinas: un solo estado vacío');
  assert.match(html, /<div class="home-recent-list" id="homeRecent" role="group" aria-label="Actividad reciente"><\/div>/);
  assert.match(html, /<div class="recent-item recent-\$\{x\.kind\}" role="button" tabindex="0"/, 'Actividad reciente: grupo de botones, no una lista con botones');
  assert.match(html, /<div class="mw-list" role="group" aria-label="Series por grupo muscular esta semana">\$\{rows\.map\(r=>`<div class="mw-row" role="button"/);
  assert.match(css, /\.mw-list \.mw-row\{min-height:34px/, 'filas tocables de al menos 34 px');
  assert.match(css, /\.ex-used\{[^}]*color:var\(--t-green/, 'contraste: verde del tema');
  assert.match(css, /\.goal-meal-head small\{[^}]*color:var\(--t-green/);
  assert.match(css, /\.kcal-tag\{[^}]*color:#9a3412/);
  assert.match(css, /\.session-type-tag\{margin-right:6px\}/);
  assert.match(css, /\.cm-explain:empty\{display:none\}/);
  assert.match(community, /setStatus\('rankingStatus',authHint\(\)\|\|'El ranking aparece cuando hay conexión con la comunidad\.'\)/);
});
