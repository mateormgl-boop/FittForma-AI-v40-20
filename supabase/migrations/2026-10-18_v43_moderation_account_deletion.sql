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
