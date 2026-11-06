-- Pruebas v72: aceptación de las normas de la comunidad. Cada persona registra y lee solo la suya;
-- la fecha la pone la base y no se puede bajar de versión.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email) values
  ('a7200000-0000-0000-0000-0000000000b1','tito72@example.test'),
  ('a7200000-0000-0000-0000-0000000000b2','uma72@example.test') on conflict do nothing;

set role authenticated;
select t.as_user('a7200000-0000-0000-0000-0000000000b1');
select t.expect_count($q$select * from public.community_rules_acceptance$q$,0,'v72 al principio nadie aceptó');
select t.expect_rows($q$insert into public.community_rules_acceptance(user_id,rules_version,accepted_at) values('a7200000-0000-0000-0000-0000000000b1',1,'2000-01-01')$q$,1,'v72 Tito acepta la versión 1');
select t.expect_count($q$select * from public.community_rules_acceptance where accepted_at > now() - interval '1 minute'$q$,1,'v72 la fecha la pone la base, no el teléfono');
select t.expect_error($q$insert into public.community_rules_acceptance(user_id,rules_version) values('a7200000-0000-0000-0000-0000000000b2',1)$q$,'v72 nadie acepta en nombre de otra persona');
select t.expect_error($q$insert into public.community_rules_acceptance(user_id,rules_version) values('a7200000-0000-0000-0000-0000000000b1',0)$q$,'v72 la versión tiene que ser válida');
select t.expect_rows($q$update public.community_rules_acceptance set rules_version=0 where user_id='a7200000-0000-0000-0000-0000000000b1'$q$,1,'v72 intentar bajar la versión no tiene efecto');
select t.expect_count($q$select * from public.community_rules_acceptance where rules_version=1$q$,1,'v72 sigue en la versión 1');
select t.expect_rows($q$update public.community_rules_acceptance set rules_version=1 where user_id='a7200000-0000-0000-0000-0000000000b1'$q$,1,'v72 volver a aceptar la misma versión no cambia nada');
select t.expect_error($q$update public.community_rules_acceptance set accepted_at='2000-01-01' where user_id='a7200000-0000-0000-0000-0000000000b1'$q$,'v72 la fecha no se puede tocar a mano');
select t.expect_rows($q$update public.community_rules_acceptance set rules_version=2 where user_id='a7200000-0000-0000-0000-0000000000b1'$q$,1,'v72 aceptar una versión nueva');
select t.expect_count($q$select * from public.community_rules_acceptance where rules_version=2$q$,1,'v72 queda la versión nueva');

select t.as_user('a7200000-0000-0000-0000-0000000000b2');
select t.expect_count($q$select * from public.community_rules_acceptance$q$,0,'v72 Uma no ve la aceptación de Tito');
select t.expect_rows($q$update public.community_rules_acceptance set rules_version=5 where user_id='a7200000-0000-0000-0000-0000000000b1'$q$,0,'v72 Uma no cambia la aceptación de Tito');
select t.expect_error($q$delete from public.community_rules_acceptance where user_id='a7200000-0000-0000-0000-0000000000b1'$q$,'v72 nadie borra aceptaciones a mano (se borran solo al eliminar la cuenta)');

reset role; set role anon; select t.as_user(null);
select t.expect_error($q$select * from public.community_rules_acceptance$q$,'v72 sin sesión no se lee nada');

reset role;
select t.expect_count($q$select * from public.community_rules_acceptance where user_id='a7200000-0000-0000-0000-0000000000b1' and rules_version=2$q$,1,'v72 la versión no baja');
delete from auth.users where id='a7200000-0000-0000-0000-0000000000b1';
select t.expect_count($q$select * from public.community_rules_acceptance where user_id='a7200000-0000-0000-0000-0000000000b1'$q$,0,'v72 al eliminar la cuenta se borra su aceptación');
do $$ begin raise notice 'PRUEBAS v72 PASARON'; end $$;
