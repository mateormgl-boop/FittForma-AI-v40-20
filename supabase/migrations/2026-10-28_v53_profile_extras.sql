-- FittForma AI v53.1 — Perfil de Comunidad: bandera, «Mi físico» y mapa de músculos.
-- ADITIVA y re-ejecutable: agrega columnas opcionales y funciones nuevas. No borra ni modifica datos, tablas,
-- funciones ni políticas existentes. RLS activo. Requiere la migración 2026-10-27_v53_athlete_community.sql.
--
-- * Bandera: código de país ISO de 2 letras que la persona elige (opcional). Es un dato básico del perfil, como el
--   nombre: se ve en el directorio, sin exponer el contenido de perfiles privados.
-- * «Mi físico»: dos secciones arriba del perfil, «Antes y después» (dos fotos) y «Una foto». Hay una sola cosa por
--   sección. Sin membresía Plus se puede cambiar cada 30 días; con Plus, cuando quieras (lo verifica el servidor con
--   monetization_is_plus). Quitarla se puede siempre. Las fotos solo las ve quien puede ver el contenido del perfil.
-- * Mapa de músculos: el rango de cada músculo del «Mapa de avances» (números de -1 a 8 por músculo; nada corporal).
--   Se ve solo si la persona muestra sus estadísticas y no ocultó el mapa (show_muscles, activado por defecto).

begin;

-- 1. Bandera
alter table public.community_profiles add column if not exists country_code text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'community_profiles_country_valid') then
    alter table public.community_profiles add constraint community_profiles_country_valid check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;
end $$;
grant update (country_code) on public.community_profiles to authenticated;

-- 1b. «Mi físico»: una fila por persona y sección. Quitar = dejar las fotos en null (la fila guarda cuándo se cambió,
--     así que borrar y volver a subir no saltea el plazo). No se permite DELETE: el cliente borra las fotos del bucket.
-- Para las políticas: community_can_view_profile no es ejecutable por los roles de la API; esta envoltura sí, y solo
-- responde por la persona que consulta.
create or replace function public.community_viewer_can_see(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.community_can_view_profile(p_owner, auth.uid())
$$;
revoke all on function public.community_viewer_can_see(uuid) from public;
grant execute on function public.community_viewer_can_see(uuid) to anon, authenticated;

create table if not exists public.community_physique (
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('pair','single')),
  before_path text, after_path text, photo_path text,
  description text not null default '' check (char_length(description) <= 300),
  changed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind),
  constraint physique_paths_own check (before_path is null or before_path like user_id::text || '/physique/%'),
  constraint physique_paths_own2 check (after_path is null or after_path like user_id::text || '/physique/%'),
  constraint physique_paths_own3 check (photo_path is null or photo_path like user_id::text || '/physique/%'),
  constraint physique_shape check (
    (kind = 'pair' and photo_path is null and ((before_path is null) = (after_path is null)))
    or (kind = 'single' and before_path is null and after_path is null))
);
alter table public.community_physique enable row level security;
drop policy if exists physique_read on public.community_physique;
create policy physique_read on public.community_physique for select to anon, authenticated
  using (public.community_viewer_can_see(user_id));
drop policy if exists physique_insert_own on public.community_physique;
create policy physique_insert_own on public.community_physique for insert to authenticated with check (user_id = auth.uid());
drop policy if exists physique_update_own on public.community_physique;
create policy physique_update_own on public.community_physique for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select on public.community_physique to anon, authenticated;
revoke delete on public.community_physique from anon, authenticated;
grant insert, update on public.community_physique to authenticated;

create or replace function public.community_physique_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare has_photo boolean := coalesce(new.before_path, new.photo_path) is not null;
        new_photo boolean;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id; new.kind := old.kind;
    new_photo := has_photo and (new.before_path is distinct from old.before_path or new.after_path is distinct from old.after_path or new.photo_path is distinct from old.photo_path);
    new.changed_at := old.changed_at;
  else
    new_photo := has_photo; new.changed_at := null;
  end if;
  if new_photo then
    if tg_op = 'UPDATE' and old.changed_at is not null and old.changed_at > now() - interval '30 days'
       and not public.monetization_is_plus(new.user_id) then
      raise exception 'physique_wait' using errcode = 'P0001',
        hint = 'Sin membresía podés cambiar esta sección una vez cada 30 días. Con Plus, cuando quieras.';
    end if;
    new.changed_at := now();
  end if;
  return new;
end; $$;
revoke all on function public.community_physique_guard() from public, anon, authenticated;
drop trigger if exists community_physique_guard on public.community_physique;
create trigger community_physique_guard before insert or update on public.community_physique
  for each row execute function public.community_physique_guard();

-- Lectura de las fotos de «Mi físico»: las actuales de un perfil que se puede ver (las viejas quedan protegidas).
drop policy if exists community_media_read_physique on storage.objects;
create policy community_media_read_physique on storage.objects for select to anon, authenticated using (
  bucket_id = 'community-media' and (storage.foldername(name))[2] = 'physique' and exists (
    select 1 from public.community_physique f
    where f.user_id::text = (storage.foldername(name))[1]
      and name in (f.before_path, f.after_path, f.photo_path)
      and public.community_viewer_can_see(f.user_id)));

-- 2. Mapa de músculos en las estadísticas
create or replace function public.community_valid_muscle_ranks(m jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(m) = 'object'
    and (select count(*) from jsonb_object_keys(m)) <= 30
    and not exists (select 1 from jsonb_each(m) e
                    where e.key !~ '^[a-z_]{2,30}$'
                       or case when jsonb_typeof(e.value) = 'number' and (e.value)::text ~ '^-?[0-9]$'
                               then (e.value)::text::int not between -1 and 8 else true end);
$$;
alter table public.community_athlete_stats add column if not exists muscle_ranks jsonb not null default '{}'::jsonb;
alter table public.community_athlete_stats add column if not exists show_muscles boolean not null default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'athlete_stats_muscle_ranks_valid') then
    alter table public.community_athlete_stats add constraint athlete_stats_muscle_ranks_valid check (public.community_valid_muscle_ranks(muscle_ranks));
  end if;
end $$;

-- 3. Datos extra de un perfil (complementa community_athlete_profile, que no cambia)
create or replace function public.community_athlete_extras(p_user uuid)
returns table (user_id uuid, country_code text, show_muscles boolean, muscle_ranks jsonb)
language sql stable security definer set search_path = public as $$
  with v as (select auth.uid() as viewer)
  select p.user_id, p.country_code,
    case when p.user_id = v.viewer then coalesce(s.show_muscles, true) end,
    case when s.user_id is not null and public.community_can_view_profile(p.user_id, v.viewer)
              and ((s.stats_public and s.show_muscles) or p.user_id = v.viewer) then s.muscle_ranks end
  from public.community_profiles p cross join v
  left join public.community_athlete_stats s on s.user_id = p.user_id
  where p.user_id = p_user
    and (p.visibility = 'public' or v.viewer is not null)
    and (v.viewer is null or p.user_id = v.viewer or not public.community_users_blocked(v.viewer, p.user_id))
$$;
revoke all on function public.community_athlete_extras(uuid) from public;
grant execute on function public.community_athlete_extras(uuid) to anon, authenticated;

-- 4. Banderas de varias personas a la vez (tarjetas del directorio, ranking y amigos). Dato básico.
create or replace function public.community_flags(p_users uuid[])
returns table (user_id uuid, country_code text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.country_code
  from public.community_profiles p
  where p.user_id = any ((coalesce(p_users, '{}'::uuid[]))[1:60])
    and p.country_code is not null
    and (p.visibility = 'public' or auth.uid() is not null)
    and (auth.uid() is null or p.user_id = auth.uid() or not public.community_users_blocked(auth.uid(), p.user_id))
$$;
revoke all on function public.community_flags(uuid[]) from public;
grant execute on function public.community_flags(uuid[]) to anon, authenticated;

commit;
