-- Pruebas v66: actividades compartidas (validadas), muro de amigos, avisos de aplausos y comentarios, desafíos del mes.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
  ('a6600000-0000-0000-0000-0000000000c1','ana66@example.test','{"full_name":"Ana"}'),
  ('a6600000-0000-0000-0000-0000000000c2','beto66@example.test','{"full_name":"Beto"}'),
  ('a6600000-0000-0000-0000-0000000000c3','caro66@example.test','{"full_name":"Caro"}'),
  ('a6600000-0000-0000-0000-0000000000c4','dani66@example.test','{"full_name":"Dani"}') on conflict do nothing;
update public.community_profiles set username='ana66', visibility='public' where user_id='a6600000-0000-0000-0000-0000000000c1';
update public.community_profiles set username='beto66', visibility='public' where user_id='a6600000-0000-0000-0000-0000000000c2';
update public.community_profiles set username='caro66', visibility='public' where user_id='a6600000-0000-0000-0000-0000000000c3';
update public.community_profiles set username='dani66', visibility='public' where user_id='a6600000-0000-0000-0000-0000000000c4';
-- Ana sigue a Beto (aceptado) y a Dani; Caro no es seguida por Ana.
insert into public.community_follows(follower_id,following_id,status) values
  ('a6600000-0000-0000-0000-0000000000c1','a6600000-0000-0000-0000-0000000000c2','accepted'),
  ('a6600000-0000-0000-0000-0000000000c1','a6600000-0000-0000-0000-0000000000c4','accepted') on conflict do nothing;

set role authenticated;
select t.as_user('a6600000-0000-0000-0000-0000000000c2');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,activity,visibility) values('a6600000-0000-0000-0000-0000000000c2','activity','¡Piernas!','{"type":"workout","title":"Piernas","date":"2026-11-02","minutes":55,"exercises":6,"sets":18,"volume_kg":4200,"kcal":310}','followers')$q$,1,'v66 Beto comparte su entrenamiento (solo seguidores)');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,activity,visibility) values('a6600000-0000-0000-0000-0000000000c2','activity','{"type":"run","date":"2026-11-02","minutes":31,"distance_km":5.2}','followers')$q$,1,'v66 Beto comparte una carrera, sin el mapa');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,activity,visibility) values('a6600000-0000-0000-0000-0000000000c2','activity','{"type":"challenge","challenge":"workouts","goal":12,"value":13,"month":"2026-11"}','followers')$q$,1,'v66 Beto comparte un desafío cumplido');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,activity) values('a6600000-0000-0000-0000-0000000000c2','activity','{"type":"challenge","challenge":"workouts","goal":12,"value":5,"month":"2026-11"}')$q$,'v66 no se comparte un desafío sin cumplir');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,activity) values('a6600000-0000-0000-0000-0000000000c2','activity','{"type":"run","minutes":30,"distance_km":5,"route":[[1,2]]}')$q$,'v66 una carrera no puede llevar la ruta (dato extra rechazado)');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,activity) values('a6600000-0000-0000-0000-0000000000c2','activity','{"type":"workout","title":"X","minutes":9999}')$q$,'v66 minutos imposibles rechazados');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,activity) values('a6600000-0000-0000-0000-0000000000c2','activity','{"type":"verificado","title":"X","minutes":20}')$q$,'v66 tipo desconocido');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,activity) values('a6600000-0000-0000-0000-0000000000c1','activity','{"type":"workout","title":"X","minutes":20}')$q$,'v66 no se publica a nombre de otra persona');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description,activity) values('a6600000-0000-0000-0000-0000000000c2','text','Hola','{"type":"workout","title":"X","minutes":20}')$q$,'v66 un texto no lleva actividad');
select t.as_user('a6600000-0000-0000-0000-0000000000c3');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,visibility) values('a6600000-0000-0000-0000-0000000000c3','text','Soy Caro','public')$q$,1,'v66 Caro publica un texto');
-- Muro de Ana: lo de Beto (seguido) y nada de Caro (no seguida).
select t.as_user('a6600000-0000-0000-0000-0000000000c1');
select t.expect_count($q$select * from public.community_wall_ids() w join public.community_posts p using (id) where p.user_id='a6600000-0000-0000-0000-0000000000c2'$q$,3,'v66 el muro de Ana trae las 3 de Beto');
select t.expect_count($q$select * from public.community_wall_ids() w join public.community_posts p using (id) where p.user_id='a6600000-0000-0000-0000-0000000000c3'$q$,0,'v66 el muro no trae a quien no seguís (no es un feed general)');
select t.expect_count($q$select * from public.community_posts where post_kind='activity' and user_id='a6600000-0000-0000-0000-0000000000c2'$q$,3,'v66 Ana (seguidora) puede leer las actividades de Beto');
select t.as_user('a6600000-0000-0000-0000-0000000000c3');
select t.expect_count($q$select * from public.community_posts where post_kind='activity' and user_id='a6600000-0000-0000-0000-0000000000c2'$q$,0,'v66 Caro (no seguidora) no ve las actividades de Beto');
-- Aplausos y comentarios avisan a quien publicó.
select t.as_user('a6600000-0000-0000-0000-0000000000c1');
select t.expect_rows($q$insert into public.community_likes(post_id,user_id) select id,'a6600000-0000-0000-0000-0000000000c1' from public.community_posts where user_id='a6600000-0000-0000-0000-0000000000c2' and activity->>'type'='workout'$q$,1,'v66 Ana aplaude');
select t.expect_rows($q$insert into public.community_comments(post_id,user_id,body) select id,'a6600000-0000-0000-0000-0000000000c1','¡Bien ahí!' from public.community_posts where user_id='a6600000-0000-0000-0000-0000000000c2' and activity->>'type'='workout'$q$,1,'v66 Ana comenta');
select t.as_user('a6600000-0000-0000-0000-0000000000c2');
select t.expect_count($q$select * from public.community_notifications where kind in ('applause','comment') and actor_id='a6600000-0000-0000-0000-0000000000c1'$q$,2,'v66 Beto recibe el aviso del aplauso y del comentario');
-- Bloqueo: Dani bloquea a Ana; lo de Dani no aparece en el muro de Ana.
select t.as_user('a6600000-0000-0000-0000-0000000000c4');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,activity,visibility) values('a6600000-0000-0000-0000-0000000000c4','activity','{"type":"workout","title":"Espalda","minutes":40}','followers')$q$,1,'v66 Dani comparte');
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('a6600000-0000-0000-0000-0000000000c4','a6600000-0000-0000-0000-0000000000c1')$q$,1,'v66 Dani bloquea a Ana');
select t.as_user('a6600000-0000-0000-0000-0000000000c1');
select t.expect_count($q$select * from public.community_wall_ids() w join public.community_posts p using (id) where p.user_id='a6600000-0000-0000-0000-0000000000c4'$q$,0,'v66 con bloqueo no aparece en el muro');
-- Desafíos del mes
select t.as_user('a6600000-0000-0000-0000-0000000000c2');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,workouts_total,workouts_30d,active_days_30d,workouts_month,active_days_month,run_count_30d,run_km_30d,run_minutes_30d,run_km_month,stats_date) values('a6600000-0000-0000-0000-0000000000c2',20,14,12,13,11,4,20,110,18.5,current_date) on conflict (user_id) do update set workouts_month=13, active_days_month=11, run_km_month=18.5, stats_date=current_date$q$,1,'v66 Beto publica sus números del mes');
select t.expect_value($q$select month_start::text from public.community_athlete_stats where user_id='a6600000-0000-0000-0000-0000000000c2'$q$,to_char(date_trunc('month',current_date),'YYYY-MM-DD'),'v66 el mes lo fija el servidor');
select t.expect_error($q$update public.community_athlete_stats set workouts_month=5, active_days_month=9 where user_id='a6600000-0000-0000-0000-0000000000c2'$q$,'v66 no puede haber más días activos que entrenamientos');
select t.as_user('a6600000-0000-0000-0000-0000000000c1');
select t.expect_value($q$select workouts_month::text||'|'||run_km_month::text from public.community_month_board() where username='beto66'$q$,'13|18.50','v66 Ana ve a Beto en el tablero del mes');
select t.as_user('a6600000-0000-0000-0000-0000000000c3');
select t.expect_count($q$select * from public.community_month_board() where username='beto66'$q$,0,'v66 Caro (no lo sigue) no lo ve');
reset role; set role anon; select t.as_user(null);
select t.expect_error($q$select * from public.community_month_board()$q$,'v66 sin sesión no hay tablero');
select t.expect_error($q$select * from public.community_wall_ids()$q$,'v66 sin sesión no hay muro');
reset role;
do $$ begin raise notice 'PRUEBAS v66 PASARON'; end $$;
