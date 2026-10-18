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
