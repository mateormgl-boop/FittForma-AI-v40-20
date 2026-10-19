-- FittForma AI v49 — Comunidad: publicaciones guardadas, insignias destacadas en el perfil social, entrenamiento
-- vinculado a una publicación, foto de perfil, lista de conversaciones, conteos reales y personas sugeridas.
-- ADITIVA y re-ejecutable: crea una tabla, agrega columnas opcionales, funciones y políticas. No borra datos ni
-- cambia políticas existentes; RLS sigue activo en todas las tablas.

begin;

-- 1. Publicaciones guardadas (solo las ve y administra su dueño) -------------------------------------------
create table if not exists public.community_saved_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.community_saved_posts enable row level security;
revoke all on public.community_saved_posts from anon, authenticated;
grant select, insert, delete on public.community_saved_posts to authenticated;
drop policy if exists community_saved_read_own on public.community_saved_posts;
create policy community_saved_read_own on public.community_saved_posts for select to authenticated using (user_id = auth.uid());
-- Solo se puede guardar una publicación que la persona puede ver (la subconsulta respeta el RLS de posts).
drop policy if exists community_saved_insert_visible on public.community_saved_posts;
create policy community_saved_insert_visible on public.community_saved_posts for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.community_posts p where p.id = post_id));
drop policy if exists community_saved_delete_own on public.community_saved_posts;
create policy community_saved_delete_own on public.community_saved_posts for delete to authenticated using (user_id = auth.uid());

-- 2. Insignias destacadas en el perfil social (máximo 3, solo datos del logro; nunca «verificada») ----------
create or replace function public.community_valid_featured(f jsonb)
returns boolean language sql immutable set search_path = public as $$
  select f is not null and jsonb_typeof(f) = 'array' and jsonb_array_length(f) <= 3
    and not exists (
      select 1 from jsonb_array_elements(f) e
      where jsonb_typeof(e) <> 'object'
        or (select count(*) from jsonb_object_keys(e) k where k not in ('exerciseId','exerciseName','category','rank','level','measure')) > 0
        or coalesce(e->>'exerciseId','') !~ '^[a-z0-9-]{1,80}$'
        or char_length(coalesce(e->>'exerciseName','')) not between 1 and 72
        or coalesce(e->>'category','') !~ '^[a-z]{0,20}$'
        or coalesce(e->>'rank','') not in ('bronze','silver','gold','diamond')
        or jsonb_typeof(e->'level') <> 'number' or (e->>'level')::numeric not in (1,2,3,4,5,6,7,8,9,10,11,12)
        or e->>'rank' <> (array['bronze','silver','gold','diamond'])[ceil((e->>'level')::numeric/3)::int]
        or coalesce(e->>'measure','reps') not in ('reps','seconds','minutes','km','days','bw','sessions','streak'))
    and (select count(distinct e->>'exerciseId') from jsonb_array_elements(f) e) = jsonb_array_length(f);
$$;
alter table public.community_profiles add column if not exists featured_badges jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'community_profiles_featured_valid') then
    alter table public.community_profiles add constraint community_profiles_featured_valid check (public.community_valid_featured(featured_badges));
  end if;
  -- La foto de perfil solo puede estar en la carpeta propia: <user_id>/avatar/<nombre>.jpg
  if not exists (select 1 from pg_constraint where conname = 'community_profiles_avatar_own') then
    alter table public.community_profiles add constraint community_profiles_avatar_own
      check (avatar_path is null or avatar_path ~ ('^' || user_id::text || '/avatar/[A-Za-z0-9_-]{1,40}\.jpg$')) not valid;
  end if;
end $$;
grant update (featured_badges) on public.community_profiles to authenticated;

-- 3. Entrenamiento vinculado (resumen que la persona elige compartir; nunca peso corporal ni altura) ----------
create or replace function public.community_valid_linked_session(s jsonb)
returns boolean language sql immutable set search_path = public as $$
  select s is null or (
    jsonb_typeof(s) = 'object'
    and (select count(*) from jsonb_object_keys(s) k where k not in ('title','date','minutes','exercises','sets','type')) = 0
    and char_length(coalesce(s->>'title','')) between 1 and 80
    and coalesce(s->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
    and (s->'minutes' is null or (jsonb_typeof(s->'minutes') = 'number' and (s->>'minutes')::numeric between 0 and 600))
    and (s->'sets' is null or (jsonb_typeof(s->'sets') = 'number' and (s->>'sets')::numeric between 0 and 300))
    and coalesce(s->>'type','free') in ('daily','plan_extra','custom','free','manual','run')
    and (s->'exercises' is null or (jsonb_typeof(s->'exercises') = 'array' and jsonb_array_length(s->'exercises') <= 12
      and not exists (select 1 from jsonb_array_elements(s->'exercises') x where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 72))));
$$;
alter table public.community_posts add column if not exists linked_session jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'community_posts_linked_session_valid') then
    alter table public.community_posts add constraint community_posts_linked_session_valid check (public.community_valid_linked_session(linked_session));
  end if;
end $$;

-- 4. Foto de perfil: se lee solo si el perfil es visible para quien la pide (RLS de perfiles en la subconsulta) --
drop policy if exists community_media_read_avatar on storage.objects;
create policy community_media_read_avatar on storage.objects for select to anon, authenticated using (
  bucket_id = 'community-media' and (storage.foldername(name))[2] = 'avatar'
  and exists (select 1 from public.community_profiles cp where cp.user_id::text = (storage.foldername(name))[1] and cp.avatar_path = name)
);

-- 5. Conversaciones: último mensaje y no leídos por contacto. Invoker: el RLS de mensajes decide qué se ve. -----
create or replace function public.community_conversations()
returns table (partner_id uuid, username text, display_name text, avatar_path text, last_body text, last_at timestamptz, last_from_me boolean, unread integer)
language sql stable security invoker set search_path = public as $$
  with m as (
    select case when sender_id = auth.uid() then recipient_id else sender_id end as partner, body, created_at,
           sender_id = auth.uid() as mine, (recipient_id = auth.uid() and read_at is null) as is_unread
    from public.community_messages where sender_id = auth.uid() or recipient_id = auth.uid()
  ), last as (
    select distinct on (partner) partner, body, created_at, mine from m order by partner, created_at desc
  ), cnt as (
    select partner, count(*) filter (where is_unread)::int as unread from m group by partner
  )
  select l.partner, p.username, p.display_name, p.avatar_path, left(l.body, 140), l.created_at, l.mine, coalesce(c.unread, 0)
  from last l join public.community_profiles p on p.user_id = l.partner left join cnt c on c.partner = l.partner
  order by l.created_at desc limit 50
$$;
revoke all on function public.community_conversations() from public, anon;
grant execute on function public.community_conversations() to authenticated;

-- 6. Conteos reales de un perfil (publicaciones, seguidores, seguidos). Solo si el perfil es visible para quien
--    pregunta (público, propio o seguidor aceptado) y no hay bloqueo entre ambos.
create or replace function public.community_profile_stats(p_user uuid)
returns table (posts integer, followers integer, following integer)
language plpgsql stable security definer set search_path = public as $$
declare viewer uuid := auth.uid();
begin
  if not exists (
    select 1 from public.community_profiles cp where cp.user_id = p_user
      and (cp.user_id = viewer or cp.visibility = 'public'
           or exists (select 1 from public.community_follows f where f.follower_id = viewer and f.following_id = p_user and f.status = 'accepted'))
      and (viewer is null or not public.community_users_blocked(viewer, p_user))
  ) then return; end if;
  return query select
    (select count(*) from public.community_posts x where x.user_id = p_user and (x.user_id = viewer or x.visibility = 'public'
      or exists (select 1 from public.community_follows f where f.follower_id = viewer and f.following_id = p_user and f.status = 'accepted')))::int,
    (select count(*) from public.community_follows f where f.following_id = p_user and f.status = 'accepted')::int,
    (select count(*) from public.community_follows f where f.follower_id = p_user and f.status = 'accepted')::int;
end $$;
revoke all on function public.community_profile_stats(uuid) from public;
grant execute on function public.community_profile_stats(uuid) to anon, authenticated;

-- 7. Personas sugeridas: solo perfiles públicos, sin bloqueos, que todavía no seguís; con datos reales. ---------
create or replace function public.community_suggested_profiles()
returns table (user_id uuid, username text, display_name text, bio text, avatar_path text, posts integer, followers integer)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, left(coalesce(p.bio,''), 120), p.avatar_path,
    (select count(*) from public.community_posts x where x.user_id = p.user_id and x.visibility = 'public')::int,
    (select count(*) from public.community_follows f where f.following_id = p.user_id and f.status = 'accepted')::int
  from public.community_profiles p
  where p.visibility = 'public' and p.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and (auth.uid() is null or not public.community_users_blocked(auth.uid(), p.user_id))
    and not exists (select 1 from public.community_follows f where f.follower_id = auth.uid() and f.following_id = p.user_id)
  order by (select max(x.created_at) from public.community_posts x where x.user_id = p.user_id) desc nulls last, p.created_at desc
  limit 12
$$;
revoke all on function public.community_suggested_profiles() from public;
grant execute on function public.community_suggested_profiles() to anon, authenticated;

commit;
