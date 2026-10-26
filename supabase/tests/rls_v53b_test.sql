-- Pruebas v53.1: bandera, «Mi físico» (una cosa por sección; sin Plus, cambio cada 30 días) y mapa de músculos.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
  ('a5310000-0000-0000-0000-0000000000e1','ana531@example.test','{"full_name":"Ana"}'),
  ('a5310000-0000-0000-0000-0000000000e2','beto531@example.test','{"full_name":"Beto"}'),
  ('a5310000-0000-0000-0000-0000000000e3','caro531@example.test','{"full_name":"Caro"}') on conflict do nothing;
update public.community_profiles set username='ana531', visibility='public' where user_id='a5310000-0000-0000-0000-0000000000e1';
update public.community_profiles set username='beto531', visibility='public' where user_id='a5310000-0000-0000-0000-0000000000e2';
update public.community_profiles set username='caro531', visibility='private' where user_id='a5310000-0000-0000-0000-0000000000e3';


set role authenticated;
select t.as_user('a5310000-0000-0000-0000-0000000000e1');
select t.expect_rows($q$update public.community_profiles set country_code='UY' where user_id='a5310000-0000-0000-0000-0000000000e1'$q$,1,'v53.1 Ana elige la bandera de Uruguay');
select t.expect_error($q$update public.community_profiles set country_code='uruguay' where user_id='a5310000-0000-0000-0000-0000000000e1'$q$,'v53.1 código de país inválido rechazado');
select t.expect_rows($q$update public.community_profiles set country_code='AR' where user_id='a5310000-0000-0000-0000-0000000000e2'$q$,0,'v53.1 no se cambia la bandera de otra persona');
select t.expect_rows($q$insert into public.community_physique(user_id,kind,before_path,after_path,description) values('a5310000-0000-0000-0000-0000000000e1','pair','a5310000-0000-0000-0000-0000000000e1/physique/a.jpg','a5310000-0000-0000-0000-0000000000e1/physique/b.jpg','3 meses')$q$,1,'v53.1 Ana sube su antes y después');
select t.expect_rows($q$insert into public.community_physique(user_id,kind,photo_path) values('a5310000-0000-0000-0000-0000000000e1','single','a5310000-0000-0000-0000-0000000000e1/physique/c.jpg')$q$,1,'v53.1 Ana sube una foto');
select t.expect_error($q$insert into public.community_physique(user_id,kind,photo_path) values('a5310000-0000-0000-0000-0000000000e1','single','a5310000-0000-0000-0000-0000000000e1/physique/d.jpg')$q$,'v53.1 una sola cosa por sección');
select t.expect_error($q$update public.community_physique set photo_path='a5310000-0000-0000-0000-0000000000e1/physique/d.jpg' where user_id='a5310000-0000-0000-0000-0000000000e1' and kind='single'$q$,'v53.1 sin Plus no se cambia antes de 30 días');
select t.expect_error($q$insert into public.community_physique(user_id,kind,photo_path) values('a5310000-0000-0000-0000-0000000000e2','single','a5310000-0000-0000-0000-0000000000e2/physique/x.jpg')$q$,'v53.1 no se sube en el perfil de otra persona');
select t.expect_error($q$insert into public.community_physique(user_id,kind,before_path) values('a5310000-0000-0000-0000-0000000000e1','pair','a5310000-0000-0000-0000-0000000000e1/physique/z.jpg')$q$,'v53.1 antes y después necesita las dos fotos');
select t.expect_error($q$update public.community_physique set photo_path='a5310000-0000-0000-0000-0000000000e2/physique/c.jpg' where user_id='a5310000-0000-0000-0000-0000000000e1' and kind='single'$q$,'v53.1 la foto tiene que estar en la carpeta propia');
select t.expect_rows($q$update public.community_physique set photo_path=null where user_id='a5310000-0000-0000-0000-0000000000e1' and kind='single'$q$,1,'v53.1 quitar la foto se puede siempre');
select t.expect_error($q$update public.community_physique set photo_path='a5310000-0000-0000-0000-0000000000e1/physique/e.jpg' where user_id='a5310000-0000-0000-0000-0000000000e1' and kind='single'$q$,'v53.1 quitar y volver a subir no saltea el plazo');
select t.expect_error($q$delete from public.community_physique where user_id='a5310000-0000-0000-0000-0000000000e1'$q$,'v53.1 la fila no se borra (guarda el plazo)');
reset role;
insert into public.community_memberships(user_id,tier,status) values('a5310000-0000-0000-0000-0000000000e1','pro','active') on conflict (user_id) do update set tier='pro', status='active';
set role authenticated; select t.as_user('a5310000-0000-0000-0000-0000000000e1');
select t.expect_rows($q$update public.community_physique set photo_path='a5310000-0000-0000-0000-0000000000e1/physique/e.jpg' where user_id='a5310000-0000-0000-0000-0000000000e1' and kind='single'$q$,1,'v53.1 con Plus se cambia cuando quiera');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,muscle_ranks) values('a5310000-0000-0000-0000-0000000000e1','{"biceps":12}')$q$,'v53.1 rango de músculo fuera de escala rechazado');
select t.expect_error($q$insert into public.community_athlete_stats(user_id,muscle_ranks) values('a5310000-0000-0000-0000-0000000000e1','{"biceps":"oro"}')$q$,'v53.1 rango de músculo no numérico rechazado');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,overall_rank,muscle_ranks) values('a5310000-0000-0000-0000-0000000000e1',2,'{"biceps":3,"cuadriceps":2,"gluteos":-1}')$q$,1,'v53.1 Ana publica su mapa de músculos');
select t.as_user('a5310000-0000-0000-0000-0000000000e3');
select t.expect_rows($q$update public.community_profiles set country_code='CL' where user_id='a5310000-0000-0000-0000-0000000000e3'$q$,1,'v53.1 Caro (privada) elige bandera');
select t.expect_rows($q$insert into public.community_physique(user_id,kind,photo_path) values('a5310000-0000-0000-0000-0000000000e3','single','a5310000-0000-0000-0000-0000000000e3/physique/c.jpg')$q$,1,'v53.1 Caro sube una foto');
select t.expect_rows($q$insert into public.community_athlete_stats(user_id,overall_rank,muscle_ranks) values('a5310000-0000-0000-0000-0000000000e3',4,'{"biceps":5}')$q$,1,'v53.1 Caro publica su mapa');

select t.as_user('a5310000-0000-0000-0000-0000000000e2');
select t.expect_value($q$select country_code||'|'||(muscle_ranks->>'biceps')||'|'||coalesce(show_muscles::text,'-') from public.community_athlete_extras('a5310000-0000-0000-0000-0000000000e1')$q$,'UY|3|-','v53.1 Beto ve bandera y músculos de Ana');
select t.expect_count($q$select 1 from public.community_physique where user_id='a5310000-0000-0000-0000-0000000000e1' and coalesce(before_path,photo_path) is not null$q$,2,'v53.1 Beto ve «Mi físico» de Ana');
select t.expect_value($q$select country_code||'|'||coalesce(muscle_ranks::text,'-') from public.community_athlete_extras('a5310000-0000-0000-0000-0000000000e3')$q$,'CL|-','v53.1 perfil privado: solo la bandera (dato básico)');
select t.expect_count($q$select 1 from public.community_physique where user_id='a5310000-0000-0000-0000-0000000000e3'$q$,0,'v53.1 perfil privado: «Mi físico» oculto');
reset role; set role anon; select t.as_user(null);
select t.expect_count($q$select 1 from public.community_physique where user_id='a5310000-0000-0000-0000-0000000000e1'$q$,2,'v53.1 sin sesión se ve «Mi físico» de un perfil público');
reset role; set role authenticated; select t.as_user('a5310000-0000-0000-0000-0000000000e2');
select t.expect_value($q$select string_agg(country_code,',' order by country_code) from public.community_flags(array['a5310000-0000-0000-0000-0000000000e1','a5310000-0000-0000-0000-0000000000e3']::uuid[])$q$,'CL,UY','v53.1 banderas para tarjetas');
select t.as_user('a5310000-0000-0000-0000-0000000000e1');
select t.expect_rows($q$update public.community_athlete_stats set show_muscles=false where user_id='a5310000-0000-0000-0000-0000000000e1'$q$,1,'v53.1 Ana oculta su mapa de músculos');
select t.expect_value($q$select show_muscles::text||'|'||(muscle_ranks->>'biceps') from public.community_athlete_extras('a5310000-0000-0000-0000-0000000000e1')$q$,'false|3','v53.1 Ana sigue viendo su mapa y su ajuste');
select t.as_user('a5310000-0000-0000-0000-0000000000e2');
select t.expect_value($q$select coalesce(muscle_ranks::text,'-') from public.community_athlete_extras('a5310000-0000-0000-0000-0000000000e1')$q$,'-','v53.1 mapa oculto: Beto no lo ve');
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('a5310000-0000-0000-0000-0000000000e2','a5310000-0000-0000-0000-0000000000e1')$q$,1,'v53.1 Beto bloquea a Ana');
select t.as_user('a5310000-0000-0000-0000-0000000000e1');
select t.expect_count($q$select 1 from public.community_athlete_extras('a5310000-0000-0000-0000-0000000000e2')$q$,0,'v53.1 con bloqueo no hay datos extra');
select t.expect_count($q$select 1 from public.community_flags(array['a5310000-0000-0000-0000-0000000000e2']::uuid[])$q$,0,'v53.1 con bloqueo no hay bandera');
select t.as_user('a5310000-0000-0000-0000-0000000000e2');
select t.expect_count($q$select 1 from public.community_physique where user_id='a5310000-0000-0000-0000-0000000000e1'$q$,0,'v53.1 con bloqueo no se ve «Mi físico»');
reset role;
do $$ begin raise notice 'PRUEBAS v53.1 PERFIL PASARON'; end $$;
