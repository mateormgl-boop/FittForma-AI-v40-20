-- FittForma AI v41.0 — publicaciones de texto y de logros, edición propia y mensajes no leídos.
-- Requiere haber aplicado supabase/schema.sql y supabase/community.sql (v40.x).
-- Migración ADITIVA y re-ejecutable: no borra tablas, filas ni archivos.
--   * Las publicaciones existentes quedan como post_kind='transformation' con sus mismas reglas.
--   * Ninguna columna nueva permite marcar un logro como "verificado": la evidencia de un logro
--     compartido solo puede ser 'declared' (declarado) o 'gps_device' (ruta GPS comprobada en el
--     dispositivo del autor). Ambas las informa el cliente y la interfaz las muestra como no verificadas.
-- Probada con PostgreSQL 16 y un stub de auth/storage (ver supabase/tests/). Revisar en un
-- proyecto de pruebas de Supabase antes de producción.

begin;

-- 1. Tipos de publicación -------------------------------------------------------------
alter table public.community_posts add column if not exists post_kind text not null default 'transformation';
alter table public.community_posts add column if not exists image_path text;
alter table public.community_posts add column if not exists achievement jsonb;
alter table public.community_posts add column if not exists updated_at timestamptz;

alter table public.community_posts alter column before_path drop not null;
alter table public.community_posts alter column after_path drop not null;
alter table public.community_posts alter column start_date drop not null;
alter table public.community_posts alter column end_date drop not null;

create or replace function public.community_valid_achievement(a jsonb)
returns boolean language sql immutable set search_path=public as $$
  select a is not null and jsonb_typeof(a)='object'
    and (select count(*) from jsonb_object_keys(a) k where k not in ('exerciseId','exerciseName','category','rank','level','threshold','measure','evidence','earnedAt')) = 0
    and jsonb_typeof(a->'exerciseName')='string' and char_length(a->>'exerciseName') between 1 and 72
    and jsonb_typeof(a->'exerciseId')='string' and (a->>'exerciseId') ~ '^[a-z0-9-]{1,80}$'
    and coalesce(a->>'category','') ~ '^[a-z]{0,20}$'
    and a->>'rank' in ('bronze','silver','gold','diamond')
    and jsonb_typeof(a->'level')='number' and (a->>'level')::numeric in (1,2,3,4,5,6,7,8,9,10,11,12)
    and a->>'rank' = (array['bronze','silver','gold','diamond'])[ceil((a->>'level')::numeric/3)::int]
    and jsonb_typeof(a->'threshold')='number' and (a->>'threshold')::numeric > 0 and (a->>'threshold')::numeric <= 100000
    and a->>'measure' in ('reps','seconds','minutes','km','days')
    and a->>'evidence' in ('declared','gps_device')
    and (a->>'evidence' <> 'gps_device' or a->>'measure'='km')
    and (a->>'earnedAt') ~ '^\d{4}-\d{2}-\d{2}$';
$$;

alter table public.community_posts drop constraint if exists community_post_kind_valid;
alter table public.community_posts add constraint community_post_kind_valid check (
  (post_kind='transformation' and before_path is not null and after_path is not null and start_date is not null and end_date is not null and achievement is null and image_path is null)
  or (post_kind='text' and char_length(trim(description)) between 1 and 1200 and before_path is null and after_path is null and achievement is null)
  or (post_kind='achievement' and public.community_valid_achievement(achievement) and before_path is null and after_path is null)
);
alter table public.community_posts drop constraint if exists community_image_path_owner;
alter table public.community_posts add constraint community_image_path_owner check (image_path is null or image_path like user_id::text || '/%');

-- 2. Edición propia: solo el texto de la descripción --------------------------------------
create or replace function public.community_touch_post_update()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists community_touch_post_update_trigger on public.community_posts;
create trigger community_touch_post_update_trigger before update on public.community_posts
for each row execute function public.community_touch_post_update();

drop policy if exists community_posts_update_own on public.community_posts;
create policy community_posts_update_own on public.community_posts for update to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
revoke update on public.community_posts from anon, authenticated;
grant update(description) on public.community_posts to authenticated;

-- 3. Foto opcional en publicaciones de texto/logro: lectura con las mismas reglas del post --
drop policy if exists community_media_read_allowed on storage.objects;
create policy community_media_read_allowed on storage.objects for select to anon,authenticated using (
  bucket_id='community-media' and exists(
    select 1 from public.community_posts p where p.user_id::text=(storage.foldername(name))[1]
      and (p.before_path=name or p.after_path=name or p.image_path=name)
      and (auth.uid() is null or not public.community_users_blocked(auth.uid(),p.user_id))
      and (p.user_id=auth.uid() or (p.visibility='public' and exists(select 1 from public.community_profiles cp where cp.user_id=p.user_id and cp.visibility='public')) or exists(select 1 from public.community_follows f where f.follower_id=auth.uid() and f.following_id=p.user_id and f.status='accepted'))
  )
);

-- 4. Mensajes no leídos: solo el destinatario puede marcar read_at ------------------------
alter table public.community_messages add column if not exists read_at timestamptz;
create index if not exists community_messages_unread_idx on public.community_messages(recipient_id) where read_at is null;

create or replace function public.community_guard_message_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.id<>old.id or new.sender_id<>old.sender_id or new.recipient_id<>old.recipient_id or new.body<>old.body or new.created_at<>old.created_at then
    raise exception 'Solo se puede marcar un mensaje como leído.';
  end if;
  if old.read_at is not null then new.read_at := old.read_at; end if;
  if new.read_at is not null and old.read_at is null then new.read_at := now(); end if;
  return new;
end; $$;
drop trigger if exists community_guard_message_update_trigger on public.community_messages;
create trigger community_guard_message_update_trigger before update on public.community_messages
for each row execute function public.community_guard_message_update();

drop policy if exists community_messages_mark_read on public.community_messages;
create policy community_messages_mark_read on public.community_messages for update to authenticated
  using (recipient_id=auth.uid() and not public.community_users_blocked(sender_id,recipient_id))
  with check (recipient_id=auth.uid());
revoke update on public.community_messages from anon, authenticated;
grant update(read_at) on public.community_messages to authenticated;

commit;
