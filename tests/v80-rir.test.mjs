import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(path.join(root, 'training-core.js'));
const T = globalThis.FittFormaTraining;

test('v80: el RIR bajo frena la progresión de carga y conserva la recomendación segura', () => {
  const previous = [
    { reps: '10', weight: '60', rir: '3', done: true },
    { reps: '10', weight: '60', rir: '3', done: true }
  ];
  const today = [
    { reps: '10', weight: '60', rir: '1', done: true },
    { reps: '', weight: '60', rir: '', done: false }
  ];
  const hint = T.nextSetHint(previous, today, '8–12', 'reps', 1);
  assert.equal(hint.kind, 'hold');
  assert.equal(hint.reason, 'high-effort');
  assert.equal(hint.weight, 60);
  assert.equal(hint.rir, 1);
});

test('v80: sin RIR, los registros anteriores mantienen la progresión existente', () => {
  const previous = [{ reps: '12', weight: '60', done: true }];
  const hint = T.nextSetHint(previous, [], '8–12', 'reps', 0);
  assert.equal(hint.kind, 'load');
  assert.equal(hint.weight, 62.5);
});

test('v80: el RIR solo se usa como entero de 0 a 5; valores desconocidos no alteran la progresión', () => {
  const previous = [{ reps: '12', weight: '60', rir: 'no válido', done: true }];
  const hint = T.nextSetHint(previous, [], '8–12', 'reps', 0);
  assert.equal(hint.kind, 'load');
});

test('v80: el campo RIR es opcional, se guarda en la sesión y se conserva en el contexto de FittAI', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const server = await readFile(path.join(root, 'backend/server.mjs'), 'utf8');
  const css = await readFile(path.join(root, 'design.css'), 'utf8');
  assert.match(html, /data-k="rir"/);
  assert.match(html, /select\[data-e\]/);
  assert.match(html, /rir:x\.rir/);
  assert.match(html, /prev\.rir/);
  assert.match(server, /rir:\['0','1','2','3','4','5'\]\.includes/);
  assert.match(server, /Si recibís RIR/);
  assert.match(css, /\.set-rir/);
});
