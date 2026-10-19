-- FittForma AI v50 — Comunidad: perfiles públicos por defecto, directorio de usuarios reales con búsqueda y carga
-- progresiva, datos básicos de perfiles privados (sin su contenido) y foto de perfil visible donde aparece la persona.
-- ADITIVA y re-ejecutable: no cambia la privacidad de perfiles existentes ni borra datos; RLS sigue activo.
-- «Descubrir» a alguien (nombre, @usuario, foto, si es privado) queda separado de «ver su contenido» (bio, insignias,
-- publicaciones, conteos), que sigue exigiendo perfil público, ser la persona o seguidor aceptado, y sin bloqueos.

begin;

-- 1. Perfiles nuevos: públicos por defecto (cada persona puede pasarlo a privado en Perfil > Editar).
alter table public.community_profiles alter column visibility set default 'public';

create or replace function public.create_community_profile_for_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare base_name text; candidate text;
begin
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'preferred_username',split_part(coalesce(new.email,'usuario'),'@',1),'usuario'),'[^a-z0-9_.-]','','g'));
  base_name := left(base_name,15);
  if length(base_name)<3 then base_name := 'fituser'; end if;
  candidate := left(base_name || '_' || left(new.id::text,8),24);
  -- Si el usuario automático ya existe, se prueba con otro sufijo (el alta de la cuenta nunca debe fallar por esto).
  for i in 1..5 loop
    exit when not exists (select 1 from public.community_profiles where username = candidate);
    candidate := left(base_name,14) || '_' || substr(md5(new.id::text || i::text || clock_timestamp()::text),1,9);
  end loop;
  insert into public.community_profiles(user_id,username,display_name,visibility)
  values(new.id,candidate,left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','Atleta FittForma'),60),'public')
  on conflict(user_id) do nothing;
  return new;
end; $$;
revoke all on function public.create_community_profile_for_new_user() from public,anon,authenticated;

-- 2. ¿Puede quien consulta ver el CONTENIDO de un perfil? (misma regla que el RLS de perfiles y publicaciones)
create or replace function public.community_can_view_profile(p_owner uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.community_profiles cp where cp.user_id = p_owner
      and (p_viewer is null or p_viewer = p_owner or not public.community_users_blocked(p_viewer, p_owner))
      and (cp.visibility = 'public' or cp.user_id = p_viewer
           or exists (select 1 from public.community_follows f where f.follower_id = p_viewer and f.following_id = p_owner and f.status = 'accepted'))
  );
$$;
revoke all on function public.community_can_view_profile(uuid, uuid) from public, anon, authenticated;

-- 3. Directorio: usuarios reales que tienen la app. Sin sesión solo se listan perfiles públicos.
--    Paginación por @usuario (p_after) para que funcione con muchos usuarios. Máximo 30 por página.
create or replace function public.community_directory(p_search text default '', p_after text default null, p_limit integer default 20)
returns table (user_id uuid, username text, display_name text, avatar_path text, visibility text, bio text, featured_badges jsonb,
               posts integer, followers integer, follow_status text, can_view boolean, is_self boolean)
language sql stable security definer set search_path = public as $$
  with v as (select auth.uid() as viewer,
                    left(regexp_replace(lower(trim(coalesce(p_search, ''))), '[^a-z0-9_.áéíóúñü -]', '', 'g'), 40) as q)
  select p.user_id, p.username, p.display_name, p.avatar_path, p.visibility,
    case when public.community_can_view_profile(p.user_id, v.viewer) then left(coalesce(p.bio, ''), 160) else '' end,
    case when public.community_can_view_profile(p.user_id, v.viewer) then coalesce(p.featured_badges, '[]'::jsonb) else '[]'::jsonb end,
    case when public.community_can_view_profile(p.user_id, v.viewer) then (select count(*) from public.community_posts x where x.user_id = p.user_id and (x.user_id = v.viewer or x.visibility = 'public' or exists (select 1 from public.community_follows f where f.follower_id = v.viewer and f.following_id = p.user_id and f.status = 'accepted')))::int end,
    case when public.community_can_view_profile(p.user_id, v.viewer) then (select count(*) from public.community_follows f where f.following_id = p.user_id and f.status = 'accepted')::int end,
    coalesce((select f.status from public.community_follows f where f.follower_id = v.viewer and f.following_id = p.user_id), ''),
    public.community_can_view_profile(p.user_id, v.viewer),
    p.user_id = v.viewer
  from public.community_profiles p, v
  where (p.visibility = 'public' or v.viewer is not null)
    and (v.viewer is null or p.user_id = v.viewer or not public.community_users_blocked(v.viewer, p.user_id))
    and (v.q = '' or p.username like '%' || replace(v.q, '_', '\_') || '%' or lower(p.display_name) like '%' || v.q || '%')
    and (p_after is null or p.username > p_after)
  order by p.username asc
  limit least(greatest(coalesce(p_limit, 20), 1), 30)
$$;
revoke all on function public.community_directory(text, text, integer) from public;
grant execute on function public.community_directory(text, text, integer) to anon, authenticated;

-- 4. Datos básicos de UN perfil (para abrir un perfil privado y mostrar el aviso sin exponer su contenido).
create or replace function public.community_profile_basic(p_user uuid)
returns table (user_id uuid, username text, display_name text, avatar_path text, visibility text, bio text, featured_badges jsonb, follow_status text, can_view boolean)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar_path, p.visibility,
    case when public.community_can_view_profile(p.user_id, auth.uid()) then p.bio else '' end,
    case when public.community_can_view_profile(p.user_id, auth.uid()) then coalesce(p.featured_badges, '[]'::jsonb) else '[]'::jsonb end,
    coalesce((select f.status from public.community_follows f where f.follower_id = auth.uid() and f.following_id = p.user_id), ''),
    public.community_can_view_profile(p.user_id, auth.uid())
  from public.community_profiles p
  where p.user_id = p_user
    and (p.visibility = 'public' or auth.uid() is not null)
    and (auth.uid() is null or p.user_id = auth.uid() or not public.community_users_blocked(auth.uid(), p.user_id))
$$;
revoke all on function public.community_profile_basic(uuid) from public;
grant execute on function public.community_profile_basic(uuid) to anon, authenticated;

-- 5. La foto de perfil es dato básico: se puede leer si es la foto ACTUAL de un perfil, sin bloqueo entre las
--    cuentas (y, sin sesión, solo de perfiles públicos). Fotos viejas o de publicaciones siguen protegidas.
create or replace function public.community_avatar_readable(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_profiles cp
    where cp.avatar_path = p_name
      and (cp.visibility = 'public' or auth.uid() is not null)
      and (auth.uid() is null or cp.user_id = auth.uid() or not public.community_users_blocked(auth.uid(), cp.user_id))
  );
$$;
revoke all on function public.community_avatar_readable(text) from public;
grant execute on function public.community_avatar_readable(text) to anon, authenticated;
drop policy if exists community_media_read_avatar_basic on storage.objects;
create policy community_media_read_avatar_basic on storage.objects for select to anon, authenticated using (
  bucket_id = 'community-media' and (storage.foldername(name))[2] = 'avatar' and public.community_avatar_readable(name)
);

commit;
