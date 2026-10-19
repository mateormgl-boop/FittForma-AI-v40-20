-- Pruebas v49: comunidad (guardadas, destacadas, foto de perfil, entrenamiento vinculado, conversaciones,
-- conteos y sugeridos) respetando privacidad, bloqueos y RLS.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email) values
  ('a4900000-0000-0000-0000-0000000000c1','xime49@example.test'),
  ('a4900000-0000-0000-0000-0000000000c2','yago49@example.test'),
  ('a4900000-0000-0000-0000-0000000000c3','zoe49@example.test') on conflict do nothing;
insert into public.community_profiles(user_id,username,display_name,visibility) values
  ('a4900000-0000-0000-0000-0000000000c1','xime49','Xime','public'),
  ('a4900000-0000-0000-0000-0000000000c2','yago49','Yago','public'),
  ('a4900000-0000-0000-0000-0000000000c3','zoe49','Zoe','private') on conflict (user_id) do update set visibility=excluded.visibility, username=excluded.username, display_name=excluded.display_name;
insert into public.community_posts(id,user_id,post_kind,description,visibility) values
  ('c4900000-0000-0000-0000-0000000000a2','a4900000-0000-0000-0000-0000000000c2','text','Post público de Yago #fuerza','public'),
  ('c4900000-0000-0000-0000-0000000000a3','a4900000-0000-0000-0000-0000000000c3','text','Post privado de Zoe','followers') on conflict do nothing;

set role authenticated;
select t.as_user('a4900000-0000-0000-0000-0000000000c1');
-- Guardadas
select t.expect_rows($q$insert into public.community_saved_posts(user_id,post_id) values('a4900000-0000-0000-0000-0000000000c1','c4900000-0000-0000-0000-0000000000a2')$q$,1,'Xime guarda un post público');
select t.expect_count($q$select 1 from public.community_saved_posts$q$,1,'Xime ve su guardada');
select t.expect_error($q$insert into public.community_saved_posts(user_id,post_id) values('a4900000-0000-0000-0000-0000000000c1','c4900000-0000-0000-0000-0000000000a3')$q$,'No se guarda un post que no se puede ver');
select t.expect_error($q$insert into public.community_saved_posts(user_id,post_id) values('a4900000-0000-0000-0000-0000000000c2','c4900000-0000-0000-0000-0000000000a2')$q$,'No se guarda en nombre de otra persona');
-- Destacadas (máximo 3, datos válidos)
select t.expect_rows($q$update public.community_profiles set featured_badges='[{"exerciseId":"load-press-banca","exerciseName":"Press de banca · carga","category":"strength","rank":"gold","level":8,"measure":"bw"},{"exerciseId":"activity-running","exerciseName":"Running · distancia","category":"running","rank":"silver","level":5,"measure":"km"}]' where user_id='a4900000-0000-0000-0000-0000000000c1'$q$,1,'Dos insignias destacadas válidas');
select t.expect_error($q$update public.community_profiles set featured_badges='[{"exerciseId":"a","exerciseName":"A","rank":"bronze","level":1},{"exerciseId":"b","exerciseName":"B","rank":"bronze","level":1},{"exerciseId":"c","exerciseName":"C","rank":"bronze","level":1},{"exerciseId":"d","exerciseName":"D","rank":"bronze","level":1}]' where user_id='a4900000-0000-0000-0000-0000000000c1'$q$,'Más de 3 destacadas');
select t.expect_error($q$update public.community_profiles set featured_badges='[{"exerciseId":"a","exerciseName":"A","rank":"diamond","level":1}]' where user_id='a4900000-0000-0000-0000-0000000000c1'$q$,'Rango incoherente con el nivel');
select t.expect_error($q$update public.community_profiles set featured_badges='[{"exerciseId":"a","exerciseName":"A","rank":"bronze","level":1},{"exerciseId":"a","exerciseName":"A","rank":"bronze","level":2}]' where user_id='a4900000-0000-0000-0000-0000000000c1'$q$,'Destacadas repetidas');
select t.expect_error($q$update public.community_profiles set featured_badges='[{"exerciseId":"a","exerciseName":"A","rank":"bronze","level":1,"verified":true}]' where user_id='a4900000-0000-0000-0000-0000000000c1'$q$,'«verified» no se acepta');
select t.expect_rows($q$update public.community_profiles set featured_badges='[]' where user_id='a4900000-0000-0000-0000-0000000000c2'$q$,0,'No se editan las destacadas de otra persona');
-- Foto de perfil solo en la carpeta propia
select t.expect_rows($q$update public.community_profiles set avatar_path='a4900000-0000-0000-0000-0000000000c1/avatar/a1.jpg' where user_id='a4900000-0000-0000-0000-0000000000c1'$q$,1,'Foto de perfil en carpeta propia');
select t.expect_error($q$update public.community_profiles set avatar_path='a4900000-0000-0000-0000-0000000000c2/avatar/a1.jpg' where user_id='a4900000-0000-0000-0000-0000000000c1'$q$,'Foto de perfil en carpeta ajena');
-- Entrenamiento vinculado
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,linked_session) values('a4900000-0000-0000-0000-0000000000c1','text','Sesión de pecho','{"title":"Pecho y tríceps","date":"2026-10-18","minutes":50,"sets":16,"type":"custom","exercises":["Press de banca con barra","Fondos en paralelas"]}')$q$,1,'Publicación con entrenamiento vinculado');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description,linked_session) values('a4900000-0000-0000-0000-0000000000c1','text','x','{"title":"Pecho","date":"2026-10-18","weightKg":80}')$q$,'El resumen no acepta datos corporales');
-- Seguimiento mutuo y conversaciones
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id,status) values('a4900000-0000-0000-0000-0000000000c1','a4900000-0000-0000-0000-0000000000c2','pending')$q$,1,'Xime sigue a Yago');
select t.as_user('a4900000-0000-0000-0000-0000000000c2');
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id,status) values('a4900000-0000-0000-0000-0000000000c2','a4900000-0000-0000-0000-0000000000c1','pending')$q$,1,'Yago sigue a Xime');
select t.expect_rows($q$insert into public.community_messages(sender_id,recipient_id,body) values('a4900000-0000-0000-0000-0000000000c2','a4900000-0000-0000-0000-0000000000c1','¡Hola Xime!')$q$,1,'Yago escribe a Xime (mutuos)');
select t.as_user('a4900000-0000-0000-0000-0000000000c1');
select t.expect_count($q$select 1 from public.community_conversations() where username='yago49' and unread=1 and not last_from_me$q$,1,'Xime ve la conversación con 1 sin leer');
select t.as_user('a4900000-0000-0000-0000-0000000000c3');
select t.expect_count($q$select 1 from public.community_conversations()$q$,0,'Zoe no ve conversaciones ajenas');
-- Conteos y sugeridos
select t.as_user('a4900000-0000-0000-0000-0000000000c1');
select t.expect_count($q$select 1 from public.community_profile_stats('a4900000-0000-0000-0000-0000000000c2') where followers=1 and following=1 and posts=1$q$,1,'Conteos reales de un perfil público');
select t.expect_count($q$select 1 from public.community_profile_stats('a4900000-0000-0000-0000-0000000000c3')$q$,0,'Un perfil privado no expone sus conteos');
select t.expect_count($q$select 1 from public.community_suggested_profiles() where username='zoe49'$q$,0,'Los perfiles privados no se sugieren');
select t.expect_count($q$select 1 from public.community_suggested_profiles() where username='yago49'$q$,0,'No se sugiere a quien ya seguís');
select t.expect_count($q$select 1 from public.community_suggested_profiles() where username='xime49'$q$,0,'No se sugiere el propio perfil');
-- Bloqueo: corta conteos
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('a4900000-0000-0000-0000-0000000000c1','a4900000-0000-0000-0000-0000000000c2')$q$,1,'Xime bloquea a Yago');
select t.as_user('a4900000-0000-0000-0000-0000000000c2');
select t.expect_count($q$select 1 from public.community_profile_stats('a4900000-0000-0000-0000-0000000000c1')$q$,0,'Con bloqueo no se ven los conteos');
reset role;
\echo PRUEBAS v49 COMUNIDAD PASARON
