import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

// Carga sw.js en un entorno simulado y devuelve helpers para disparar eventos "fetch".
async function loadServiceWorker({ online, networkBody = 'DESDE RED' }) {
  const source = await read('sw.js');
  const store = new Map();
  const listeners = {};
  const cacheApi = {
    async open() {
      return {
        async match(request) {
          const key = typeof request === 'string' ? request : request.url;
          const hit = store.get(key) || [...store.entries()].find(([k]) => k.endsWith(String(key).replace(/^\./, '')))?.[1];
          return hit ? hit.clone() : undefined;
        },
        async put(request, response) { store.set(typeof request === 'string' ? request : request.url, response); },
        async add() {}
      };
    },
    async keys() { return []; },
    async delete() { return true; },
    async match(request) { return (await this.open()).match(request); }
  };
  let networkCalls = 0;
  const sandbox = {
    self: {
      location: new URL('https://app.test/sw.js'),
      registration: { scope: 'https://app.test/' },
      addEventListener(type, fn) { listeners[type] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} }
    },
    caches: cacheApi,
    fetch: async () => {
      networkCalls++;
      if (!online) throw new TypeError('offline');
      const response = new Response(networkBody, { status: 200 });
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    },
    Response, Request, URL, Promise, setTimeout, clearTimeout, console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const handle = async (path, { mode = 'cors', method = 'GET', origin = 'https://app.test' } = {}) => {
    const request = new Request(origin + path, { method });
    Object.defineProperty(request, 'mode', { value: mode });
    let responded = null;
    listeners.fetch({ request, respondWith(p) { responded = p; } });
    return responded ? await responded : null;
  };
  return { handle, store, get networkCalls() { return networkCalls; } };
}

test('el service worker pide primero a la red el index, los JS y la configuración', async () => {
  const sw = await loadServiceWorker({ online: true });
  const paths = ['/', '/index.html', '/community.js', '/supabase-config.js', '/manifest.json'];
  // Caso real del error: ya hay una copia OBSOLETA guardada de una versión anterior.
  for (const path of paths) sw.store.set('https://app.test' + path, new Response('OBSOLETA'));
  for (const path of paths) {
    const response = await sw.handle(path, { mode: path === '/' ? 'navigate' : 'cors' });
    assert.equal(await response.text(), 'DESDE RED', `${path} debe traer la versión nueva aunque haya una copia vieja guardada`);
  }
  assert.ok(sw.networkCalls >= 5);
});

test('sin conexión, el service worker sirve la copia guardada del index', async () => {
  const online = await loadServiceWorker({ online: true, networkBody: 'COPIA GUARDADA' });
  await online.handle('/index.html', { mode: 'navigate' });
  // Se reutiliza la caché del primer entorno en uno sin red.
  const offline = await loadServiceWorker({ online: false });
  for (const [k, v] of online.store) offline.store.set(k, v);
  await new Promise(r => setTimeout(r, 0));
  const response = await offline.handle('/index.html', { mode: 'navigate' });
  assert.equal(await response.text(), 'COPIA GUARDADA');
});

test('el service worker no intercepta la API, métodos distintos de GET ni otros orígenes', async () => {
  const sw = await loadServiceWorker({ online: true });
  assert.equal(await sw.handle('/api/public-config'), null);
  assert.equal(await sw.handle('/api/coach', { method: 'POST' }), null);
  assert.equal(await sw.handle('/lib.js', { origin: 'https://cdn.jsdelivr.net' }), null);
  assert.equal(sw.networkCalls, 0);
});

test('las imágenes siguen usando la copia guardada primero para no recargarlas', async () => {
  const sw = await loadServiceWorker({ online: true, networkBody: 'IMG' });
  const first = await sw.handle('/assets/exercises/squat.webp');
  assert.equal(await first.text(), 'IMG');
  const callsAfterFirst = sw.networkCalls;
  await new Promise(r => setTimeout(r, 0));
  const second = await sw.handle('/assets/exercises/squat.webp');
  assert.equal(await second.text(), 'IMG');
  assert.equal(sw.networkCalls, callsAfterFirst, 'la segunda petición debe salir de la caché');
});

test('el nombre de la caché del service worker coincide con la versión del paquete', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const sw = await read('sw.js');
  const expected = 'fittforma-ai-static-v' + pkg.version.replace(/^0\./, '').replace(/\./g, '-');
  assert.ok(sw.includes(`'${expected}'`), `se esperaba la caché ${expected}`);
});

test('la app avisa de una versión nueva sin recargar sola y permite buscar actualización desde Perfil', async () => {
  const html = await read('index.html');
  const pkg = JSON.parse(await read('package.json'));
  assert.ok(html.includes(`const APP_VERSION='${pkg.version}'`), 'APP_VERSION debe coincidir con package.json');
  assert.match(html, /addEventListener\('controllerchange'/);
  assert.match(html, /function showUpdateNotice\(/);
  assert.match(html, /id="checkUpdateButton"/);
  assert.match(html, /id="updateMessage"[^>]*aria-live="polite"/);
  // El aviso no debe recargar automáticamente dentro de controllerchange (podría cortar un entrenamiento).
  const handler = html.match(/addEventListener\('controllerchange',\(\)=>\{([^}]*)\}/)?.[1] || '';
  assert.ok(!/location\.reload/.test(handler), 'controllerchange no debe recargar la página por sí solo');
});
