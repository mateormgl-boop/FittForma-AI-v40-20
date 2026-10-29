import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('el backend rechaza una variable PORT inválida con un mensaje claro', async () => {
  const child = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: 'puerto-invalido', GEMINI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  const exitCode = await new Promise(resolve => child.once('exit', resolve));
  assert.notEqual(exitCode, 0, 'El backend no debe iniciar con un puerto inválido');
  assert.match(output, /PORT debe ser un entero entre 0 y 65535/);
});

test('pruebas de integración HTTP del backend', async t => {
  const port = await unusedPort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), GEMINI_API_KEY: '', TRUST_RENDER_CLIENT_IP: 'true', SUPABASE_URL: 'https://fittforma-test.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_test_key_for_runtime_checks', SUPABASE_SERVICE_ROLE_KEY: 'service_role_SECRET_SENTINEL' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });

  async function waitForServer() {
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`El backend terminó al iniciar. ${output}`);
      try {
        const response = await fetch(`${base}/healthz`);
        if (response.ok) return;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`El backend no respondió a tiempo. ${output}`);
  }

  try {
    await waitForServer();

    await t.test('expone únicamente la configuración pública de Supabase desde variables de Render', async () => {
      const response = await fetch(`${base}/api/public-config`);
      assert.equal(response.status, 200);
      const raw = await response.text();
      const payload = JSON.parse(raw);
      const { monetization, ...rest } = payload;
      assert.equal(monetization.enabled, false, 'monetización apagada por defecto');
      assert.equal(monetization.ads.provider, 'none');
      assert.deepEqual(rest, { version: '0.65.0', supabase: { configured: true, url: 'https://fittforma-test.supabase.co', anonKey: 'sb_publishable_test_key_for_runtime_checks', keyType: 'publishable' }, missing: [], issue: null });
      assert.doesNotMatch(raw, /service_role_SECRET_SENTINEL|GEMINI_API_KEY|GEMINI_MODEL|SUPABASE_SERVICE_ROLE_KEY/);
    });

    await t.test('responde en salud, página principal y estado de IA', async () => {
      const health = await fetch(`${base}/healthz`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { ok: true, service: 'fittforma-ai', version: '0.65.0' });

      const home = await fetch(`${base}/`);
      assert.equal(home.status, 200);
      assert.match(home.headers.get('content-type') || '', /text\/html/);
      const html = await home.text();
      assert.match(html, /FittForma AI/);
      assert.match(html, /Versión 65\.0/);
      assert.match(html, /workoutAutosaveStatus/);

      const status = await fetch(`${base}/api/status`);
      assert.equal(status.status, 200);
      const payload = await status.json();
      assert.equal(payload.frontendAvailable, true);
      assert.equal(payload.version, '0.65.0');
      assert.equal(payload.supabaseConfigured, true);
      assert.equal(payload.configured, false);
      assert.equal(payload.mode, 'demo');
    });

    await t.test('sirve un cliente que consulta la configuración del backend sin exigir un archivo con credenciales', async () => {
      const html = await (await fetch(`${base}/`)).text();
      assert.match(html, /fetch\('\/api\/public-config'/);
      assert.match(html, /SUPABASE_ANON_KEY/);
      assert.match(html, /payload\?\.supabase\?\.configured/);
    });

    await t.test('sirve el módulo de comunidad incluido en la lista pública permitida', async () => {
      const response = await fetch(`${base}/community.js`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /javascript/);
      assert.match(await response.text(), /FittFormaCommunity/);
    });

    await t.test('sirve el motor de insignias desde la lista pública permitida sin abrir otros JS internos', async () => {
      const response = await fetch(`${base}/achievements.js`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /javascript/);
      assert.match(await response.text(), /FittFormaBadgeEngine/);
      const internal = await fetch(`${base}/backend/server.mjs`);
      assert.equal(internal.status, 404);
    });

    await t.test('sirve las ilustraciones con el tipo de contenido correcto', async () => {
      const response = await fetch(`${base}/assets/exercises/reference-push.svg`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /image\/svg\+xml/);
      assert.match(await response.text(), /<svg/);
    });

    await t.test('no publica los SVG generados que siguen sin validar la biomecánica', async () => {
      const response = await fetch(`${base}/assets/exercises/unverified-generated/press-de-banca-con-barra.svg`);
      assert.equal(response.status, 404);
    });

    await t.test('rechaza métodos, orígenes cruzados y archivos internos', async () => {
      const method = await fetch(`${base}/`, { method: 'PUT' });
      assert.equal(method.status, 405);

      const origin = await fetch(`${base}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
        body: JSON.stringify({ message: 'hola' })
      });
      assert.equal(origin.status, 403);

      const internal = await fetch(`${base}/backend/server.mjs`);
      assert.equal(internal.status, 404);
    });


    await t.test('aplica cabeceras de seguridad y permite recursos requeridos', async () => {
      const home = await fetch(`${base}/`);
      assert.equal(home.status, 200);
      assert.match(home.headers.get('content-security-policy') || '', /default-src 'self'/);
      assert.match(home.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
      assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(home.headers.get('x-frame-options'), 'DENY');
      assert.equal(home.headers.get('cross-origin-opener-policy'), 'same-origin');
      assert.equal(home.headers.get('x-dns-prefetch-control'), 'off');
      const js = await fetch(`${base}/membership-config.js`);
      assert.equal(js.status, 200);
      assert.match(js.headers.get('content-type') || '', /javascript/);
      const head = await fetch(`${base}/icon.svg`, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
    });

    await t.test('no expone archivos internos, paquetes, documentación ni pruebas', async () => {
      for (const pathname of [
        '/package.json', '/README.md', '/CHANGELOG.md', '/render.yaml',
        '/.gitignore', '/tests/runtime.test.mjs', '/supabase/schema.sql',
        '/supabase-config.example.js', '/backend/server.mjs',
        '/assets/../package.json', '/assets/README.md'
      ]) {
        const response = await fetch(`${base}${pathname}`);
        assert.equal(response.status, 404, `${pathname} no debería ser público`);
      }
    });

    await t.test('valida que el cuerpo JSON sea un objeto y limita bytes reales', async () => {
      const nullBody = await fetch(`${base}/api/coach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: 'null'
      });
      assert.equal(nullBody.status, 400);
      assert.match((await nullBody.json()).error, /objeto JSON/);

      const arrayBody = await fetch(`${base}/api/coach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: '[]'
      });
      assert.equal(arrayBody.status, 400);

      const badJson = await fetch(`${base}/api/coach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: '{'
      });
      assert.equal(badJson.status, 400);

      const unicode = JSON.stringify({ message: 'á'.repeat(17000) });
      const tooLargeBytes = await fetch(`${base}/api/coach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: unicode
      });
      assert.equal(tooLargeBytes.status, 413);

      const mediaType = await fetch(`${base}/api/coach`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain', 'Sec-Fetch-Site': 'same-origin' }, body: '{}'
      });
      assert.equal(mediaType.status, 415);
    });

    await t.test('los errores también conservan cabeceras y no filtran archivos por rutas codificadas', async () => {
      const missing = await fetch(`${base}/not-a-real-file`);
      assert.equal(missing.status, 404);
      assert.equal(missing.headers.get('x-content-type-options'), 'nosniff');
      assert.match(missing.headers.get('content-security-policy') || '', /object-src 'none'/);

      for (const pathname of ['/%2e%2e/package.json', '/%2E%2E/README.md', '/supabase/%2e%2e/%2e%2e/package.json']) {
        const response = await fetch(`${base}${pathname}`);
        assert.notEqual(response.status, 200, `${pathname} no debería revelar archivos`);
      }
    });

    await t.test('el límite de la IA separa clientes detrás del proxy de Render y aplica el umbral por IP', async () => {
      for (let i = 1; i <= 13; i++) {
        const response = await fetch(`${base}/api/coach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', 'CF-Ray': `test-${i}`, 'CF-Connecting-IP': `198.51.100.${i}` },
          body: JSON.stringify({ message: 'hola' })
        });
        assert.equal(response.status, 503, `La IP independiente ${i} no debería consumir la cuota de otra IP`);
      }
      const statuses = [];
      for (let i = 1; i <= 13; i++) {
        const response = await fetch(`${base}/api/coach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', 'CF-Ray': `repeat-${i}`, 'CF-Connecting-IP': '198.51.100.200' },
          body: JSON.stringify({ message: 'hola' })
        });
        statuses.push(response.status);
      }
      assert.deepEqual(statuses.slice(0, 12), Array(12).fill(503));
      assert.equal(statuses[12], 429);
    });

    await t.test('v44: un POST sin Origin ni Sec-Fetch-Site (script externo) se rechaza', async () => {
      const response = await fetch(`${base}/api/coach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'hola' }) });
      assert.equal(response.status, 403);
    });

    await t.test('la IA devuelve un error controlado si falta la clave', async () => {
      const response = await fetch(`${base}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' },
        body: JSON.stringify({ message: 'Ayudame a entrenar' })
      });
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /GEMINI_API_KEY/);
    });
  } finally {
    child.kill('SIGTERM');
  }
});


test('el endpoint público rechaza una clave JWT service_role aunque esté guardada por error en SUPABASE_ANON_KEY', async () => {
  const port = await unusedPort();
  const base = `http://127.0.0.1:${port}`;
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  const serviceRoleJwt = `eyJhbGciOiJub25lIn0.${payload}.signature`;
  const child = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), GEMINI_API_KEY: '', SUPABASE_URL: 'https://fittforma-test.supabase.co', SUPABASE_ANON_KEY: serviceRoleJwt },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  try {
    const deadline = Date.now() + 7000;
    let response;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`El backend terminó al iniciar. ${output}`);
      try { response = await fetch(`${base}/api/public-config`); if (response.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(response?.ok, `El backend no respondió a tiempo. ${output}`);
    const raw = await response.text();
    const data = JSON.parse(raw);
    assert.equal(data.supabase.configured, false);
    assert.equal(data.supabase.anonKey, null);
    assert.doesNotMatch(raw, /signature|eyJhbGciOiJub25lIn0/);
  } finally { child.kill('SIGTERM'); }
});


test('la configuración de generación evita parámetros sampling legacy para los modelos Gemini 3 y 4', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../backend/server.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes("if(/^gemini-3\\.(6|8)-/.test(currentModel)) generationConfig.thinkingConfig={thinkingLevel:'low'};"));
  assert.ok(source.includes("else if(!/^gemini-[34](?:[.-])/.test(currentModel)) generationConfig.temperature=0.3;"));
  assert.doesNotMatch(source, /else generationConfig\.temperature=0\.3;/);
});
