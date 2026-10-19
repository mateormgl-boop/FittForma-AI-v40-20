import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');

test('v41.0 usa claves foráneas explícitas para evitar el error PGRST201 en feed y comentarios',async()=>{
 const js=await read('community.js');
 assert.match(js,/community_profiles!community_posts_user_id_fkey!inner\(/);
 assert.match(js,/community_profiles!community_comments_user_id_fkey\(/);
 assert.match(js,/PGRST201|community_posts_user_id_fkey/);
});

test('Comunidad v41.0 separa Feed, Explorar, Publicar, Mensajes y Mi perfil en paneles internos',async()=>{
 const html=await read('index.html'),js=await read('community.js');
 for(const name of ['feed','explore','publish','messages','profile']){
  assert.match(html,new RegExp(`data-community-tab="${name}"`));
  assert.match(html,new RegExp(`data-community-panel="${name}"`));
 }
 assert.match(html,/id="communitySearchPosts"/);
 assert.match(html,/class="community-subnav"/);
 assert.match(html,/\.community-subpanel\[hidden\]\{display:none!important\}/);
 assert.match(js,/function showCommunitySubView/);
 assert.match(js,/ArrowLeft.*ArrowRight.*Home.*End/);
});

test('feed search results render inside Explore and clearing the query does not hide the main feed permanently',async()=>{
 const js=await read('community.js');
 assert.match(js,/searchTerm&&\$\('communitySearchPosts'\)\?\$\('communitySearchPosts'\):\$\('communityFeed'\)/);
 assert.match(js,/communityClearSearch/);
 assert.match(js,/searchTerm='';if\(\$\('communitySearch'\)\)/);
});

test('version, backend and service-worker cache match v41.0',async()=>{
 const a=JSON.parse(await read('package.json')),b=JSON.parse(await read('backend/package.json'));
 assert.equal(a.version,'0.50.0');assert.equal(b.version,'0.50.0');
 const server=await read('backend/server.mjs'),html=await read('index.html'),sw=await read('sw.js');
 assert.match(server,/0\.50\.0/);assert.match(html,/Versión 50\.0/);assert.match(sw,/fittforma-ai-static-v50-0/);
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
