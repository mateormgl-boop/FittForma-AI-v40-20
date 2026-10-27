-- FittForma AI v54 — Comunidad: ranking de esta semana, reto semanal entre amigos, evolución semanal para comparar,
-- avisos (campanita) e historial privado de «Mi físico».
-- ADITIVA y re-ejecutable: columnas opcionales, tablas y funciones nuevas. No borra ni cambia datos, tablas, funciones
-- ni políticas existentes. RLS activo. Requiere las migraciones v53 (2026-10-27 y 2026-10-28).

begin;

-- 1. Semana actual (lunes a domingo) en las estadísticas. La semana la fija el servidor a partir de stats_date.
alter table public.community_athlete_stats add column if not exists week_start date;
alter table public.community_athlete_stats add column if not exists active_days_week smallint not null default 0;
alter table public.community_athlete_stats add column if not exists workouts_week smallint not null default 0;
alter table public.community_athlete_stats add column if not exists run_km_week numeric(6,2) not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'athlete_stats_week_valid') then
    alter table public.community_athlete_stats add constraint athlete_stats_week_valid check (
      active_days_week between 0 and 7 and workouts_week between 0 and 60 and run_km_week between 0 and 500
      and active_days_week <= workouts_week and active_days_week <= active_days_30d
      and workouts_week <= workouts_30d and run_km_week <= run_km_30d);
  end if;
end $$;

create or replace function public.community_athlete_week_set()
returns trigger language plpgsql set search_path = public as $$
begin
  new.week_start := date_trunc('week', new.stats_date)::date;
  return new;
end; $$;
revoke all on function public.community_athlete_week_set() from public, anon, authenticated;
drop trigger if exists community_athlete_week_set on public.community_athlete_stats;
create trigger community_athlete_week_set before insert or update on public.community_athlete_stats
  for each row execute function public.community_athlete_week_set();

-- 2. Historial semanal (una fila por persona y semana; la última actualización de la semana queda guardada).
create table if not exists public.community_athlete_weekly (
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  week_start date not null,
  active_days smallint not null default 0,
  workouts smallint not null default 0,
  run_km numeric(6,2) not null default 0,
  overall_rank smallint not null default -1,
  xp_level integer not null default 1,
  badges_count integer not null default 0,
  best_pushups smallint not null default 0,
  best_pullups smallint not null default 0,
  best_air_squats smallint not null default 0,
  best_plank_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table public.community_athlete_weekly enable row level security;
revoke all on public.community_athlete_weekly from anon, authenticated;

create or replace function public.community_athlete_weekly_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.week_start is null then return new; end if;
  insert into public.community_athlete_weekly as w (user_id, week_start, active_days, workouts, run_km, overall_rank, xp_level,
      badges_count, best_pushups, best_pullups, best_air_squats, best_plank_seconds, updated_at)
  values (new.user_id, new.week_start, new.active_days_week, new.workouts_week, new.run_km_week, new.overall_rank, new.xp_level,
      new.badges_count, new.best_pushups, new.best_pullups, new.best_air_squats, new.best_plank_seconds, now())
  on conflict (user_id, week_start) do update set active_days = excluded.active_days, workouts = excluded.workouts,
      run_km = excluded.run_km, overall_rank = excluded.overall_rank, xp_level = excluded.xp_level,
      badges_count = excluded.badges_count, best_pushups = excluded.best_pushups, best_pullups = excluded.best_pullups,
      best_air_squats = excluded.best_air_squats, best_plank_seconds = excluded.best_plank_seconds, updated_at = now();
  return new;
end; $$;
revoke all on function public.community_athlete_weekly_snapshot() from public, anon, authenticated;
drop trigger if exists community_athlete_weekly_snapshot on public.community_athlete_stats;
create trigger community_athlete_weekly_snapshot after insert or update on public.community_athlete_stats
  for each row execute function public.community_athlete_weekly_snapshot();

-- Evolución semanal de una persona (para comparar). Misma regla que las estadísticas: visibles y no ocultas.
create or replace function public.community_weekly_history(p_user uuid, p_weeks integer default 8)
returns table (week_start date, active_days smallint, workouts smallint, run_km numeric, overall_rank smallint,
               best_pushups smallint, best_pullups smallint, best_air_squats smallint, best_plank_seconds integer)
language sql stable security definer set search_path = public as $$
  select w.week_start, w.active_days, w.workouts, w.run_km, w.overall_rank, w.best_pushups, w.best_pullups, w.best_air_squats, w.best_plank_seconds
  from public.community_athlete_weekly w
  join public.community_athlete_stats s on s.user_id = w.user_id
  where w.user_id = p_user
    and w.week_start > date_trunc('week', current_date)::date - (least(greatest(coalesce(p_weeks, 8), 1), 26) * 7)
    and public.community_can_view_profile(p_user, auth.uid())
    and (s.stats_public or p_user = auth.uid())
  order by w.week_start
$$;
revoke all on function public.community_weekly_history(uuid, integer) from public;
grant execute on function public.community_weekly_history(uuid, integer) to anon, authenticated;

-- 3. Ranking de esta semana: días activos, entrenamientos o km de running entre el lunes y hoy.
create or replace function public.community_week_board(p_category text, p_scope text default 'all', p_limit integer default 50)
returns table (pos bigint, user_id uuid, username text, display_name text, avatar_path text, training_level text,
               overall_rank smallint, featured_badges jsonb, value numeric, is_self boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_category not in ('active','workouts','running') then
    raise exception 'Categoría semanal desconocida' using errcode = '22023';
  end if;
  if coalesce(p_scope, 'all') not in ('all','friends') then
    raise exception 'Alcance de ranking desconocido' using errcode = '22023';
  end if;
  return query
  with v as (select auth.uid() as viewer),
  c as (
    select s.user_id, p.username, p.display_name, p.avatar_path, s.training_level, s.overall_rank, coalesce(p.featured_badges, '[]'::jsonb) as fb,
      (case p_category when 'active' then s.active_days_week::numeric when 'workouts' then s.workouts_week::numeric else s.run_km_week end) as val,
      coalesce(s.user_id = v.viewer, false) as me
    from public.community_athlete_stats s
    join public.community_profiles p on p.user_id = s.user_id, v
    where s.stats_public
      and s.week_start = date_trunc('week', current_date)::date
      and public.community_can_view_profile(s.user_id, v.viewer)
      and (coalesce(p_scope, 'all') = 'all' or (v.viewer is not null and (s.user_id = v.viewer or exists (
            select 1 from public.community_follows f where f.follower_id = v.viewer and f.following_id = s.user_id and f.status = 'accepted'))))
  )
  select rank() over (order by c.val desc), c.user_id, c.username, c.display_name, c.avatar_path, c.training_level, c.overall_rank, c.fb, c.val, c.me
  from c where c.val > 0
  order by c.val desc, c.username asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end; $$;
revoke all on function public.community_week_board(text, text, integer) from public;
grant execute on function public.community_week_board(text, text, integer) to anon, authenticated;

-- Ganador/es del reto de la semana pasada (más días activos) entre vos y las personas que seguís.
create or replace function public.community_week_winners()
returns table (week_start date, user_id uuid, username text, display_name text, avatar_path text, active_days smallint, is_self boolean)
language sql stable security definer set search_path = public as $$
  with v as (select auth.uid() as viewer, (date_trunc('week', current_date)::date - 7) as wk),
  c as (
    select w.week_start, w.user_id, p.username, p.display_name, p.avatar_path, w.active_days, w.user_id = v.viewer as me
    from public.community_athlete_weekly w
    join public.community_athlete_stats s on s.user_id = w.user_id
    join public.community_profiles p on p.user_id = w.user_id, v
    where v.viewer is not null and w.week_start = v.wk and w.active_days > 0 and s.stats_public
      and public.community_can_view_profile(w.user_id, v.viewer)
      and (w.user_id = v.viewer or exists (select 1 from public.community_follows f where f.follower_id = v.viewer and f.following_id = w.user_id and f.status = 'accepted'))
  )
  select c.week_start, c.user_id, c.username, c.display_name, c.avatar_path, c.active_days, c.me
  from c where c.active_days = (select max(active_days) from c)
  order by c.username
  limit 5
$$;
revoke all on function public.community_week_winners() from public, anon;
grant execute on function public.community_week_winners() to authenticated;

-- 4. Avisos (campanita). Los crea solo el servidor; cada persona lee, marca como leídos o borra los suyos.
create table if not exists public.community_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('follow','follow_request','follow_accepted','message','rank_passed')),
  actor_id uuid not null references public.community_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists community_notifications_user_idx on public.community_notifications(user_id, created_at desc);
alter table public.community_notifications enable row level security;
drop policy if exists notifications_select_own on public.community_notifications;
create policy notifications_select_own on public.community_notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.community_notifications;
create policy notifications_update_own on public.community_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete_own on public.community_notifications;
create policy notifications_delete_own on public.community_notifications for delete to authenticated using (user_id = auth.uid());
revoke all on public.community_notifications from anon, authenticated;
grant select, delete on public.community_notifications to authenticated;
grant update (read_at) on public.community_notifications to authenticated;

create or replace function public.community_notify(p_user uuid, p_kind text, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor or public.community_users_blocked(p_user, p_actor) then return; end if;
  -- Sin duplicados: si ya hay un aviso igual sin leer del mismo día, solo se actualiza la hora.
  update public.community_notifications set created_at = now()
   where user_id = p_user and kind = p_kind and actor_id = p_actor and read_at is null and created_at > now() - interval '1 day';
  if not found then
    insert into public.community_notifications(user_id, kind, actor_id) values (p_user, p_kind, p_actor);
  end if;
end; $$;
revoke all on function public.community_notify(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.community_notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.community_notify(new.following_id, case when new.status = 'accepted' then 'follow' else 'follow_request' end, new.follower_id);
  elsif old.status = 'pending' and new.status = 'accepted' then
    perform public.community_notify(new.follower_id, 'follow_accepted', new.following_id);
  end if;
  return new;
end; $$;
revoke all on function public.community_notify_follow() from public, anon, authenticated;
drop trigger if exists community_notify_follow on public.community_follows;
create trigger community_notify_follow after insert or update on public.community_follows
  for each row execute function public.community_notify_follow();

create or replace function public.community_notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.community_notify(new.recipient_id, 'message', new.sender_id);
  return new;
end; $$;
revoke all on function public.community_notify_message() from public, anon, authenticated;
drop trigger if exists community_notify_message on public.community_messages;
create trigger community_notify_message after insert on public.community_messages
  for each row execute function public.community_notify_message();

-- «Te superó en el rango general»: cuando sube el rango de alguien, se avisa a quienes lo siguen y quedaron debajo.
create or replace function public.community_notify_rank()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_op = 'UPDATE' and new.stats_public and new.overall_rank > old.overall_rank then
    for r in
      select s.user_id from public.community_follows f
      join public.community_athlete_stats s on s.user_id = f.follower_id
      where f.following_id = new.user_id and f.status = 'accepted' and s.stats_public
        and s.overall_rank >= old.overall_rank and s.overall_rank < new.overall_rank
      limit 200
    loop
      perform public.community_notify(r.user_id, 'rank_passed', new.user_id);
    end loop;
  end if;
  return new;
end; $$;
revoke all on function public.community_notify_rank() from public, anon, authenticated;
drop trigger if exists community_notify_rank on public.community_athlete_stats;
create trigger community_notify_rank after update of overall_rank on public.community_athlete_stats
  for each row execute function public.community_notify_rank();

-- Lista de avisos con los datos básicos de quien los generó (sin embed: evita PGRST201).
create or replace function public.community_notifications_list(p_limit integer default 40)
returns table (id bigint, kind text, actor_id uuid, username text, display_name text, avatar_path text, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, n.actor_id, p.username, p.display_name, p.avatar_path, n.created_at, n.read_at
  from public.community_notifications n
  join public.community_profiles p on p.user_id = n.actor_id
  where auth.uid() is not null and n.user_id = auth.uid()
    and not public.community_users_blocked(auth.uid(), n.actor_id)
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100)
$$;
revoke all on function public.community_notifications_list(integer) from public, anon;
grant execute on function public.community_notifications_list(integer) to authenticated;

-- 5. Historial privado de «Mi físico»: al cambiar una sección, las fotos anteriores quedan guardadas solo para su dueño.
create table if not exists public.community_physique_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('pair','single')),
  before_path text, after_path text, photo_path text,
  description text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists community_physique_history_user_idx on public.community_physique_history(user_id, created_at desc);
alter table public.community_physique_history enable row level security;
drop policy if exists physique_history_select_own on public.community_physique_history;
create policy physique_history_select_own on public.community_physique_history for select to authenticated using (user_id = auth.uid());
drop policy if exists physique_history_delete_own on public.community_physique_history;
create policy physique_history_delete_own on public.community_physique_history for delete to authenticated using (user_id = auth.uid());
revoke all on public.community_physique_history from anon, authenticated;
grant select, delete on public.community_physique_history to authenticated;

create or replace function public.community_physique_archive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.before_path, old.photo_path) is not null and coalesce(new.before_path, new.photo_path) is not null
     and (new.before_path is distinct from old.before_path or new.after_path is distinct from old.after_path or new.photo_path is distinct from old.photo_path) then
    insert into public.community_physique_history(user_id, kind, before_path, after_path, photo_path, description, created_at)
    values (old.user_id, old.kind, old.before_path, old.after_path, old.photo_path, old.description, coalesce(old.changed_at, now()));
  end if;
  return new;
end; $$;
revoke all on function public.community_physique_archive() from public, anon, authenticated;
drop trigger if exists community_physique_archive on public.community_physique;
create trigger community_physique_archive after update on public.community_physique
  for each row execute function public.community_physique_archive();

-- La persona puede leer sus propias fotos de «Mi físico» (incluidas las del historial privado).
drop policy if exists community_media_read_own_physique on storage.objects;
create policy community_media_read_own_physique on storage.objects for select to authenticated using (
  bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'physique');

commit;
