-- Pruebas v48: monetización (contadores, recompensas de un solo uso, límite de fotos, membresía).
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
grant usage on schema t to service_role; grant execute on all functions in schema t to service_role;
insert into auth.users(id,email) values ('a4800000-0000-0000-0000-0000000000f1','fotos@example.test'),('a4800000-0000-0000-0000-0000000000f2','plus@example.test') on conflict do nothing;
insert into public.community_profiles(user_id,username,display_name,visibility) values ('a4800000-0000-0000-0000-0000000000f1','fotos48','Fotos','public'),('a4800000-0000-0000-0000-0000000000f2','plus48','Plus','public') on conflict (user_id) do nothing;

set role authenticated;
select t.as_user('a4800000-0000-0000-0000-0000000000f1');
select t.expect_error($q$select public.monetization_bump('u:a4800000-0000-0000-0000-0000000000f1', current_date, 'photo_extra', 5, null)$q$, 'Un usuario no puede sumarse fotos extra');
select t.expect_error($q$select public.monetization_reward_claim('xxxxxxxxxxxxxxxxxxxxxxxxx', now())$q$, 'Un usuario no puede canjear recompensas');
select t.expect_error($q$select public.monetization_set_membership('a4800000-0000-0000-0000-0000000000f1','active',now()+interval '30 days','web')$q$, 'Un usuario no puede darse Plus');
select t.expect_error($q$insert into public.monetization_usage(subject,day,kind,count) values ('u:x',current_date,'ai_bonus',99)$q$, 'Sin escritura directa de contadores');
select t.expect_error($q$select 1 from public.monetization_usage$q$, 'Los contadores no son legibles desde el navegador');
select t.expect_json($q$select public.my_photo_quota()$q$, 'enabled', 'false', 'El límite de fotos viene desactivado');
-- Desactivado: se puede publicar sin límite (comportamiento anterior).
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,image_path) select 'a4800000-0000-0000-0000-0000000000f1','text','foto '||g,'a4800000-0000-0000-0000-0000000000f1/x'||g||'.jpg' from generate_series(1,3) g$q$, 3, 'Sin límite activo, 3 fotos se publican');

reset role;
delete from public.community_posts where user_id='a4800000-0000-0000-0000-0000000000f1';
update public.monetization_settings set photo_limit_enabled = true;
set role authenticated;
select t.as_user('a4800000-0000-0000-0000-0000000000f1');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,image_path) values ('a4800000-0000-0000-0000-0000000000f1','text','foto 1','a4800000-0000-0000-0000-0000000000f1/1.jpg')$q$, 1, 'Primera foto gratis');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,image_path) values ('a4800000-0000-0000-0000-0000000000f1','text','foto 2','a4800000-0000-0000-0000-0000000000f1/2.jpg')$q$, 1, 'Segunda foto gratis');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description,image_path) values ('a4800000-0000-0000-0000-0000000000f1','text','foto 3','a4800000-0000-0000-0000-0000000000f1/3.jpg')$q$, 'Tercera foto bloqueada sin recompensa');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description) values ('a4800000-0000-0000-0000-0000000000f1','text','solo texto')$q$, 1, 'Las publicaciones sin foto no cuentan');

-- El backend (service_role) registra una recompensa una sola vez y habilita una foto más.
reset role; set role service_role;
select t.expect_json($q$select jsonb_build_object('ok', public.monetization_reward_start('nonce-photo-000000000001','u:a4800000-0000-0000-0000-0000000000f1',public.monetization_today(),'photo',now()))$q$, 'ok', 'true', 'El backend emite un comprobante');
select t.expect_json($q$select jsonb_build_object('ok', public.monetization_reward_claim('nonce-photo-000000000001', now()))$q$, 'ok', 'true', 'Primer canje del comprobante');
select t.expect_json($q$select jsonb_build_object('ok', public.monetization_reward_claim('nonce-photo-000000000001', now()))$q$, 'ok', 'false', 'El mismo comprobante no se canjea dos veces');
select t.expect_json($q$select jsonb_build_object('v', public.monetization_bump('u:a4800000-0000-0000-0000-0000000000f1', public.monetization_today(), 'photo_extra', 1, 3))$q$, 'v', '1', 'Se suma una foto extra');
select t.expect_json($q$select jsonb_build_object('v', public.monetization_bump('u:a4800000-0000-0000-0000-0000000000f1', public.monetization_today(), 'photo_extra', 5, 3))$q$, 'v', '-1', 'El tope diario de fotos extra se respeta');
reset role; set role authenticated;
select t.as_user('a4800000-0000-0000-0000-0000000000f1');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,image_path) values ('a4800000-0000-0000-0000-0000000000f1','text','foto 3','a4800000-0000-0000-0000-0000000000f1/3.jpg')$q$, 1, 'Con la recompensa se publica la tercera');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,description,image_path) values ('a4800000-0000-0000-0000-0000000000f1','text','foto 4','a4800000-0000-0000-0000-0000000000f1/4.jpg')$q$, 'La cuarta vuelve a pedir recompensa');
select t.expect_json($q$select public.my_photo_quota()$q$, 'allowed', '3', 'El estado propio muestra 2 gratis + 1 extra');

-- Plus: lo da solo un pago verificado (service_role) y tiene más fotos sin anuncios.
reset role; set role service_role;
select t.expect_json($q$select jsonb_build_object('ok', public.monetization_set_membership('a4800000-0000-0000-0000-0000000000f2','active',now()+interval '30 days','google_play','token-test-123456','fittforma_plus_monthly'))$q$, 'ok', 'true', 'El backend activa Plus tras verificar el pago');
reset role; set role authenticated;
select t.as_user('a4800000-0000-0000-0000-0000000000f2');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,image_path) select 'a4800000-0000-0000-0000-0000000000f2','text','plus '||g,'a4800000-0000-0000-0000-0000000000f2/'||g||'.jpg' from generate_series(1,4) g$q$, 4, 'Plus publica más fotos sin anuncios');
select t.expect_json($q$select public.my_photo_quota()$q$, 'plan', 'plus', 'El estado indica Plus');
reset role; set role service_role;
select t.expect_json($q$select jsonb_build_object('ok', public.monetization_set_membership('a4800000-0000-0000-0000-0000000000f2','cancelled',now()-interval '1 day','google_play','token-test-123456'))$q$, 'ok', 'true', 'Cancelación o vencimiento');
reset role; set role authenticated;
select t.as_user('a4800000-0000-0000-0000-0000000000f2');
select t.expect_json($q$select public.my_photo_quota()$q$, 'plan', 'free', 'Al vencer vuelve a gratis');
reset role;
update public.monetization_settings set photo_limit_enabled = false;
\echo PRUEBAS v48 MONETIZACION PASARON
