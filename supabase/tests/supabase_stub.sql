-- Stub mínimo de Supabase SOLO para pruebas locales en un PostgreSQL vacío.
-- Emula roles, auth.uid() (a partir de request.jwt.claim.sub), auth.users y storage.
-- Nunca ejecutar en un proyecto real de Supabase.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true),''),(nullif(current_setting('request.jwt.claims', true),'')::jsonb)->>'sub'),'')::uuid $$;
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name,'/'))[1:greatest(array_length(string_to_array(name,'/'),1)-1,0)] $$;
grant usage on schema public, auth, storage to anon, authenticated;
-- Igual que Supabase: lo que se crea en public queda con todos los permisos para anon/authenticated
-- (las restricciones reales dependen de RLS y de los revoke explícitos de cada script).
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select, insert, delete on storage.objects to anon, authenticated;
