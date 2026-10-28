-- Pruebas v62: datos corporales privados por defecto; cada persona elige cuáles mostrar en Comunidad.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
  ('a6200000-0000-0000-0000-0000000000f1','ana62@example.test','{"full_name":"Ana"}'),
  ('a6200000-0000-0000-0000-0000000000f2','beto62@example.test','{"full_name":"Beto"}'),
  ('a6200000-0000-0000-0000-0000000000f3','caro62@example.test','{"full_name":"Caro"}'),
  ('a6200000-0000-0000-0000-0000000000f4','dani62@example.test','{"full_name":"Dani"}') on conflict do nothing;
update public.community_profiles set username='ana62', visibility='public' where user_id='a6200000-0000-0000-0000-0000000000f1';
update public.community_profiles set username='beto62', visibility='public' where user_id='a6200000-0000-0000-0000-0000000000f2';
update public.community_profiles set username='caro62', visibility='private' where user_id='a6200000-0000-0000-0000-0000000000f3';
update public.community_profiles set username='dani62', visibility='public' where user_id='a6200000-0000-0000-0000-0000000000f4';

set role authenticated;
-- Por defecto no hay nada: nadie ve datos corporales de Beto.
select t.as_user('a6200000-0000-0000-0000-0000000000f1');
select t.expect_count($q$select * from public.community_body_info('a6200000-0000-0000-0000-0000000000f2')$q$,0,'v62 sin elegir nada, no se ve ningún dato corporal');
-- Ana elige mostrar peso y objetivo (no la altura).
select t.expect_rows($q$insert into public.community_body(user_id,weight_kg,goal) values('a6200000-0000-0000-0000-0000000000f1',72.5,'muscle')$q$,1,'v62 Ana comparte peso y objetivo');
select t.expect_error($q$insert into public.community_body(user_id,weight_kg) values('a6200000-0000-0000-0000-0000000000f2',80)$q$,'v62 no se guardan datos en nombre de otra persona');
select t.expect_error($q$update public.community_body set weight_kg=900 where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,'v62 peso fuera de rango rechazado');
select t.expect_error($q$update public.community_body set goal='otro' where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,'v62 objetivo desconocido rechazado');
select t.expect_rows($q$insert into public.community_body(user_id,weight_kg,goal) values('a6200000-0000-0000-0000-0000000000f1',72.5,'muscle') on conflict (user_id) do update set user_id=excluded.user_id, weight_kg=excluded.weight_kg, goal=excluded.goal$q$,1,'v62 la app puede guardar con upsert');
select t.expect_rows($q$update public.community_body set user_id='a6200000-0000-0000-0000-0000000000f2' where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,1,'v62 intentar pasar la fila a otra cuenta…');
select t.expect_count($q$select 1 from public.community_body where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,1,'v62 …la deja en la cuenta original');
select t.expect_error($q$update public.community_body set updated_at='2020-01-01' where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,'v62 la fecha la pone el servidor');
select t.expect_error($q$delete from public.community_body where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,'v62 la fila no se borra: se apagan los datos');
-- Beto no puede leer la tabla de Ana directamente; sí lo que Ana eligió mostrar.
select t.as_user('a6200000-0000-0000-0000-0000000000f2');
select t.expect_count($q$select * from public.community_body where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,0,'v62 la tabla no se lee directo');
select t.expect_value($q$select weight_kg::text||'|'||coalesce(height_cm::text,'-')||'|'||goal from public.community_body_info('a6200000-0000-0000-0000-0000000000f1')$q$,'72.5|-|muscle','v62 Beto ve el peso y el objetivo de Ana, no la altura');
select t.expect_rows($q$update public.community_body set weight_kg=50 where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,0,'v62 Beto no cambia los datos de Ana');
-- Caro (privada) comparte su altura: solo la ven sus seguidores aceptados.
select t.as_user('a6200000-0000-0000-0000-0000000000f3');
select t.expect_rows($q$insert into public.community_body(user_id,height_cm) values('a6200000-0000-0000-0000-0000000000f3',165)$q$,1,'v62 Caro comparte su altura');
select t.as_user('a6200000-0000-0000-0000-0000000000f2');
select t.expect_count($q$select * from public.community_body_info('a6200000-0000-0000-0000-0000000000f3')$q$,0,'v62 perfil privado: quien no la sigue no ve su altura');
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id,status) values('a6200000-0000-0000-0000-0000000000f2','a6200000-0000-0000-0000-0000000000f3','pending')$q$,1,'v62 Beto pide seguir a Caro');
select t.as_user('a6200000-0000-0000-0000-0000000000f3');
select t.expect_rows($q$update public.community_follows set status='accepted' where follower_id='a6200000-0000-0000-0000-0000000000f2' and following_id='a6200000-0000-0000-0000-0000000000f3'$q$,1,'v62 Caro acepta');
select t.as_user('a6200000-0000-0000-0000-0000000000f2');
select t.expect_value($q$select height_cm::text from public.community_body_info('a6200000-0000-0000-0000-0000000000f3')$q$,'165.0','v62 seguidor aceptado ve la altura de Caro');
-- Bloqueo: Dani bloquea a Ana y comparte su peso; Ana no lo ve.
select t.as_user('a6200000-0000-0000-0000-0000000000f4');
select t.expect_rows($q$insert into public.community_body(user_id,weight_kg) values('a6200000-0000-0000-0000-0000000000f4',90)$q$,1,'v62 Dani comparte su peso');
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('a6200000-0000-0000-0000-0000000000f4','a6200000-0000-0000-0000-0000000000f1')$q$,1,'v62 Dani bloquea a Ana');
select t.as_user('a6200000-0000-0000-0000-0000000000f1');
select t.expect_count($q$select * from public.community_body_info('a6200000-0000-0000-0000-0000000000f4')$q$,0,'v62 con bloqueo no se ven los datos');
-- Ana apaga todo: deja de verse.
select t.expect_rows($q$update public.community_body set weight_kg=null, goal=null where user_id='a6200000-0000-0000-0000-0000000000f1'$q$,1,'v62 Ana deja de compartir');
select t.as_user('a6200000-0000-0000-0000-0000000000f2');
select t.expect_count($q$select * from public.community_body_info('a6200000-0000-0000-0000-0000000000f1')$q$,0,'v62 apagado: no queda nada visible');
-- Sin sesión: solo perfiles públicos y nunca la tabla.
reset role; set role anon; select t.as_user(null);
select t.expect_value($q$select weight_kg::text from public.community_body_info('a6200000-0000-0000-0000-0000000000f4')$q$,'90.0','v62 sin sesión se ve lo que Dani (pública) eligió mostrar');
select t.expect_count($q$select * from public.community_body_info('a6200000-0000-0000-0000-0000000000f3')$q$,0,'v62 sin sesión no se ve nada de un perfil privado');
select t.expect_error($q$select * from public.community_body$q$,'v62 sin sesión no se lee la tabla');
reset role;
do $$ begin raise notice 'PRUEBAS v62 PASARON'; end $$;
