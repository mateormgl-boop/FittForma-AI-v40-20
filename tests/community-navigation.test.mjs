import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');

test('v53 evita el error PGRST201: publicaciones sin embed ambiguo, solicitudes por función y recuperación en comentarios',async()=>{
 const js=await read('community.js');
 assert.doesNotMatch(js,/community_profiles!community_posts_user_id_fkey/,'las publicaciones ya no usan el embed posts → perfiles');
 assert.match(js,/async function withAuthors\(posts\)/);
 assert.match(js,/client\.rpc\('community_follow_requests'\)/);
 assert.match(js,/community_profiles!community_comments_user_id_fkey\(/);
 assert.match(js,/error\.code==='PGRST201'\|\|results\[1\]\.error\.code==='PGRST200'/);
});

test('Comunidad v53: Todos, Ranking y Amigos como pestañas; Mensajes y Mi perfil en la cabecera; sin feed',async()=>{
 const html=await read('index.html'),js=await read('community.js');
 for(const name of ['world','ranking','friends','messages','profile']){
  assert.match(html,new RegExp(`data-community-tab="${name}"`));
  assert.match(html,new RegExp(`data-community-panel="${name}"`));
 }
 for(const name of ['publish','user','compare'])assert.match(html,new RegExp(`data-community-panel="${name}"`));
 for(const old of ['data-community-panel="feed"','data-community-panel="explore"','id="communityFeed"','data-feed-mode','Para vos'])assert.ok(!html.includes(old),`sin feed: ${old}`);
 assert.match(html,/class="community-subnav cm-tabs" role="tablist"/);
 assert.match(html,/\.community-subpanel\[hidden\]\{display:none!important\}/);
 assert.match(js,/function showCommunitySubView/);
 assert.match(js,/ArrowLeft.*ArrowRight.*Home.*End/);
});

test('la búsqueda de Todos busca personas y limpiarla vuelve al directorio',async()=>{
 const js=await read('community.js');
 assert.match(js,/peopleTerm=searchTerm\.replace\(\/\^\[@#\]\/,''\)/);
 assert.match(js,/\$\('communityClearSearch'\)\?\.addEventListener\('click',clearSearch\)/);
 assert.match(js,/function clearSearch\(\)\{searchTerm='';peopleTerm='';\$\('communitySearch'\)\.value='';loadDirectory\(true\);\}/);
});

test('version, backend and service-worker cache match v41.0',async()=>{
 const a=JSON.parse(await read('package.json')),b=JSON.parse(await read('backend/package.json'));
 assert.equal(a.version,'0.58.0');assert.equal(b.version,'0.58.0');
 const server=await read('backend/server.mjs'),html=await read('index.html'),sw=await read('sw.js');
 assert.match(server,/0\.58\.0/);assert.match(html,/Versión 58\.0/);assert.match(sw,/fittforma-ai-static-v58-0/);
});

test('la navegación y los títulos principales de Comunidad están traducidos en los seis idiomas',async()=>{
 const i18n=await read('i18n.js');
 for(const key of ['Feed','Explorar','Publicar','Mensajes','Mi perfil','Lo que está pasando','Encontrá personas y avances','Publicaciones coincidentes','Compartí tu transformación','Mensajes privados']){
  const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  assert.match(i18n,new RegExp(`languageRows\\.push\\(\\["${escaped}"\\s*,\\s*"[^"]+"\\s*,\\s*"[^"]+"\\s*,\\s*"[^"]+"\\s*,\\s*"[^"]+"\\s*,\\s*"[^"]+"\\]`),`Falta traducir: ${key}`);
 }
});

test('si el embed de autores de comentarios sigue ambiguo, Comunidad recupera los comentarios con una consulta separada',async()=>{
 const js=await read('community.js');
 assert.match(js,/plainComments=await client\.from\('community_comments'\)\.select\('id,post_id,user_id,body,created_at'\)/);
 assert.match(js,/commentAuthors=\[\.\.\.new Set\(\(plainComments\.data\|\|\[\]\)\.map\(comment=>comment\.user_id\)\)\]/);
 assert.match(js,/community_profiles'\)\.select\('user_id,display_name,username(?:,avatar_path)?'\)\.in\('user_id',commentAuthors\)/); // v50: también la foto
});

test('las cinco pestañas principales y sus títulos de Comunidad tienen traducciones para los seis idiomas',async()=>{
 const i18n=await read('i18n.js');
 for(const key of ['Feed','Explorar','Publicar','Mensajes','Mi perfil','Lo que está pasando','Encontrá personas y avances','Publicaciones coincidentes','Compartí tu transformación','Mensajes privados']){
  const escaped=key.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&');
  assert.match(i18n,new RegExp(`languageRows\\.push\\(\\["${escaped}"\\s*,\\s*"[^"]+"\\s*,\\s*"[^"]+"\\s*,\\s*"[^"]+"\\s*,\\s*"[^"]+"\\s*,\\s*"[^"]+"\\]`),`Falta traducir: ${key}`);
 }
});

test('comentarios también tienen recuperación no destructiva si su relación con perfiles devuelve PGRST201',async()=>{
 const js=await read('community.js');
 assert.match(js,/plainComments=await client\.from\('community_comments'\)\.select\('id,post_id,user_id,body,created_at'\)/);
 assert.match(js,/commentAuthors=\[\.\.\.new Set\(\(plainComments\.data\|\|\[\]\)\.map\(comment=>comment\.user_id\)\)\]/);
 assert.match(js,/community_profiles'\)\.select\('user_id,display_name,username(?:,avatar_path)?'\)\.in\('user_id',commentAuthors\)/); // v50: también la foto
});
