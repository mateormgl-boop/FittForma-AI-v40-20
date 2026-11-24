-- FittForma AI v81 — referencias privadas para suscripciones web de Mercado Pago.
-- ADITIVA y re-ejecutable. No modifica membresías existentes ni concede Plus por sí sola.
-- Solo el backend con service_role puede vincular o consultar una suscripción externa.

begin;

create table if not exists public.monetization_mp_subscriptions (
  subscription_id text primary key check (char_length(subscription_id) between 6 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_reference text not null unique check (char_length(external_reference) between 20 and 160),
  updated_at timestamptz not null default now()
);

alter table public.monetization_mp_subscriptions enable row level security;
revoke all on public.monetization_mp_subscriptions from anon, authenticated;

create or replace function public.monetization_mp_link_subscription(
  p_subscription_id text, p_user_id uuid, p_external_reference text
) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare n integer;
begin
  if p_subscription_id is null or p_subscription_id !~ '^[A-Za-z0-9_-]{6,80}$'
     or p_user_id is null
     or p_external_reference !~ ('^fittforma-plus:' || p_user_id::text || ':[a-f0-9-]{36}$') then
    raise exception 'invalid_subscription_reference';
  end if;
  insert into public.monetization_mp_subscriptions(subscription_id, user_id, external_reference)
  values (p_subscription_id, p_user_id, p_external_reference)
  on conflict (subscription_id) do update set updated_at = now()
    where public.monetization_mp_subscriptions.user_id = excluded.user_id
      and public.monetization_mp_subscriptions.external_reference = excluded.external_reference;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.monetization_mp_get_subscription(p_subscription_id text)
returns table(user_id uuid, external_reference text)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.external_reference
  from public.monetization_mp_subscriptions s
  where s.subscription_id = p_subscription_id
$$;

revoke all on function public.monetization_mp_link_subscription(text, uuid, text) from public, anon, authenticated;
revoke all on function public.monetization_mp_get_subscription(text) from public, anon, authenticated;
grant execute on function public.monetization_mp_link_subscription(text, uuid, text) to service_role;
grant execute on function public.monetization_mp_get_subscription(text) to service_role;

commit;
notify pgrst, 'reload schema';
