# Revisión de seguridad — FittForma AI v40.0

**Tipo de revisión:** análisis estático del código y pruebas automatizadas locales. No es pentest, certificación ni confirmación de seguridad del despliegue online.

## Controles presentes en el código

- Acceso a comunidad opcional vía Supabase; la configuración incluida empieza vacía.
- Políticas RLS declaradas para perfiles, publicaciones, relaciones, likes, comentarios, denuncias, bloqueos y mensajes.
- Bucket de imágenes privado y URLs firmadas temporales; las fotos se re-codifican en el cliente para reducir tamaño y quitar metadatos EXIF comunes.
- Bloqueos de cuentas aplicados en las políticas de acceso social.
- Chat condicionado a seguimiento mutuo aceptado, límites por cuenta en la base de datos y opción de eliminar una conversación para ambas personas.
- Backend con validaciones de entrada, límites de petición, cabeceras de seguridad y servicio de activos públicos restringido.

## Riesgos abiertos

1. **Supabase sin validación real:** ejecutar `supabase/community.sql` y probar usuarios, RLS, fotos, bloqueos y chat con al menos dos cuentas antes de usar la comunidad públicamente.
2. **Moderación incompleta:** las denuncias se guardan, pero falta panel, flujo de revisión, herramientas de moderación y política operativa.
3. **API de IA:** el rate limit local del backend está en memoria y principalmente por IP. No sustituye identidad validada, cuota por usuario ni controles distribuidos.
4. **CSP:** el proyecto todavía contiene scripts inline; `unsafe-inline` reduce la robustez de la Content Security Policy.
5. **Pro y publicidad:** no hay proveedor de pagos ni webhooks firmados; los anuncios están desactivados. No se deben activar basándose en flags del cliente.
6. **Datos de usuario:** falta flujo completo de recuperación de contraseña, borrado/exportación de cuenta y notificaciones sociales.
7. **Dispositivos reales:** no se verificaron navegación visual, GPS, permisos, fotos ni comportamiento en segundo plano en hardware físico.

## Recomendación

Mantener la comunidad como beta limitada hasta validar Supabase real y disponer de un flujo de moderación operativo. No guardar nunca una clave `service_role` en GitHub, el frontend o `supabase-config.js`; la clave de cliente `anon`/publishable es pública por diseño y debe estar protegida por políticas RLS adecuadas.


## Actualización v40.14 — configuración pública de Supabase

- `GET /api/public-config` es la única respuesta del backend que entrega configuración del cliente; no devuelve `process.env` ni una lista de variables con valores.
- Solo devuelve la URL https de un proyecto `*.supabase.co` y una clave `sb_publishable_...` o un JWT cuyo claim `role` sea `anon`.
- Las claves `sb_secret_...` y JWT con roles distintos de `anon` son rechazadas antes de enviarse al navegador.
- Mantener `SUPABASE_ANON_KEY` configurada únicamente con la clave pública `anon`/publishable. Aunque el endpoint valida, no debe guardarse una clave privilegiada en ese campo.
- Las pruebas locales no sustituyen una comprobación de RLS y Storage con dos cuentas en el proyecto real.


## Revisión v40.16 — alcance y pendientes

- 121 tests locales aprobados, incluida la comprobación HTTP del endpoint público de configuración de Supabase y el rechazo de claves de servidor.
- El endpoint público solo entrega URL y clave publishable/anon aceptadas por su validador; no serializa `process.env`.
- `GEMINI_API_KEY`, las claves de servicio y las credenciales privadas no deben estar en archivos estáticos, ZIP público ni repositorio.
- Esta es una revisión estática + pruebas automáticas, no un pentest. Sigue pendiente probar RLS/Storage con dos cuentas en el proyecto real, verificar las políticas de privacidad, límites de mensajes, borrado de cuenta/conversación y probar una llamada real a Gemini en Render.


## Revisión v40.17 — comprobaciones adicionales
- La validación pública de Supabase está alineada entre navegador y backend: HTTPS, hostname de proyecto `*.supabase.co`, sin credenciales ni query/hash/ruta adicional; acepta solo publishable o JWT `anon`.
- Se rechazan placeholders, `sb_secret_` y JWT con rol distinto de `anon`. El endpoint público no expone la clave de Gemini ni valores generales del entorno.
- El diagnóstico de Comunidad hace lecturas de solo lectura a cinco tablas y dos funciones RPC; con sesión autentificada también comprueba mensajes, bloqueos y `user_app_data`.
- Suite automatizada: 130 pruebas aprobadas, 0 fallidas; no equivale a pentest ni a validación de Supabase real.
- Siguen pendientes las pruebas RLS/Storage con cuentas distintas, el flujo administrativo de denuncias, la validación de credenciales Gemini/Render y las comprobaciones en teléfonos físicos.
