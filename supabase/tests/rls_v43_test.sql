-- Pruebas v43: moderación y eliminación de cuenta. Se ejecuta después de rls_v41_test.sql (reusa el esquema t).
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email) values
 ('dddddddd-0000-0000-0000-000000000004','mod@example.test'),
 ('ffffffff-0000-0000-0000-000000000006','frank@example.test')
on conflict do nothing;
update public.community_profiles set visibility='public' where user_id='ffffffff-0000-0000-0000-000000000006';
insert into public.community_moderators(user_id) values('dddddddd-0000-0000-0000-000000000004') on conflict do nothing;

set role authenticated;
-- F publica; C la denuncia.
select t.as_user('ffffffff-0000-0000-0000-000000000006');
select t.expect_rows($q$insert into public.community_posts(id,user_id,post_kind,description) values('f0000000-0000-0000-0000-0000000000f1','ffffffff-0000-0000-0000-000000000006','text','Contenido a revisar')$q$,1,'F publica');
select t.expect_rows($q$insert into public.user_app_data(user_id,data) values('ffffffff-0000-0000-0000-000000000006','{"x":1}')$q$,1,'F guarda datos');
select t.expect_error($q$insert into public.community_moderators(user_id) values('ffffffff-0000-0000-0000-000000000006')$q$,'F se nombra moderador');
select t.expect_count($q$select 1 where public.community_is_moderator()$q$,0,'F no es moderador');
select t.as_user('cccccccc-0000-0000-0000-000000000003');
select t.expect_rows($q$insert into public.community_reports(reporter_id,post_id,reason) values('cccccccc-0000-0000-0000-000000000003','f0000000-0000-0000-0000-0000000000f1','spam')$q$,1,'C denuncia');
select t.expect_count($q$select 1 from public.community_reports$q$,0,'C no lee denuncias');
select t.expect_rows($q$update public.community_reports set status='dismissed'$q$,0,'C no resuelve denuncias');
select t.expect_rows($q$delete from public.community_posts where id='f0000000-0000-0000-0000-0000000000f1'$q$,0,'C no borra posts ajenos');
-- Moderador
select t.as_user('dddddddd-0000-0000-0000-000000000004');
select t.expect_count($q$select 1 where public.community_is_moderator()$q$,1,'D es moderador');
select t.expect_count($q$select 1 from public.community_reports where status='open'$q$,1,'Moderador ve la denuncia');
select t.expect_error($q$update public.community_reports set reason='otra' where post_id='f0000000-0000-0000-0000-0000000000f1'$q$,'Moderador no altera el motivo');
select t.expect_rows($q$update public.community_reports set status='dismissed' where post_id='f0000000-0000-0000-0000-0000000000f1'$q$,1,'Moderador descarta');
select t.expect_count($q$select 1 from public.community_reports where status='dismissed' and resolved_by='dddddddd-0000-0000-0000-000000000004' and resolved_at is not null$q$,1,'Queda registrado quién resolvió');
select t.expect_rows($q$delete from public.community_posts where id='f0000000-0000-0000-0000-0000000000f1'$q$,1,'Moderador elimina el post');
select t.expect_count($q$select 1 from public.community_reports where reason='spam' and post_id is null$q$,1,'La denuncia se conserva sin el post (v44)');
-- Eliminar cuenta
reset role; set role anon; select t.as_user(null);
select t.expect_error($q$select public.delete_my_account()$q$,'Anónimo no elimina cuentas');
reset role; set role authenticated;
select t.as_user('ffffffff-0000-0000-0000-000000000006');
select public.delete_my_account();
reset role;
select t.expect_count($q$select 1 from auth.users where id='ffffffff-0000-0000-0000-000000000006'$q$,0,'Cuenta de F eliminada');
select t.expect_count($q$select 1 from public.community_profiles where user_id='ffffffff-0000-0000-0000-000000000006'$q$,0,'Perfil de F eliminado en cascada');
select t.expect_count($q$select 1 from public.user_app_data where user_id='ffffffff-0000-0000-0000-000000000006'$q$,0,'Datos de la app de F eliminados');
select t.expect_count($q$select 1 from auth.users where id='cccccccc-0000-0000-0000-000000000003'$q$,1,'Otras cuentas intactas');
select 'PRUEBAS v43 PASARON' as resultado;
