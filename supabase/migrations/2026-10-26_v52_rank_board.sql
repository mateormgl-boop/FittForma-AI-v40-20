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
