-- Pruebas de RLS y restricciones para schema.sql + community.sql + migración v41.
-- Ejecutar SOLO en un PostgreSQL de pruebas (ver supabase/tests/run.sh). Aborta ante el primer fallo.
\set ON_ERROR_STOP on
set client_min_messages = notice;

create schema if not exists t;
grant usage on schema t to anon, authenticated;
create or replace function t.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); end $$;
create or replace function t.expect_error(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'OK (rechazado) %: %', label, sqlerrm; return; end;
  raise exception 'FALLO: se esperaba error en "%"', label;
end $$;
create or replace function t.expect_rows(q text, n int, label text) returns void language plpgsql as $$
declare got int;
begin
  execute q; get diagnostics got = row_count;
  if got <> n then raise exception 'FALLO: "%" afectó % filas, se esperaban %', label, got, n; end if;
  raise notice 'OK %: % fila(s)', label, got;
end $$;
create or replace function t.expect_count(q text, n int, label text) returns void language plpgsql as $$
declare got int;
begin
  execute 'select count(*) from (' || q || ') x' into got;
  if got <> n then raise exception 'FALLO: "%" devolvió % filas, se esperaban %', label, got, n; end if;
  raise notice 'OK %: % fila(s) visibles', label, got;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- Datos: A (público), B (público), C (privado). El trigger crea los perfiles.
reset role;
insert into auth.users(id,email) values
 ('aaaaaaaa-0000-0000-0000-000000000001','alice@example.test'),
 ('bbbbbbbb-0000-0000-0000-000000000002','bob@example.test'),
 ('cccccccc-0000-0000-0000-000000000003','carol@example.test')
on conflict do nothing;
update public.community_profiles set visibility='public' where user_id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');

set role authenticated;
-- ---------------------------------------------------------------- publicaciones
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.expect_rows($q$insert into public.community_posts(id,user_id,post_kind,description) values('a0000000-0000-0000-0000-0000000000a1','aaaaaaaa-0000-0000-0000-000000000001','text','Hoy hice mi primera carrera de 5 km')$q$,1,'A publica texto');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description) values('aaaaaaaa-0000-0000-0000-000000000001','text','   ')$q$,'texto vacío');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description,before_path) values('aaaaaaaa-0000-0000-0000-000000000001','text','x','aaaaaaaa-0000-0000-0000-000000000001/p/before.jpg')$q$,'texto con foto de antes');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description) values('aaaaaaaa-0000-0000-0000-000000000001','transformation','sin fotos')$q$,'transformación sin fotos');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description,image_path) values('aaaaaaaa-0000-0000-0000-000000000001','text','x','bbbbbbbb-0000-0000-0000-000000000002/p/img.jpg')$q$,'imagen en carpeta ajena');
select t.expect_rows($q$insert into public.community_posts(id,user_id,post_kind,achievement) values('a0000000-0000-0000-0000-0000000000a2','aaaaaaaa-0000-0000-0000-000000000001','achievement','{"exerciseId":"exercise-flexiones","exerciseName":"Flexiones","category":"calisthenics","rank":"silver","level":5,"threshold":25,"measure":"reps","evidence":"declared","earnedAt":"2026-10-17"}')$q$,1,'A comparte logro declarado');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,achievement) values('aaaaaaaa-0000-0000-0000-000000000001','achievement','{"exerciseId":"activity-running","exerciseName":"Running · distancia","rank":"bronze","level":3,"threshold":3,"measure":"km","evidence":"gps_device","earnedAt":"2026-10-17"}')$q$,1,'A comparte logro con ruta GPS');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('aaaaaaaa-0000-0000-0000-000000000001','achievement','{"exerciseId":"exercise-flexiones","exerciseName":"Flexiones","rank":"diamond","level":12,"threshold":100,"measure":"reps","evidence":"verified","earnedAt":"2026-10-17"}')$q$,'evidencia "verified" desde el cliente');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('aaaaaaaa-0000-0000-0000-000000000001','achievement','{"exerciseId":"exercise-flexiones","exerciseName":"Flexiones","rank":"diamond","level":2,"threshold":10,"measure":"reps","evidence":"declared","earnedAt":"2026-10-17"}')$q$,'rango incoherente con el nivel');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('aaaaaaaa-0000-0000-0000-000000000001','achievement','{"exerciseId":"exercise-flexiones","exerciseName":"Flexiones","rank":"bronze","level":1,"threshold":5,"measure":"reps","evidence":"gps_device","earnedAt":"2026-10-17"}')$q$,'GPS en un ejercicio de repeticiones');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('aaaaaaaa-0000-0000-0000-000000000001','achievement','{"exerciseId":"exercise-flexiones","exerciseName":"Flexiones","rank":"bronze","level":1,"threshold":5,"measure":"reps","evidence":"declared","earnedAt":"2026-10-17","verifiedBy":"admin"}')$q$,'clave extra en el logro');

select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description) values('aaaaaaaa-0000-0000-0000-000000000001','text','suplantación')$q$,'B publica como A');
select t.expect_rows($q$update public.community_posts set description='editado por B' where id='a0000000-0000-0000-0000-0000000000a1'$q$,0,'B no edita post de A');
select t.expect_rows($q$delete from public.community_posts where id='a0000000-0000-0000-0000-0000000000a1'$q$,0,'B no borra post de A');

select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.expect_rows($q$update public.community_posts set description='Hoy hice mi primera carrera de 5 km (editado)' where id='a0000000-0000-0000-0000-0000000000a1'$q$,1,'A edita su descripción');
select t.expect_error($q$update public.community_posts set post_kind='transformation' where id='a0000000-0000-0000-0000-0000000000a1'$q$,'A cambia el tipo de post');
select t.expect_error($q$update public.community_posts set achievement='{"rank":"diamond"}' where id='a0000000-0000-0000-0000-0000000000a2'$q$,'A altera un logro ya publicado');

-- Privacidad: C (privado) publica; B no lo sigue.
select t.as_user('cccccccc-0000-0000-0000-000000000003');
select t.expect_rows($q$insert into public.community_posts(id,user_id,post_kind,description) values('c0000000-0000-0000-0000-0000000000c1','cccccccc-0000-0000-0000-000000000003','text','Post privado de C')$q$,1,'C publica (perfil privado)');
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.expect_count($q$select 1 from public.community_posts where user_id='cccccccc-0000-0000-0000-000000000003'$q$,0,'B no ve posts de C privado');
select t.expect_count($q$select 1 from public.community_posts where user_id='aaaaaaaa-0000-0000-0000-000000000001'$q$,3,'B ve posts públicos de A');
reset role; set role anon; select t.as_user(null);
select t.expect_count($q$select 1 from public.community_posts$q$,3,'anónimo ve solo públicos');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description) values('aaaaaaaa-0000-0000-0000-000000000001','text','anon')$q$,'anónimo no publica');
reset role; set role authenticated;

-- ---------------------------------------------------------------- likes y comentarios
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.expect_rows($q$insert into public.community_likes(post_id,user_id) values('a0000000-0000-0000-0000-0000000000a2','bbbbbbbb-0000-0000-0000-000000000002')$q$,1,'B da me gusta');
select t.expect_error($q$insert into public.community_likes(post_id,user_id) values('a0000000-0000-0000-0000-0000000000a2','bbbbbbbb-0000-0000-0000-000000000002')$q$,'me gusta duplicado por reintento');
select t.expect_error($q$insert into public.community_likes(post_id,user_id) values('c0000000-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-000000000002')$q$,'B da me gusta a post que no puede ver');
select t.expect_rows($q$insert into public.community_comments(post_id,user_id,body) values('a0000000-0000-0000-0000-0000000000a2','bbbbbbbb-0000-0000-0000-000000000002','¡Bien ahí!')$q$,1,'B comenta');

-- ---------------------------------------------------------------- mensajes y no leídos
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id) values('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001')$q$,1,'B sigue a A');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id) values('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')$q$,1,'A sigue a B (mutuo)');
select t.expect_rows($q$insert into public.community_messages(id,sender_id,recipient_id,body) values('d0000000-0000-0000-0000-0000000000d1','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Hola B')$q$,1,'A escribe a B');
select t.expect_error($q$insert into public.community_messages(sender_id,recipient_id,body) values('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','Hola C')$q$,'A escribe a C sin seguimiento mutuo');
select t.expect_rows($q$update public.community_messages set read_at=now() where id='d0000000-0000-0000-0000-0000000000d1'$q$,0,'el remitente no marca leído');
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.expect_count($q$select 1 from public.community_messages where recipient_id='bbbbbbbb-0000-0000-0000-000000000002' and read_at is null$q$,1,'B tiene 1 no leído');
select t.expect_rows($q$update public.community_messages set read_at=now() where id='d0000000-0000-0000-0000-0000000000d1'$q$,1,'B marca leído');
select t.expect_count($q$select 1 from public.community_messages where recipient_id='bbbbbbbb-0000-0000-0000-000000000002' and read_at is null$q$,0,'B sin no leídos');
select t.expect_error($q$update public.community_messages set body='alterado' where id='d0000000-0000-0000-0000-0000000000d1'$q$,'B altera el texto');
select t.as_user('cccccccc-0000-0000-0000-000000000003');
select t.expect_count($q$select 1 from public.community_messages$q$,0,'C no ve mensajes ajenos');

-- ---------------------------------------------------------------- otros permisos críticos
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.expect_error($q$insert into public.community_memberships(user_id,tier,status) values('bbbbbbbb-0000-0000-0000-000000000002','pro','active')$q$,'B se otorga Pro');
select t.expect_error($q$insert into storage.objects(bucket_id,name) values('community-media','aaaaaaaa-0000-0000-0000-000000000001/x/img.jpg')$q$,'B sube a la carpeta de A');
select t.expect_rows($q$insert into public.user_app_data(user_id,data) values('bbbbbbbb-0000-0000-0000-000000000002','{"x":1}')$q$,1,'B guarda sus datos');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.expect_count($q$select 1 from public.user_app_data$q$,0,'A no lee datos de B');
select t.expect_rows($q$update public.user_app_data set data='{}' where user_id='bbbbbbbb-0000-0000-0000-000000000002'$q$,0,'A no modifica datos de B');

-- Bloqueo: A bloquea a B → B deja de ver los posts de A y se cortan los seguimientos.
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')$q$,1,'A bloquea a B');
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.expect_count($q$select 1 from public.community_posts where user_id='aaaaaaaa-0000-0000-0000-000000000001'$q$,0,'B bloqueado no ve posts de A');
select t.expect_count($q$select 1 from public.community_messages$q$,0,'B bloqueado no ve el chat');

reset role;
select 'TODAS LAS PRUEBAS RLS PASARON' as resultado;
