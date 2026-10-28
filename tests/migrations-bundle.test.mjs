// El archivo único para Supabase (supabase/APLICAR_MIGRACIONES.sql) tiene todas las migraciones, en orden y sin
// cambios, y termina recargando la caché de la API. Si falta alguna, regenerarlo con node tools/build-migrations-bundle.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('APLICAR_MIGRACIONES.sql está al día con supabase/migrations', () => {
  const bundle = readFileSync('supabase/APLICAR_MIGRACIONES.sql', 'utf8');
  const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
  let last = -1;
  for (const f of files) {
    const body = readFileSync(`supabase/migrations/${f}`, 'utf8').trim(), at = bundle.indexOf(body);
    assert.ok(at >= 0, `${f} falta o cambió: regenerar con node tools/build-migrations-bundle.mjs`);
    assert.ok(at > last, `${f} fuera de orden`); last = at;
  }
  assert.match(bundle, /notify pgrst, 'reload schema';\s*$/);
  assert.doesNotMatch(bundle, /disable row level security|\btruncate\b|drop table/i);
});
