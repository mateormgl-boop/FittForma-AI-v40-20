import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>readFile(path.join(root,f),'utf8');

test('la configuración pública permite claves publishable o JWT anon, pero nunca service_role o secret', async()=>{
  const server=await read('backend/server.mjs'),html=await read('index.html');
  assert.match(server,/\^sb_publishable_\[A-Za-z0-9_-\]\{20,\}\$/);
  assert.match(server,/payload\?\.role==='anon'/);
  assert.match(html,/payload\?\.role==='anon'/);
  assert.match(server,/process\.env\.SUPABASE_ANON_KEY/);
  assert.match(server,/process\.env\.SUPABASE_PUBLISHABLE_KEY/);
  assert.match(server,/SUPABASE_URL/);
  assert.match(html,/fetch\('\/api\/public-config'/);
});

test('el error de Comunidad distingue configuración ausente del esquema SQL', async()=>{
  const js=await read('community.js');
  assert.match(js,/No se conectó Supabase/);
  assert.match(js,/Comprobar conexión/);
});


test('la conexión a Supabase distingue configuración, CDN y diagnóstico de comunidad', async () => {
  const html = await read('index.html');
  const community = await read('community.js');
  assert.match(html, /communityRetryConnection/);
  assert.match(html, /unpkg\.com\/@supabase\/supabase-js@2\.45\.4\/dist\/umd\/supabase\.js/);
  assert.match(html, /FittFormaRetrySupabase=initCloud/);
  assert.match(html, /No se pudo consultar \/api\/public-config/);
  assert.match(community, /friendlySupabaseError/);
  assert.match(community, /falta una tabla necesaria/);
  assert.match(community, /políticas\/permisos RLS/);
});


test('la comprobación manual de Comunidad hace una lectura real sin escribir datos', async () => {
  const community = await read('community.js');
  assert.match(community, /async function testConnection\(\)/);
  assert.match(community, /coreChecks=\[\['community_profiles','user_id'\]/);
  assert.match(community, /coreChecks\.map\(async\(\[table,column\]\)/);
  assert.match(community, /communityRetryConnection/);
  assert.match(community, /window\.FittFormaCommunity=\{init,setSession,refresh,loadChatContacts,loadMessages,loadBlockedUsers,testConnection,/);
});


test('la configuración local de Supabase valida dominio HTTPS y clave pública antes de inicializar el SDK',async()=>{
  const html=await read('index.html');
  const block=html.slice(html.indexOf('function usableSupabaseConfig'),html.indexOf('async function resolveSupabaseConfig'));
  assert.match(block,/parsed\.protocol!=='https:'/);
  assert.match(block,/\[a-z0-9-\]\+\\\.supabase\\\.co/);
  assert.match(block,/parsed\.username\|\|parsed\.password\|\|parsed\.search\|\|parsed\.hash/);
  assert.match(block,/payload\?\.role==='anon'/);
  assert.match(block,/service_role\|sb_secret_/);
});

test('la validación del navegador y del backend acepta solo claves públicas y URL realistas de Supabase',async()=>{
  const html=await read('index.html'),server=await read('backend/server.mjs');
  const browserBlock=html.slice(html.indexOf('function usableSupabaseConfig'),html.indexOf('async function resolveSupabaseConfig'));
  const serverBlock=server.slice(server.indexOf('function validSupabasePublicConfig'),server.indexOf('function isPublicAssetPath'));
  const browserCtx={URL,atob};
  vm.runInNewContext(`${browserBlock};globalThis.check=usableSupabaseConfig;`,browserCtx);
  const serverCtx={URL,Buffer};
  vm.runInNewContext(`${serverBlock};globalThis.check=validSupabasePublicConfig;`,serverCtx);
  const goodUrl='https://fittforma-test.supabase.co';
  const goodKey='sb_publishable_test_key_for_runtime_checks';
  const checks=[cfg=>browserCtx.check(cfg),cfg=>serverCtx.check(cfg.url,cfg.anonKey)];
  for(const check of checks){
    assert.ok(check({url:goodUrl,anonKey:goodKey}));
    assert.equal(Boolean(check({url:'http://fittforma-test.supabase.co',anonKey:goodKey})),false);
    assert.equal(Boolean(check({url:'https://fittforma-test.supabase.co.evil.example',anonKey:goodKey})),false);
    assert.equal(Boolean(check({url:'https://one.two.supabase.co',anonKey:goodKey})),false);
    assert.equal(Boolean(check({url:goodUrl+'/rest/v1',anonKey:goodKey})),false);
    assert.equal(Boolean(check({url:'https://user:pass@fittforma-test.supabase.co',anonKey:goodKey})),false);
    assert.equal(Boolean(check({url:goodUrl,anonKey:'sb_secret_do_not_expose'})),false);
    assert.equal(Boolean(check({url:goodUrl,anonKey:'placeholder'})),false);
  }
  const anonPayload=Buffer.from(JSON.stringify({role:'anon'})).toString('base64url');
  const roleKey=`eyJhbGciOiJub25lIn0.${anonPayload}.signature`;
  assert.ok(browserCtx.check({url:goodUrl,anonKey:roleKey}));
  assert.ok(serverCtx.check(goodUrl,roleKey));
  const servicePayload=Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url');
  const serviceKey=`eyJhbGciOiJub25lIn0.${servicePayload}.signature`;
  assert.equal(Boolean(browserCtx.check({url:goodUrl,anonKey:serviceKey})),false);
  assert.equal(Boolean(serverCtx.check(goodUrl,serviceKey)),false);
});

test('el diagnóstico de Comunidad verifica las tablas principales de lectura y separa funciones opcionales', async()=>{
  const js=await read('community.js');
  for(const table of ['community_profiles','community_posts','community_follows','community_likes','community_comments'])assert.ok(js.includes(`['${table}'`),`El diagnóstico debe comprobar ${table}`);
  for(const table of ['community_messages','community_blocks','user_app_data'])assert.ok(js.includes(`['${table}'`),`El diagnóstico autenticado debe comprobar ${table}`);
  assert.match(js,/5 tablas principales y 2 funciones de búsqueda\/ordenamiento de Comunidad/);
  assert.match(js,/client\.rpc\('search_community_profiles'/);
  assert.match(js,/client\.rpc\('community_ranked_post_ids'/);
});
