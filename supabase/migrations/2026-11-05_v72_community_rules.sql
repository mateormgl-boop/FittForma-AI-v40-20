-- FittForma AI v72 — Normas de la comunidad: registro de quién aceptó qué versión y cuándo.
-- ADITIVA y re-ejecutable: crea una tabla nueva con RLS; no borra ni modifica datos existentes. RLS activo.
-- Requiere las migraciones anteriores (v41 a v70).
--
-- Google Play pide que quien publica contenido en la app acepte antes las normas de uso. La app pide aceptarlas
-- antes de publicar, comentar, mandar mensajes o editar el perfil público, y guarda acá la versión aceptada.
-- * Solo la propia persona lee su fila: nadie más puede saber si aceptó ni cuándo.
-- * La fecha la pone la base (no el teléfono) y no se puede volver a una versión anterior.
-- * Al eliminar la cuenta, la fila se borra sola (cascada desde auth.users, como el resto de los datos).
-- * Sin esta migración la app funciona igual: guarda la aceptación en el dispositivo y la sube cuando la tabla exista.

begin;

create table if not exists public.community_rules_acceptance (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rules_version smallint not null check (rules_version between 1 and 100),
  accepted_at timestamptz not null default now()
);
alter table public.community_rules_acceptance enable row level security;

drop policy if exists community_rules_select_own on public.community_rules_acceptance;
create policy community_rules_select_own on public.community_rules_acceptance
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists community_rules_insert_own on public.community_rules_acceptance;
create policy community_rules_insert_own on public.community_rules_acceptance
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists community_rules_update_own on public.community_rules_acceptance;
create policy community_rules_update_own on public.community_rules_acceptance
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Supabase da todos los permisos por defecto a las tablas nuevas: se quitan y se dan solo los necesarios.
revoke all on public.community_rules_acceptance from public, anon, authenticated;
grant select, insert on public.community_rules_acceptance to authenticated;
grant update (user_id, rules_version) on public.community_rules_acceptance to authenticated;  -- user_id: lo pide el upsert; la política impide cambiarlo

create or replace function public.community_rules_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.rules_version < old.rules_version then new.rules_version := old.rules_version; end if;
    if new.rules_version = old.rules_version then new.accepted_at := old.accepted_at; return new; end if;
  end if;
  new.accepted_at := now();
  return new;
end $$;
revoke all on function public.community_rules_stamp() from public;

drop trigger if exists community_rules_stamp on public.community_rules_acceptance;
create trigger community_rules_stamp before insert or update on public.community_rules_acceptance
  for each row execute function public.community_rules_stamp();

commit;
notify pgrst, 'reload schema';
