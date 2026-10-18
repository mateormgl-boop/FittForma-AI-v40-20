-- FittForma AI v48 — progresión de entrenamientos diarios (una sesión diaria cada 12 horas).
-- Requiere schema.sql. ADITIVA y re-ejecutable: crea tablas y funciones nuevas, no modifica ni borra datos.
--
-- Reglas que aplica la base (no el navegador):
--   * La hora de finalización y la próxima habilitación las pone el servidor con now(); la hora del
--     teléfono no interviene.
--   * Una cuenta no puede completar otro entrenamiento diario hasta que pasen 12 horas desde el último.
--   * Las solicitudes repetidas o simultáneas no duplican: la fila de progreso se bloquea (FOR UPDATE),
--     cada número de secuencia es único y el mismo client_session_id devuelve el mismo resultado.
--   * Solo cuenta como completa si se hizo al menos el 70 % de las series planificadas (dato declarado
--     por la app; no hay forma de verificar físicamente las series).
--   * Las rutinas adicionales, propias, libres o manuales NO pasan por aquí: no mueven la progresión.
-- Nadie puede escribir estas tablas directamente: solo a través de las funciones.

begin;

create table if not exists public.daily_training_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seq integer not null default 0 check (seq >= 0),
  last_completed_at timestamptz,
  next_available_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seq integer not null check (seq >= 1),
  client_session_id text not null check (char_length(client_session_id) between 6 and 64),
  plan_day_index integer not null check (plan_day_index between 0 and 6),
  plan_day_title text not null check (char_length(plan_day_title) between 1 and 80),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  status text not null default 'completed' check (status in ('completed')),
  exercises jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array' and pg_column_size(exercises) <= 20000),
  completed_sets integer not null check (completed_sets between 0 and 400),
  total_sets integer not null check (total_sets between 1 and 400),
  reward_xp integer not null default 50,
  next_available_at timestamptz not null,
  unique (user_id, seq),
  unique (user_id, client_session_id)
);
create index if not exists daily_training_sessions_user_completed on public.daily_training_sessions(user_id, completed_at desc);

alter table public.daily_training_progress enable row level security;
alter table public.daily_training_sessions enable row level security;
revoke all on public.daily_training_progress from anon, authenticated;
revoke all on public.daily_training_sessions from anon, authenticated;
grant select on public.daily_training_progress to authenticated;
grant select on public.daily_training_sessions to authenticated;

drop policy if exists daily_progress_read_own on public.daily_training_progress;
create policy daily_progress_read_own on public.daily_training_progress for select to authenticated using (user_id = auth.uid());
drop policy if exists daily_sessions_read_own on public.daily_training_sessions;
create policy daily_sessions_read_own on public.daily_training_sessions for select to authenticated using (user_id = auth.uid());

-- Estado actual con la hora del servidor.
create or replace function public.daily_training_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.daily_training_progress;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into p from public.daily_training_progress where user_id = uid;
  return jsonb_build_object(
    'seq', coalesce(p.seq, 0),
    'last_completed_at', p.last_completed_at,
    'next_available_at', p.next_available_at,
    'server_now', now(),
    'available', p.next_available_at is null or now() >= p.next_available_at
  );
end $$;

-- Registrar un entrenamiento diario completo.
create or replace function public.complete_daily_training(
  p_client_session_id text,
  p_plan_day_index integer,
  p_plan_day_title text,
  p_started_at timestamptz,
  p_exercises jsonb,
  p_completed_sets integer,
  p_total_sets integer
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.daily_training_progress;
  existing public.daily_training_sessions;
  started timestamptz;
  next_at timestamptz;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_client_session_id is null or char_length(p_client_session_id) not between 6 and 64 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  -- Bloquear la fila de progreso de esta cuenta: las solicitudes simultáneas se atienden de a una.
  insert into public.daily_training_progress(user_id) values (uid) on conflict (user_id) do nothing;
  select * into p from public.daily_training_progress where user_id = uid for update;

  -- Reintento de la misma sesión: misma respuesta, sin duplicar.
  select * into existing from public.daily_training_sessions where user_id = uid and client_session_id = p_client_session_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'seq', existing.seq, 'completed_at', existing.completed_at,
      'next_available_at', existing.next_available_at, 'server_now', now());
  end if;

  if p.next_available_at is not null and now() < p.next_available_at then
    return jsonb_build_object('ok', false, 'reason', 'cooldown', 'seq', p.seq, 'next_available_at', p.next_available_at, 'server_now', now());
  end if;

  if p_total_sets is null or p_total_sets < 1 or p_total_sets > 400 or p_completed_sets is null or p_completed_sets < 0 or p_completed_sets > p_total_sets then
    return jsonb_build_object('ok', false, 'reason', 'invalid_sets');
  end if;
  if p_completed_sets::numeric / p_total_sets < 0.7 then
    return jsonb_build_object('ok', false, 'reason', 'incomplete', 'server_now', now());
  end if;
  if p_plan_day_index is null or p_plan_day_index not between 0 and 6 or p_plan_day_title is null or char_length(trim(p_plan_day_title)) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_day');
  end if;

  -- La hora de inicio la informa la app; se acota a las últimas 6 horas y nunca al futuro.
  started := least(greatest(coalesce(p_started_at, now()), now() - interval '6 hours'), now());
  next_at := now() + interval '12 hours';

  insert into public.daily_training_sessions(user_id, seq, client_session_id, plan_day_index, plan_day_title, started_at, completed_at,
    exercises, completed_sets, total_sets, reward_xp, next_available_at)
  values (uid, p.seq + 1, p_client_session_id, p_plan_day_index, trim(p_plan_day_title), started, now(),
    case when jsonb_typeof(p_exercises) = 'array' and pg_column_size(p_exercises) <= 20000 then p_exercises else '[]'::jsonb end,
    p_completed_sets, p_total_sets, 50, next_at);

  update public.daily_training_progress
     set seq = p.seq + 1, last_completed_at = now(), next_available_at = next_at, updated_at = now()
   where user_id = uid;

  return jsonb_build_object('ok', true, 'duplicate', false, 'seq', p.seq + 1, 'completed_at', now(), 'next_available_at', next_at, 'server_now', now());
end $$;

revoke all on function public.daily_training_status() from public, anon;
revoke all on function public.complete_daily_training(text, integer, text, timestamptz, jsonb, integer, integer) from public, anon;
grant execute on function public.daily_training_status() to authenticated;
grant execute on function public.complete_daily_training(text, integer, text, timestamptz, jsonb, integer, integer) to authenticated;

commit;
