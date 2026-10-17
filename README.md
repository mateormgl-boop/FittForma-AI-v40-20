# FittForma AI — v40.20

Aplicación fitness web instalable como PWA, con frontend móvil, backend Node.js, integración opcional con Gemini y comunidad con Supabase. El repositorio está pensado para continuar usando GitHub y Render.

## Novedades v40.20 — Insignias personales

- Insignias en Progreso y vista previa en Perfil para ejercicios medibles, actividades al aire libre y constancia.
- Doce niveles por desafío: Bronce, Plata, Oro y Diamante (tres niveles de cada rango).
- Marcas de flexiones, dominadas, sentadillas, abdominales, plancha y otros ejercicios detectados en la biblioteca; admite desafíos personalizados.
- Las actividades GPS plausibles pueden marcar hitos de distancia con distintivo GPS; no es una verificación antifraude completa.
- La publicación de insignias en Comunidad se deja para una fase posterior.

## Novedades v40.19 — Comunidad por secciones y corrección de PGRST201

- La consulta del feed selecciona explícitamente la FK `community_posts_user_id_fkey`; los comentarios seleccionan `community_comments_user_id_fkey`.
- Si PostgREST todavía devuelve una relación ambigua o una FK con nombre distinto, el feed intenta consultar publicaciones y perfiles por separado, siempre respetando RLS.
- Comunidad tiene cinco secciones internas: **Feed, Explorar, Publicar, Mensajes y Mi perfil**. No se apilan todos los formularios en una única pantalla.
- Explorar mantiene juntos los perfiles encontrados y las publicaciones coincidentes; volver al Feed limpia la búsqueda.
- Las pestañas son adaptables a móvil, accesibles con teclado y marcan el estado seleccionado.
- El embed de comentarios también tiene recuperación por consultas separadas cuando el nombre de la FK difiere o hay relaciones ambiguas.
- Las pestañas y los principales títulos de Comunidad tienen traducciones añadidas para los seis idiomas de la app.
- `npm test`: 149 pruebas aprobadas, 0 fallidas en ejecución local, incluida la suite de insignias.

## Importante antes de publicar

- Conservá la configuración real de `supabase-config.js` o usá las variables de Render.
- En Render deben estar `SUPABASE_URL`, una clave pública (`SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`) y `GEMINI_API_KEY`; `GEMINI_MODEL` debe ser un modelo soportado.
- Nunca pongas claves `service_role`/`sb_secret_` en el frontend.
- Esta versión no cambia el esquema SQL. No vuelvas a ejecutar `supabase/schema.sql` ni `supabase/community.sql` por este cambio.
- Las pruebas locales no verifican las credenciales reales, RLS, OAuth ni Storage del proyecto de producción.

## Guías

- `ACTUALIZAR_DESDE_VERSION_ANTERIOR.txt`: instrucciones de despliegue.
- `AUDITORIA_COMPLETA_FittForma_AI_v40_20.md`: alcance de las insignias y pendientes de producción.
- `AUDITORIA_COMUNIDAD_FittForma_AI_v40_19.md`: alcance de la corrección de comunidad v40.19.
- `ESTADO_Y_PENDIENTES.md`: estado acumulado del proyecto.
