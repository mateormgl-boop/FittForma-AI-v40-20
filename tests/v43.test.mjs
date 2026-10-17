import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFile(path.join(root, f), 'utf8');
const [html, server, community, i18n, sw] = await Promise.all(['index.html', 'backend/server.mjs', 'community.js', 'i18n.js', 'sw.js'].map(read));
const migration = await read('supabase/migrations/2026-10-18_v43_moderation_account_deletion.sql');

test('v43: bienvenida solo la primera vez y sin pisar datos existentes', () => {
  assert.match(html, /id="welcomeScreen" hidden/);
  assert.match(html, /const WELCOME_KEY='fittforma-welcome-v1'/);
  assert.match(html, /if\(seen\|\|hasAnyUserData\(\)\)\{w\.hidden=true;return;\}/);
});

test('v43: foto de perfil recortada, validada y aplicada con variable CSS', () => {
  assert.match(html, /id="avatarInput"[^>]*accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(html, /function validAvatar\(v\)\{return typeof v==='string'&&\/\^data:image\\\/jpeg;base64,/);
  assert.match(html, /c\.width=c\.height=256/);
  assert.match(html, /\.profile-avatar\.has-photo\{background:var\(--avatar\)/);
});

test('v43: botón + abre registro rápido real', () => {
  assert.match(html, /id="quickAddFab"/);
  for (const k of ['train', 'meal', 'water', 'run', 'body', 'routine', 'post']) assert.match(html, new RegExp(`data-quick-add="${k}"`));
});

test('v43: FittAI conoce la app y solo navega a destinos permitidos', () => {
  const front = [...html.match(/const FITTAI_TARGETS=\{([^;]+)\};/)[1].matchAll(/'?([a-z:]+)'?:\[/g)].map(m => m[1]).sort();
  const back = [...server.match(/const APP_TARGETS=new Set\(\[([^\]]+)\]\)/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(back, front, 'el backend y la app comparten la misma lista de destinos');
  assert.match(server, /function sanitizeActions\(list\)/);
  assert.match(server, /\.slice\(0,3\)/);
  assert.match(server, /actions:sanitizeActions\(result\.actions\)/);
  assert.match(server, /const APP_GUIDE=/);
  assert.match(html, /function localAppGuide\(msg\)/);
  assert.match(html, /respuesta local, sin IA/, 'la guía local no se presenta como IA');
  assert.match(html, /data-ai-go/);
});

test('v43: plan de comidas y recetas con estimaciones', () => {
  assert.match(html, /const RECIPES=\[/);
  assert.match(html, /id="mealPlanCard"/);
  assert.match(html, /id="recipeList"/);
  assert.match(html, /function addToMealPlan\(/);
});

test('v43: moderación solo para moderadores asignados por SQL', () => {
  assert.match(community, /rpc\('community_is_moderator'\)/);
  assert.match(html, /id="communityModerationCard"[^>]*hidden/);
  assert.match(migration, /revoke all on public\.community_moderators from public, anon, authenticated/);
  assert.match(migration, /check \(status in \('open','dismissed','actioned'\)\)/);
});

test('v43: eliminación de cuenta con confirmación escrita y migración aditiva', () => {
  assert.match(html, /answer\.trim\(\)!=='ELIMINAR'/);
  assert.match(html, /rpc\('delete_my_account'\)/);
  assert.match(migration, /if uid is null then raise exception/);
  assert.match(migration, /revoke all on function public\.delete_my_account\(\) from public, anon/);
  assert.doesNotMatch(migration, /drop table|truncate|disable row level security/i);
  const deletes = migration.match(/^\s*delete from [^;]+;/gim) || [];
  assert.deepEqual(deletes.map(s => s.trim()), ['delete from auth.users where id=uid;']);
});

test('v43: mensajes dinámicos traducidos y versión 43.0', () => {
  assert.match(i18n, /function translateDynamic\(source\)/);
  assert.match(i18n, /translateDynamic\(source\) \|\| source/);
  assert.match(sw, /fittforma-ai-static-v47-0/);
  assert.match(html, /const APP_VERSION='0\.47\.0'/);
});
