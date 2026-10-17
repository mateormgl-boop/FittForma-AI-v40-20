import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFile(path.join(root, f), 'utf8');
const [html, server, community, stub] = await Promise.all(['index.html', 'backend/server.mjs', 'community.js', 'supabase/tests/supabase_stub.sql'].map(read));
const migration = await read('supabase/migrations/2026-10-19_v44_security_hardening.sql');

test('v44: datos importados o de la nube pasan por sanitizeState', () => {
  assert.match(html, /function sanitizeState\(st\)/);
  assert.match(html, /try\{return sanitizeState\(restored\);\}catch\(err\)\{console\.error\('sanitizeState',err\);return restored;\}/, 'almacenamiento local, sin perder datos si falla');
  // loadState() se ejecuta al iniciar, antes de que corran las líneas de sus ayudantes: no pueden ser const/let.
  const helpers = html.slice(html.indexOf('function sanitizeState'), html.indexOf('function loadState'));
  assert.doesNotMatch(html.slice(html.indexOf('v44: validación de forma'), html.indexOf('function loadState')), /^  (const|let) /m, 'ayudantes de nivel superior declarados como function');
  assert.ok(helpers.length > 0);
  assert.match(html, /return sanitizeState\(\{\.\.\.structuredClone\(defaults\),\.\.\.data,/, 'copia en la nube');
  assert.match(html, /state=sanitizeState\(\{\.\.\.structuredClone\(defaults\),\.\.\.parsed,/, 'copia importada');
  assert.match(html, /file\.size>8\*1024\*1024/);
  assert.match(html, /if\(!save\(\)\)\{state=previous;/, 'la importación no informa éxito si no se pudo guardar');
});

test('v44: textos de la copia se escapan en el plan, el peso y el chat', () => {
  assert.match(html, /Registrar \$\{esc\(day\.title\.toLowerCase\(\)\)\}/);
  assert.match(html, /data-id="\$\{esc\(String\(w\.id\)\)\}"/);
  assert.match(html, /r=role==='user'\?'user':'assistant';return `<div class="bubble \$\{r\}">/);
  assert.doesNotMatch(html, /\$\{e\.sets\}/);
  assert.match(html, /Object\.hasOwn\(FITTAI_TARGETS,a\.target\)/);
});

test('v44: librerías externas con versión exacta e integridad (SRI) y CSP acotada', () => {
  assert.match(html, /supabase-js@2\.45\.4\/dist\/umd\/supabase\.js" integrity="sha384-[A-Za-z0-9+/=]{64}" crossorigin="anonymous"/);
  assert.match(html, /leaflet@1\.9\.4\/dist\/leaflet\.js" integrity="sha384-/);
  assert.match(html, /script\.integrity='sha384-/);
  assert.doesNotMatch(html, /supabase-js@2['"/]/);
  assert.doesNotMatch(server, /script-src[^"]*https:\/\/cdn\.jsdelivr\.net[ "]/, 'no se permite todo jsdelivr');
});

test('v44: el servidor exige mismo origen, limita el uso diario y filtra el contexto de FittAI', () => {
  assert.match(server, /function sameOriginPost\(req\)/);
  assert.match(server, /if\(req\.method==='POST'&&!sameOriginPost\(req\)\)/);
  assert.match(server, /function overDailyBudget\(req\)/);
  assert.match(server, /profile:sanitizeCoachProfile\(body\.profile\)/);
  assert.doesNotMatch(server.match(/function sanitizeCoachProfile[\s\S]*?\n\}/)[0], /avatar/);
  assert.match(html, /profile:\(\(\{avatar,\.\.\.rest\}\)=>rest\)\(state\.profile\|\|\{\}\)/, 'la foto de perfil no viaja a la IA');
});

test('v44: eliminación de cuenta verifica antes de borrar fotos y recorre todas las páginas', () => {
  const fn = html.match(/async function deleteCloudAccount\(\)\{[\s\S]*?\n  \}/)[0];
  assert.ok(fn.indexOf("rpc('account_deletion_ready')") < fn.indexOf('bucket.remove'), 'primero la verificación');
  assert.match(fn, /offset\+=1000/);
});

test('v44: Comunidad sin correo en el nombre por defecto, moderación con registro y chat limpio al salir', () => {
  assert.doesNotMatch(community.match(/async function ensureProfile[\s\S]*?\n  \}/)[0], /email/);
  assert.match(community, /update\(\{status:'actioned'\}\)/);
  assert.match(community, /\.delete\(\)\.eq\('id',id\)\.select\('id'\)/);
  assert.match(community, /\['communityChatMessages','communityReportsList'\]\.forEach/);
});

test('v44: migración aditiva con las correcciones de la base', () => {
  assert.doesNotMatch(migration, /drop table|truncate|disable row level security|delete from public\.(?!community_message_events)/i, 'solo la limpieza de eventos de mensajes que ya existía en v41');
  assert.match(migration, /revoke update on public\.community_follows from anon, authenticated;\ngrant update\(status\)/);
  assert.match(migration, /new\.created_at := now\(\);/);
  assert.match(migration, /new\.read_at := null;/);
  assert.match(migration, /check \(octet_length\(data::text\) <= 3000000\) not valid/);
  assert.match(migration, /on delete set null/);
  assert.match(stub, /alter default privileges in schema public grant all on tables to anon, authenticated;/, 'las pruebas reproducen los permisos por defecto de Supabase');
});
