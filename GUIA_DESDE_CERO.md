# Guía rápida — FittForma AI v40.2

## Desplegar o actualizar
1. Descomprimí el ZIP y subí su contenido a la raíz del repositorio de GitHub conectado a Render.
2. Conservá las variables de entorno actuales, especialmente `GEMINI_API_KEY` y `GEMINI_MODEL`.
3. En Render, mantené `npm install`, `npm start` y el health check `/healthz`.
4. En `/healthz` se espera `{"ok":true,"service":"fittforma-ai"}`. Probá también entrenador IA, nutrición, historial y navegación desde el teléfono.
5. El backend no debe exponer por URL archivos como `/package.json`, `/README.md`, `/tests/runtime.test.mjs` ni `/supabase/community.sql`; deberían devolver 404.

## Activar comunidad online
1. Creá un proyecto Supabase y ejecutá `supabase/schema.sql` si querés habilitar sincronización del estado local.
2. Ejecutá el archivo completo `supabase/community.sql` desde SQL Editor. En actualizaciones, volvé a ejecutar este archivo para aplicar funciones de bloqueo, límites del chat y el ranking.
3. En `supabase-config.js`, completá `url` y la clave pública `anon`/`publishable`. Nunca uses `service_role` en el navegador.
4. En Supabase Auth, habilitá Email y, si vas a usarlo, Google OAuth. Añadí el dominio real de Render en Site URL/Redirect URLs y completá credenciales del proveedor.
5. Probá con dos cuentas públicas y privadas: seguir/aceptar, subir fotos, reaccionar, comentar, bloquear/desbloquear, enviar mensajes, eliminar conversación y comprobar límites.

## Antes de publicar
La comunidad aún no tiene panel de revisión de denuncias. Los reportes se guardan, pero una persona responsable debe poder revisarlos y resolverlos antes de abrir el servicio. Tampoco están integrados recuperación de contraseña personalizada, borrado/exportación completa de cuenta online, pagos Pro ni publicidad real. Los retos de constancia son locales al dispositivo. La suite automática no sustituye pruebas reales en Supabase ni en iPhone/Android.
