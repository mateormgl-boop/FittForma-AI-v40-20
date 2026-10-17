# Auditoría final — FittForma AI v40.13 (Punto 10)

## Resultado local

- Versión de aplicación y paquetes: `0.40.13`.
- Suite automatizada: **119 pruebas aprobadas, 0 fallidas** (incluye pruebas HTTP de backend, configuración pública, rechazo de service-role, sintaxis JavaScript y módulos de entrenamiento/nutrición/comunidad).
- `npm test` ejecutado tras los cambios; el código JS/MJS y el script inline de `index.html` pasan `node --check` en la suite.
- Endpoint `/api/public-config` probado localmente: con variables demo válidas devuelve solamente `supabase.configured`, URL y clave publicable; una JWT con `role: service_role` es rechazada y no aparece en la respuesta.
- La CSP ya permite conexiones al backend propio y a `*.supabase.co`; las llamadas `/api/*` no se precargan ni cachean en el service worker.
- La versión de caché PWA se cambió a `fittforma-ai-static-v40-13`.
- Los anuncios y pagos continúan desactivados. No se añadió ningún mecanismo de cobro simulado.
- No se modificaron `supabase/schema.sql` ni `supabase/community.sql`.

## Corrección principal

En v40.12 el cliente necesitaba un `supabase-config.js` con `url` y `anonKey` y no consultaba las variables privadas del backend Render. Como el ZIP conservaba el archivo de cliente vacío por seguridad, era coherente que se mantuviera el mensaje de Comunidad aun después de ejecutar los scripts SQL.

v40.13 permite que el navegador consulte `GET /api/public-config`; el backend lee `SUPABASE_URL` y `SUPABASE_ANON_KEY` (con alternativa `SUPABASE_PUBLISHABLE_KEY`). Solo entrega URL + clave de cliente publicable/anon validada. No serializa el entorno general, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ni otras claves privadas. Para los JWT anon antiguos valida `role === 'anon'`; no acepta JWT con rol distinto de `anon` ni claves `sb_secret_`.

## Pasos de despliegue y comprobación

1. En Render → Environment, confirmar `SUPABASE_URL` con la URL del proyecto y `SUPABASE_ANON_KEY` con la clave pública publishable/anon. Si la variable `SUPABASE_ANON_KEY` contiene por error `service_role`, corregirla; el endpoint la rechazará.
2. Subir a GitHub los archivos del ZIP conservando rutas; mantener otras variables como `GEMINI_API_KEY`. No copiar claves secretas al repositorio.
3. Esperar `Live` en Render y recargar la app (Ctrl+F5; cerrar y reabrir la PWA instalada si corresponde).
4. Verificar que `/api/public-config` devuelve `supabase.configured: true`. Esa respuesta incluye una clave pública de cliente; no pegarla en espacios públicos.
5. Probar registro, confirmación por correo si está activada, inicio de sesión, creación/edición de perfil y el feed de Comunidad con dos cuentas de prueba.
6. Si Community o Supabase falla, revisar los logs del navegador y Render, y confirmar RLS, bucket privado, URLs de redireccionamiento OAuth y las tablas ya ejecutadas.

## Pendientes no verificables localmente

- No se pudo autenticar contra el proyecto Supabase real del usuario desde este entorno ni ver las variables guardadas en Render.
- No se ha confirmado el funcionamiento de Gemini con la clave real ni cuotas de API.
- Se requieren pruebas de comunidad con dos cuentas reales para validar políticas RLS, storage, bloqueos, seguimientos y chat.
- Se requieren pruebas de PWA/GPS en teléfono real y las condiciones de ubicación/permisos del navegador.
- Las 120 pruebas automatizadas no equivalen a certificación de seguridad ni prueba de producción.

## Cambios de esquema

Ninguno. No volver a ejecutar `supabase/schema.sql` ni `supabase/community.sql` por esta versión.
