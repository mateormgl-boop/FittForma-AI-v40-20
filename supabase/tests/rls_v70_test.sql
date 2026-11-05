-- Pruebas v70: la membresía de otra persona no se lee; la insignia Plus aparece solo si la persona la eligió.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email) values
  ('a7000000-0000-0000-0000-0000000000a1','pia70@example.test'),
  ('a7000000-0000-0000-0000-0000000000a2','quim70@example.test'),
  ('a7000000-0000-0000-0000-0000000000a3','rita70@example.test'),
  ('a7000000-0000-0000-0000-0000000000a4','sol70@example.test') on conflict do nothing;
update public.community_profiles set username='pia70', visibility='public' where user_id='a7000000-0000-0000-0000-0000000000a1';
update public.community_profiles set username='quim70', visibility='public' where user_id='a7000000-0000-0000-0000-0000000000a2';
update public.community_profiles set username='rita70', visibility='private' where user_id='a7000000-0000-0000-0000-0000000000a3';
update public.community_profiles set username='sol70', visibility='public' where user_id='a7000000-0000-0000-0000-0000000000a4';
-- Pía y Rita y Quim son Plus (escrito por el servidor de pagos); Sol no.
select public.monetization_set_membership('a7000000-0000-0000-0000-0000000000a1','active',now()+interval '20 days','google_play','tok-pia70','fittforma_plus_monthly');
select public.monetization_set_membership('a7000000-0000-0000-0000-0000000000a2','active',now()+interval '20 days','google_play','tok-quim70','fittforma_plus_monthly');
select public.monetization_set_membership('a7000000-0000-0000-0000-0000000000a3','active',now()+interval '20 days','google_play','tok-rita70','fittforma_plus_monthly');

set role authenticated;
select t.as_user('a7000000-0000-0000-0000-0000000000a4');
select t.expect_count($q$select * from public.community_memberships where user_id<>'a7000000-0000-0000-0000-0000000000a4'$q$,0,'v70 nadie lee la membresía de otra persona');
select t.expect_count($q$select * from public.community_plus_ids(array['a7000000-0000-0000-0000-0000000000a1','a7000000-0000-0000-0000-0000000000a2']::uuid[])$q$,0,'v70 sin elegir mostrarla, no hay insignia');
select t.as_user('a7000000-0000-0000-0000-0000000000a1');
select t.expect_count($q$select * from public.community_memberships where user_id='a7000000-0000-0000-0000-0000000000a1' and status='active'$q$,1,'v70 cada persona lee su propia membresía');
select t.expect_rows($q$update public.community_profiles set show_plus=true where user_id='a7000000-0000-0000-0000-0000000000a1'$q$,1,'v70 Pía elige mostrar su insignia');
select t.expect_error($q$insert into public.community_memberships(user_id,tier,status) values('a7000000-0000-0000-0000-0000000000a1','pro','active')$q$,'v70 nadie se da Plus a sí mismo');
select t.as_user('a7000000-0000-0000-0000-0000000000a3');
select t.expect_rows($q$update public.community_profiles set show_plus=true where user_id='a7000000-0000-0000-0000-0000000000a3'$q$,1,'v70 Rita (perfil privado) también la activa');
select t.as_user('a7000000-0000-0000-0000-0000000000a4');
select t.expect_rows($q$update public.community_profiles set show_plus=true where user_id='a7000000-0000-0000-0000-0000000000a4'$q$,1,'v70 Sol activa la opción aunque no sea Plus');
select t.expect_count($q$select * from public.community_plus_ids(array['a7000000-0000-0000-0000-0000000000a1','a7000000-0000-0000-0000-0000000000a2','a7000000-0000-0000-0000-0000000000a3','a7000000-0000-0000-0000-0000000000a4']::uuid[])$q$,1,'v70 solo Pía: Quim no eligió, Rita es privada para Sol y Sol no es Plus');
select t.expect_count($q$select * from public.community_plus_featured(10) where username in ('pia70','quim70','rita70','sol70')$q$,1,'v70 «Miembros Plus» muestra solo perfiles públicos Plus que eligieron mostrarse');
reset role; set role anon; select t.as_user(null);
select t.expect_error($q$select * from public.community_memberships$q$,'v70 sin sesión no se leen membresías');
select t.expect_count($q$select * from public.community_plus_featured(10) where username='pia70'$q$,1,'v70 sin sesión también se ve la fila de Miembros Plus (solo perfiles públicos)');
reset role;
do $$ begin raise notice 'PRUEBAS v70 PASARON'; end $$;
