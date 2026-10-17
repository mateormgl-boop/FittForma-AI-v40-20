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
