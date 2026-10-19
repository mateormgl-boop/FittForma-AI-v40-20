-- Pruebas v50: perfiles públicos por defecto, directorio de usuarios reales, privados con datos básicos y sin
-- contenido, foto de perfil como dato básico y bloqueos.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
-- El alta en auth crea el perfil (disparador): debe nacer PÚBLICO.
insert into auth.users(id,email,raw_user_meta_data) values
  ('a5000000-0000-0000-0000-0000000000d1','ana50@example.test','{"full_name":"Ana"}'),
  ('a5000000-0000-0000-0000-0000000000d2','beto50@example.test','{"full_name":"Beto"}'),
  ('a5000000-0000-0000-0000-0000000000d3','caro50@example.test','{"full_name":"Caro"}'),
  ('a5000000-0000-0000-0000-0000000000d4','dani50@example.test','{"full_name":"Dani"}') on conflict do nothing;
select t.expect_count($q$select 1 from public.community_profiles where user_id in ('a5000000-0000-0000-0000-0000000000d1','a5000000-0000-0000-0000-0000000000d2','a5000000-0000-0000-0000-0000000000d3','a5000000-0000-0000-0000-0000000000d4') and visibility='public'$q$,4,'Los perfiles nuevos nacen públicos');
select t.expect_count($q$select 1 from public.community_profiles where user_id='a5000000-0000-0000-0000-0000000000d1' and username !~ 'ana50@'$q$,1,'El correo no se usa como usuario visible');
-- Colisión de usuario automático: el alta no falla.
update public.community_profiles set username='eva50_a5000000' where user_id='a5000000-0000-0000-0000-0000000000d4';
insert into auth.users(id,email) values ('a5000000-0000-0000-0000-0000000000d5','eva50@example.test') on conflict do nothing;
select t.expect_count($q$select 1 from public.community_profiles where user_id='a5000000-0000-0000-0000-0000000000d5' and username <> 'eva50_a5000000'$q$,1,'Si el usuario automático está ocupado, el alta usa otro');
update public.community_profiles set username='ana50', bio='Corro 10K', avatar_path='a5000000-0000-0000-0000-0000000000d1/avatar/a.jpg' where user_id='a5000000-0000-0000-0000-0000000000d1';
update public.community_profiles set username='beto50' where user_id='a5000000-0000-0000-0000-0000000000d2';
update public.community_profiles set username='caro50', bio='Secreto', visibility='private', avatar_path='a5000000-0000-0000-0000-0000000000d3/avatar/c.jpg' where user_id='a5000000-0000-0000-0000-0000000000d3';
update public.community_profiles set username='dani50' where user_id='a5000000-0000-0000-0000-0000000000d4';
insert into public.community_posts(id,user_id,post_kind,description,visibility) values
  ('c5000000-0000-0000-0000-0000000000a3','a5000000-0000-0000-0000-0000000000d3','text','Post privado de Caro','followers') on conflict do nothing;
insert into storage.objects(bucket_id,name,owner) values ('community-media','a5000000-0000-0000-0000-0000000000d3/avatar/c.jpg','a5000000-0000-0000-0000-0000000000d3'),
  ('community-media','a5000000-0000-0000-0000-0000000000d3/avatar/vieja.jpg','a5000000-0000-0000-0000-0000000000d3') on conflict do nothing;

set role authenticated;
select t.as_user('a5000000-0000-0000-0000-0000000000d2');
-- Directorio: aparecen usuarios reales, también los privados, con datos básicos.
select t.expect_count($q$select 1 from public.community_directory('50', null, 30) where username in ('ana50','caro50','dani50')$q$,3,'El directorio lista usuarios reales (incluye privados)');
select t.expect_count($q$select 1 from public.community_directory('caro50', null, 30) where username='caro50' and visibility='private' and bio='' and posts is null and followers is null and not can_view and avatar_path is not null$q$,1,'Privado: solo datos básicos, sin bio ni conteos');
select t.expect_count($q$select 1 from public.community_directory('ana50', null, 30) where username='ana50' and bio='Corro 10K' and can_view and posts=0$q$,1,'Público: muestra lo compartido');
-- Paginación por @usuario.
select t.expect_count($q$select 1 from public.community_directory('50', 'beto50', 30) where username <= 'beto50'$q$,0,'Página siguiente sin repetir');
select t.expect_count($q$select 1 from public.community_directory('', null, 2)$q$,2,'Límite por página');
-- Contenido protegido: el RLS sigue ocultando el perfil completo y las publicaciones del privado.
select t.expect_count($q$select 1 from public.community_profiles where user_id='a5000000-0000-0000-0000-0000000000d3'$q$,0,'El perfil privado completo no se lee directo');
select t.expect_count($q$select 1 from public.community_posts where user_id='a5000000-0000-0000-0000-0000000000d3'$q$,0,'Las publicaciones del privado no se leen');
select t.expect_count($q$select 1 from public.community_profile_basic('a5000000-0000-0000-0000-0000000000d3') where visibility='private' and bio='' and not can_view$q$,1,'Datos básicos del privado para el aviso');
-- Foto de perfil: la actual se puede leer; una vieja de la misma carpeta no.
select t.expect_count($q$select 1 from storage.objects where name='a5000000-0000-0000-0000-0000000000d3/avatar/c.jpg'$q$,1,'Foto de perfil actual visible');
select t.expect_count($q$select 1 from storage.objects where name='a5000000-0000-0000-0000-0000000000d3/avatar/vieja.jpg'$q$,0,'Foto anterior no expuesta');
-- Seguir y ser aceptado habilita el contenido.
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id,status) values('a5000000-0000-0000-0000-0000000000d2','a5000000-0000-0000-0000-0000000000d3','pending')$q$,1,'Beto pide seguir a Caro');
select t.expect_count($q$select 1 from public.community_directory('caro50', null, 30) where follow_status='pending' and not can_view$q$,1,'Solicitud pendiente: sigue sin ver contenido');
select t.as_user('a5000000-0000-0000-0000-0000000000d3');
select t.expect_rows($q$update public.community_follows set status='accepted' where follower_id='a5000000-0000-0000-0000-0000000000d2' and following_id='a5000000-0000-0000-0000-0000000000d3'$q$,1,'Caro acepta');
select t.expect_count($q$select 1 from public.community_directory('caro50', null, 30) where is_self and can_view and bio='Secreto'$q$,1,'La dueña ve su propio contenido');
select t.as_user('a5000000-0000-0000-0000-0000000000d2');
select t.expect_count($q$select 1 from public.community_posts where user_id='a5000000-0000-0000-0000-0000000000d3'$q$,1,'Seguidor aceptado ve las publicaciones');
select t.expect_count($q$select 1 from public.community_directory('caro50', null, 30) where can_view and bio='Secreto' and posts=1$q$,1,'Seguidor aceptado ve bio y conteos');
-- Cambio inmediato de privacidad: Ana pasa a privada y Dani deja de ver su bio en el acto.
select t.as_user('a5000000-0000-0000-0000-0000000000d1');
select t.expect_rows($q$update public.community_profiles set visibility='private' where user_id='a5000000-0000-0000-0000-0000000000d1'$q$,1,'Ana pasa a privado');
select t.as_user('a5000000-0000-0000-0000-0000000000d4');
select t.expect_count($q$select 1 from public.community_directory('ana50', null, 30) where bio='' and not can_view$q$,1,'El cambio de privacidad se aplica de inmediato');
-- Bloqueo: quien bloquea desaparece del directorio del bloqueado y su foto deja de leerse.
select t.as_user('a5000000-0000-0000-0000-0000000000d3');
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('a5000000-0000-0000-0000-0000000000d3','a5000000-0000-0000-0000-0000000000d4')$q$,1,'Caro bloquea a Dani');
select t.as_user('a5000000-0000-0000-0000-0000000000d4');
select t.expect_count($q$select 1 from public.community_directory('caro50', null, 30)$q$,0,'Con bloqueo no aparece en el directorio');
select t.expect_count($q$select 1 from storage.objects where name='a5000000-0000-0000-0000-0000000000d3/avatar/c.jpg'$q$,0,'Con bloqueo no se ve la foto');
-- Sin sesión: solo perfiles públicos.
reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;
select t.expect_count($q$select 1 from public.community_directory('50', null, 30) where visibility='private'$q$,0,'Sin sesión no se listan privados');
select t.expect_count($q$select 1 from public.community_directory('beto50', null, 30)$q$,1,'Sin sesión se listan públicos');
-- Quitar la foto de perfil (null) está permitido.
reset role; set role authenticated; select t.as_user('a5000000-0000-0000-0000-0000000000d1');
select t.expect_rows($q$update public.community_profiles set avatar_path=null where user_id='a5000000-0000-0000-0000-0000000000d1'$q$,1,'Se puede quitar la foto de perfil');
reset role;
\echo PRUEBAS v50 COMUNIDAD PASARON
