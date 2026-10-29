-- Pruebas v67: tres funciones solo con sesión; sin sesión se siguen viendo perfiles y publicaciones públicas.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
  ('a6700000-0000-0000-0000-0000000000a1','ana67@example.test','{"full_name":"Ana"}') on conflict do nothing;
update public.community_profiles set username='ana67', visibility='public' where user_id='a6700000-0000-0000-0000-0000000000a1';
insert into public.community_posts(user_id,post_kind,description,visibility) values('a6700000-0000-0000-0000-0000000000a1','text','Hola v67','public');

select t.expect_value($q$select (not has_function_privilege('anon','public.community_are_mutual_follows(uuid,uuid)','execute'))::text$q$,'true','v67 sin sesión no se llama community_are_mutual_follows');
select t.expect_value($q$select (not has_function_privilege('anon','public.community_is_moderator()','execute'))::text$q$,'true','v67 sin sesión no se llama community_is_moderator');
select t.expect_value($q$select (not has_function_privilege('anon','public.community_suggested_profiles()','execute'))::text$q$,'true','v67 sin sesión no se llama community_suggested_profiles');
select t.expect_value($q$select (has_function_privilege('authenticated','public.community_are_mutual_follows(uuid,uuid)','execute') and has_function_privilege('authenticated','public.community_is_moderator()','execute') and has_function_privilege('authenticated','public.community_suggested_profiles()','execute'))::text$q$,'true','v67 con sesión se siguen pudiendo usar');

set role anon; select t.as_user(null);
select t.expect_error($q$select public.community_is_moderator()$q$,'v67 anon: community_is_moderator rechazada');
select t.expect_error($q$select * from public.community_suggested_profiles()$q$,'v67 anon: sugeridas rechazada');
select t.expect_count($q$select 1 from public.community_profiles where user_id='a6700000-0000-0000-0000-0000000000a1'$q$,1,'v67 sin sesión se sigue viendo un perfil público');
select t.expect_count($q$select 1 from public.community_posts where user_id='a6700000-0000-0000-0000-0000000000a1'$q$,1,'v67 sin sesión se sigue viendo una publicación pública');
reset role; set role authenticated;
select t.as_user('a6700000-0000-0000-0000-0000000000a1');
select t.expect_value($q$select public.community_is_moderator()::text$q$,'false','v67 con sesión: moderación responde');
select t.expect_value($q$select 'ok' from (select count(*) from public.community_suggested_profiles()) x$q$,'ok','v67 con sesión: sugeridas responde');
reset role;
do $$ begin raise notice 'PRUEBAS v67 PASARON'; end $$;
