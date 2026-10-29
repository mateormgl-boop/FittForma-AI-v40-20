-- FittForma AI — todas las migraciones de la base, en orden (2026-10-17_v41_posts_achievements_unread.sql → 2026-11-02_v66_wall_challenges.sql).
-- Pegá este archivo completo en Supabase → SQL Editor → Run, en el proyecto de la app.
-- Es seguro aunque algunas ya estén aplicadas: cada bloque se puede ejecutar más de una vez, no borra tablas,
-- datos ni políticas que no vuelva a crear, y no desactiva RLS. Requiere haber aplicado antes schema.sql y community.sql.
-- Generado con: node tools/build-migrations-bundle.mjs (no editar a mano).

-- ===================================================================
-- 2026-10-17_v41_posts_achievements_unread.sql
-- ===================================================================
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

-- ===================================================================
-- 2026-10-18_v43_moderation_account_deletion.sql
-- ===================================================================
-- FittForma AI v43 — moderación de denuncias y eliminación de la propia cuenta.
-- Requiere schema.sql, community.sql y la migración v41. ADITIVA y re-ejecutable: no borra datos.
--
-- Moderadores: no se pueden asignar desde la app. La persona dueña del proyecto los agrega en el
-- SQL Editor con:  insert into public.community_moderators(user_id) values ('UUID-DEL-USUARIO');
-- Eliminación de cuenta: la app primero borra los archivos de Storage de la persona y después llama
-- a public.delete_my_account(), que elimina auth.users y, en cascada, todos sus datos de la base.

begin;

-- 1. Moderadores --------------------------------------------------------------------------
create table if not exists public.community_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.community_moderators enable row level security;
revoke all on public.community_moderators from public, anon, authenticated;

create or replace function public.community_is_moderator()
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.community_moderators m where m.user_id=auth.uid());
$$;
revoke all on function public.community_is_moderator() from public;
grant execute on function public.community_is_moderator() to authenticated;

-- 2. Estado de las denuncias ------------------------------------------------------------
alter table public.community_reports add column if not exists status text not null default 'open';
alter table public.community_reports add column if not exists resolved_at timestamptz;
alter table public.community_reports add column if not exists resolved_by uuid references auth.users(id) on delete set null;
alter table public.community_reports drop constraint if exists community_report_status_valid;
alter table public.community_reports add constraint community_report_status_valid check (status in ('open','dismissed','actioned'));

create or replace function public.community_stamp_report_resolution()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.reporter_id<>old.reporter_id or new.post_id<>old.post_id or new.reason<>old.reason or new.created_at<>old.created_at then
    raise exception 'Solo se puede cambiar el estado de una denuncia.';
  end if;
  new.resolved_at := case when new.status='open' then null else now() end;
  new.resolved_by := case when new.status='open' then null else auth.uid() end;
  return new;
end; $$;
revoke all on function public.community_stamp_report_resolution() from public,anon,authenticated;
drop trigger if exists community_stamp_report_resolution_trigger on public.community_reports;
create trigger community_stamp_report_resolution_trigger before update on public.community_reports
for each row execute function public.community_stamp_report_resolution();

drop policy if exists community_reports_read_moderator on public.community_reports;
create policy community_reports_read_moderator on public.community_reports for select to authenticated using (public.community_is_moderator());
drop policy if exists community_reports_update_moderator on public.community_reports;
create policy community_reports_update_moderator on public.community_reports for update to authenticated using (public.community_is_moderator()) with check (public.community_is_moderator());
grant select on public.community_reports to authenticated;
grant update(status) on public.community_reports to authenticated;

-- Los moderadores pueden leer las publicaciones denunciadas aunque sean privadas, y eliminarlas.
drop policy if exists community_posts_read_reported_moderator on public.community_posts;
create policy community_posts_read_reported_moderator on public.community_posts for select to authenticated
  using (public.community_is_moderator() and exists(select 1 from public.community_reports r where r.post_id=community_posts.id));
drop policy if exists community_posts_delete_moderator on public.community_posts;
create policy community_posts_delete_moderator on public.community_posts for delete to authenticated using (public.community_is_moderator());
drop policy if exists community_media_delete_moderator on storage.objects;
create policy community_media_delete_moderator on storage.objects for delete to authenticated using (bucket_id='community-media' and public.community_is_moderator());

-- 3. Eliminar la propia cuenta ------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path=public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Tenés que iniciar sesión para eliminar tu cuenta.'; end if;
  delete from auth.users where id=uid;  -- cascada: user_app_data, community_profiles y todo lo que depende de ellas
end; $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

-- ===================================================================
-- 2026-10-19_v44_security_hardening.sql
-- ===================================================================
-- FittForma AI v44 — endurecimiento de seguridad (Etapa 6).
-- Requiere schema.sql, community.sql y las migraciones v41 y v43. ADITIVA y re-ejecutable: no borra datos.
--
-- 1. Seguimientos: solo se puede cambiar `status` (antes, con los permisos por defecto de Supabase, la
--    persona seguida podía reescribir follower_id y fabricar un seguimiento mutuo para enviar mensajes).
-- 2. Fechas del servidor: created_at lo pone la base en cada alta (fechas futuras fijaban un post arriba).
-- 3. Límites anti-spam para publicaciones, comentarios, me gusta, seguimientos y denuncias.
-- 4. Perfiles: columnas editables explícitas; avatar_path solo dentro de la carpeta propia.
-- 5. Mensajes: no se pueden crear ya marcados como leídos.
-- 6. Búsqueda de perfiles: el mínimo de 2 caracteres se mide después de limpiar el término.
-- 7. Copia en la nube: tamaño máximo por cuenta.
-- 8. Eliminar cuenta: no procede si quedan archivos en Storage.

begin;

-- 1. Seguimientos -------------------------------------------------------------------------
revoke update on public.community_follows from anon, authenticated;
grant update(status) on public.community_follows to authenticated;

create or replace function public.community_guard_follow_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.follower_id<>old.follower_id or new.following_id<>old.following_id or new.created_at<>old.created_at then
    raise exception 'Solo se puede aceptar una solicitud de seguimiento.';
  end if;
  return new;
end; $$;
revoke all on function public.community_guard_follow_update() from public, anon, authenticated;
drop trigger if exists community_guard_follow_update_trigger on public.community_follows;
create trigger community_guard_follow_update_trigger before update on public.community_follows
for each row execute function public.community_guard_follow_update();

-- 2 y 3. Fechas del servidor y límites por cuenta -----------------------------------------
-- Las altas hechas sin sesión (SQL Editor, tareas del dueño) no se limitan ni se re-fechan.
create index if not exists community_comments_user_time_idx on public.community_comments(user_id,created_at desc);
create index if not exists community_likes_user_time_idx on public.community_likes(user_id,created_at desc);
create index if not exists community_follows_follower_time_idx on public.community_follows(follower_id,created_at desc);
create index if not exists community_reports_reporter_time_idx on public.community_reports(reporter_id,created_at desc);

create or replace function public.community_guard_insert()
returns trigger language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); per_minute int; per_day int; recent int; daily int; label text;
begin
  if uid is null then return new; end if;
  new.created_at := now();
  if tg_table_name='community_posts' then
    new.updated_at := null;
    per_minute := 5; per_day := 30; label := 'publicaciones';
    select count(*) filter (where created_at>now()-interval '1 minute'), count(*) into recent, daily
      from public.community_posts where user_id=uid and created_at>now()-interval '24 hours';
  elsif tg_table_name='community_comments' then
    per_minute := 10; per_day := 300; label := 'comentarios';
    select count(*) filter (where created_at>now()-interval '1 minute'), count(*) into recent, daily
      from public.community_comments where user_id=uid and created_at>now()-interval '24 hours';
  elsif tg_table_name='community_likes' then
    per_minute := 60; per_day := 1000; label := 'me gusta';
    select count(*) filter (where created_at>now()-interval '1 minute'), count(*) into recent, daily
      from public.community_likes where user_id=uid and created_at>now()-interval '24 hours';
  elsif tg_table_name='community_follows' then
    per_minute := 20; per_day := 200; label := 'solicitudes de seguimiento';
    select count(*) filter (where created_at>now()-interval '1 minute'), count(*) into recent, daily
      from public.community_follows where follower_id=uid and created_at>now()-interval '24 hours';
  elsif tg_table_name='community_reports' then
    per_minute := 5; per_day := 30; label := 'denuncias';
    select count(*) filter (where created_at>now()-interval '1 minute'), count(*) into recent, daily
      from public.community_reports where reporter_id=uid and created_at>now()-interval '24 hours';
  else
    return new;
  end if;
  -- Serializa altas simultáneas de la misma cuenta para que no se salteen el límite.
  perform pg_advisory_xact_lock(hashtext(uid::text||tg_table_name), 20261019);
  if recent>=per_minute then raise exception 'Demasiadas % en un minuto. Esperá un momento.', label; end if;
  if daily>=per_day then raise exception 'Llegaste al límite diario de %.', label; end if;
  return new;
end; $$;
revoke all on function public.community_guard_insert() from public, anon, authenticated;

drop trigger if exists community_guard_insert_trigger on public.community_posts;
create trigger community_guard_insert_trigger before insert on public.community_posts for each row execute function public.community_guard_insert();
drop trigger if exists community_guard_insert_trigger on public.community_comments;
create trigger community_guard_insert_trigger before insert on public.community_comments for each row execute function public.community_guard_insert();
drop trigger if exists community_guard_insert_trigger on public.community_likes;
create trigger community_guard_insert_trigger before insert on public.community_likes for each row execute function public.community_guard_insert();
drop trigger if exists community_guard_insert_trigger on public.community_follows;
create trigger community_guard_insert_trigger before insert on public.community_follows for each row execute function public.community_guard_insert();
drop trigger if exists community_guard_insert_trigger on public.community_reports;
create trigger community_guard_insert_trigger before insert on public.community_reports for each row execute function public.community_guard_insert();

-- 4. Perfiles -----------------------------------------------------------------------------
revoke update on public.community_profiles from anon, authenticated;
-- user_id se incluye porque supabase-js hace upsert; la política exige user_id=auth.uid().
grant update(user_id, username, display_name, bio, visibility, avatar_path, updated_at) on public.community_profiles to authenticated;

create or replace function public.community_guard_profile_write()
returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op='INSERT' then new.created_at := now(); else new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.community_guard_profile_write() from public, anon, authenticated;
drop trigger if exists community_guard_profile_write_trigger on public.community_profiles;
create trigger community_guard_profile_write_trigger before insert or update on public.community_profiles
for each row execute function public.community_guard_profile_write();

alter table public.community_profiles drop constraint if exists community_avatar_path_owner;
alter table public.community_profiles add constraint community_avatar_path_owner
  check (avatar_path is null or avatar_path like user_id::text || '/%') not valid;

-- 5. Mensajes: nunca se crean leídos (misma función de v41 + read_at := null) ----------------
create or replace function public.community_limit_message_rate()
returns trigger language plpgsql security definer set search_path=public as $$
declare recent_count integer; day_count integer;
begin
  if auth.uid() is null or new.sender_id <> auth.uid() then raise exception 'Invalid message sender.'; end if;
  new.created_at := now();
  new.read_at := null;
  -- Serialize concurrent sends per account so parallel requests cannot race past the limits.
  perform pg_advisory_xact_lock(hashtext(new.sender_id::text), 19831014);
  select count(*) into recent_count from public.community_message_events e where e.sender_id=new.sender_id and e.created_at>now()-interval '1 minute';
  if recent_count >= 10 then raise exception 'Message rate limit exceeded. Wait before sending more messages.'; end if;
  select count(*) into day_count from public.community_message_events e where e.sender_id=new.sender_id and e.created_at>now()-interval '24 hours';
  if day_count >= 100 then raise exception 'Daily message limit exceeded.'; end if;
  insert into public.community_message_events(sender_id,created_at) values(new.sender_id,now());
  if random()<0.01 then delete from public.community_message_events where created_at<now()-interval '7 days'; end if;
  return new;
end; $$;
revoke all on function public.community_limit_message_rate() from public,anon,authenticated;

-- 6. Búsqueda de perfiles -----------------------------------------------------------------
create or replace function public.search_community_profiles(search_term text)
returns table(user_id uuid,display_name text,username text,bio text,visibility text)
language sql stable security definer set search_path=public as $$
  with t as (select left(regexp_replace(lower(trim(coalesce(search_term,''))), '[^a-z0-9_.-]', '', 'g'),24) as clean)
  select p.user_id,p.display_name,p.username,
    case when p.visibility='public' then p.bio else '' end as bio,
    p.visibility
  from public.community_profiles p, t
  where length(t.clean) >= 2
    and (p.visibility='public' or auth.uid() is not null)
    and (auth.uid() is null or not public.community_users_blocked(auth.uid(),p.user_id))
    and p.username like '%' || replace(t.clean,'_','\_') || '%'
  order by (p.visibility='public') desc, p.username asc
  limit 10;
$$;
revoke all on function public.search_community_profiles(text) from public;
grant execute on function public.search_community_profiles(text) to anon,authenticated;

-- 7. Copia en la nube: hasta 3 MB por cuenta (no valida filas existentes) --------------------
alter table public.user_app_data drop constraint if exists user_app_data_size;
alter table public.user_app_data add constraint user_app_data_size check (octet_length(data::text) <= 3000000) not valid;

-- 8. Eliminar cuenta: exige que la app haya borrado antes los archivos de Storage -----------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path=public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Tenés que iniciar sesión para eliminar tu cuenta.'; end if;
  if exists(select 1 from storage.objects o where o.bucket_id='community-media' and (storage.foldername(o.name))[1]=uid::text) then
    raise exception 'Todavía quedan fotos tuyas en Storage. Volvé a intentarlo para borrarlas primero.';
  end if;
  delete from auth.users where id=uid;  -- cascada: user_app_data, community_profiles y todo lo que depende de ellas
end; $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- La app la consulta ANTES de borrar fotos: si la migración no está aplicada, no se toca nada.
create or replace function public.account_deletion_ready()
returns boolean language sql stable security definer set search_path=public as $$ select auth.uid() is not null; $$;
revoke all on function public.account_deletion_ready() from public, anon;
grant execute on function public.account_deletion_ready() to authenticated;

-- 9. Moderación: las denuncias se conservan aunque se elimine la publicación -----------------
alter table public.community_reports add column if not exists post_excerpt text;
alter table public.community_reports alter column post_id drop not null;
alter table public.community_reports drop constraint if exists community_reports_post_id_fkey;
alter table public.community_reports add constraint community_reports_post_id_fkey
  foreign key (post_id) references public.community_posts(id) on delete set null;

create or replace function public.community_stamp_report_resolution()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- Al borrarse la publicación, la base pone post_id en null: es el único cambio permitido además del estado.
  if new.reporter_id<>old.reporter_id or (new.post_id is distinct from old.post_id and new.post_id is not null)
     or new.reason<>old.reason or new.created_at<>old.created_at or new.post_excerpt is distinct from old.post_excerpt then
    raise exception 'Solo se puede cambiar el estado de una denuncia.';
  end if;
  if new.status is distinct from old.status then
    new.resolved_at := case when new.status='open' then null else now() end;
    new.resolved_by := case when new.status='open' then null else auth.uid() end;
    if new.status='actioned' and new.post_id is not null then
      new.post_excerpt := (select left(coalesce(p.description,''),280) from public.community_posts p where p.id=new.post_id);
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.community_stamp_report_resolution() from public,anon,authenticated;

commit;

-- ===================================================================
-- 2026-10-20_v48_daily_training.sql
-- ===================================================================
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

-- ===================================================================
-- 2026-10-21_v48_monetization.sql
-- ===================================================================
-- FittForma AI v48 — monetización: contadores diarios, recompensas de un solo uso, límite de fotos y
-- membresía verificada por Google Play. Requiere schema.sql, community.sql y las migraciones v41–v44.
-- ADITIVA y re-ejecutable: crea tablas/funciones y agrega columnas opcionales; no borra ni cambia datos.
--
-- Seguridad:
--   * Las tablas de contadores y recompensas no se pueden leer ni escribir desde el navegador.
--   * Las funciones que conceden algo solo las puede ejecutar service_role (el backend, con la clave de
--     servicio en el servidor; nunca en el navegador).
--   * El límite de fotos lo aplica la base (trigger) y está DESACTIVADO por defecto
--     (monetization_settings.photo_limit_enabled = false) para no cambiar nada hasta activar anuncios.

begin;

create table if not exists public.monetization_settings (
  id boolean primary key default true check (id),
  photo_limit_enabled boolean not null default false,
  photos_free_per_day integer not null default 2 check (photos_free_per_day between 0 and 50),
  photos_plus_per_day integer not null default 10 check (photos_plus_per_day between 0 and 200),
  photos_max_extra_per_day integer not null default 3 check (photos_max_extra_per_day between 0 and 20),
  timezone text not null default 'America/Montevideo',
  updated_at timestamptz not null default now()
);
insert into public.monetization_settings(id) values (true) on conflict (id) do nothing;

create table if not exists public.monetization_usage (
  subject text not null check (char_length(subject) between 3 and 80),
  day date not null,
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject, day, kind)
);

create table if not exists public.monetization_rewards (
  nonce text primary key check (nonce ~ '^[A-Za-z0-9_-]{20,40}$'),
  subject text not null,
  day date not null,
  kind text not null check (kind in ('ai','photo')),
  started_at timestamptz not null,
  claimed_at timestamptz
);
create index if not exists monetization_rewards_subject_day on public.monetization_rewards(subject, day);

create table if not exists public.monetization_play_purchases (
  purchase_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text,
  updated_at timestamptz not null default now()
);

-- Columnas opcionales para saber de dónde viene la membresía (no cambian las filas existentes).
alter table public.community_memberships add column if not exists source text;
alter table public.community_memberships add column if not exists product_id text;

alter table public.monetization_settings enable row level security;
alter table public.monetization_usage enable row level security;
alter table public.monetization_rewards enable row level security;
alter table public.monetization_play_purchases enable row level security;
revoke all on public.monetization_settings, public.monetization_usage, public.monetization_rewards, public.monetization_play_purchases from anon, authenticated;
-- La configuración pública (sin datos personales) se puede leer para mostrar los límites en la app.
grant select on public.monetization_settings to anon, authenticated;
drop policy if exists monetization_settings_read on public.monetization_settings;
create policy monetization_settings_read on public.monetization_settings for select to anon, authenticated using (true);

-- Día de la app según la zona horaria configurada (igual que el backend).
create or replace function public.monetization_today()
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from public.monetization_settings where id), 'America/Montevideo'))::date
$$;

create or replace function public.monetization_get(p_subject text, p_day date, p_kind text)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select count from public.monetization_usage where subject = p_subject and day = p_day and kind = p_kind), 0)
$$;

-- Suma atómica con tope: devuelve el nuevo valor o -1 si superaría el tope o quedaría negativo.
create or replace function public.monetization_bump(p_subject text, p_day date, p_kind text, p_delta integer, p_cap integer default null)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare cur integer;
begin
  insert into public.monetization_usage(subject, day, kind, count) values (p_subject, p_day, p_kind, 0) on conflict do nothing;
  select count into cur from public.monetization_usage where subject = p_subject and day = p_day and kind = p_kind for update;
  if cur + p_delta < 0 or (p_cap is not null and cur + p_delta > p_cap) then return -1; end if;
  update public.monetization_usage set count = cur + p_delta, updated_at = now() where subject = p_subject and day = p_day and kind = p_kind;
  return cur + p_delta;
end $$;

create or replace function public.monetization_reward_start(p_nonce text, p_subject text, p_day date, p_kind text, p_started_at timestamptz)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.monetization_rewards(nonce, subject, day, kind, started_at) values (p_nonce, p_subject, p_day, p_kind, least(p_started_at, now()));
  return true;
end $$;

create or replace function public.monetization_reward_get(p_nonce text)
returns setof public.monetization_rewards language sql stable security definer set search_path = public as $$
  select * from public.monetization_rewards where nonce = p_nonce
$$;

-- Canje único: solo la primera solicitud marca claimed_at; las repetidas o simultáneas devuelven false.
create or replace function public.monetization_reward_claim(p_nonce text, p_claimed_at timestamptz)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare n integer;
begin
  update public.monetization_rewards set claimed_at = least(p_claimed_at, now()) where nonce = p_nonce and claimed_at is null;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.monetization_photo_posts(p_user_id uuid, p_day date)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.community_posts p
  where p.user_id = p_user_id
    and (p.created_at at time zone coalesce((select timezone from public.monetization_settings where id), 'America/Montevideo'))::date = p_day
    and (p.before_path is not null or p.after_path is not null or p.image_path is not null)
$$;

-- Plus vigente según community_memberships (escrita solo por pagos verificados).
create or replace function public.monetization_is_plus(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.community_memberships m where m.user_id = p_user_id and m.tier in ('pro') and m.status = 'active' and (m.current_period_end is null or m.current_period_end > now()))
$$;

create or replace function public.monetization_set_membership(p_user_id uuid, p_status text, p_period_end timestamptz, p_source text, p_purchase_token text default null, p_product_id text default null)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if p_status not in ('active','inactive','past_due','cancelled') then raise exception 'invalid_status'; end if;
  insert into public.community_memberships(user_id, tier, status, current_period_end, source, product_id, updated_at)
  values (p_user_id, 'pro', p_status, p_period_end, p_source, p_product_id, now())
  on conflict (user_id) do update set tier = 'pro', status = excluded.status, current_period_end = excluded.current_period_end, source = excluded.source, product_id = coalesce(excluded.product_id, public.community_memberships.product_id), updated_at = now();
  if p_purchase_token is not null then
    insert into public.monetization_play_purchases(purchase_token, user_id, product_id) values (p_purchase_token, p_user_id, p_product_id)
    on conflict (purchase_token) do update set updated_at = now() where public.monetization_play_purchases.user_id = p_user_id;
  end if;
  return true;
end $$;

create or replace function public.monetization_user_for_purchase(p_purchase_token text)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.monetization_play_purchases where purchase_token = p_purchase_token
$$;

-- Límite de fotos por día aplicado por la base (solo si se activa en monetization_settings).
create or replace function public.monetization_guard_photo_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.monetization_settings; posted integer; extra integer; allowed integer; today date;
begin
  if new.before_path is null and new.after_path is null and new.image_path is null then return new; end if;
  select * into s from public.monetization_settings where id;
  if not coalesce(s.photo_limit_enabled, false) then return new; end if;
  -- Serializa publicaciones simultáneas de la misma cuenta.
  perform pg_advisory_xact_lock(hashtext('photo:' || new.user_id::text));
  today := public.monetization_today();
  posted := public.monetization_photo_posts(new.user_id, today);
  if public.monetization_is_plus(new.user_id) then allowed := s.photos_plus_per_day;
  else
    extra := least(public.monetization_get('u:' || new.user_id::text, today, 'photo_extra'), s.photos_max_extra_per_day);
    allowed := s.photos_free_per_day + extra;
  end if;
  if posted >= allowed then raise exception 'photo_daily_limit' using errcode = 'P0001', hint = 'Mirá un video para publicar una foto más o volvé mañana.'; end if;
  return new;
end $$;
drop trigger if exists monetization_guard_photo_post on public.community_posts;
create trigger monetization_guard_photo_post before insert on public.community_posts for each row execute function public.monetization_guard_photo_post();

-- Estado para la app: cuántas fotos quedan hoy (lectura de la cuenta propia).
create or replace function public.my_photo_quota()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.monetization_settings; today date; posted integer; extra integer; plus boolean;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into s from public.monetization_settings where id; today := public.monetization_today();
  posted := public.monetization_photo_posts(uid, today); plus := public.monetization_is_plus(uid);
  extra := least(public.monetization_get('u:' || uid::text, today, 'photo_extra'), s.photos_max_extra_per_day);
  return jsonb_build_object('enabled', s.photo_limit_enabled, 'plan', case when plus then 'plus' else 'free' end, 'posted', posted, 'extra', extra,
    'allowed', case when plus then s.photos_plus_per_day else s.photos_free_per_day + extra end, 'day', today);
end $$;

do $$ declare f text; begin
  foreach f in array array['monetization_today()','monetization_get(text,date,text)','monetization_bump(text,date,text,integer,integer)','monetization_reward_start(text,text,date,text,timestamptz)','monetization_reward_get(text)','monetization_reward_claim(text,timestamptz)','monetization_photo_posts(uuid,date)','monetization_is_plus(uuid)','monetization_set_membership(uuid,text,timestamptz,text,text,text)','monetization_user_for_purchase(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function public.%s to service_role', f); end if;
  end loop;
  -- El backend lee los límites de fotos de esta tabla (misma fuente que el trigger).
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant select on public.monetization_settings to service_role'; end if;
end $$;
revoke all on function public.my_photo_quota() from public, anon;
grant execute on function public.my_photo_quota() to authenticated;
revoke all on function public.monetization_guard_photo_post() from public, anon, authenticated;

commit;

-- ===================================================================
-- 2026-10-22_v49_badges.sql
-- ===================================================================
-- FittForma AI v49 — insignias: nuevas medidas y fuente «registrada en sesión» en los logros compartidos.
-- ADITIVA y re-ejecutable: solo amplía la validación del logro (no cambia filas ni políticas).
--   measure: + 'bw' (múltiplo del peso corporal en la mejor serie), 'sessions' (entrenamientos completos),
--            'streak' (días seguidos con actividad).
--   evidence: + 'session' (dato tomado de una sesión registrada en la app; no es una verificación independiente).
-- El resto de las reglas de v41 se mantienen igual (claves permitidas, rango acorde al nivel, GPS solo en km).

begin;

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
    and a->>'measure' in ('reps','seconds','minutes','km','days','bw','sessions','streak')
    and (a->>'measure' <> 'bw' or (a->>'threshold')::numeric <= 5)
    and a->>'evidence' in ('declared','gps_device','session')
    and (a->>'evidence' <> 'gps_device' or a->>'measure'='km')
    and (a->>'earnedAt') ~ '^\d{4}-\d{2}-\d{2}$';
$$;

commit;

-- ===================================================================
-- 2026-10-23_v49_community.sql
-- ===================================================================
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

-- ===================================================================
-- 2026-10-24_v50_community_directory.sql
-- ===================================================================
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

-- ===================================================================
-- 2026-10-26_v52_rank_board.sql
-- ===================================================================
-- FittForma AI v52 — Ranking de rangos con amigos (opcional y privado por defecto).
-- ADITIVA y re-ejecutable: crea una tabla nueva y funciones; no toca datos existentes. RLS activo.
-- Solo se comparte el RANGO GENERAL del «Mapa de avances» (y dos números para ordenar). No se comparten peso,
-- medidas, series por músculo ni entrenamientos. La fila existe solo si la persona activó «Compartir mi rango»;
-- al desactivarlo se borra.

begin;

create table if not exists public.community_rank_shares (
  user_id uuid primary key references auth.users(id) on delete cascade,
  overall_rank smallint not null check (overall_rank between -1 and 8),
  median_sets numeric(7,1) not null default 0 check (median_sets between 0 and 99999),
  balance smallint not null default 0 check (balance between 0 and 100),
  ranked_muscles smallint not null default 0 check (ranked_muscles between 0 and 20),
  updated_at timestamptz not null default now()
);
alter table public.community_rank_shares enable row level security;

-- Cada persona maneja solo su propia fila. La lectura de otras personas va por la función del ranking.
drop policy if exists rank_shares_select_own on public.community_rank_shares;
create policy rank_shares_select_own on public.community_rank_shares for select to authenticated using (user_id = auth.uid());
drop policy if exists rank_shares_insert_own on public.community_rank_shares;
create policy rank_shares_insert_own on public.community_rank_shares for insert to authenticated with check (user_id = auth.uid());
drop policy if exists rank_shares_update_own on public.community_rank_shares;
create policy rank_shares_update_own on public.community_rank_shares for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists rank_shares_delete_own on public.community_rank_shares;
create policy rank_shares_delete_own on public.community_rank_shares for delete to authenticated using (user_id = auth.uid());
revoke all on public.community_rank_shares from anon;
grant select, insert, update, delete on public.community_rank_shares to authenticated;

-- Ranking: vos (si compartís) + las personas que seguís con solicitud ACEPTADA que comparten su rango,
-- sin bloqueos en ninguna dirección. Sin sesión no devuelve nada.
create or replace function public.community_rank_board()
returns table (user_id uuid, username text, display_name text, avatar_path text, overall_rank smallint, median_sets numeric, balance smallint, ranked_muscles smallint, is_self boolean, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.user_id, p.username, p.display_name, p.avatar_path, s.overall_rank, s.median_sets, s.balance, s.ranked_muscles, s.user_id = auth.uid(), s.updated_at
  from public.community_rank_shares s
  join public.community_profiles p on p.user_id = s.user_id
  where auth.uid() is not null
    and (s.user_id = auth.uid()
         or (exists (select 1 from public.community_follows f where f.follower_id = auth.uid() and f.following_id = s.user_id and f.status = 'accepted')
             and not public.community_users_blocked(auth.uid(), s.user_id)))
  order by s.overall_rank desc, s.median_sets desc, p.username asc
  limit 100
$$;
revoke all on function public.community_rank_board() from public, anon;
grant execute on function public.community_rank_board() to authenticated;

commit;

-- ===================================================================
-- 2026-10-27_v53_athlete_community.sql
-- ===================================================================
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

-- ===================================================================
-- 2026-10-28_v53_profile_extras.sql
-- ===================================================================
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

-- ===================================================================
-- 2026-10-29_v54_weekly_alerts.sql
-- ===================================================================
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

-- ===================================================================
-- 2026-10-30_v57_legend_badges.sql
-- ===================================================================
-- FittForma AI v57 — Insignias de 15 niveles: se suma el rango «Legendario» (niveles 13 a 15) arriba de Diamante.
-- ADITIVA y re-ejecutable: solo reemplaza dos funciones de validación para aceptar también los niveles 13–15 con
-- rango 'legend'. Todo lo que ya era válido sigue siéndolo (niveles 1–12 con los mismos rangos). No borra tablas,
-- datos ni políticas; RLS sigue activo.

begin;

create or replace function public.community_valid_achievement(a jsonb)
returns boolean language sql immutable set search_path=public as $$
  select a is not null and jsonb_typeof(a)='object'
    and (select count(*) from jsonb_object_keys(a) k where k not in ('exerciseId','exerciseName','category','rank','level','threshold','measure','evidence','earnedAt')) = 0
    and jsonb_typeof(a->'exerciseName')='string' and char_length(a->>'exerciseName') between 1 and 72
    and jsonb_typeof(a->'exerciseId')='string' and (a->>'exerciseId') ~ '^[a-z0-9-]{1,80}$'
    and coalesce(a->>'category','') ~ '^[a-z]{0,20}$'
    and a->>'rank' in ('bronze','silver','gold','diamond','legend')
    and jsonb_typeof(a->'level')='number' and (a->>'level')::numeric in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15)
    and a->>'rank' = (array['bronze','silver','gold','diamond','legend'])[ceil((a->>'level')::numeric/3)::int]
    and jsonb_typeof(a->'threshold')='number' and (a->>'threshold')::numeric > 0 and (a->>'threshold')::numeric <= 100000
    and a->>'measure' in ('reps','seconds','minutes','km','days','bw','sessions','streak')
    and (a->>'measure' <> 'bw' or (a->>'threshold')::numeric <= 5)
    and a->>'evidence' in ('declared','gps_device','session')
    and (a->>'evidence' <> 'gps_device' or a->>'measure'='km')
    and (a->>'earnedAt') ~ '^\d{4}-\d{2}-\d{2}$';
$$;

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
        or coalesce(e->>'rank','') not in ('bronze','silver','gold','diamond','legend')
        or jsonb_typeof(e->'level') <> 'number' or (e->>'level')::numeric not in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15)
        or e->>'rank' <> (array['bronze','silver','gold','diamond','legend'])[ceil((e->>'level')::numeric/3)::int]
        or coalesce(e->>'measure','reps') not in ('reps','seconds','minutes','km','days','bw','sessions','streak'))
    and (select count(distinct e->>'exerciseId') from jsonb_array_elements(f) e) = jsonb_array_length(f);
$$;

commit;

-- ===================================================================
-- 2026-10-31_v62_body_share.sql
-- ===================================================================
-- FittForma AI v62 — Datos corporales en Comunidad: PRIVADOS por defecto, la persona elige cuáles mostrar.
-- ADITIVA y re-ejecutable: crea una tabla y una función nuevas y ajusta el search_path de tres funciones existentes
-- (sin cambiar lo que hacen). No borra ni modifica datos, tablas, funciones ni políticas existentes. RLS activo.
-- Requiere la migración 2026-10-28_v53_profile_extras.sql.
--
-- * Peso actual, altura, peso objetivo y objetivo de entrenamiento. Cada dato se guarda en la nube SOLO si la persona
--   activó su interruptor en Comunidad → Mi perfil; un dato no compartido queda en null (no se sube). Sin fila = nada
--   compartido. Desactivar un interruptor deja ese dato en null.
-- * Lo ve quien puede ver el contenido del perfil (perfil público, o seguidores aceptados si es privado) y nunca
--   alguien bloqueado. Nadie lee la tabla directamente salvo su dueña: los demás pasan por community_body_info.

begin;

create table if not exists public.community_body (
  user_id uuid primary key references public.community_profiles(user_id) on delete cascade,
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 25 and 350),
  height_cm numeric(5,1) check (height_cm is null or height_cm between 90 and 250),
  target_weight_kg numeric(5,1) check (target_weight_kg is null or target_weight_kg between 25 and 350),
  goal text check (goal is null or goal in ('fitness','muscle','strength','endurance','habit')),
  updated_at timestamptz not null default now()
);
alter table public.community_body enable row level security;
drop policy if exists community_body_select_own on public.community_body;
create policy community_body_select_own on public.community_body for select to authenticated using (user_id = auth.uid());
drop policy if exists community_body_insert_own on public.community_body;
create policy community_body_insert_own on public.community_body for insert to authenticated with check (user_id = auth.uid());
drop policy if exists community_body_update_own on public.community_body;
create policy community_body_update_own on public.community_body for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.community_body from anon, authenticated;
grant select on public.community_body to authenticated;
grant insert (user_id, weight_kg, height_cm, target_weight_kg, goal) on public.community_body to authenticated;
-- user_id también, para que el «upsert» de la app funcione; el disparador lo deja siempre como estaba.
grant update (user_id, weight_kg, height_cm, target_weight_kg, goal) on public.community_body to authenticated;

create or replace function public.community_body_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.user_id := old.user_id; end if;
  return new;
end; $$;
revoke all on function public.community_body_touch() from public, anon, authenticated;
drop trigger if exists community_body_touch on public.community_body;
create trigger community_body_touch before insert or update on public.community_body
  for each row execute function public.community_body_touch();

-- Lo que una persona eligió mostrar, para quien puede ver su perfil. Sin fila o sin permiso: no devuelve nada.
create or replace function public.community_body_info(p_user uuid)
returns table (weight_kg numeric, height_cm numeric, target_weight_kg numeric, goal text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.weight_kg, b.height_cm, b.target_weight_kg, b.goal, b.updated_at
  from public.community_body b
  where b.user_id = p_user
    and (b.weight_kg is not null or b.height_cm is not null or b.target_weight_kg is not null or b.goal is not null)
    and public.community_can_view_profile(b.user_id, auth.uid())
$$;
revoke all on function public.community_body_info(uuid) from public;
grant execute on function public.community_body_info(uuid) to anon, authenticated;

-- Avisos de seguridad de Supabase: search_path fijo en tres funciones existentes (no cambia lo que hacen).
alter function public.community_valid_muscle_ranks(jsonb) set search_path = public;
alter function public.community_stats_fresh(date) set search_path = public;
alter function public.touch_user_app_data_updated_at() set search_path = public;

commit;

-- ===================================================================
-- 2026-11-01_v65_feedback.sql
-- ===================================================================
-- FittForma AI v65 — «Enviar una sugerencia»: las personas con cuenta mandan ideas o avisan de problemas.
-- ADITIVA y re-ejecutable: crea una tabla y su disparador. No borra ni modifica datos, tablas, funciones ni políticas
-- existentes. RLS activo.
--
-- * Solo se puede ESCRIBIR (con sesión iniciada y a nombre propio). Nadie las lee desde la app: la persona dueña del
--   proyecto las ve en Supabase (Table Editor → app_feedback), que usa la clave de servicio y no pasa por RLS.
-- * Límite: 5 por persona por día, para evitar abusos.
-- * Se guarda solo lo que la persona escribe, la categoría y la versión de la app. Nada de datos de salud.

begin;

create table if not exists public.app_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  category text not null default 'idea' check (category in ('idea', 'problema', 'otro')),
  message text not null check (char_length(btrim(message)) between 3 and 1000),
  app_version text check (app_version is null or app_version ~ '^[0-9]{1,3}\.[0-9]{1,3}(\.[0-9]{1,3})?$'),
  created_at timestamptz not null default now()
);
create index if not exists app_feedback_user_day_idx on public.app_feedback (user_id, created_at);
alter table public.app_feedback enable row level security;
drop policy if exists app_feedback_insert_own on public.app_feedback;
create policy app_feedback_insert_own on public.app_feedback for insert to authenticated with check (user_id = auth.uid());
revoke all on public.app_feedback from anon, authenticated;
grant insert (user_id, category, message, app_version) on public.app_feedback to authenticated;

create or replace function public.app_feedback_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  new.message := btrim(new.message);
  if (select count(*) from public.app_feedback f where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 5 then
    raise exception 'feedback_limit' using errcode = 'P0001', hint = 'Llegaste al máximo de 5 sugerencias por día. ¡Gracias! Probá mañana.';
  end if;
  return new;
end; $$;
revoke all on function public.app_feedback_guard() from public, anon, authenticated;
drop trigger if exists app_feedback_guard on public.app_feedback;
create trigger app_feedback_guard before insert on public.app_feedback
  for each row execute function public.app_feedback_guard();

commit;

-- ===================================================================
-- 2026-11-02_v66_wall_challenges.sql
-- ===================================================================
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

-- Que la API de Supabase vea enseguida las funciones nuevas (evita «Could not find the function … in the schema cache»).
notify pgrst, 'reload schema';
