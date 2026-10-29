-- FittForma AI v67 — Seguridad: tres funciones que solo sirven con la sesión iniciada dejan de poder llamarse sin sesión.
-- ADITIVA y re-ejecutable: solo cambia permisos (revoke/grant). No borra datos, tablas, funciones ni políticas. RLS activo.
-- Requiere las migraciones anteriores (v41 a v66).
--
-- Aviso de Supabase «Public Can Execute SECURITY DEFINER Function». Se revisó cada función del aviso:
-- * Se quitan a «anon» (sin sesión) solo las que la app usa siempre con sesión y que ninguna política de lectura
--   sin sesión necesita:
--   - community_are_mutual_follows: solo la usan las políticas de mensajes (con sesión).
--   - community_is_moderator: la app la consulta solo con sesión; la usan políticas de moderación (con sesión).
--   - community_suggested_profiles: «Personas sugeridas» se muestra solo con sesión.
-- * Las demás quedan como están a propósito: sin sesión se ven los perfiles públicos, el directorio, el ranking y
--   las publicaciones públicas, y las políticas de lectura sin sesión llaman a community_users_blocked,
--   community_viewer_can_see y community_avatar_readable (quitarlas rompería esa lectura).

begin;

revoke execute on function public.community_are_mutual_follows(uuid, uuid) from public, anon;
grant execute on function public.community_are_mutual_follows(uuid, uuid) to authenticated;

revoke execute on function public.community_is_moderator() from public, anon;
grant execute on function public.community_is_moderator() to authenticated;

revoke execute on function public.community_suggested_profiles() from public, anon;
grant execute on function public.community_suggested_profiles() to authenticated;

commit;
