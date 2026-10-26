-- Pruebas v52: ranking de rangos con amigos. Opcional, solo lo propio se escribe, y solo se ve el de quienes seguís
-- con solicitud aceptada y sin bloqueos.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
  ('a5200000-0000-0000-0000-0000000000e1','ana52@example.test','{"full_name":"Ana"}'),
  ('a5200000-0000-0000-0000-0000000000e2','beto52@example.test','{"full_name":"Beto"}'),
  ('a5200000-0000-0000-0000-0000000000e3','caro52@example.test','{"full_name":"Caro"}'),
  ('a5200000-0000-0000-0000-0000000000e4','dani52@example.test','{"full_name":"Dani"}') on conflict do nothing;
update public.community_profiles set username='ana52' where user_id='a5200000-0000-0000-0000-0000000000e1';
update public.community_profiles set username='beto52' where user_id='a5200000-0000-0000-0000-0000000000e2';
update public.community_profiles set username='caro52', visibility='private' where user_id='a5200000-0000-0000-0000-0000000000e3';
update public.community_profiles set username='dani52' where user_id='a5200000-0000-0000-0000-0000000000e4';
-- Ana sigue a Beto (aceptado), a Caro (privada: queda pendiente) y a Dani (aceptado, pero Dani después la bloquea).
insert into public.community_follows(follower_id,following_id,status) values
  ('a5200000-0000-0000-0000-0000000000e1','a5200000-0000-0000-0000-0000000000e2','accepted'),
  ('a5200000-0000-0000-0000-0000000000e1','a5200000-0000-0000-0000-0000000000e3','pending'),
  ('a5200000-0000-0000-0000-0000000000e1','a5200000-0000-0000-0000-0000000000e4','accepted') on conflict do nothing;

set role anon;
select t.expect_error($q$insert into public.community_rank_shares(user_id,overall_rank) values('a5200000-0000-0000-0000-0000000000e1',3)$q$,'Sin sesión no se puede compartir');
select t.expect_error($q$select * from public.community_rank_board()$q$,'Sin sesión no se ve el ranking');

set role authenticated;
select t.as_user('a5200000-0000-0000-0000-0000000000e1');
select t.expect_count($q$select 1 from public.community_rank_shares$q$,0,'Nadie comparte por defecto');
select t.expect_error($q$insert into public.community_rank_shares(user_id,overall_rank) values('a5200000-0000-0000-0000-0000000000e2',8)$q$,'No se puede escribir el rango de otra persona');
select t.expect_error($q$insert into public.community_rank_shares(user_id,overall_rank) values('a5200000-0000-0000-0000-0000000000e1',12)$q$,'Rango fuera de escala rechazado');
select t.expect_rows($q$insert into public.community_rank_shares(user_id,overall_rank,median_sets,balance,ranked_muscles) values('a5200000-0000-0000-0000-0000000000e1',3,55,60,18)$q$,1,'Ana comparte su rango');
select t.as_user('a5200000-0000-0000-0000-0000000000e2');
select t.expect_rows($q$insert into public.community_rank_shares(user_id,overall_rank,median_sets) values('a5200000-0000-0000-0000-0000000000e2',4,95)$q$,1,'Beto comparte');
select t.as_user('a5200000-0000-0000-0000-0000000000e3');
select t.expect_rows($q$insert into public.community_rank_shares(user_id,overall_rank,median_sets) values('a5200000-0000-0000-0000-0000000000e3',6,200)$q$,1,'Caro comparte');
select t.as_user('a5200000-0000-0000-0000-0000000000e4');
select t.expect_rows($q$insert into public.community_rank_shares(user_id,overall_rank,median_sets) values('a5200000-0000-0000-0000-0000000000e4',5,120)$q$,1,'Dani comparte');
select t.expect_rows($q$insert into public.community_blocks(blocker_id,blocked_id) values('a5200000-0000-0000-0000-0000000000e4','a5200000-0000-0000-0000-0000000000e1')$q$,1,'Dani bloquea a Ana');
select t.expect_count($q$select 1 from public.community_rank_shares where user_id<>'a5200000-0000-0000-0000-0000000000e4'$q$,0,'La tabla no deja leer filas ajenas');

select t.as_user('a5200000-0000-0000-0000-0000000000e1');
select t.expect_count($q$select 1 from public.community_rank_board()$q$,2,'Ana ve su rango y el de Beto (seguido aceptado)');
select t.expect_count($q$select 1 from public.community_rank_board() where username='caro52'$q$,0,'Solicitud pendiente: no ve el rango');
select t.expect_count($q$select 1 from public.community_rank_board() where username='dani52'$q$,0,'Con bloqueo: no ve el rango');
select t.expect_count($q$select 1 from (select username, row_number() over () n from public.community_rank_board()) x where (username='beto52' and n=1) or (username='ana52' and n=2)$q$,2,'Orden por rango');
select t.expect_rows($q$update public.community_rank_shares set overall_rank=5 where user_id='a5200000-0000-0000-0000-0000000000e1'$q$,1,'Ana actualiza su rango');
select t.expect_rows($q$update public.community_rank_shares set overall_rank=0 where user_id='a5200000-0000-0000-0000-0000000000e2'$q$,0,'Ana no puede cambiar el de Beto');
select t.as_user('a5200000-0000-0000-0000-0000000000e2');
select t.expect_count($q$select 1 from public.community_rank_board() where username='ana52'$q$,0,'Beto no sigue a Ana: no ve su rango');
select t.as_user('a5200000-0000-0000-0000-0000000000e1');
select t.expect_rows($q$delete from public.community_rank_shares where user_id='a5200000-0000-0000-0000-0000000000e1'$q$,1,'Ana deja de compartir (se borra)');
select t.expect_count($q$select 1 from public.community_rank_board() where is_self$q$,0,'Ya no aparece');
reset role;
do $$ begin raise notice 'PRUEBAS v52 RANKING PASARON'; end $$;
