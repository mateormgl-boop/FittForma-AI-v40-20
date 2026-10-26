-- Pruebas v53: estadísticas deportivas públicas por defecto (con opción de ocultarlas), directorio, perfil completo,
-- rankings por categoría, alcance «amigos», privacidad, bloqueos y validación del servidor.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
create or replace function t.expect_value(q text, expected text, label text) returns void language plpgsql as $$
declare got text;
begin
  execute q into got;
  if coalesce(got, '<null>') <> expected then raise exception 'FALLO: "%" devolvió %, se esperaba %', label, coalesce(got, '<null>'), expected; end if;
  raise notice 'OK %: %', label, got;
end $$;
grant execute on all functions in schema t to anon, authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
  ('a5300000-0000-0000-0000-0000000000e1','ana53@example.test','{"full_name":"Ana"}'),
  ('a5300000-0000-0000-0000-0000000000e2','beto53@example.test','{"full_name":"Beto"}'),
  ('a5300000-0000-0000-0000-0000000000e3','caro53@example.test','{"full_name":"Caro"}'),
  ('a5300000-0000-0000-0000-0000000000e4','dani53@example.test','{"full_name":"Dani"}'),
  ('a5300000-0000-0000-0000-0000000000e5','eva53@example.test','{"full_name":"Eva"}') on conflict do nothing;
update public.community_profiles set username='ana53', visibility='public' where user_id='a5300000-0000-0000-0000-0000000000e1';
update public.community_profiles set username='beto53', visibility='public', bio='Corro los domingos' where user_id='a5300000-0000-0000-0000-0000000000e2';
update public.community_profiles set username='caro53', visibility='private', bio='Bio privada' where user_id='a5300000-0000-0000-0000-0000000000e3';
update public.community_profiles set username='dani53', visibility='public' where user_id='a5300000-0000-0000-0000-0000000000e4';
update public.community_profiles set username='eva53', visibility='public' where user_id='a5300000-0000-0000-0000-0000000000e5';
-- Ana y Beto se siguen (mutuo). Ana pidió seguir a Caro (privada: pendiente).
insert into public.community_follows(follower_id,following_id,status) values
  ('a5300000-0000-0000-0000-0000000000e1','a5300000-0000-0000-0000-0000000000e2','accepted'),
  ('a5300000-0000-0000-0000-0000000000e2','a5300000-0000-0000-0000-0000000000e1','accepted'),
  ('a5300000-0000-0000-0000-0000000000e1','a5300000-0000-0000-0000-0000000000e3','pending') on conflict do nothing;

set role anon;
select t.expect_error($q$insert into public.community_athlete_stats(user_id) values('a5300000-0000-0000-0000-0000000000e1')$q$,'v53 sin sesión no se publican estadísticas');
select t.expect_error($q$select * from public.community_athlete_stats$q$,'v53 sin sesión no se lee la tabla');

set role authenticated;
select t.as_user('a5300000-0000-0000-0000-0000000000e1');
select t.expect_error($q$insert into public.community_athlete_stats(user_id) values('a5300000-0000-0000-0000-0000000000e2')$q$,'v53 no se publican estadísticas de otra persona');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,best_pushups) values('a5300000-0000-0000-0000-0000000000e1',999)$q$,'v53 récord fuera de escala rechazado');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,workouts_total,workouts_30d,active_days_30d) values('a5300000-0000-0000-0000-0000000000e1',10,5,9)$q$,'v53 más días activos que entrenamientos rechazado');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,workouts_total,workouts_30d,run_count_30d,run_km_30d,run_minutes_30d) values('a5300000-0000-0000-0000-0000000000e1',5,5,1,10,15)$q$,'v53 ritmo de running imposible rechazado');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,stats_date) values('a5300000-0000-0000-0000-0000000000e1',current_date-30)$q$,'v53 fecha de cálculo vieja rechazada');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,training_level) values('a5300000-0000-0000-0000-0000000000e1','pro')$q$,'v53 nivel de entrenamiento desconocido rechazado');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,training_level,xp_level,overall_rank,ranked_muscles,badges_count,badges,workouts_total,workouts_30d,active_days_30d,run_count_30d,run_km_30d,run_minutes_30d,best_pushups,best_plank_seconds)
  values('a5300000-0000-0000-0000-0000000000e1','intermediate',4,2,12,3,'[{"exerciseName":"Flexiones","level":2,"rank":"bronze","earnedAt":"2026-10-01"},{"exerciseName":"Correr","level":1,"rank":"bronze","earnedAt":"2026-10-20"}]',40,12,10,3,15.5,95,20,90)$q$,1,'v53 Ana publica sus estadísticas');
select t.expect_value($q$select stats_public::text from public.community_athlete_stats where user_id='a5300000-0000-0000-0000-0000000000e1'$q$,'true','v53 públicas por defecto');

select t.as_user('a5300000-0000-0000-0000-0000000000e2');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,training_level,xp_level,overall_rank,ranked_muscles,badges_count,workouts_total,workouts_30d,active_days_30d,best_pushups) values('a5300000-0000-0000-0000-0000000000e2','advanced',9,4,15,7,90,20,18,45)$q$,1,'v53 Beto publica');
select t.as_user('a5300000-0000-0000-0000-0000000000e3');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,overall_rank,workouts_total,workouts_30d,active_days_30d,best_pushups) values('a5300000-0000-0000-0000-0000000000e3',6,50,25,25,60)$q$,1,'v53 Caro publica (perfil privado)');
select t.as_user('a5300000-0000-0000-0000-0000000000e4');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,overall_rank,workouts_total,workouts_30d,active_days_30d,best_pushups) values('a5300000-0000-0000-0000-0000000000e4',7,70,28,28,80)$q$,1,'v53 Dani publica');
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('a5300000-0000-0000-0000-0000000000e4','a5300000-0000-0000-0000-0000000000e1')$q$,1,'v53 Dani bloquea a Ana');
select t.as_user('a5300000-0000-0000-0000-0000000000e5');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,stats_public,overall_rank,workouts_total,workouts_30d,active_days_30d,best_pushups) values('a5300000-0000-0000-0000-0000000000e5',false,8,99,30,30,100)$q$,1,'v53 Eva publica pero oculta sus estadísticas');
select t.expect_count($q$select 1 from public.community_athlete_stats$q$,1,'v53 la tabla solo deja leer la fila propia');

-- Directorio
select t.as_user('a5300000-0000-0000-0000-0000000000e1');
select t.expect_count($q$select 1 from public.community_people('53',null,30,'all')$q$,4,'v53 Ana ve a Ana, Beto, Caro y Eva (Dani la bloqueó)');
select t.expect_value($q$select stats_visible::text||'/'||training_level||'/'||overall_rank||'/'||badges_count from public.community_people('beto53',null,30,'all')$q$,'true/advanced/4/7','v53 tarjeta de Beto con nivel, rango e insignias');
select t.expect_value($q$select stats_visible::text||'/'||coalesce(training_level,'-')||'/'||bio||'|' from public.community_people('caro53',null,30,'all')$q$,'false/-/|','v53 perfil privado sin aceptar: sin estadísticas ni bio');
select t.expect_value($q$select stats_visible::text from public.community_people('eva53',null,30,'all')$q$,'false','v53 estadísticas ocultas no se muestran');
select t.expect_value($q$select latest_badge->>'exerciseName' from public.community_people('ana53',null,30,'all')$q$,'Correr','v53 logro más reciente');
select t.expect_value($q$select follows_me::text||'/'||follow_status from public.community_people('beto53',null,30,'all')$q$,'true/accepted','v53 relación mutua visible');
select t.expect_count($q$select 1 from public.community_people('',null,30,'friends')$q$,1,'v53 Amigos de Ana: solo Beto (Caro está pendiente)');
select t.expect_count($q$select 1 from public.community_people('',null,30,'friends') where username='beto53'$q$,1,'v53 Amigos refleja el seguimiento aceptado');
reset role; set role anon; select t.as_user(null);
select t.expect_count($q$select 1 from public.community_people('53',null,30,'all') where username='caro53'$q$,0,'v53 sin sesión no se listan perfiles privados');
select t.expect_value($q$select stats_visible::text from public.community_people('beto53',null,30,'all')$q$,'true','v53 sin sesión se ven estadísticas de perfiles públicos');
select t.expect_count($q$select 1 from public.community_people('',null,30,'friends')$q$,0,'v53 sin sesión no hay amigos');
reset role; set role authenticated;

-- Perfil completo
select t.as_user('a5300000-0000-0000-0000-0000000000e1');
select t.expect_value($q$select can_view::text||'/'||stats_visible::text||'/'||coalesce(posts::text,'-')||'/'||bio||'|' from public.community_athlete_profile('a5300000-0000-0000-0000-0000000000e3')$q$,'false/false/-/|','v53 perfil privado: sin contenido ni estadísticas');
select t.expect_count($q$select 1 from public.community_athlete_profile('a5300000-0000-0000-0000-0000000000e4')$q$,0,'v53 con bloqueo no se abre el perfil');
select t.expect_value($q$select stats_public::text||'/'||best_pushups||'/'||stats_fresh::text from public.community_athlete_profile('a5300000-0000-0000-0000-0000000000e1')$q$,'true/20/true','v53 perfil propio con su ajuste de privacidad');
select t.expect_value($q$select coalesce(stats_public::text,'-')||'/'||best_pushups||'/'||followers||'/'||following from public.community_athlete_profile('a5300000-0000-0000-0000-0000000000e2')$q$,'-/45/1/1','v53 perfil de Beto: estadísticas y seguidores, sin su ajuste privado');
select t.expect_value($q$select jsonb_array_length(badges)::text from public.community_athlete_profile('a5300000-0000-0000-0000-0000000000e1')$q$,'2','v53 sección de insignias');

-- Rankings
select t.expect_value($q$select string_agg(username||':'||pos,',' order by pos, username) from public.community_leaderboard('pushups','all',50)$q$,'beto53:1,ana53:2','v53 ranking de flexiones: sin privados no aceptados, bloqueos ni ocultos');
select t.expect_value($q$select string_agg(username,',' order by pos) from public.community_leaderboard('rank','friends',50)$q$,'beto53,ana53','v53 ranking de amigos por rango');
select t.expect_value($q$select string_agg(username,',' order by pos) from public.community_leaderboard('running','all',50)$q$,'ana53','v53 running: solo quien tiene km');
select t.expect_error($q$select * from public.community_leaderboard('peso','all',50)$q$,'v53 categoría inventada rechazada');
select t.expect_error($q$select * from public.community_leaderboard('rank','todos',50)$q$,'v53 alcance inventado rechazado');
reset role;
alter table public.community_athlete_stats disable trigger community_athlete_stats_guard;
update public.community_athlete_stats set stats_date = current_date - 10 where user_id = 'a5300000-0000-0000-0000-0000000000e2';
alter table public.community_athlete_stats enable trigger community_athlete_stats_guard;
set role authenticated; select t.as_user('a5300000-0000-0000-0000-0000000000e1');
select t.expect_count($q$select 1 from public.community_leaderboard('constancy','all',50) where username='beto53'$q$,0,'v53 constancia de 30 días: datos viejos no cuentan');
select t.expect_count($q$select 1 from public.community_leaderboard('pushups','all',50) where username='beto53'$q$,1,'v53 récords históricos siguen contando');

-- Validación de récords en el servidor
select t.expect_rows($q$update public.community_athlete_stats set best_pushups=100 where user_id='a5300000-0000-0000-0000-0000000000e1'$q$,1,'v53 Ana intenta subir de 20 a 100 flexiones');
select t.expect_value($q$select best_pushups::text from public.community_athlete_stats where user_id='a5300000-0000-0000-0000-0000000000e1'$q$,'20','v53 dentro de las 20 h no sube');
reset role;
alter table public.community_athlete_stats disable trigger community_athlete_stats_guard;
update public.community_athlete_stats set bests_raised_at = now() - interval '1 day' where user_id = 'a5300000-0000-0000-0000-0000000000e1';
alter table public.community_athlete_stats enable trigger community_athlete_stats_guard;
set role authenticated; select t.as_user('a5300000-0000-0000-0000-0000000000e1');
select t.expect_rows($q$update public.community_athlete_stats set best_pushups=100 where user_id='a5300000-0000-0000-0000-0000000000e1'$q$,1,'v53 un día después');
select t.expect_value($q$select best_pushups::text from public.community_athlete_stats where user_id='a5300000-0000-0000-0000-0000000000e1'$q$,'30','v53 sube como mucho +50 % (o +10)');
select t.expect_rows($q$update public.community_athlete_stats set best_pushups=0 where user_id='a5300000-0000-0000-0000-0000000000e2'$q$,0,'v53 Ana no puede cambiar las de Beto');

-- Ocultar
select t.expect_rows($q$update public.community_athlete_stats set stats_public=false where user_id='a5300000-0000-0000-0000-0000000000e1'$q$,1,'v53 Ana oculta sus estadísticas');
select t.as_user('a5300000-0000-0000-0000-0000000000e2');
select t.expect_value($q$select stats_visible::text from public.community_athlete_profile('a5300000-0000-0000-0000-0000000000e1')$q$,'false','v53 Beto ya no ve las estadísticas de Ana');
select t.expect_count($q$select 1 from public.community_leaderboard('pushups','all',50) where username='ana53'$q$,0,'v53 Ana sale de los rankings');

-- Solicitudes (sin embed ambiguo) y aceptación
select t.as_user('a5300000-0000-0000-0000-0000000000e3');
select t.expect_value($q$select string_agg(username,',') from public.community_follow_requests()$q$,'ana53','v53 Caro ve la solicitud de Ana');
select t.expect_rows($q$update public.community_follows set status='accepted' where follower_id='a5300000-0000-0000-0000-0000000000e1' and following_id='a5300000-0000-0000-0000-0000000000e3'$q$,1,'v53 Caro acepta a Ana');
select t.as_user('a5300000-0000-0000-0000-0000000000e1');
select t.expect_value($q$select stats_visible::text||'/'||overall_rank from public.community_athlete_profile('a5300000-0000-0000-0000-0000000000e3')$q$,'true/6','v53 seguidora aceptada ve las estadísticas de un perfil privado');
select t.expect_count($q$select 1 from public.community_people('',null,30,'friends')$q$,2,'v53 Amigos se actualiza al aceptar');
select t.expect_rows($q$delete from public.community_athlete_stats where user_id='a5300000-0000-0000-0000-0000000000e1'$q$,1,'v53 Ana puede borrar sus estadísticas');
reset role;
do $$ begin raise notice 'PRUEBAS v53 COMUNIDAD DE DEPORTISTAS PASARON'; end $$;
