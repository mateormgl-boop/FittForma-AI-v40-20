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
