// v50: animaciones propias para cada ejercicio de la biblioteca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const load = file => { const ctx = { window: {} }; ctx.globalThis = ctx; vm.runInNewContext(readFileSync(file, 'utf8'), ctx); return ctx; };
const gifs = load('exercise-gifs.js').window.FittFormaExerciseGifs;
const trainingCtx = load('training-core.js');
const T = trainingCtx.FittFormaTraining || trainingCtx.window.FittFormaTraining;

test('cada ejercicio de la biblioteca tiene su propia animación GIF', () => {
  const names = new Set(Object.values(T.LIBRARY).flat().map(e => e.name));
  for (const n of names) assert.ok(gifs[n], `falta animación: ${n}`);
  const files = Object.values(gifs).map(g => g.file);
  assert.equal(new Set(files).size, files.length, 'no se reutiliza un GIF para otro ejercicio');
  for (const f of files) {
    const path = 'assets/exercises/' + f;
    assert.ok(existsSync(path), path);
    const head = readFileSync(path).subarray(0, 6).toString('latin1');
    assert.equal(head, 'GIF89a', `${path} es un GIF`);
  }
});

test('cada animación indica músculos principales reales del mapa anatómico', () => {
  const anatomy = load('anatomy.js').window.FittFormaAnatomy;
  const ids = new Set(Object.keys(anatomy.MUSCLES));
  for (const [n, g] of Object.entries(gifs)) {
    assert.ok(g.muscles.length > 0, `${n} sin músculos`);
    for (const m of [...g.muscles, ...g.secondary]) assert.ok(ids.has(m), `${n}: músculo desconocido ${m}`);
  }
});

test('la ficha y las tarjetas usan la animación y conservan las fotos reales como complemento', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<script src="\.\/exercise-gifs\.js"><\/script>/);
  assert.match(html, /function exerciseGif\(name\)/);
  assert.match(html, /exercise-gif-hero/);
  assert.match(html, /Ver fotos reales/);
  assert.match(readFileSync('sw.js', 'utf8'), /exercise-gifs\.js/);
  assert.match(readFileSync('backend/server.mjs', 'utf8'), /'\/exercise-gifs\.js'/);
});
