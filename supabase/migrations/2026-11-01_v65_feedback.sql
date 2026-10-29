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
