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
