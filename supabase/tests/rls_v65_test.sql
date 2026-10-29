-- Pruebas v65: «Enviar una sugerencia» — solo escritura propia con sesión, nadie lee desde la app, límite diario.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
  ('a6500000-0000-0000-0000-0000000000a1','ana65@example.test','{"full_name":"Ana"}'),
  ('a6500000-0000-0000-0000-0000000000a2','beto65@example.test','{"full_name":"Beto"}') on conflict do nothing;

set role authenticated;
select t.as_user('a6500000-0000-0000-0000-0000000000a1');
select t.expect_rows($q$insert into public.app_feedback(user_id,category,message,app_version) values('a6500000-0000-0000-0000-0000000000a1','idea','Sumar recordatorios de agua','65.0')$q$,1,'v65 Ana manda una idea');
select t.expect_error($q$insert into public.app_feedback(user_id,message) values('a6500000-0000-0000-0000-0000000000a2','Me hago pasar por Beto')$q$,'v65 no se manda a nombre de otra persona');
select t.expect_error($q$insert into public.app_feedback(user_id,message) values('a6500000-0000-0000-0000-0000000000a1','ok')$q$,'v65 mensaje demasiado corto');
select t.expect_error($q$insert into public.app_feedback(user_id,category,message) values('a6500000-0000-0000-0000-0000000000a1','spam','Hola hola')$q$,'v65 categoría desconocida');
select t.expect_error($q$insert into public.app_feedback(user_id,message,created_at) values('a6500000-0000-0000-0000-0000000000a1','Fecha inventada','2020-01-01')$q$,'v65 la fecha la pone el servidor');
select t.expect_error($q$select * from public.app_feedback$q$,'v65 nadie lee las sugerencias desde la app');
select t.expect_error($q$update public.app_feedback set message='cambio' where user_id='a6500000-0000-0000-0000-0000000000a1'$q$,'v65 no se editan');
select t.expect_error($q$delete from public.app_feedback$q$,'v65 no se borran desde la app');
select t.expect_rows($q$insert into public.app_feedback(user_id,category,message) values('a6500000-0000-0000-0000-0000000000a1','problema','Segunda')$q$,1,'v65 segunda del día');
select t.expect_rows($q$insert into public.app_feedback(user_id,category,message) values('a6500000-0000-0000-0000-0000000000a1','otro','Tercera')$q$,1,'v65 tercera del día');
select t.expect_rows($q$insert into public.app_feedback(user_id,category,message) values('a6500000-0000-0000-0000-0000000000a1','idea','Cuarta')$q$,1,'v65 cuarta del día');
select t.expect_rows($q$insert into public.app_feedback(user_id,category,message) values('a6500000-0000-0000-0000-0000000000a1','idea','Quinta')$q$,1,'v65 quinta del día');
select t.expect_error($q$insert into public.app_feedback(user_id,category,message) values('a6500000-0000-0000-0000-0000000000a1','idea','Sexta')$q$,'v65 máximo 5 por día');
reset role; set role anon; select t.as_user(null);
select t.expect_error($q$insert into public.app_feedback(user_id,message) values(null,'Sin cuenta')$q$,'v65 sin sesión no se manda');
reset role;
select t.expect_value($q$select count(*)::text from public.app_feedback where user_id='a6500000-0000-0000-0000-0000000000a1'$q$,'5','v65 quedaron 5 guardadas (las ve la dueña en Supabase)');
do $$ begin raise notice 'PRUEBAS v65 PASARON'; end $$;
