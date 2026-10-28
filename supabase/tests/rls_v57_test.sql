-- Pruebas v57: insignias de 15 niveles con rango «Legendario». Lo anterior sigue siendo válido.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email) values ('a5700000-0000-0000-0000-0000000000d1','lena57@example.test') on conflict do nothing;
insert into public.community_profiles(user_id,username,display_name,visibility) values
  ('a5700000-0000-0000-0000-0000000000d1','lena57','Lena','public') on conflict (user_id) do nothing;
set role authenticated;
select t.as_user('a5700000-0000-0000-0000-0000000000d1');
select t.expect_rows($q$update public.community_profiles set featured_badges='[{"exerciseId":"exercise-dominadas","exerciseName":"Dominadas","category":"calisthenics","rank":"legend","level":15,"measure":"reps"},{"exerciseId":"exercise-flexiones","exerciseName":"Flexiones","category":"calisthenics","rank":"legend","level":13,"measure":"reps"},{"exerciseId":"load-press-banca","exerciseName":"Press de banca · carga","category":"strength","rank":"diamond","level":12,"measure":"bw"}]' where user_id='a5700000-0000-0000-0000-0000000000d1'$q$,1,'Se destacan insignias Legendario (13 y 15) y Diamante 12');
select t.expect_error($q$update public.community_profiles set featured_badges='[{"exerciseId":"a","exerciseName":"A","rank":"diamond","level":13}]' where user_id='a5700000-0000-0000-0000-0000000000d1'$q$,'Nivel 13 con rango que no corresponde');
select t.expect_error($q$update public.community_profiles set featured_badges='[{"exerciseId":"a","exerciseName":"A","rank":"legend","level":16}]' where user_id='a5700000-0000-0000-0000-0000000000d1'$q$,'No existe el nivel 16');
select t.expect_error($q$update public.community_profiles set featured_badges='[{"exerciseId":"a","exerciseName":"A","rank":"legend","level":12}]' where user_id='a5700000-0000-0000-0000-0000000000d1'$q$,'Legendario no es el nivel 12');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,achievement,visibility) values('a5700000-0000-0000-0000-0000000000d1','achievement','30 dominadas','{"exerciseId":"exercise-dominadas","exerciseName":"Dominadas","category":"calisthenics","rank":"legend","level":14,"threshold":30,"measure":"reps","evidence":"declared","earnedAt":"2026-10-28"}','public')$q$,1,'Publicar un logro Legendario II');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,description,achievement,visibility) values('a5700000-0000-0000-0000-0000000000d1','achievement','5 dominadas','{"exerciseId":"exercise-dominadas","exerciseName":"Dominadas","category":"calisthenics","rank":"bronze","level":2,"threshold":2,"measure":"reps","evidence":"declared","earnedAt":"2026-10-28"}','public')$q$,1,'Los logros de antes (Bronce) siguen siendo válidos');
reset role;
do $$ begin raise notice 'PRUEBAS v57 PASARON'; end $$;
