-- v78: base más rápida y ordenada (avisos de rendimiento de Supabase). Aditiva y re-ejecutable: no borra datos,
-- no desactiva RLS y no cambia quién puede ver o escribir qué (lo comprueban todas las pruebas RLS anteriores).

-- 1) Índices para las 5 claves foráneas que no tenían (borrar o actualizar una fila ya no recorre toda la tabla).
create index if not exists community_reports_resolved_by_idx on public.community_reports(resolved_by);
create index if not exists community_reports_post_id_idx on public.community_reports(post_id);
create index if not exists monetization_play_purchases_user_id_idx on public.monetization_play_purchases(user_id);
create index if not exists community_saved_posts_post_id_idx on public.community_saved_posts(post_id);
create index if not exists community_notifications_actor_id_idx on public.community_notifications(actor_id);

-- 2) Políticas RLS: auth.uid() se calcula una vez por consulta y no una vez por fila.
-- Se reemplaza auth.uid() por (select auth.uid()) en cada política del esquema public; la condición es la misma.
do $$
declare
  p record; q text; c text; stmt text;
  fix constant text := '(select auth.uid())';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
  loop
    q := p.qual; c := p.with_check;
    if q is not null then
      q := replace(replace(replace(q, '( SELECT auth.uid() AS uid)', '§uid§'), 'auth.uid()', fix), '§uid§', fix);
    end if;
    if c is not null then
      c := replace(replace(replace(c, '( SELECT auth.uid() AS uid)', '§uid§'), 'auth.uid()', fix), '§uid§', fix);
    end if;
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if q is not null then stmt := stmt || format(' using (%s)', q); end if;
    if c is not null then stmt := stmt || format(' with check (%s)', c); end if;
    execute stmt;
  end loop;
end $$;

-- 3) Bloqueos: solo responde sobre pares que incluyen a quien pregunta (sin sesión, siempre «no»).
-- Es la misma definición que ya estaba en el repositorio; se vuelve a aplicar para que producción quede igual.
create or replace function public.community_users_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or (auth.uid() <> a and auth.uid() <> b) then false
    else exists(select 1 from public.community_blocks x where (x.blocker_id = a and x.blocked_id = b) or (x.blocker_id = b and x.blocked_id = a)) end;
$$;
revoke all on function public.community_users_blocked(uuid, uuid) from public;
grant execute on function public.community_users_blocked(uuid, uuid) to anon, authenticated;
