-- FittForma AI v66 — Comunidad: muro de amigos, aplausos con aviso, actividades compartidas y desafíos del mes.
-- ADITIVA y re-ejecutable: columnas opcionales, funciones y disparadores nuevos. No borra datos, tablas, funciones ni
-- políticas. Las dos reglas que se amplían (tipos de publicación y tipos de aviso) se reemplazan por una versión que
-- acepta todo lo anterior y además lo nuevo. RLS activo. Requiere las migraciones v41, v53 y v54.
--
-- * Actividad compartida (post_kind = 'activity'): un entrenamiento, una carrera o un desafío cumplido, con números
--   que registró la app (declarados por la persona, nunca «verificados»). Las carreras se comparten SIN el mapa.
--   Solo se publica si la persona elige «Compartir» y, por defecto, solo la ven sus seguidores aceptados.
-- * Muro de amigos: lo que publican las personas que seguís (seguimiento aceptado) y lo tuyo. No es un feed general.
-- * Aplausos: son los «me gusta» de siempre (community_likes). Aplaudir o comentar avisa a quien publicó.
-- * Desafíos del mes: entrenamientos, días activos y kilómetros del mes en curso, solo de quien muestra sus estadísticas.

begin;

-- 1. Actividad compartida -------------------------------------------------------------------------------------------
alter table public.community_posts add column if not exists activity jsonb;

create or replace function public.community_valid_activity(a jsonb)
returns boolean language sql immutable set search_path = public as $$
  select a is not null and jsonb_typeof(a) = 'object'
    and (select count(*) from jsonb_object_keys(a) k
         where k not in ('type','title','date','minutes','exercises','sets','volume_kg','distance_km','kcal','challenge','goal','value','month')) = 0
    and a->>'type' in ('workout','run','challenge')
    and (a->'title' is null or (jsonb_typeof(a->'title') = 'string' and char_length(a->>'title') between 1 and 80))
    and (a->'date' is null or (a->>'date') ~ '^\d{4}-\d{2}-\d{2}$')
    and (a->'minutes' is null or (jsonb_typeof(a->'minutes') = 'number' and (a->>'minutes')::numeric between 0 and 600))
    and (a->'exercises' is null or (jsonb_typeof(a->'exercises') = 'number' and (a->>'exercises')::numeric between 0 and 40))
    and (a->'sets' is null or (jsonb_typeof(a->'sets') = 'number' and (a->>'sets')::numeric between 0 and 300))
    and (a->'volume_kg' is null or (jsonb_typeof(a->'volume_kg') = 'number' and (a->>'volume_kg')::numeric between 0 and 200000))
    and (a->'distance_km' is null or (jsonb_typeof(a->'distance_km') = 'number' and (a->>'distance_km')::numeric between 0 and 300))
    and (a->'kcal' is null or (jsonb_typeof(a->'kcal') = 'number' and (a->>'kcal')::numeric between 0 and 5000))
    and case a->>'type'
      when 'workout' then a->'title' is not null and a->'minutes' is not null and a->'distance_km' is null and a->'challenge' is null
      when 'run' then a->'distance_km' is not null and (a->>'distance_km')::numeric > 0 and a->'minutes' is not null and a->'challenge' is null
      when 'challenge' then a->>'challenge' in ('workouts','active_days','run_km') and (a->>'month') ~ '^\d{4}-\d{2}$'
        and jsonb_typeof(a->'goal') = 'number' and (a->>'goal')::numeric between 1 and 1000
        and jsonb_typeof(a->'value') = 'number' and (a->>'value')::numeric between (a->>'goal')::numeric and 100000
      else false end;
$$;

alter table public.community_posts drop constraint if exists community_post_kind_valid;
alter table public.community_posts add constraint community_post_kind_valid check (
  (post_kind='transformation' and before_path is not null and after_path is not null and start_date is not null and end_date is not null and achievement is null and image_path is null and activity is null)
  or (post_kind='text' and char_length(trim(description)) between 1 and 1200 and before_path is null and after_path is null and achievement is null and activity is null)
  or (post_kind='achievement' and public.community_valid_achievement(achievement) and before_path is null and after_path is null and activity is null)
  or (post_kind='activity' and public.community_valid_activity(activity) and before_path is null and after_path is null and achievement is null)
);

-- 2. Muro de amigos: ids de lo que publicaron las personas que seguís (aceptadas) y vos, de lo más nuevo a lo más viejo.
--    Solo ids: la app trae las publicaciones con las mismas reglas de lectura (RLS) de siempre.
create or replace function public.community_wall_ids(p_before timestamptz default null, p_limit integer default 20)
returns table (id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.created_at
  from public.community_posts p
  where auth.uid() is not null
    and (p_before is null or p.created_at < p_before)
    and (p.user_id = auth.uid()
         or exists (select 1 from public.community_follows f where f.follower_id = auth.uid() and f.following_id = p.user_id and f.status = 'accepted'))
    and (p.user_id = auth.uid() or not public.community_users_blocked(auth.uid(), p.user_id))
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 40)
$$;
revoke all on function public.community_wall_ids(timestamptz, integer) from public, anon;
grant execute on function public.community_wall_ids(timestamptz, integer) to authenticated;

-- 3. Avisos de aplausos y comentarios --------------------------------------------------------------------------------
alter table public.community_notifications drop constraint if exists community_notifications_kind_check;
alter table public.community_notifications drop constraint if exists community_notifications_kind_valid;
alter table public.community_notifications add constraint community_notifications_kind_valid
  check (kind in ('follow','follow_request','follow_accepted','message','rank_passed','applause','comment'));

create or replace function public.community_notify_applause()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.community_notify((select p.user_id from public.community_posts p where p.id = new.post_id), 'applause', new.user_id);
  return new;
end; $$;
revoke all on function public.community_notify_applause() from public, anon, authenticated;
drop trigger if exists community_notify_applause on public.community_likes;
create trigger community_notify_applause after insert on public.community_likes
  for each row execute function public.community_notify_applause();

create or replace function public.community_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.community_notify((select p.user_id from public.community_posts p where p.id = new.post_id), 'comment', new.user_id);
  return new;
end; $$;
revoke all on function public.community_notify_comment() from public, anon, authenticated;
drop trigger if exists community_notify_comment on public.community_comments;
create trigger community_notify_comment after insert on public.community_comments
  for each row execute function public.community_notify_comment();

-- 4. Desafíos del mes: números del mes en curso (el mes lo fija el servidor a partir de stats_date) ---------------------
alter table public.community_athlete_stats add column if not exists month_start date;
alter table public.community_athlete_stats add column if not exists workouts_month smallint not null default 0;
alter table public.community_athlete_stats add column if not exists active_days_month smallint not null default 0;
alter table public.community_athlete_stats add column if not exists run_km_month numeric(7,2) not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'athlete_stats_month_valid') then
    alter table public.community_athlete_stats add constraint athlete_stats_month_valid check (
      workouts_month between 0 and 200 and active_days_month between 0 and 31 and run_km_month between 0 and 3000
      and active_days_month <= workouts_month);
  end if;
end $$;

create or replace function public.community_athlete_month_set()
returns trigger language plpgsql set search_path = public as $$
begin
  new.month_start := date_trunc('month', new.stats_date)::date;
  if new.active_days_month > extract(day from new.stats_date) then new.active_days_month := extract(day from new.stats_date)::smallint; end if;
  return new;
end; $$;
revoke all on function public.community_athlete_month_set() from public, anon, authenticated;
drop trigger if exists community_athlete_month_set on public.community_athlete_stats;
create trigger community_athlete_month_set before insert or update on public.community_athlete_stats
  for each row execute function public.community_athlete_month_set();

-- Tablero de los desafíos: vos y las personas que seguís (aceptadas) que muestran sus estadísticas y ya
-- registraron algo este mes. Sin bloqueos.
create or replace function public.community_month_board()
returns table (user_id uuid, username text, display_name text, avatar_path text, workouts_month integer, active_days_month integer, run_km_month numeric, is_self boolean)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar_path, s.workouts_month::int, s.active_days_month::int, s.run_km_month, p.user_id = auth.uid()
  from public.community_athlete_stats s
  join public.community_profiles p on p.user_id = s.user_id
  where auth.uid() is not null
    and s.month_start = date_trunc('month', current_date)::date
    and (s.user_id = auth.uid()
         or (s.stats_public
             and exists (select 1 from public.community_follows f where f.follower_id = auth.uid() and f.following_id = s.user_id and f.status = 'accepted')
             and not public.community_users_blocked(auth.uid(), s.user_id)))
  order by s.workouts_month desc, s.active_days_month desc, p.username
  limit 60
$$;
revoke all on function public.community_month_board() from public, anon;
grant execute on function public.community_month_board() to authenticated;

commit;
