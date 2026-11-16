-- v78: índices de claves foráneas, políticas con (select auth.uid()) y bloqueos solo para pares propios.
-- Las pruebas RLS anteriores corren después de esta migración y comprueban que los permisos no cambiaron.
do $$
declare n int; r boolean;
begin
  select count(*) into n from pg_indexes where schemaname = 'public' and indexname in
    ('community_reports_resolved_by_idx','community_reports_post_id_idx','monetization_play_purchases_user_id_idx','community_saved_posts_post_id_idx','community_notifications_actor_id_idx');
  if n <> 5 then raise exception 'FALLO: faltan índices (%)', n; end if;
  raise notice 'OK v78 los 5 índices de claves foráneas existen';

  select count(*) into n from pg_constraint c where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and (i.indkey::int2[])[0:cardinality(c.conkey)-1] @> c.conkey);
  if n <> 0 then raise exception 'FALLO: % claves foráneas sin índice', n; end if;
  raise notice 'OK v78 ninguna clave foránea sin índice';

  select count(*) into n from pg_policies where schemaname = 'public'
    and regexp_replace(coalesce(qual, '') || coalesce(with_check, ''), '\( SELECT auth\.uid\(\) AS uid\)', '', 'g') ~ 'auth\.uid\(\)';
  if n <> 0 then raise exception 'FALLO: % políticas recalculan auth.uid() por fila', n; end if;
  raise notice 'OK v78 ninguna política recalcula auth.uid() por fila';

  select count(*) into n from pg_policies where schemaname = 'public' and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'SELECT auth\.uid\(\) AS uid';
  if n < 40 then raise exception 'FALLO: solo % políticas usan (select auth.uid())', n; end if;
  raise notice 'OK v78 % políticas usan (select auth.uid())', n;

  insert into auth.users(id, email) values
    ('78000000-0000-0000-0000-000000000001', 'a78@example.test'), ('78000000-0000-0000-0000-000000000002', 'b78@example.test'), ('78000000-0000-0000-0000-000000000003', 'c78@example.test')
    on conflict do nothing;
  insert into public.community_blocks(blocker_id, blocked_id) values ('78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000002') on conflict do nothing;

  perform set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-000000000003', true);
  perform set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
  r := public.community_users_blocked('78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000002');
  if r then raise exception 'FALLO: un tercero puede saber quién bloqueó a quién'; end if;
  raise notice 'OK v78 un tercero no puede saber quién bloqueó a quién';

  perform set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-000000000002', true);
  perform set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  r := public.community_users_blocked('78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000002');
  if not r then raise exception 'FALLO: la persona involucrada no ve el bloqueo'; end if;
  raise notice 'OK v78 quien está en el par sí lo ve (para ocultar mensajes y perfiles)';

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  r := public.community_users_blocked('78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000002');
  if r then raise exception 'FALLO: sin sesión responde sobre bloqueos'; end if;
  raise notice 'OK v78 sin sesión siempre responde que no';
  raise notice 'PRUEBAS v78 PASARON';
end $$;
