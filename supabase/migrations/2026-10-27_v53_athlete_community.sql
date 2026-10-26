-- FittForma AI v53 — Comunidad de deportistas: directorio con nivel, rango e insignias, perfil completo,
-- rankings por categoría y comparación con amigos.
-- ADITIVA y re-ejecutable: crea UNA tabla nueva y funciones nuevas. No borra ni modifica tablas, registros,
-- funciones ni políticas existentes (las de v52, incluida community_rank_board, siguen instaladas). RLS activo.
--
-- Qué se publica: solo estadísticas DEPORTIVAS calculadas por la app (nivel de entrenamiento elegido por la
-- persona, nivel de XP, rango general del Mapa de avances, insignias, constancia de 30 días, running de 30 días y
-- mejores series de cuatro ejercicios de peso corporal). NUNCA peso corporal, altura, medidas, objetivos físicos
-- ni fotos de progreso: esas columnas no existen en esta tabla.
-- Quién las ve: quien puede ver el contenido del perfil (community_can_view_profile: perfil público o seguidor
-- aceptado, sin bloqueos), y solo si la persona no las ocultó (stats_public, activado por defecto según la
-- decisión del producto). La tabla no se puede leer directamente salvo la fila propia: el resto pasa por funciones.
--
-- Límites de la validación: los entrenamientos se registran en el dispositivo, así que el servidor no puede
-- demostrar que un número sea real. Para que no sea fácil alterarlo enviando valores falsos:
--   * topes de plausibilidad y coherencia entre columnas (CHECK);
--   * la fecha de cálculo debe ser la de hoy (±1 día) y la marca de tiempo la pone el servidor;
--   * los récords por ejercicio solo pueden subir una vez cada 20 h y como mucho +50 % (o +10 rep / +60 s);
--     un salto mayor se recorta en el servidor y se completa en los días siguientes;
--   * el orden de los rankings se calcula en el servidor; las categorías de 30 días solo cuentan datos frescos.

begin;

create table if not exists public.community_athlete_stats (
  user_id uuid primary key references public.community_profiles(user_id) on delete cascade,
  stats_public boolean not null default true,
  training_level text check (training_level in ('beginner','intermediate','advanced')),
  xp_level integer not null default 1 check (xp_level between 1 and 2000),
  overall_rank smallint not null default -1 check (overall_rank between -1 and 8),
  ranked_muscles smallint not null default 0 check (ranked_muscles between 0 and 20),
  badges_count integer not null default 0 check (badges_count between 0 and 1000),
  badges jsonb not null default '[]'::jsonb check (jsonb_typeof(badges) = 'array' and jsonb_array_length(badges) <= 60 and octet_length(badges::text) <= 24000),
  workouts_total integer not null default 0 check (workouts_total between 0 and 100000),
  workouts_30d smallint not null default 0 check (workouts_30d between 0 and 180),
  active_days_30d smallint not null default 0 check (active_days_30d between 0 and 30),
  run_count_30d smallint not null default 0 check (run_count_30d between 0 and 120),
  run_km_30d numeric(7,2) not null default 0 check (run_km_30d between 0 and 1500),
  run_minutes_30d integer not null default 0 check (run_minutes_30d between 0 and 20000),
  best_pushups smallint not null default 0 check (best_pushups between 0 and 300),
  best_pullups smallint not null default 0 check (best_pullups between 0 and 120),
  best_air_squats smallint not null default 0 check (best_air_squats between 0 and 1000),
  best_plank_seconds integer not null default 0 check (best_plank_seconds between 0 and 7200),
  stats_date date not null default current_date,
  bests_raised_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint athlete_stats_consistent check (
    active_days_30d <= workouts_30d and workouts_30d <= workouts_total and run_count_30d <= workouts_30d
    and run_km_30d <= run_count_30d * 150
    and (run_km_30d = 0 or run_minutes_30d >= run_km_30d * 2.5)
  )
);
alter table public.community_athlete_stats enable row level security;

drop policy if exists athlete_stats_select_own on public.community_athlete_stats;
create policy athlete_stats_select_own on public.community_athlete_stats for select to authenticated using (user_id = auth.uid());
drop policy if exists athlete_stats_insert_own on public.community_athlete_stats;
create policy athlete_stats_insert_own on public.community_athlete_stats for insert to authenticated with check (user_id = auth.uid());
drop policy if exists athlete_stats_update_own on public.community_athlete_stats;
create policy athlete_stats_update_own on public.community_athlete_stats for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists athlete_stats_delete_own on public.community_athlete_stats;
create policy athlete_stats_delete_own on public.community_athlete_stats for delete to authenticated using (user_id = auth.uid());
revoke all on public.community_athlete_stats from anon;
grant select, insert, update, delete on public.community_athlete_stats to authenticated;

-- Validación del lado del servidor (ver encabezado).
create or replace function public.community_athlete_stats_guard()
returns trigger language plpgsql set search_path = public as $$
declare raised boolean := false; cap numeric;
begin
  if new.stats_date not between current_date - 1 and current_date + 1 then
    raise exception 'La fecha de las estadísticas debe ser la de hoy' using errcode = '22023';
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    if new.best_pushups > old.best_pushups or new.best_pullups > old.best_pullups
       or new.best_air_squats > old.best_air_squats or new.best_plank_seconds > old.best_plank_seconds then
      if old.bests_raised_at is not null and old.bests_raised_at > now() - interval '20 hours' then
        new.best_pushups := least(new.best_pushups, old.best_pushups);
        new.best_pullups := least(new.best_pullups, old.best_pullups);
        new.best_air_squats := least(new.best_air_squats, old.best_air_squats);
        new.best_plank_seconds := least(new.best_plank_seconds, old.best_plank_seconds);
        new.bests_raised_at := old.bests_raised_at;
      else
        cap := greatest(old.best_pushups * 1.5, old.best_pushups + 10);     new.best_pushups := least(new.best_pushups, floor(cap));
        cap := greatest(old.best_pullups * 1.5, old.best_pullups + 10);     new.best_pullups := least(new.best_pullups, floor(cap));
        cap := greatest(old.best_air_squats * 1.5, old.best_air_squats + 10); new.best_air_squats := least(new.best_air_squats, floor(cap));
        cap := greatest(old.best_plank_seconds * 1.5, old.best_plank_seconds + 60); new.best_plank_seconds := least(new.best_plank_seconds, floor(cap));
        raised := new.best_pushups > old.best_pushups or new.best_pullups > old.best_pullups
               or new.best_air_squats > old.best_air_squats or new.best_plank_seconds > old.best_plank_seconds;
        new.bests_raised_at := case when raised then now() else old.bests_raised_at end;
      end if;
    else
      new.bests_raised_at := old.bests_raised_at;
    end if;
  else
    new.bests_raised_at := case when new.best_pushups + new.best_pullups + new.best_air_squats + new.best_plank_seconds > 0 then now() end;
  end if;
  return new;
end; $$;
revoke all on function public.community_athlete_stats_guard() from public, anon, authenticated;
drop trigger if exists community_athlete_stats_guard on public.community_athlete_stats;
create trigger community_athlete_stats_guard before insert or update on public.community_athlete_stats
  for each row execute function public.community_athlete_stats_guard();

-- ¿Las estadísticas de 30 días siguen vigentes? (se calcularon hace 3 días o menos)
create or replace function public.community_stats_fresh(p_date date)
returns boolean language sql stable as $$ select p_date >= current_date - 3 $$;

-- Directorio de deportistas (Todo el mundo y Amigos). Misma privacidad que community_directory (v50) más las
-- estadísticas, que solo aparecen si se pueden ver y no están ocultas. p_scope='friends': personas que seguís
-- con solicitud aceptada (la relación de seguimiento existente; no hay una tabla nueva de amistades).
create or replace function public.community_people(p_search text default '', p_after text default null, p_limit integer default 20, p_scope text default 'all')
returns table (user_id uuid, username text, display_name text, avatar_path text, visibility text, bio text, featured_badges jsonb,
               follow_status text, follows_me boolean, can_view boolean, is_self boolean,
               stats_visible boolean, training_level text, xp_level integer, overall_rank smallint, badges_count integer, latest_badge jsonb)
language sql stable security definer set search_path = public as $$
  with v as (select auth.uid() as viewer,
                    left(regexp_replace(lower(trim(coalesce(p_search, ''))), '[^a-z0-9_.áéíóúñü -]', '', 'g'), 40) as q),
  base as (
    select p.user_id, p.username, p.display_name, p.avatar_path, p.visibility, p.bio, p.featured_badges, v.viewer,
           public.community_can_view_profile(p.user_id, v.viewer) as cv
    from public.community_profiles p, v
    where (p.visibility = 'public' or v.viewer is not null)
      and (v.viewer is null or p.user_id = v.viewer or not public.community_users_blocked(v.viewer, p.user_id))
      and (v.q = '' or p.username like '%' || replace(v.q, '_', '\_') || '%' or lower(p.display_name) like '%' || v.q || '%')
      and (p_after is null or p.username > p_after)
      and (coalesce(p_scope, 'all') <> 'friends' or (v.viewer is not null and p.user_id <> v.viewer and exists (
            select 1 from public.community_follows f where f.follower_id = v.viewer and f.following_id = p.user_id and f.status = 'accepted')))
    order by p.username asc
    limit least(greatest(coalesce(p_limit, 20), 1), 30)
  )
  select b.user_id, b.username, b.display_name, b.avatar_path, b.visibility,
    case when b.cv then left(coalesce(b.bio, ''), 160) else '' end,
    case when b.cv then coalesce(b.featured_badges, '[]'::jsonb) else '[]'::jsonb end,
    coalesce((select f.status from public.community_follows f where f.follower_id = b.viewer and f.following_id = b.user_id), ''),
    coalesce(exists (select 1 from public.community_follows f where f.follower_id = b.user_id and f.following_id = b.viewer and f.status = 'accepted'), false),
    b.cv, coalesce(b.user_id = b.viewer, false),
    s.user_id is not null, s.training_level, s.xp_level, s.overall_rank, s.badges_count,
    (select x from jsonb_array_elements(s.badges) x order by x->>'earnedAt' desc nulls last limit 1)
  from base b
  left join public.community_athlete_stats s on s.user_id = b.user_id and b.cv and (s.stats_public or s.user_id = b.viewer)
  order by b.username asc
$$;
revoke all on function public.community_people(text, text, integer, text) from public;
grant execute on function public.community_people(text, text, integer, text) to anon, authenticated;

-- Perfil completo de UNA persona (mismo componente para Todo el mundo, Ranking y Amigos, y para comparar).
create or replace function public.community_athlete_profile(p_user uuid)
returns table (user_id uuid, username text, display_name text, avatar_path text, visibility text, bio text, featured_badges jsonb,
               follow_status text, follows_me boolean, can_view boolean, is_self boolean, posts integer, followers integer, following integer,
               stats_visible boolean, stats_public boolean, training_level text, xp_level integer, overall_rank smallint, ranked_muscles smallint,
               badges_count integer, badges jsonb, workouts_total integer, workouts_30d smallint, active_days_30d smallint,
               run_count_30d smallint, run_km_30d numeric, run_minutes_30d integer,
               best_pushups smallint, best_pullups smallint, best_air_squats smallint, best_plank_seconds integer,
               stats_date date, stats_fresh boolean, stats_updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  with v as (select auth.uid() as viewer),
  b as (
    select p.*, v.viewer, public.community_can_view_profile(p.user_id, v.viewer) as cv
    from public.community_profiles p, v
    where p.user_id = p_user
      and (p.visibility = 'public' or v.viewer is not null)
      and (v.viewer is null or p.user_id = v.viewer or not public.community_users_blocked(v.viewer, p.user_id))
  )
  select b.user_id, b.username, b.display_name, b.avatar_path, b.visibility,
    case when b.cv then coalesce(b.bio, '') else '' end,
    case when b.cv then coalesce(b.featured_badges, '[]'::jsonb) else '[]'::jsonb end,
    coalesce((select f.status from public.community_follows f where f.follower_id = b.viewer and f.following_id = b.user_id), ''),
    coalesce(exists (select 1 from public.community_follows f where f.follower_id = b.user_id and f.following_id = b.viewer and f.status = 'accepted'), false),
    b.cv, coalesce(b.user_id = b.viewer, false),
    case when b.cv then (select count(*) from public.community_posts x where x.user_id = b.user_id and (x.user_id = b.viewer or x.visibility = 'public' or exists (select 1 from public.community_follows f where f.follower_id = b.viewer and f.following_id = b.user_id and f.status = 'accepted')))::int end,
    case when b.cv then (select count(*) from public.community_follows f where f.following_id = b.user_id and f.status = 'accepted')::int end,
    case when b.cv then (select count(*) from public.community_follows f where f.follower_id = b.user_id and f.status = 'accepted')::int end,
    s.user_id is not null,
    case when b.user_id = b.viewer then s.stats_public end,
    s.training_level, s.xp_level, s.overall_rank, s.ranked_muscles, s.badges_count, coalesce(s.badges, '[]'::jsonb),
    s.workouts_total, s.workouts_30d, s.active_days_30d, s.run_count_30d, s.run_km_30d, s.run_minutes_30d,
    s.best_pushups, s.best_pullups, s.best_air_squats, s.best_plank_seconds,
    s.stats_date, case when s.user_id is not null then public.community_stats_fresh(s.stats_date) end, s.updated_at
  from b
  left join public.community_athlete_stats s on s.user_id = b.user_id and b.cv and (s.stats_public or s.user_id = b.viewer)
$$;
revoke all on function public.community_athlete_profile(uuid) from public;
grant execute on function public.community_athlete_profile(uuid) to anon, authenticated;

-- Ranking por categoría. Cada categoría compara UNA métrica con UNA unidad (no se mezclan km, repeticiones y
-- segundos). Orden: valor de mayor a menor; empate en «rank» por músculos con rango; después por @usuario.
-- Las posiciones usan rank(): dos personas con el mismo valor comparten puesto. Solo cuentan valores > 0
-- (en «rank», desde Hierro). p_scope='friends': vos y las personas que seguís con solicitud aceptada.
create or replace function public.community_leaderboard(p_category text, p_scope text default 'all', p_limit integer default 50)
returns table (pos bigint, user_id uuid, username text, display_name text, avatar_path text, training_level text,
               overall_rank smallint, featured_badges jsonb, value numeric, is_self boolean, stats_date date)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_category not in ('rank','badges','level','constancy','running','pushups','pullups','squats','plank') then
    raise exception 'Categoría de ranking desconocida' using errcode = '22023';
  end if;
  if coalesce(p_scope, 'all') not in ('all','friends') then
    raise exception 'Alcance de ranking desconocido' using errcode = '22023';
  end if;
  return query
  with v as (select auth.uid() as viewer),
  c as (
    select s.user_id, p.username, p.display_name, p.avatar_path, s.training_level, s.overall_rank, coalesce(p.featured_badges, '[]'::jsonb) as fb,
      (case p_category
        when 'rank' then s.overall_rank::numeric
        when 'badges' then s.badges_count::numeric
        when 'level' then s.xp_level::numeric
        when 'constancy' then case when public.community_stats_fresh(s.stats_date) then s.active_days_30d::numeric end
        when 'running' then case when public.community_stats_fresh(s.stats_date) then s.run_km_30d end
        when 'pushups' then s.best_pushups::numeric
        when 'pullups' then s.best_pullups::numeric
        when 'squats' then s.best_air_squats::numeric
        when 'plank' then s.best_plank_seconds::numeric
      end) as val,
      case when p_category = 'rank' then s.ranked_muscles else 0 end as tie,
      coalesce(s.user_id = v.viewer, false) as me, s.stats_date
    from public.community_athlete_stats s
    join public.community_profiles p on p.user_id = s.user_id, v
    where s.stats_public
      and public.community_can_view_profile(s.user_id, v.viewer)
      and (coalesce(p_scope, 'all') = 'all' or (v.viewer is not null and (s.user_id = v.viewer or exists (
            select 1 from public.community_follows f where f.follower_id = v.viewer and f.following_id = s.user_id and f.status = 'accepted'))))
  )
  select rank() over (order by c.val desc, c.tie desc), c.user_id, c.username, c.display_name, c.avatar_path, c.training_level,
         c.overall_rank, c.fb, c.val, c.me, c.stats_date
  from c
  where c.val is not null and (c.val > 0 or (p_category = 'rank' and c.val >= 0))
  order by c.val desc, c.tie desc, c.username asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end; $$;
revoke all on function public.community_leaderboard(text, text, integer) from public;
grant execute on function public.community_leaderboard(text, text, integer) to anon, authenticated;

-- Solicitudes de seguimiento pendientes con los datos básicos de quien las envió. Reemplaza en el cliente el
-- embed community_follows → community_profiles, que puede dar PGRST201/PGRST200 si el nombre de la FK difiere.
create or replace function public.community_follow_requests()
returns table (follower_id uuid, username text, display_name text, avatar_path text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.follower_id, p.username, p.display_name, p.avatar_path, f.created_at
  from public.community_follows f
  join public.community_profiles p on p.user_id = f.follower_id
  where auth.uid() is not null and f.following_id = auth.uid() and f.status = 'pending'
    and not public.community_users_blocked(auth.uid(), f.follower_id)
  order by f.created_at desc
  limit 50
$$;
revoke all on function public.community_follow_requests() from public, anon;
grant execute on function public.community_follow_requests() to authenticated;

commit;
