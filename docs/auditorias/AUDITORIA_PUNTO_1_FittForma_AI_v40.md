# FittForma AI v40 — Punto 1: auditoría inicial sin modificar código

**Fecha:** 15/10/2026  
**Archivo revisado:** `FittForma_AI_v40_revision_auditoria_integral(1).zip`  
**Alcance de esta etapa:** inventario, ejecución de pruebas incluidas y detección inicial de riesgos estáticos. No se modificó ningún archivo del proyecto.

## 1. Inventario comprobado

- 244 archivos dentro del ZIP.
- Aplicación principal en `index.html` (2.608 líneas; interfaz, estilos y gran parte de la lógica de cliente).
- Módulo separado de comunidad en `community.js` (215 líneas) y traducciones en `i18n.js`.
- Backend Node.js en `backend/server.mjs` (252 líneas), con endpoints de salud/estado, entrenador IA y estimación nutricional por foto.
- SQL de sincronización y comunidad en `supabase/schema.sql` y `supabase/community.sql`.
- 180 ilustraciones SVG específicas bajo `assets/exercises/generated/`, además de imágenes WebP y referencias genéricas.
- 6 archivos de pruebas bajo `tests/`.
- Configuración PWA en `manifest.json` y `sw.js`; configuración de despliegue en `render.yaml`.

## 2. Pruebas ejecutadas en esta revisión

Se ejecutó `npm test` con Node.js v22.16.0 desde el contenido extraído del ZIP.

**Resultado: 68 pruebas aprobadas, 0 fallidas, 0 omitidas.** La suite incluye comprobaciones de sintaxis, recursos estáticos, rutas HTTP locales, cabeceras de seguridad, partes del catálogo de ejercicios, GPS, nutrición, progreso, funciones comunitarias y consistencia de versión.

Esto valida los casos cubiertos por las pruebas automatizadas, no cada interacción posible ni el servicio desplegado en producción.

## 3. Inventario funcional inicial

| Área | Estado según código y pruebas locales | Límite conocido |
|---|---|---|
| Inicio, navegación y perfil | Implementados | Falta recorrido visual en teléfonos físicos. |
| Biblioteca de ejercicios | Hay más de 150 ejercicios en la biblioteca y 180 SVG específicos | La existencia del SVG no demuestra que cada dibujo represente correctamente la técnica. |
| Rutinas y registro de series | Incluye series, guardado local, recuperación de sesión y referencias de rendimiento anterior | Falta probar sesiones largas/interrumpidas en dispositivos reales. |
| Carrera, caminata, bicicleta y GPS | Incluye registro manual, GPS, historial y exportación GPX | El navegador puede suspender el GPS en segundo plano. |
| Nutrición | Registro de comidas, estimaciones, objetivos y propuesta de menú | Los valores son aproximados; falta validar precisión en casos variados. |
| Progreso | Peso, historial, comparaciones, récords y resúmenes | La calidad depende de que los datos estén completos y bien registrados. |
| Entrenador IA | Backend con Gemini para conversación/rutinas y análisis de foto | Requiere clave de servidor; la API no tiene cuota persistente por cuenta. |
| Comunidad | Perfiles, publicaciones, fotos privadas, seguimiento, comentarios, likes, bloqueo y chat en SQL/cliente | La integración real con Supabase no fue ejecutada en este entorno. |
| Sincronización | Código de inicio de sesión, carga y guardado en Supabase | El `supabase-config.js` del ZIP viene vacío; no funciona online hasta configurarlo. |
| Pro y publicidad | Presentación/configuración preparadas | No hay pagos/webhooks activos ni proveedor de anuncios configurado. |
| Recordatorios | Preferencias y avisos locales | No garantizan notificaciones si la app está cerrada. |

## 4. Hallazgos y prioridad preliminar

### P0 — Antes de abrir al público

1. **Moderación de comunidad incompleta.** Las denuncias se guardan, pero no hay panel/procedimiento operativo para revisarlas y resolverlas. No lanzar la comunidad abierta sin una vía de moderación.
2. **Validar RLS y almacenamiento en Supabase real.** Las políticas existen en SQL, pero las pruebas estáticas no prueban aislamiento entre usuarios. Probar perfiles privados, fotos, bloqueo, chat y solicitudes con al menos dos cuentas.
3. **API de IA sin cuota persistente por usuario.** El límite actual del backend es en memoria y por IP; no equivale a cuotas duraderas ni es suficiente para controlar costos a escala.

### P1 — Importante antes de crecer

4. **Configuración vacía de Supabase en el ZIP.** Es intencional para no exponer credenciales, pero hay que preservar/restaurar URL y clave pública `anon`/publishable en el despliegue. Nunca usar `service_role` en el frontend.
5. **`supabase/schema.sql` no parece idempotente.** Crea tres políticas con `create policy` sin eliminarlas previamente; si se vuelve a ejecutar sobre una base ya configurada, puede fallar por políticas existentes. La guía debe aclarar si se ejecuta solo una vez o el SQL debe hacerse repetible.
6. **CSP con `unsafe-inline`.** La política actual lo necesita por los scripts/estilos inline; reduce la protección frente a ciertas inyecciones. Una mejora posterior sería mover scripts/estilos o usar nonces/hashes.
7. **Falta recuperación de contraseña, borrado/exportación completa de cuenta online y notificaciones sociales/push.** Exportar datos locales no equivale a una exportación integral de los datos comunitarios en nube.
8. **GPS/recordatorios en segundo plano.** Debe explicarse como limitación de la PWA y probarse en iOS/Android.

### P2 — Calidad del producto

9. **Revisión de contenido visual de ejercicios pendiente.** Hay 180 SVG específicos y pruebas de que existen, pero no se verificó manualmente que cada ilustración, instrucciones, músculos, respiración, errores y regresiones coincidan con el ejercicio.
10. **Pruebas de interfaz real pendientes.** No se hizo un recorrido de navegador con distintos tamaños ni pruebas físicas en iPhone/Android; las pruebas actuales son principalmente automatizadas y HTTP local.
11. **Pagos y anuncios no activos.** Mantenerlos desactivados hasta integrar proveedor, validación server-side/webhooks, consentimiento y política de privacidad.

## 5. Qué no se pudo certificar en esta etapa

- No se probó el proyecto real de Supabase ni se hicieron pruebas con usuarios/cuentas reales.
- No se probó la app desplegada en Render ni con Gemini real y una clave válida.
- No se probó GPS en movimiento real ni comportamiento con la app en segundo plano.
- No se inspeccionó visualmente, uno por uno, el contenido de las 180 ilustraciones.
- No se hizo una auditoría de penetración ni se certifica que la aplicación sea segura para producción.

## 6. Próximo orden de trabajo

1. Corregir y probar la base técnica/de configuración sin perder los datos ni las claves públicas de despliegue.
2. Revisar a fondo la interfaz móvil y la navegación.
3. Auditar el catálogo/ilustraciones de ejercicios por grupos prioritarios.
4. Probar el flujo completo de entrenamiento y recuperación de sesiones.
5. Revisar el contexto, validaciones y límites del entrenador IA.
6. Auditar comunidad, privacidad, moderación y RLS con una instancia real.
7. Revisar nutrición, progreso y hábitos.
8. Hacer QA de lanzamiento y documentar pendientes.

**Conclusión del punto 1:** la base tiene una suite local saludable y una cantidad considerable de funciones implementadas, pero no corresponde marcarla como lista para producción. Los riesgos más urgentes son moderación, validación real de Supabase y control de uso/costos de la IA. No se modificó el código en esta etapa.
