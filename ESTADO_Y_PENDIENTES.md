# FittForma AI — estado revisado v40.2

## Cambios v40.2 — estabilización técnica

- Validación de `PORT` en arranque y bind explícito a `0.0.0.0`.
- Corrección del identificador de cliente para el límite de solicitudes cuando se despliega detrás del proxy de Render; se confía en esos encabezados solo con `TRUST_RENDER_CLIENT_IP=true`.
- Recuperación escalonada de estados anteriores de `localStorage` si la clave vigente está corrupta o es incompatible.
- El esquema base de `user_app_data` es re-ejecutable respecto de sus tres políticas RLS porque las descarta si ya existen antes de crearlas de nuevo.
- Manejo de errores de conexión para autenticación y sincronización con Supabase, con conservación del estado local si no se completa la carga remota.
- Caché de PWA versionada a `v40-1`.
- Suite automática ampliada para probar límites por IP y rutas de recuperación/sincronización a nivel estático.

## Cambios v40.0

- Revisión de coherencia de versión: pie de página, traducciones, menú móvil, paquetes, service worker, documentación y pruebas alineados a 40.0.
- Ranking orgánico actualizado para premiar actividad y constancia de los últimos 30 días, con topes, interacciones, recencia, una pequeña ayuda de descubrimiento para cuentas pequeñas, máximo de 90 días de antigüedad del post y diversificación por autor. Pro es un distintivo, no una ventaja automática de ranking.
- Bloqueo de usuarios aplicado en RLS a perfiles, feed, comentarios, likes, relaciones, fotos y mensajes. Bloquear borra los seguimientos mutuos; desbloquear no los restaura. La lista de bloqueados conserva nombre y usuario visible para reconocerlos aunque el perfil quede oculto.
- Chat protegido por seguimiento mutuo aceptado; se añade límite server-side de 10 mensajes/minuto y 100 mensajes/día por usuario, bloqueado por transacción para reducir carreras de solicitudes simultáneas, y opción de eliminar la conversación para ambas personas.
- La interfaz identifica el contenido de progreso como compartido por el usuario y no verificado automáticamente.
- Retos personales semanales sobre registros locales: 3 rutinas, 3 días activos y 120 minutos.
- Se mejora la documentación de despliegue y se explicitan funciones que siguen sin estar listas para producción.

## Validaciones locales

- La suite de pruebas estáticas y HTTP local debe ejecutarse con `npm test`; registrar su resultado definitivo en la auditoría v40.
- Revisar sintaxis JS con `node --check` y extraer/verificar el ZIP final.
- No se dispone de un proyecto Supabase real asociado a esta auditoría; por tanto el SQL, RLS, OAuth y almacenamiento tienen que probarse manualmente con dos cuentas reales.

## Funciones disponibles en el código

1. Entrenamiento: planes, biblioteca de ejercicios, rutinas y seguimiento de series.
2. GPS: registro al aire libre y exportación; el navegador puede suspenderlo en segundo plano.
3. IA: entrenador y análisis de foto a través del backend; depende de clave válida, cuota y disponibilidad del proveedor.
4. Nutrición: objetivos y registro con estimaciones que requieren revisión del usuario.
5. Progreso: historial, comparativas, récords y retos personales de constancia.
6. Comunidad online opcional: perfiles públicos/privados, publicaciones, fotos, likes, comentarios, seguimiento, chat y ranking orgánico.
7. Seguridad social: RLS, fotos privadas, bloqueo y límites del chat preparados en SQL; requieren prueba real antes de activarlos públicamente.
8. Membresía Pro: solo presentación informativa. No se procesan pagos y el cliente no puede asignarse Pro.
9. Publicidad: módulos desactivados hasta configurar proveedor y consentimiento.

## Pendientes críticos antes de un lanzamiento público

- **Moderación:** denuncias almacenadas, pero no existe panel de administración ni flujo de revisión y resolución.
- Recuperación de contraseña, eliminación de cuenta y exportación/borrado completo de datos del servicio online.
- Verificar en Supabase real, con dos o más cuentas: perfiles privados, políticas RLS, chat, bloqueo/desbloqueo, eliminación de conversación, carga y firma de imágenes, y límites por cuenta.
- Probar en teléfono físico y en despliegue real la instalación PWA, autorización GPS, navegación, fotos, notificaciones y manejo de errores.
- Notificaciones sociales/push y avatares en nube.
- Autenticación/cupo persistente por cuenta para la API IA; el rate limit actual del backend es en memoria y por IP.
- Pago/webhook real para Pro y proveedor publicitario con consentimiento/política de privacidad antes de monetizar.
- Retos compartidos entre usuarios aún no están implementados; los retos de v40 son personales y locales a este dispositivo.

## Estado de producción

**No marcar como listo para producción.** La versión mejora controles y consistencia, pero faltan validación de Supabase real, moderación operativa y pruebas en dispositivos físicos. No hay cobros ni anuncios activos.
