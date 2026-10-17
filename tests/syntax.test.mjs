import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (/\.(?:mjs|js)$/.test(entry.name) && !entry.name.endsWith('.example.js')) out.push(full);
  }
  return out;
}

test('todos los archivos JavaScript del proyecto pasan node --check y el script inline principal se parsea', async () => {
  const files = await walk(root);
  assert.ok(files.length >= 10, `Se esperaban al menos 10 archivos JS/MJS; se encontraron ${files.length}`);
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${path.relative(root, file)}: ${result.stderr || result.stdout}`);
  }
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, 'No se encontró ningún script inline para validar');
  for (let i = 0; i < scripts.length; i++) {
    const source = scripts[i][1].trim();
    if (!source) continue;
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8' });
    assert.equal(result.status, 0, `Script inline #${i + 1}: ${result.stderr || result.stdout}`);
  }
});
