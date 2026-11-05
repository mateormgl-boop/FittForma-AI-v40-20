-- FittForma AI v70 — Insignia «Plus» en Comunidad, solo para quien elige mostrarla.
-- ADITIVA y re-ejecutable: agrega una columna (por defecto apagada) y dos funciones de lectura; no borra datos ni tablas.
-- Requiere las migraciones anteriores (v41 a v67). RLS sigue activo.
--
-- Privacidad: hasta ahora cualquiera podía leer qué cuentas tenían una membresía activa (política
-- community_memberships_read_active). Saber quién paga es un dato de la cuenta, así que pasa a leerse solo
-- la fila propia. Quien quiera, activa «Mostrar mi insignia Plus en Comunidad» (show_plus) y solo entonces
-- se ve la insignia y puede aparecer en «Miembros Plus». La membresía la sigue escribiendo solo el servidor de pagos.

begin;

alter table public.community_profiles add column if not exists show_plus boolean not null default false;
grant update (show_plus) on public.community_profiles to authenticated;  -- la política de actualización ya limita a la fila propia

drop policy if exists community_memberships_read_active on public.community_memberships;
drop policy if exists community_memberships_read_own on public.community_memberships;
create policy community_memberships_read_own on public.community_memberships
  for select to authenticated using (user_id = auth.uid());
revoke select on public.community_memberships from anon;
grant select on public.community_memberships to authenticated;

-- De una lista de perfiles en pantalla, cuáles muestran la insignia (Plus vigente + show_plus + perfil visible).
create or replace function public.community_plus_ids(p_ids uuid[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select cp.user_id from public.community_profiles cp
  where cp.user_id = any((coalesce(p_ids, '{}'::uuid[]))[1:200])
    and cp.show_plus
    and public.monetization_is_plus(cp.user_id)
    and public.community_can_view_profile(cp.user_id, auth.uid())
$$;

-- «Miembros Plus» arriba de Todos: hasta 10 perfiles públicos que eligieron mostrarse; el orden rota cada día.
create or replace function public.community_plus_featured(p_limit integer default 6)
returns table (user_id uuid, username text, display_name text, avatar_path text, country_code text)
language sql stable security definer set search_path = public as $$
  select cp.user_id, cp.username, cp.display_name, cp.avatar_path, cp.country_code
  from public.community_profiles cp
  where cp.show_plus and cp.visibility = 'public' and cp.username is not null
    and public.monetization_is_plus(cp.user_id)
    and (auth.uid() is null or not public.community_users_blocked(auth.uid(), cp.user_id))
  order by md5(cp.user_id::text || current_date::text)
  limit least(greatest(coalesce(p_limit, 6), 1), 10)
$$;

revoke all on function public.community_plus_ids(uuid[]) from public;
revoke all on function public.community_plus_featured(integer) from public;
grant execute on function public.community_plus_ids(uuid[]) to anon, authenticated;
grant execute on function public.community_plus_featured(integer) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
