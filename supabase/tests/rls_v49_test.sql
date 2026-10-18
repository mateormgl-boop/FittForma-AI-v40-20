-- Pruebas v49: logros compartidos con las medidas nuevas (carga relativa, entrenamientos, racha) y la fuente
-- «registrada en sesión». Se siguen rechazando «verified», claves extra y rangos incoherentes.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email) values ('a4900000-0000-0000-0000-0000000000b1','insignias49@example.test') on conflict do nothing;
insert into public.community_profiles(user_id,username,display_name,visibility) values ('a4900000-0000-0000-0000-0000000000b1','insignias49','Insignias','public') on conflict (user_id) do nothing;

set role authenticated;
select t.as_user('a4900000-0000-0000-0000-0000000000b1');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,achievement) values('a4900000-0000-0000-0000-0000000000b1','achievement','{"exerciseId":"load-press-banca","exerciseName":"Press de banca · carga","category":"strength","rank":"gold","level":8,"threshold":1.0,"measure":"bw","evidence":"session","earnedAt":"2026-10-18"}')$q$,1,'Logro por carga relativa registrado en sesión');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,achievement) values('a4900000-0000-0000-0000-0000000000b1','achievement','{"exerciseId":"consistency-streak","exerciseName":"Racha de días activos","category":"consistency","rank":"bronze","level":2,"threshold":3,"measure":"streak","evidence":"declared","earnedAt":"2026-10-18"}')$q$,1,'Logro de racha');
select t.expect_rows($q$insert into public.community_posts(user_id,post_kind,achievement) values('a4900000-0000-0000-0000-0000000000b1','achievement','{"exerciseId":"consistency-sessions","exerciseName":"Entrenamientos completados","category":"consistency","rank":"silver","level":4,"threshold":10,"measure":"sessions","evidence":"session","earnedAt":"2026-10-18"}')$q$,1,'Logro de entrenamientos completados');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('a4900000-0000-0000-0000-0000000000b1','achievement','{"exerciseId":"load-press-banca","exerciseName":"Press de banca · carga","rank":"diamond","level":12,"threshold":9,"measure":"bw","evidence":"session","earnedAt":"2026-10-18"}')$q$,'Carga relativa imposible (9× el peso corporal)');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('a4900000-0000-0000-0000-0000000000b1','achievement','{"exerciseId":"load-press-banca","exerciseName":"Press de banca · carga","rank":"gold","level":8,"threshold":1,"measure":"bw","evidence":"verified","earnedAt":"2026-10-18"}')$q$,'«verified» sigue prohibido');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('a4900000-0000-0000-0000-0000000000b1','achievement','{"exerciseId":"load-press-banca","exerciseName":"Press de banca · carga","rank":"gold","level":8,"threshold":1,"measure":"bw","evidence":"gps_device","earnedAt":"2026-10-18"}')$q$,'GPS solo para distancia');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('a4900000-0000-0000-0000-0000000000b1','achievement','{"exerciseId":"load-press-banca","exerciseName":"Press de banca · carga","rank":"silver","level":8,"threshold":1,"measure":"bw","evidence":"session","earnedAt":"2026-10-18"}')$q$,'Rango incoherente con el nivel');
select t.expect_error($q$insert into public.community_posts(user_id,post_kind,achievement) values('a4900000-0000-0000-0000-0000000000b1','achievement','{"exerciseId":"load-press-banca","exerciseName":"Press de banca · carga","rank":"gold","level":8,"threshold":1,"measure":"kg_total","evidence":"session","earnedAt":"2026-10-18"}')$q$,'Medida desconocida');
reset role;
\echo PRUEBAS v49 INSIGNIAS PASARON
