-- Pruebas v44: endurecimiento de seguridad. Se ejecuta después de rls_v41 y rls_v43 (reusa el esquema t).
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email) values
 ('99999999-0000-0000-0000-000000000009','victima@example.test'),
 ('77777777-0000-0000-0000-000000000007','gina@example.test'),
 ('88888888-0000-0000-0000-000000000008','hugo@example.test')
on conflict do nothing;
insert into public.community_profiles(user_id,username,display_name,visibility) values
 ('99999999-0000-0000-0000-000000000009','victima','Víctima','public'),
 ('77777777-0000-0000-0000-000000000007','gina','Gina','private'),
 ('88888888-0000-0000-0000-000000000008','hugo','Hugo','public')
on conflict (user_id) do nothing;
update public.community_profiles set visibility='public' where user_id in ('99999999-0000-0000-0000-000000000009','88888888-0000-0000-0000-000000000008');
update public.community_profiles set visibility='private' where user_id='77777777-0000-0000-0000-000000000007';

set role authenticated;
-- 1. Seguimientos: la persona seguida solo puede cambiar el estado.
select t.as_user('88888888-0000-0000-0000-000000000008');
select t.expect_rows($q$insert into public.community_follows(follower_id,following_id) values('88888888-0000-0000-0000-000000000008','77777777-0000-0000-0000-000000000007')$q$,1,'H pide seguir a G (privada)');
select t.as_user('77777777-0000-0000-0000-000000000007');
select t.expect_error($q$update public.community_follows set follower_id='99999999-0000-0000-0000-000000000009', status='accepted' where follower_id='88888888-0000-0000-0000-000000000008'$q$,'G no puede fabricar un seguimiento de la víctima');
select t.expect_rows($q$update public.community_follows set status='accepted' where follower_id='88888888-0000-0000-0000-000000000008'$q$,1,'G acepta la solicitud real');
reset role;
select t.expect_count($q$select 1 from public.community_follows where follower_id='99999999-0000-0000-0000-000000000009'$q$,0,'No existe el seguimiento falso');
set role authenticated;

-- 2. Fechas del servidor.
select t.as_user('88888888-0000-0000-0000-000000000008');
select t.expect_rows($q$insert into public.community_posts(id,user_id,post_kind,description,created_at,updated_at) values('80000000-0000-0000-0000-000000000081','88888888-0000-0000-0000-000000000008','text','Post con fecha futura','2099-01-01','2099-01-01')$q$,1,'H publica intentando fijar fechas');
select t.expect_count($q$select 1 from public.community_posts where id='80000000-0000-0000-0000-000000000081' and created_at<=now() and updated_at is null$q$,1,'La base ignora created_at/updated_at del cliente');

-- 3. Límite de publicaciones por minuto (5).
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description) select '88888888-0000-0000-0000-000000000008','text','extra '||g from generate_series(2,5) g$q$,4,'H llega a 5 publicaciones');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description) values('88888888-0000-0000-0000-000000000008','text','seis')$q$,'Sexta publicación en un minuto rechazada');

-- 4. Perfiles: columnas permitidas y avatar en carpeta propia.
select t.expect_error($q$update public.community_profiles set created_at='2000-01-01' where user_id='88888888-0000-0000-0000-000000000008'$q$,'H no cambia created_at del perfil');
select t.expect_error($q$update public.community_profiles set avatar_path='javascript:alert(1)' where user_id='88888888-0000-0000-0000-000000000008'$q$,'avatar_path fuera de la carpeta propia rechazado');
select t.expect_rows($q$update public.community_profiles set bio='Hola' where user_id='88888888-0000-0000-0000-000000000008'$q$,1,'H edita su bio');

-- 5. Mensajes: no se crean ya leídos (H y la víctima se siguen mutuamente).
reset role;
insert into public.community_follows(follower_id,following_id,status) values
 ('88888888-0000-0000-0000-000000000008','99999999-0000-0000-0000-000000000009','accepted'),
 ('99999999-0000-0000-0000-000000000009','88888888-0000-0000-0000-000000000008','accepted') on conflict do nothing;
set role authenticated;
select t.as_user('88888888-0000-0000-0000-000000000008');
select t.expect_rows($q$insert into public.community_messages(sender_id,recipient_id,body,read_at) values('88888888-0000-0000-0000-000000000008','99999999-0000-0000-0000-000000000009','hola','2000-01-01')$q$,1,'H envía mensaje');
select t.expect_count($q$select 1 from public.community_messages where sender_id='88888888-0000-0000-0000-000000000008' and read_at is null$q$,1,'El mensaje llega como no leído');

-- 6. Búsqueda: términos vacíos tras limpiar no listan perfiles.
select t.expect_count($q$select * from public.search_community_profiles('!!')$q$,0,'Búsqueda "!!" no lista perfiles');
select t.expect_count($q$select * from public.search_community_profiles('__')$q$,0,'Búsqueda "__" no actúa como comodín');
select t.expect_count($q$select * from public.search_community_profiles('hug')$q$,1,'Búsqueda normal sigue funcionando');

-- 7. Copia en la nube: tamaño máximo.
select t.expect_error($q$insert into public.user_app_data(user_id,data) values('88888888-0000-0000-0000-000000000008',jsonb_build_object('x',repeat('x',3100000)))$q$,'Copia de más de 3 MB rechazada');
select t.expect_rows($q$insert into public.user_app_data(user_id,data) values('88888888-0000-0000-0000-000000000008','{"ok":true}')$q$,1,'Copia normal aceptada');

-- 8. Moderación: la denuncia se conserva con un extracto al eliminar el post.
select t.as_user('99999999-0000-0000-0000-000000000009');
select t.expect_rows($q$insert into public.community_reports(reporter_id,post_id,reason,created_at) values('99999999-0000-0000-0000-000000000009','80000000-0000-0000-0000-000000000081','spam v44','2000-01-01')$q$,1,'La víctima denuncia');
select t.as_user('dddddddd-0000-0000-0000-000000000004');
select t.expect_rows($q$update public.community_reports set status='actioned' where post_id='80000000-0000-0000-0000-000000000081'$q$,1,'Moderador marca como resuelta');
select t.expect_rows($q$delete from public.community_posts where id='80000000-0000-0000-0000-000000000081'$q$,1,'Moderador elimina el post');
select t.expect_count($q$select 1 from public.community_reports where reason='spam v44' and post_id is null and status='actioned' and post_excerpt='Post con fecha futura' and created_at>'2001-01-01'$q$,1,'Denuncia conservada con extracto y fecha real');

-- 9. Eliminar cuenta: verificación previa y fotos pendientes.
reset role; set role anon; select t.as_user(null);
select t.expect_error($q$select public.account_deletion_ready()$q$,'Anónimo no consulta la eliminación');
reset role;
insert into storage.objects(bucket_id,name,owner) values('community-media','88888888-0000-0000-0000-000000000008/p/foto.jpg','88888888-0000-0000-0000-000000000008');
set role authenticated;
select t.as_user('88888888-0000-0000-0000-000000000008');
select t.expect_count($q$select 1 where public.account_deletion_ready()$q$,1,'H puede iniciar la eliminación');
select t.expect_error($q$select public.delete_my_account()$q$,'No se elimina la cuenta con fotos pendientes');
reset role;
select t.expect_count($q$select 1 from auth.users where id='88888888-0000-0000-0000-000000000008'$q$,1,'La cuenta de H sigue intacta');
delete from storage.objects where name='88888888-0000-0000-0000-000000000008/p/foto.jpg';
set role authenticated;
select t.as_user('88888888-0000-0000-0000-000000000008');
select public.delete_my_account();
reset role;
select t.expect_count($q$select 1 from auth.users where id='88888888-0000-0000-0000-000000000008'$q$,0,'Sin fotos, la cuenta de H se elimina');
select 'PRUEBAS v44 PASARON' as resultado;
