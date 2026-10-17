# FittForma AI v40.2 — entrenamiento, nutrición y comunidad


## Cambios de navegación móvil en v40.2

- Barra inferior con Inicio, Entrenar, Progreso, Comunidad y Perfil.
- Entrenador IA, Correr y Nutrición quedan en el menú secundario “Más”.
- Instalación PWA accesible desde ese menú y caché estática versionada a v40.2.
- Verificación automatizada: 73 pruebas aprobadas, 0 fallidas.
- Auditoría: `AUDITORIA_PUNTO_3_FittForma_AI_v40_2.md`.

FittForma AI es una PWA móvil para organizar rutinas, registrar series y actividades, seguir el progreso y usar un entrenador IA opcional. La comunidad en línea depende de configurar un proyecto propio de Supabase y probar las políticas con cuentas reales.

## Cambios técnicos de v40.2

- El inicio del backend valida `PORT` y escucha explícitamente en `0.0.0.0`, como requiere Render.
- El límite de la IA identifica por separado clientes que llegan a través del proxy de Render cuando `TRUST_RENDER_CLIENT_IP=true`; en desarrollo local queda desactivado. Sigue siendo un límite en memoria, por lo que no reemplaza cuotas persistentes por cuenta ni un almacén distribuido.
- El estado local intenta recuperar copias anteriores si la clave principal de almacenamiento está corrupta o no tiene el formato esperado. Si logra recuperarla, intenta migrarla a la clave actual.
- Inicio/cierre de sesión y guardado/carga en Supabase muestran errores de conexión de forma controlada; si la carga remota falla al procesarse, se conserva el estado local en memoria.
- Se actualiza el nombre de caché PWA para que instalaciones existentes vuelvan a descargar los recursos de esta revisión.

## Qué incluye v40.2

- Biblioteca de ejercicios, rutinas, registro de series, recuperación de sesión, GPS, historial, estadísticas, seguimiento de peso y registro nutricional.
- Entrenador IA y análisis de foto de comida a través del backend. Requiere `GEMINI_API_KEY` en las variables de entorno del servidor.
- Comunidad con perfiles públicos/privados, publicaciones de progreso, fotos almacenadas en un bucket privado, reacciones, comentarios, solicitudes de seguimiento y chat privado con seguimiento mutuo aceptado.
- **Feed orgánico equilibrado:** combina recencia, actividad sostenida durante 30 días, interacciones con topes y un pequeño impulso de descubrimiento para cuentas con pocos seguidores. Cada autor recibe una penalización gradual por publicaciones adicionales en el ranking, para evitar que una sola cuenta ocupe toda la parte superior. Pro es un distintivo; no ordena por encima de otras publicaciones ni implica que se haya verificado un pago.
- **Bloqueo de usuarios aplicado en la base de datos:** el bloqueo corta los seguimientos en ambos sentidos y evita ver perfiles, publicaciones, comentarios, archivos y mensajes entre esas cuentas. También se puede desbloquear desde el perfil; el seguimiento no se restaura solo.
- **Seguridad del chat:** límite de hasta 10 mensajes por minuto y 100 por día por cuenta, con contador del lado del servidor y bloqueo transaccional por cuenta para evitar carreras con envíos simultáneos; también permite eliminar una conversación para ambas personas. La lista de bloqueados conserva nombre y usuario para poder reconocerlos.
- Retos personales de constancia basados en las rutinas y actividades registradas esta semana: 3 rutinas, 3 días activos y 120 minutos. Son locales a este dispositivo; no son retos globales ni verificaciones independientes.
- Tests automáticos, controles del servidor, CSP, caché PWA versionada y configuración sin secretos en el frontend.

## Actualizar desde v39 o anterior

1. Descargá el ZIP y subí **el contenido** a la raíz del repositorio de GitHub conectado a Render, sin crear una carpeta contenedora adicional.
2. Conservá las variables de entorno privadas existentes en Render, especialmente `GEMINI_API_KEY`. `GEMINI_MODEL` también puede permanecer como está si ya funciona.
3. En Supabase → SQL Editor, ejecutá el archivo completo `supabase/community.sql` de este ZIP. La actualización crea las tablas de bloqueo y control de mensajes y reemplaza la función de ranking. No compartas una clave `service_role`.
4. Conservá tu `supabase-config.js` con la URL y la clave pública `anon`/`publishable`. Si ese archivo se reemplazó con la plantilla vacía, volvé a cargar los valores públicos de tu proyecto. Nunca pongas claves privadas en el frontend.
5. Esperá a que Render termine el despliegue. En `/healthz` se espera `{"ok":true,"service":"fittforma-ai"}`.
6. Probá con dos cuentas: perfiles público y privado, solicitud/aceptación, bloqueo/desbloqueo, fotos, comentarios, chat, límites y eliminación de conversación. Confirmá que las cuentas bloqueadas no se ven ni pueden escribirse.

## Configurar desde cero

1. Creá un proyecto Supabase.
2. En SQL Editor ejecutá `supabase/schema.sql` para la sincronización opcional de datos locales; luego ejecutá `supabase/community.sql` para la comunidad.
3. En `supabase-config.js`, completá `url` y `anonKey` con el endpoint y la clave pública del proyecto.
4. En Supabase Authentication, habilitá Email y, si lo necesitás, Google OAuth. Configurá los callback/redirect URLs y agregá el dominio de Render en las URL permitidas.
5. Subí el código a GitHub y dejá que Render despliegue.

## Ejecutar las pruebas

Necesitás Node.js 20 o posterior:

```bash
npm test
node --check community.js
node --check i18n.js
node --check sw.js
node --check backend/server.mjs
```

Las pruebas automáticas validan código y configuración local. No sustituyen la comprobación de RLS en un Supabase real ni la prueba visual en iPhone/Android.

## Pendientes antes de abrir al público

- La comunidad todavía requiere pruebas reales de autenticación, RLS, bloqueo, chat, almacenamiento privado y límites con dos o más cuentas.
- Las denuncias quedan almacenadas, pero **no hay panel administrativo para revisar/resolver reportes**. Antes de abrir la comunidad hay que definir moderadores, procedimiento de respuesta y reglas de contenido.
- Faltan recuperación de contraseña personalizada, eliminación de cuenta/descarga completa desde el servicio online, notificaciones sociales/push y avatar cargable.
- Pro es una propuesta de producto; no hay pagos ni webhook de suscripciones conectados. No habilitar cobros ni asignar membresías desde el navegador.
- Los espacios publicitarios están desactivados hasta configurar un proveedor real y consentimiento/política de privacidad.
- El GPS puede interrumpirse con la app en segundo plano; los recordatorios locales tampoco garantizan entrega cuando la aplicación está cerrada.
- La API de IA no está autenticada por cuenta. El backend aplica límites por IP en memoria; aunque v40.2 mejora la identificación de IP detrás de Render, no constituye una cuota/contabilidad persistente y debe reforzarse antes de recibir tráfico significativo.
