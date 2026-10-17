# FittForma AI v44 — Etapa 6: Seguridad y datos

Revisión de la app (index.html, community.js, i18n.js, sw.js), el servidor (backend/server.mjs) y la base de
datos (schema.sql, community.sql, migraciones). Cada hallazgo se verificó en el código o reproduciéndolo en un
PostgreSQL local antes de corregirlo.

## Corregido

| # | Gravedad | Problema | Corrección |
|---|---|---|---|
| 1 | Alta | Con los permisos por defecto de Supabase, quien recibía una solicitud de seguimiento podía cambiar `follower_id` y fabricar un «seguimiento mutuo» para enviar mensajes no deseados. | Solo se puede actualizar `status` (permiso por columna y trigger). El stub de pruebas ahora reproduce los permisos por defecto de Supabase, que ocultaban el error. |
| 2 | Alta | Una copia importada (o de la nube) podía inyectar código en el plan, el historial de peso y el chat. | Escapado en esos puntos y `sanitizeState` valida la forma de todos los datos externos. |
| 3 | Media | Una copia con datos rotos dejaba la app inutilizable hasta borrar los datos del sitio; la importación decía «correcta» aunque no se hubiera guardado. | Validación de forma, límite de 8 MB y vuelta atrás si no se puede guardar o mostrar. |
| 4 | Media | `created_at` lo elegía el cliente: una fecha futura dejaba un post primero en el ranking. | La base pone la fecha en cada alta. |
| 5 | Media | Sin límite de spam en publicaciones, comentarios, me gusta, seguimientos y denuncias. | Límites por minuto y por día en la base. |
| 6 | Media | FittAI enviaba la foto de perfil a la IA y el servidor reenviaba el perfil completo. | El servidor solo usa campos permitidos; la app no envía la foto. |
| 7 | Media | Los endpoints de IA aceptaban pedidos de cualquier script. | Se exige mismo origen y hay un límite diario por cliente y total (`GEMINI_DAILY_PER_CLIENT`, `GEMINI_DAILY_LIMIT`). |
| 8 | Media | supabase-js se cargaba como `@2` (cualquier versión) y la CSP permitía todo jsdelivr/unpkg. | Versión exacta 2.45.4 y Leaflet 1.9.4 con integridad SRI; CSP limitada a esas rutas. |
| 9 | Media | Eliminar la cuenta borraba fotos antes de saber si la base podía eliminarla; listaba solo 1000 archivos. | Verificación previa (`account_deletion_ready`), listado paginado y la base no elimina la cuenta si quedan fotos. |
| 10 | Media | Eliminar un post denunciado borraba también las denuncias. | Las denuncias se conservan (estado «actioned» y un extracto del texto). |
| 11 | Media | Sin tamaño máximo para la copia en la nube. | Hasta 3 MB por cuenta (no afecta filas existentes). |
| 12 | Baja | La búsqueda con «!!» o «__» listaba perfiles al azar; los nombres por defecto salían del correo. | Mínimo medido después de limpiar, `_` escapado y nombres por defecto sin el correo (solo perfiles nuevos). |
| 13 | Baja | Un mensaje podía crearse ya «leído»; el chat quedaba visible tras cerrar sesión; denuncias con solo espacios; destinos de FittAI como `constructor`. | Corregidos. |
| 14 | Baja | El límite por IP confiaba en `X-Forwarded-For`, que controla el cliente. | Solo `CF-Connecting-IP` de Render/Cloudflare. |

Aplicar en Supabase: `supabase/migrations/2026-10-19_v44_security_hardening.sql` (aditiva y re-ejecutable),
después de la v43.

## Revisado y correcto

Archivos estáticos (lista blanca, sin `..`, `.git` ni `.env`), límites de tamaño y tiempos del servidor, claves
`service_role`/`sb_secret_` rechazadas, clave de Gemini solo en el servidor, cabeceras de seguridad, RLS activo en
todas las tablas, funciones `security definer` con `search_path`, bloqueo de usuarios, Storage por carpeta propia,
service worker sin cachear `/api` ni Supabase, enlaces externos con `noopener`.

## Pendiente (no se pudo resolver sin decisiones o servicios externos)

- La CSP mantiene `'unsafe-inline'` porque la app es un único HTML con scripts en línea; el riesgo se reduce
  escapando todo dato externo. Quitarlo implica separar el JavaScript en archivos.
- Los endpoints de IA no exigen iniciar sesión (la app permite usar FittAI sin cuenta); se limitan por origen y por cuota diaria.
- Perfiles creados antes de v44 conservan el nombre de usuario derivado del correo; cada persona puede cambiarlo.
- Fotos de cuentas eliminadas antes de v44 pueden haber quedado en Storage: revisarlas desde el panel de Supabase.
- Nada de esto se probó contra el Supabase real ni Render.
