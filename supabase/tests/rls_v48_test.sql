-- Pruebas v48: entrenamiento diario cada 12 horas, controlado por la base. Reusa el esquema t de rls_v41.
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
insert into auth.users(id,email) values
 ('a4800000-0000-0000-0000-000000000001','dia1@example.test'),
 ('a4800000-0000-0000-0000-000000000002','otra@example.test')
on conflict do nothing;

create or replace function t.expect_json(q text, path text, expected text, label text) returns void language plpgsql as $$
declare got jsonb; val text;
begin
  execute q into got;
  val := got #>> string_to_array(path, '.');
  if coalesce(val, '<null>') <> expected then raise exception 'FALLO: "%" → %=% (se esperaba %) · %', label, path, coalesce(val, '<null>'), expected, got; end if;
  raise notice 'OK %: % = %', label, path, val;
end $$;
grant execute on all functions in schema t to anon, authenticated;

set role anon;
select t.expect_error($q$select public.daily_training_status()$q$, 'Sin sesión no se consulta el estado diario');
select t.expect_error($q$select public.complete_daily_training('anon-123456',0,'Día',now(),'[]',10,10)$q$, 'Sin sesión no se completa un entrenamiento diario');

set role authenticated;
select t.as_user('a4800000-0000-0000-0000-000000000001');
select t.expect_json($q$select public.daily_training_status()$q$, 'available', 'true', 'Cuenta nueva: el entrenamiento diario 1 está disponible');
select t.expect_json($q$select public.complete_daily_training('sess-a-000001',0,'Cuerpo completo A',now()-interval '50 minutes','[{"name":"Sentadilla goblet","sets":3}]',5,10)$q$, 'reason', 'incomplete', 'Con 50 % de las series no cuenta como completo');
select t.expect_json($q$select public.complete_daily_training('sess-a-000001',0,'Cuerpo completo A',now()-interval '50 minutes','[{"name":"Sentadilla goblet","sets":3}]',9,10)$q$, 'seq', '1', 'Entrenamiento diario 1 completado');
select t.expect_json($q$select public.complete_daily_training('sess-a-000001',0,'Cuerpo completo A',now()-interval '50 minutes','[]',9,10)$q$, 'duplicate', 'true', 'Reintento de la misma sesión: no duplica');
select t.expect_json($q$select public.complete_daily_training('sess-a-000002',1,'Cuerpo completo B',now()-interval '40 minutes','[]',10,10)$q$, 'reason', 'cooldown', 'Antes de 12 horas no se habilita el entrenamiento 2');
select t.expect_json($q$select public.daily_training_status()$q$, 'available', 'false', 'El estado indica que todavía no está disponible');
select t.expect_count($q$select 1 from public.daily_training_sessions$q$, 1, 'Una sola sesión diaria registrada');
select t.expect_count($q$select 1 from public.daily_training_sessions where next_available_at = completed_at + interval '12 hours'$q$, 1, 'La próxima habilitación es exactamente 12 horas después');
select t.expect_error($q$insert into public.daily_training_sessions(user_id,seq,client_session_id,plan_day_index,plan_day_title,started_at,completed_sets,total_sets,next_available_at) values('a4800000-0000-0000-0000-000000000001',2,'manual-x1',1,'Trampa',now(),10,10,now())$q$, 'No se puede insertar una sesión diaria directamente');
select t.expect_error($q$update public.daily_training_progress set next_available_at = now() - interval '1 minute'$q$, 'No se puede adelantar la próxima habilitación');

-- La otra cuenta no ve ni comparte el progreso.
select t.as_user('a4800000-0000-0000-0000-000000000002');
select t.expect_count($q$select 1 from public.daily_training_sessions$q$, 0, 'Otra cuenta no ve sesiones ajenas');
select t.expect_json($q$select public.daily_training_status()$q$, 'seq', '0', 'Otra cuenta empieza en 0');

-- Simular que pasaron 12 horas (solo el administrador de la prueba puede hacerlo).
reset role;
update public.daily_training_progress set next_available_at = now() - interval '1 second' where user_id = 'a4800000-0000-0000-0000-000000000001';
set role authenticated;
select t.as_user('a4800000-0000-0000-0000-000000000001');
select t.expect_json($q$select public.complete_daily_training('sess-a-000002',1,'Cuerpo completo B',now()-interval '40 minutes','[]',10,10)$q$, 'seq', '2', 'Pasadas las 12 horas se completa el entrenamiento 2');
select t.expect_json($q$select public.complete_daily_training('sess-a-000003',2,'Cuerpo completo C',now(),'[]',10,10)$q$, 'reason', 'cooldown', 'El entrenamiento 3 vuelve a esperar 12 horas');
select t.expect_count($q$select 1 from public.daily_training_sessions where started_at >= now() - interval '6 hours'$q$, 2, 'La hora de inicio informada se acota a las últimas 6 horas');
reset role;
select t.expect_count($q$select 1 from public.daily_training_sessions where user_id='a4800000-0000-0000-0000-000000000001' and seq in (1,2)$q$, 2, 'Secuencia 1 y 2 sin huecos ni duplicados');
\echo PRUEBAS v48 PASARON
