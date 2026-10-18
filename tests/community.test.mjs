import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>readFile(path.join(root,f),'utf8');

test('v40 incluye recursos de comunidad y precaché PWA versionado',async()=>{
  for(const f of ['community.js','supabase/community.sql'])await access(path.join(root,f));
  const sw=await read('sw.js');const m=sw.match(/const ASSETS = (\[[\s\S]*?\]);/);assert.ok(m);assert.ok(JSON.parse(m[1]).includes('./community.js'));assert.match(sw,/fittforma-ai-static-v48-0/);
});

test('la interfaz comunitaria incluye perfil privado, transformaciones, feed y acciones sociales',async()=>{
  const html=await read('index.html');const js=await read('community.js');const server=await read('backend/server.mjs');
  for(const id of ['view-community','communityProfileForm','communityPostForm','communityBeforePhoto','communityAfterPhoto','communityVisibility','communityFeed','communityEmailAuthForm','communityGoogleLogin','communityFollowRequests'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(server, /'\/community\.js'/);
  for(const feature of ['community_likes','community_comments','community_follows','community_reports','createSignedUrl','signInWithOAuth','signInWithPassword','auth.signUp','data-community-delete-post'])assert.ok(js.includes(feature),`Falta la integración: ${feature}`);
});

test('el esquema de comunidad protege tablas e imágenes con RLS y bucket privado',async()=>{
  const sql=await read('supabase/community.sql');
  for(const table of ['community_profiles','community_posts','community_follows','community_likes','community_comments','community_reports'])assert.match(sql,new RegExp(`alter table public\.${table} enable row level security`));
  assert.match(sql,/values\('community-media','community-media',false,8388608/);
  assert.match(sql,/community_profiles_read/);assert.match(sql,/community_posts_read/);assert.match(sql,/community_media_read_allowed/);assert.match(sql,/community_follow_status_trigger/);assert.match(sql,/on_auth_user_created_community_profile/);
});

test('validación de fotos y fechas se realiza antes de publicar',async()=>{
  const js=await read('community.js');assert.match(js,/file\.size>8\*1024\*1024/);assert.match(js,/createImageBitmap\(file\)/);assert.match(js,/image\/jpeg',0\.86/);assert.match(js,/image\/jpeg/);assert.match(js,/end<start/);assert.match(js,/end>localDateKey\(\)/);
});

test('las versiones visibles, traducciones y paquetes coinciden en 41.0',async()=>{
  const a=JSON.parse(await read('package.json')),b=JSON.parse(await read('backend/package.json'));assert.equal(a.version,'0.48.0');assert.equal(b.version,'0.48.0');
  const html=await read('index.html');assert.match(html,/Versión 48\.0/);assert.match(html,/V48\.0/);const i18n=await read('i18n.js');assert.match(i18n,/VERSION 48\.0 · ONLINE FITNESS COMMUNITY/);assert.match(i18n,/VERSION 48\.0 · ONLINE FITNESS COMMUNITY/);
});

test('la búsqueda pública limita la información de perfiles privados y el seguimiento pasa por aprobación',async()=>{
  const sql=await read('supabase/community.sql');
  assert.match(sql,/p\.visibility='public' or auth\.uid\(\) is not null/);
  assert.match(sql,/case when p\.visibility='public' then p\.bio else '' end/);
  assert.match(sql,/new\.status := case when target_visibility='public' then 'accepted' else 'pending' end/);
  assert.match(sql,/following_id=auth\.uid\(\) and status='pending'/);
});


test('v40 conserva el chat y usa un ranking orgánico por actividad',async()=>{
  const html=await read('index.html'),js=await read('community.js'),sql=await read('supabase/community.sql'),sw=await read('sw.js');
  for(const id of ['communityChatTitle','communityChatContact','communityChatMessages','communityChatForm','communityChatRefresh'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/community_messages/);assert.match(js,/loadChatContacts/);assert.match(js,/community_ranked_post_ids/);
  assert.match(sql,/community_are_mutual_follows/);assert.match(sql,/community_messages_insert_mutual/);assert.match(sql,/community_messages_read_mutual/);
  assert.match(sql,/community_memberships/);assert.match(sql,/order by activity_score desc, d\.created_at desc/);assert.match(sql,/least\(e\.recent_posts,5\)\*2\.0/);assert.match(sql,/least\(e\.active_days,10\)\*1\.5/);assert.match(sql,/Pro is a badge only/);
  assert.match(sql,/revoke insert,update,delete on public\.community_memberships from anon,authenticated/);assert.match(sw,/fittforma-ai-static-v48-0/);
});

test('chat exige seguimiento mutuo aceptado en ambos sentidos',async()=>{
  const sql=await read('supabase/community.sql');
  assert.match(sql,/f\.follower_id=a and f\.following_id=b and f\.status='accepted'/);
  assert.match(sql,/f\.follower_id=b and f\.following_id=a and f\.status='accepted'/);
  assert.match(sql,/auth\.uid\(\) is not null and \(auth\.uid\(\)=a or auth\.uid\(\)=b\)/);
  assert.match(sql,/sender_id=auth\.uid\(\) and public\.community_are_mutual_follows\(sender_id,recipient_id\)/);
});

test('la membresía Pro no puede activarse desde el cliente normal',async()=>{
  const sql=await read('supabase/community.sql');assert.match(sql,/community_memberships_read_active/);assert.match(sql,/revoke insert,update,delete on public\.community_memberships from anon,authenticated/);assert.match(sql,/current_period_end>now\(\)/);
});


test('v40 ranking rewards regular activity, caps spam and diversifies authors',async()=>{
 const sql=await read('supabase/community.sql'),js=await read('community.js'),sw=await read('sw.js');
 assert.match(sql,/now\(\)-interval '30 days'/);assert.match(sql,/p\.created_at > now\(\)-interval '90 days'/);assert.match(sql,/least\(e\.recent_posts,5\)/);assert.match(sql,/least\(e\.active_days,10\)/);assert.match(sql,/least\(e\.recent_likes,20\)/);assert.match(sql,/least\(e\.recent_comments,10\)/);assert.match(sql,/row_number\(\) over\(partition by s\.user_id/);
 assert.match(js,/activityScore:Number\(r\.activity_score\)\|\|0/);assert.match(sw,/fittforma-ai-static-v48-0/);
});


test('v40 incluye bloqueo aplicado por RLS y controles para desbloquear desde la interfaz',async()=>{
 const sql=await read('supabase/community.sql'),js=await read('community.js'),html=await read('index.html');
 assert.match(sql,/create table if not exists public\.community_blocks/);
 assert.match(sql,/blocked_username text not null default ''/);
 assert.match(sql,/community_fill_block_snapshot_trigger/);
 assert.match(sql,/community_users_blocked/);assert.match(sql,/community_after_block_cleanup_trigger/);
 assert.match(sql,/community_profiles_read[\s\S]*community_users_blocked/);
 assert.match(sql,/community_posts_read[\s\S]*community_users_blocked/);
 assert.match(sql,/community_media_read_allowed[\s\S]*community_users_blocked/);
 assert.match(js,/async function blockUser/);assert.match(js,/async function unblockUser/);assert.match(js,/blocked_display_name/);assert.match(html,/id=\"communityBlockedList\"/);
});

test('v40 aplica límites de mensajes del lado del servidor y permite borrar una conversación',async()=>{
 const sql=await read('supabase/community.sql'),js=await read('community.js'),html=await read('index.html');
 assert.match(sql,/community_message_events/);assert.match(sql,/recent_count >= 10/);assert.match(sql,/day_count >= 100/);assert.match(sql,/pg_advisory_xact_lock\(hashtext\(new\.sender_id::text\), 19831014\)/);assert.match(sql,/community_message_rate_limit_trigger/);
 assert.match(sql,/community_messages_delete_participant/);assert.match(js,/async function deleteConversation/);assert.match(html,/id=\"communityChatDeleteConversation\"/);
});

test('retos de constancia usan la semana actual y registros locales, sin presentar actividad como verificada',async()=>{
 const html=await read('index.html'),js=await read('community.js');
 assert.match(html,/id=\"consistencyChallenges\"/);assert.match(html,/No es un registro médico ni una verificación automática/);
 assert.match(js,/Información compartida por el usuario; no está verificada automáticamente por FittForma/);
 assert.match(html,/function renderConsistencyChallenges\(\)/);assert.match(html,/Completá 3 rutinas/);assert.match(html,/Movete 3 días/);
});
