#!/usr/bin/env bash
# Aplica schema.sql + community.sql + migraciones sobre una base PostgreSQL VACÍA de pruebas
# (con el stub de Supabase) y ejecuta las pruebas RLS. Nunca apuntar a producción.
# Uso: PGHOST=localhost PGPORT=5432 PGUSER=postgres supabase/tests/run.sh   (variables estándar de libpq)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."
db="ff_rls_$$"
psql -d postgres -qAtc "create database $db" >/dev/null
trap 'psql -d postgres -qAtc "drop database if exists $db" >/dev/null' EXIT
url="$db"
run() { PGOPTIONS="-c client_min_messages=warning" psql -d "$url" -v ON_ERROR_STOP=1 -q -f "$1" >/dev/null; }
run "$here/supabase_stub.sql"
run "$root/schema.sql"
run "$root/community.sql"
# Publicación previa a la migración: debe seguir siendo válida después.
PGOPTIONS="-c client_min_messages=warning" psql -d "$url" -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
insert into auth.users(id,email) values('eeeeeeee-0000-0000-0000-000000000005','legacy@example.test');
insert into public.community_posts(user_id,start_date,end_date,before_path,after_path)
values('eeeeeeee-0000-0000-0000-000000000005','2026-01-01','2026-03-01','eeeeeeee-0000-0000-0000-000000000005/p/before.jpg','eeeeeeee-0000-0000-0000-000000000005/p/after.jpg');
SQL
for m in "$root"/migrations/*.sql; do run "$m"; run "$m"; done   # dos veces: debe ser re-ejecutable
psql -d "$url" -v ON_ERROR_STOP=1 -qAtc "select case when post_kind='transformation' then 'legacy ok' else 'legacy MAL' end from public.community_posts where user_id='eeeeeeee-0000-0000-0000-000000000005'"
out=""
for t in "$here"/rls_v*_test.sql; do
  part="$(psql -d "$url" -v ON_ERROR_STOP=1 -q -f "$t" 2>&1)" || { echo "$part" | grep -E "OK|FALLO|ERROR"; echo "RESULTADO: FALLÓ en $(basename "$t")"; exit 1; }
  out="$out
$part"
done
echo "$out" | grep -E "OK|PASARON"
echo "RESULTADO: OK ($(echo "$out" | grep -c 'OK') comprobaciones)"
