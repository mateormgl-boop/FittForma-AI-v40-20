# Auditoría final — FittForma AI v40.0

**Fecha:** 14 de octubre de 2026
**Revisión integral adicional:** auditoría estática del ZIP real y ampliación de pruebas de sintaxis  
**Alcance:** revisión estática del proyecto, coherencia de versión, suite automatizada local y endurecimientos de la comunidad. No equivale a una auditoría externa, una prueba de penetración ni una validación de un despliegue real.

## Resultado de la revisión local

- **68 pruebas automatizadas aprobadas; 0 fallidas** tras ampliar la suite. La suite incluye comprobaciones de estructura, políticas declaradas, recursos estáticos, pruebas HTTP locales del backend y una prueba que recorre los archivos JavaScript/MJS e intenta parsear los scripts inline de `index.html`.
- Sintaxis comprobada mediante `node --check` en todos los archivos `.js`/`.mjs` del proyecto (excepto plantilla `.example.js`) y en los scripts inline de `index.html`. Esta verificación se ejecuta ahora como parte de `npm test`.
- Versiones visibles, paquetes, traducciones de pie de página, caché de Service Worker y documentación alineadas con 40.0.
- Se verificó que los recursos declarados para la PWA y los archivos del proyecto existen mediante la suite de tests.
- La base SQL no pudo ejecutarse contra un proyecto PostgreSQL/Supabase real en esta revisión; por eso las comprobaciones de RLS, triggers, OAuth y almacenamiento siguen pendientes de validación real.

## Cambios funcionales de v40.0

### Feed

- Prioriza una combinación de publicaciones recientes, actividad constante del autor durante los últimos 30 días e interacciones, con topes para que publicar o reaccionar en masa no sume sin límite.
- Añade una pequeña oportunidad de descubrimiento a cuentas con pocos seguidores y reduce gradualmente el peso de publicaciones adicionales del mismo autor.
- Descarta del ranking orgánico publicaciones con más de 90 días para reducir contenido demasiado antiguo.
- Pro aparece como distintivo, no recibe prioridad automática en el ranking orgánico. No hay pagos ni publicación patrocinada activa.

### Bloqueos y privacidad de la comunidad

- El bloqueo se aplica mediante políticas de base de datos a perfiles, publicaciones, relaciones, comentarios, likes, medios y mensajes.
- Bloquear elimina las relaciones de seguimiento en ambos sentidos. Desbloquear no vuelve a seguir automáticamente a la otra persona.
- La lista de bloqueados muestra nombre y usuario guardados en el momento del bloqueo para reconocer la cuenta aunque el perfil se oculte durante el bloqueo.
- Los progresos publicados se identifican expresamente como información compartida por el usuario y no verificada automáticamente.

### Chat

- Conserva el requisito de seguimiento mutuo aceptado.
- Añade un límite del lado de la base de datos de 10 mensajes por minuto y 100 por cada ventana de 24 horas, con bloqueo transaccional por cuenta para reducir carreras de solicitudes simultáneas.
- Permite borrar todos los mensajes de la conversación para ambas personas con confirmación explícita.

### Retos personales

- Se muestran metas semanales de 3 rutinas, 3 días activos y 120 minutos.
- El avance se calcula con registros locales del dispositivo. No es un reto online compartido ni una verificación independiente de la actividad realizada.

## Pasos para actualizar

1. Subir el contenido del ZIP directamente a la raíz del repositorio GitHub conectado a Render.
2. Mantener las variables privadas existentes en Render, especialmente `GEMINI_API_KEY` y `GEMINI_MODEL`.
3. Si la comunidad está configurada, ejecutar el archivo completo `supabase/community.sql` de este paquete en el SQL Editor del proyecto Supabase.
4. Revisar que `supabase-config.js` conserve la URL y la clave pública `anon`/`publishable`. Nunca colocar una clave `service_role` en el frontend.
5. Probar la versión desplegada con dos o más cuentas reales antes de permitir el uso público de la comunidad.

## Hallazgos de esta revisión adicional

- El ZIP es íntegro y extrae correctamente; `npm test` se ejecutó desde la raíz del proyecto y terminó sin fallos.
- Se añadió `tests/syntax.test.mjs` para que la sintaxis de todos los módulos y scripts inline se vuelva a comprobar en futuras modificaciones, en lugar de depender de una validación manual puntual.
- No se confirmó un fallo funcional adicional que pudiera corregirse con seguridad sin conectar una instancia real de Supabase. No se hicieron cambios especulativos al SQL ni se simularon resultados de producción.
- Los tests actuales comprueban muchos contratos por inspección de código/SQL; no ejecutan el SQL en PostgreSQL y no sustituyen las pruebas de permisos con usuarios reales.

## Pendientes y límites conocidos

- No se probaron las políticas RLS, el SQL, la autenticación por correo/Google, los enlaces firmados de fotografías, los bloqueos ni el chat contra un proyecto Supabase real.
- No se hizo prueba visual con iPhone/Android físico ni se comprobó un despliegue de Render en producción durante esta revisión.
- Las denuncias se almacenan, pero no existe panel administrativo ni flujo operativo de moderación y resolución. No abrir la comunidad al público sin ese procedimiento.
- No hay recuperación de contraseña personalizada, borrado/exportación completa de cuenta online, notificaciones sociales push ni avatar en nube.
- Pro sigue siendo informativo: no hay proveedor de pagos ni webhook conectados. Los módulos publicitarios permanecen desactivados.
- Los retos son locales al dispositivo, no comunitarios ni verificables.
- GPS y recordatorios pueden verse interrumpidos por el sistema operativo cuando la aplicación queda en segundo plano o cerrada.
- La limitación de la API de IA sigue basada principalmente en IP y memoria del proceso; antes de escalar, hace falta autenticación validada por cuenta y cuota persistente.
- La política CSP aún permite scripts inline por la arquitectura actual, lo que limita su endurecimiento.

## Conclusión

La versión 40.0 mejora de forma verificable el ranking y los controles sociales y pasa la suite local ampliada de 68 pruebas. **No debe etiquetarse todavía como lista para producción** hasta comprobar SQL/RLS en Supabase real, probar dispositivos y desplegar una moderación operativa.
