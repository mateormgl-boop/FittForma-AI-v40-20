# FittForma AI v40.19 — corrección de Comunidad y navegación interna

## Problema reportado

La app mostró `PGRST201: Could not embed because more than one relationship was found for 'community_posts' and 'community_profiles'`. PostgREST requería desambiguar la relación de autor. No era un error que se debiera resolver volviendo a ejecutar el SQL a ciegas.

## Correcciones

- La consulta de feed utiliza `community_profiles!community_posts_user_id_fkey!inner(...)` para seleccionar explícitamente la relación de autor declarada por `community.sql`.
- Los comentarios usan `community_profiles!community_comments_user_id_fkey(...)` para evitar ambigüedad equivalente al mostrar autor de comentario. Si el embed de comentario aún falla por PGRST201/PGRST200, una consulta de respaldo trae los comentarios y resuelve autores por separado bajo RLS.
- Si el caché de esquema tiene una relación ambigua o un nombre de FK distinto, el feed intenta una vía de recuperación: consulta las publicaciones y luego los perfiles por separado, respetando las políticas de RLS. Esta recuperación no sustituye reparar el esquema si falta realmente la FK prevista.
- La comunidad ahora presenta cinco secciones internas: Feed, Explorar, Publicar, Mensajes y Mi perfil. Cada sección se abre de forma independiente; la navegación está adaptada a móviles, tiene estados ARIA y admite teclas de flecha/Home/End.
- En Explorar, búsqueda de usuarios y publicaciones coincidentes aparecen en el propio panel de exploración. Limpiar la búsqueda no altera el feed principal.
- Publicar una transformación vuelve al Feed. Los mensajes, perfil, solicitudes de seguimiento y bloqueos quedan en sus propias secciones.
- Versionado actualizado a `0.40.19`, caché PWA `fittforma-ai-static-v40-19`.

## Validación local

- `npm test`: **144 pruebas aprobadas, 0 fallidas**.
- `node --check community.js` y `node --check i18n.js`: correctos.
- 287 IDs encontrados en HTML, 287 únicos.
- 12 referencias locales revisadas, ninguna ausente.
- 5 pestañas internas y 5 paneles verificados.
- Añadidas pruebas para traducciones de Comunidad y recuperación cuando el embed de comentarios también devuelve PGRST201/PGRST200.
- Pruebas finales repetidas desde la copia extraída del ZIP: 144 aprobadas, 0 fallidas.
- La suite se repetirá desde el ZIP extraído antes de la entrega.

## Pendiente en producción

No se usaron credenciales reales del usuario. Hay que desplegar en Render y comprobar el feed con Supabase real. Si `PGRST201` persiste, abrir los detalles del error; la FK actual en ese proyecto podría tener otro nombre o estar duplicada con restricciones antiguas. En ese caso se debe revisar la lista de constraints con SQL de solo lectura antes de hacer cambios. No se debe borrar ni volver a crear tablas.
