-- Pruebas v54: semana actual, ranking semanal, reto entre amigos, evolución semanal, avisos e historial de «Mi físico».
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
  ('a5400000-0000-0000-0000-0000000000e1','ana54@example.test','{"full_name":"Ana"}'),
  ('a5400000-0000-0000-0000-0000000000e2','beto54@example.test','{"full_name":"Beto"}'),
  ('a5400000-0000-0000-0000-0000000000e3','caro54@example.test','{"full_name":"Caro"}'),
  ('a5400000-0000-0000-0000-0000000000e4','dani54@example.test','{"full_name":"Dani"}') on conflict do nothing;
update public.community_profiles set username='ana54', visibility='public' where user_id='a5400000-0000-0000-0000-0000000000e1';
update public.community_profiles set username='beto54', visibility='public' where user_id='a5400000-0000-0000-0000-0000000000e2';
update public.community_profiles set username='caro54', visibility='private' where user_id='a5400000-0000-0000-0000-0000000000e3';
update public.community_profiles set username='dani54', visibility='public' where user_id='a5400000-0000-0000-0000-0000000000e4';

set role authenticated;
-- Avisos de seguimiento
select t.as_user('a5400000-0000-0000-0000-0000000000e1');
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id,status) values('a5400000-0000-0000-0000-0000000000e1','a5400000-0000-0000-0000-0000000000e2','pending')$q$,1,'v54 Ana sigue a Beto (público)');
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id,status) values('a5400000-0000-0000-0000-0000000000e1','a5400000-0000-0000-0000-0000000000e3','pending')$q$,1,'v54 Ana pide seguir a Caro (privada)');
select t.expect_error($q$insert into public.community_notifications(user_id,kind,actor_id) values('a5400000-0000-0000-0000-0000000000e2','follow','a5400000-0000-0000-0000-0000000000e1')$q$,'v54 los avisos no se crean desde el cliente');
select t.as_user('a5400000-0000-0000-0000-0000000000e2');
select t.expect_value($q$select string_agg(kind||':'||username,',') from public.community_notifications_list(40)$q$,'follow:ana54','v54 Beto recibe «te sigue»');
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id,status) values('a5400000-0000-0000-0000-0000000000e2','a5400000-0000-0000-0000-0000000000e1','pending')$q$,1,'v54 Beto sigue a Ana');
select t.as_user('a5400000-0000-0000-0000-0000000000e3');
select t.expect_value($q$select string_agg(kind||':'||username,',') from public.community_notifications_list(40)$q$,'follow_request:ana54','v54 Caro recibe la solicitud');
select t.expect_rows($q$update public.community_follows set status='accepted' where follower_id='a5400000-0000-0000-0000-0000000000e1' and following_id='a5400000-0000-0000-0000-0000000000e3'$q$,1,'v54 Caro acepta');
select t.expect_rows($q$update public.community_notifications set read_at=now() where user_id='a5400000-0000-0000-0000-0000000000e3'$q$,1,'v54 Caro marca sus avisos como leídos');
select t.expect_rows($q$update public.community_notifications set read_at=now() where user_id='a5400000-0000-0000-0000-0000000000e1'$q$,0,'v54 no se tocan avisos ajenos');
select t.as_user('a5400000-0000-0000-0000-0000000000e1');
select t.expect_value($q$select string_agg(kind||':'||username,',' order by kind) from public.community_notifications_list(40)$q$,'follow:beto54,follow_accepted:caro54','v54 Ana recibe «te sigue» y «aceptó tu solicitud»');
select t.expect_count($q$select 1 from public.community_notifications where user_id<>'a5400000-0000-0000-0000-0000000000e1'$q$,0,'v54 cada persona ve solo sus avisos');
-- Mensaje (Ana y Beto se siguen)
select t.expect_rows($q$insert into public.community_messages(sender_id,recipient_id,body) values('a5400000-0000-0000-0000-0000000000e1','a5400000-0000-0000-0000-0000000000e2','Hola')$q$,1,'v54 Ana le escribe a Beto');
select t.expect_rows($q$insert into public.community_messages(sender_id,recipient_id,body) values('a5400000-0000-0000-0000-0000000000e1','a5400000-0000-0000-0000-0000000000e2','¿Entrenamos?')$q$,1,'v54 segundo mensaje');
select t.as_user('a5400000-0000-0000-0000-0000000000e2');
select t.expect_count($q$select 1 from public.community_notifications_list(40) where kind='message'$q$,1,'v54 varios mensajes = un solo aviso sin leer');

-- Semana actual y ranking semanal
select t.as_user('a5400000-0000-0000-0000-0000000000e1');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,workouts_total,workouts_30d,active_days_30d,workouts_week,active_days_week) values('a5400000-0000-0000-0000-0000000000e1',5,5,5,3,4)$q$,'v54 más días activos que entrenamientos en la semana: rechazado');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,workouts_total,workouts_30d,active_days_30d,workouts_week,active_days_week) values('a5400000-0000-0000-0000-0000000000e1',5,5,2,4,3)$q$,'v54 más días en la semana que en 30 días: rechazado');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,overall_rank,workouts_total,workouts_30d,active_days_30d,workouts_week,active_days_week,run_count_30d,run_km_30d,run_minutes_30d,run_km_week) values('a5400000-0000-0000-0000-0000000000e1',1,20,10,8,4,3,1,5,30,5)$q$,1,'v54 Ana publica su semana');
select t.expect_value($q$select (week_start = date_trunc('week', current_date)::date)::text from public.community_athlete_stats where user_id='a5400000-0000-0000-0000-0000000000e1'$q$,'true','v54 la semana la fija el servidor');
select t.as_user('a5400000-0000-0000-0000-0000000000e2');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,overall_rank,workouts_total,workouts_30d,active_days_30d,workouts_week,active_days_week) values('a5400000-0000-0000-0000-0000000000e2',3,40,20,15,6,5)$q$,1,'v54 Beto publica su semana');
select t.as_user('a5400000-0000-0000-0000-0000000000e4');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,overall_rank,workouts_total,workouts_30d,active_days_30d,workouts_week,active_days_week) values('a5400000-0000-0000-0000-0000000000e4',2,40,20,15,7,6)$q$,1,'v54 Dani (no es amigo de Ana) publica');
select t.as_user('a5400000-0000-0000-0000-0000000000e1');
select t.expect_value($q$select string_agg(username||':'||value,',' order by pos, username) from public.community_week_board('active','all',50)$q$,'dani54:6,beto54:5,ana54:3','v54 ranking de esta semana (todos)');
select t.expect_value($q$select string_agg(username,',' order by pos) from public.community_week_board('active','friends',50)$q$,'beto54,ana54','v54 reto semanal: solo vos y quienes seguís');
select t.expect_value($q$select string_agg(username||':'||value,',') from public.community_week_board('running','all',50)$q$,'ana54:5.00','v54 running de la semana');
select t.expect_error($q$select * from public.community_week_board('peso','all',50)$q$,'v54 categoría semanal inventada rechazada');
-- Ganador de la semana pasada (desde el historial)
reset role;
insert into public.community_athlete_weekly(user_id,week_start,active_days) values
  ('a5400000-0000-0000-0000-0000000000e1',date_trunc('week',current_date)::date-7,4),
  ('a5400000-0000-0000-0000-0000000000e2',date_trunc('week',current_date)::date-7,6),
  ('a5400000-0000-0000-0000-0000000000e4',date_trunc('week',current_date)::date-7,7),
  ('a5400000-0000-0000-0000-0000000000e2',date_trunc('week',current_date)::date-14,2);
set role authenticated; select t.as_user('a5400000-0000-0000-0000-0000000000e1');
select t.expect_value($q$select string_agg(username||':'||active_days,',') from public.community_week_winners()$q$,'beto54:6','v54 ganador de la semana pasada entre amigos (Dani no cuenta)');
select t.expect_error($q$select * from public.community_athlete_weekly$q$,'v54 el historial no se lee directo');
select t.expect_value($q$select string_agg(active_days::text,',' order by week_start) from public.community_weekly_history('a5400000-0000-0000-0000-0000000000e2',8)$q$,'2,6,5','v54 evolución semanal de Beto');
select t.expect_count($q$select 1 from public.community_weekly_history('a5400000-0000-0000-0000-0000000000e3',8)$q$,0,'v54 sin estadísticas no hay evolución');
select t.as_user('a5400000-0000-0000-0000-0000000000e2');
select t.expect_rows($q$update public.community_athlete_stats set stats_public=false where user_id='a5400000-0000-0000-0000-0000000000e2'$q$,1,'v54 Beto oculta sus estadísticas');
select t.as_user('a5400000-0000-0000-0000-0000000000e1');
select t.expect_count($q$select 1 from public.community_weekly_history('a5400000-0000-0000-0000-0000000000e2',8)$q$,0,'v54 estadísticas ocultas: sin evolución');
select t.expect_count($q$select 1 from public.community_week_board('active','friends',50) where username='beto54'$q$,0,'v54 estadísticas ocultas: fuera del reto');
select t.as_user('a5400000-0000-0000-0000-0000000000e2');
select t.expect_rows($q$update public.community_athlete_stats set stats_public=true where user_id='a5400000-0000-0000-0000-0000000000e2'$q$,1,'v54 Beto las vuelve a mostrar');

-- «Te superó»: Ana sube de rango por encima de Beto (que la sigue)
select t.as_user('a5400000-0000-0000-0000-0000000000e1');
select t.expect_rows($q$update public.community_athlete_stats set overall_rank=4 where user_id='a5400000-0000-0000-0000-0000000000e1'$q$,1,'v54 Ana sube de rango');
select t.as_user('a5400000-0000-0000-0000-0000000000e2');
select t.expect_count($q$select 1 from public.community_notifications_list(40) where kind='rank_passed' and username='ana54'$q$,1,'v54 Beto recibe «te superó en el rango general»');

-- Bloqueo: los avisos de esa persona dejan de verse
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('a5400000-0000-0000-0000-0000000000e2','a5400000-0000-0000-0000-0000000000e1')$q$,1,'v54 Beto bloquea a Ana');
select t.expect_count($q$select 1 from public.community_notifications_list(40) where username='ana54'$q$,0,'v54 con bloqueo no se ven sus avisos');

-- Historial privado de «Mi físico»
reset role;
insert into public.community_memberships(user_id,tier,status) values('a5400000-0000-0000-0000-0000000000e4','pro','active') on conflict (user_id) do update set tier='pro', status='active';
set role authenticated; select t.as_user('a5400000-0000-0000-0000-0000000000e4');
select t.expect_rows($q$insert into public.community_physique(user_id,kind,photo_path,description) values('a5400000-0000-0000-0000-0000000000e4','single','a5400000-0000-0000-0000-0000000000e4/physique/1.jpg','Enero')$q$,1,'v54 Dani sube una foto');
select t.expect_rows($q$update public.community_physique set photo_path='a5400000-0000-0000-0000-0000000000e4/physique/2.jpg', description='Marzo' where user_id='a5400000-0000-0000-0000-0000000000e4' and kind='single'$q$,1,'v54 Dani (Plus) la cambia');
select t.expect_value($q$select photo_path||'|'||description from public.community_physique_history where user_id='a5400000-0000-0000-0000-0000000000e4'$q$,'a5400000-0000-0000-0000-0000000000e4/physique/1.jpg|Enero','v54 la foto anterior queda en su historial privado');
select t.as_user('a5400000-0000-0000-0000-0000000000e1');
select t.expect_count($q$select 1 from public.community_physique_history$q$,0,'v54 nadie más ve el historial');
select t.as_user('a5400000-0000-0000-0000-0000000000e4');
select t.expect_rows($q$delete from public.community_physique_history where user_id='a5400000-0000-0000-0000-0000000000e4'$q$,1,'v54 Dani borra su historial');
reset role;
do $$ begin raise notice 'PRUEBAS v54 PASARON'; end $$;
