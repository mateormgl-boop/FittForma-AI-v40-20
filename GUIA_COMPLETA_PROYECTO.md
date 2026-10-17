# Guía completa del proyecto FittForma AI — v40.20

## Estado actual v40.20

La v40.20 agrega un centro de insignias personales en Progreso con 12 niveles por desafío (Bronce, Plata, Oro y Diamante), catálogo de ejercicios medibles, desafíos de running/caminata/ciclismo, constancia y marcas personalizadas. Las insignias se guardan dentro del estado de usuario y se sincronizan al usar la sincronización de datos existente. La actividad GPS pasa controles básicos de plausibilidad; no equivale a verificación antifraude completa. La vista previa personal aparece en Perfil; compartir públicamente insignias en Comunidad queda para otra fase.

La v40.19 corrige el error PGRST201 mediante claves foráneas explícitas y una recuperación no destructiva con consultas separadas si el esquema remoto conserva relaciones ambiguas. Comunidad se reorganiza en cinco paneles internos: Feed, Explorar, Publicar, Mensajes y Mi perfil. La interfaz de esas secciones tiene traducciones para seis idiomas. La suite local final de v40.20 pasa 149/149 pruebas; la conexión con servicios reales sigue pendiente de comprobar con las credenciales del usuario en Render/Supabase.

## Qué es
FittForma AI es una aplicación fitness con interfaz mobile-first/PWA, backend Node.js, entrenador de IA basado en Gemini y módulos que pueden integrarse con Supabase para autenticación, datos y comunidad. La aplicación se desarrolla y publica a través del repositorio GitHub conectado a Render.

## Módulos
- **Inicio:** resumen y accesos rápidos, incluido «Consultar a la IA».
- **Entrenar:** rutinas y biblioteca; el flujo actual incluye tiempo activo, series/repeticiones/peso, descanso, pausa/reanudación, borrador local y resumen final.
- **Nutrición:** registro de comidas y estimación de calorías/macros.
- **Progreso:** peso, estadísticas, hábitos, récords e insignias con 12 niveles por desafío; las marcas manuales se diferencian de los recorridos GPS plausibles.
- **Comunidad:** feed, perfiles, interacción social y chat; debe probarse con cuentas reales y reglas RLS.
- **GPS:** registro de actividades al aire libre.
- **Entrenador IA:** conversaciones y recomendaciones a través del backend; necesita clave del servidor y cuotas controladas.
- **Perfil/configuración:** datos y preferencias.
- **PWA:** instalación desde el navegador, service worker y caché versionada.
- **Pro/monetización:** presentación conceptual; no asumir pagos reales ni publicidad activa.

## Tecnología y secretos
- Frontend: HTML, CSS, JavaScript y recursos estáticos.
- Backend: Node.js ESM en `backend/server.mjs`.
- Pruebas: `node --test` (`npm test`).
- Gemini: `GEMINI_API_KEY` debe configurarse solo en variables privadas de Render.
- Supabase: el frontend intenta obtener la URL y la clave pública `anon`/publishable desde `/api/public-config` servido por el backend Render. `supabase-config.js` puede permanecer vacío por seguridad; un archivo local válido también puede actuar como alternativa. No incorporar `service_role` ni `sb_secret_` al frontend ni a commits.
- `npm start` ejecuta el backend; el puerto puede fijarse mediante `PORT`.

## Historial de la versión v40.17

La versión v40.17 fue una etapa de auditoría anterior. La versión actual es v40.20; consultar `AUDITORIA_COMPLETA_FittForma_AI_v40_20.md` para el alcance actual. Las verificaciones de integración externa siguen pendientes hasta probar con las credenciales reales en Render.

## Histórico: Estado de la versión v40.14

## Punto 10 — Auditoría final y configuración de Supabase (v40.14)

La v40.12 dependía del archivo `supabase-config.js` en el navegador. Como el ZIP distribuido deja ese archivo sin credenciales intencionalmente, esta dependencia podía hacer que Comunidad mostrara un mensaje de configuración incluso cuando las variables ya estaban en Render.

La v40.14 agregó `GET /api/public-config`; v40.16 conserva ese camino y añade una revisión visual y estática integral. El backend lee `SUPABASE_URL` y `SUPABASE_ANON_KEY` (o `SUPABASE_PUBLISHABLE_KEY`) y devuelve solo esos valores públicos si pasan la validación. Nunca devuelve `GEMINI_API_KEY` ni otras variables de entorno. Rechaza claves `sb_secret_` y JWT cuyo claim de rol no sea `anon`.

En Render → Environment comprobar:
- `SUPABASE_URL`: URL del proyecto, por ejemplo `https://xxxx.supabase.co`.
- `SUPABASE_ANON_KEY`: clave pública publishable/anon, no `service_role`.

Esta versión no modifica el esquema de tablas. No hace falta volver a ejecutar `supabase/schema.sql` ni `supabase/community.sql`.

La comprobación real de producción sigue pendiente: desplegar en el servicio Render, revisar `/api/public-config` (sin publicar la respuesta), probar registro/inicio de sesión y Comunidad con dos cuentas, e inspeccionar Logs si falla.


### Rediseño (punto 3)
Seis accesos móviles: Inicio, Entrenar, Nutrición, Progreso, Comunidad y Perfil. Inicio cuenta con CTA para abrir el chat. El diseño común usa tema oscuro y acentos azules. Falta la validación final en teléfonos físicos y en instalación PWA productiva.

### Biblioteca de ejercicios (punto 4)
- 190 registros entre modalidades y 180 nombres únicos.
- 36 guías específicas más guías por familia de movimiento para los restantes.
- Las fichas orientativas incluyen patrón, músculos principales/secundarios, equipo, nivel, pasos, respiración, errores, descanso y alternativas.
- Los favoritos son locales. La sustitución prioriza modalidad y patrón; las equivalencias genéricas no se afirman como certificadas.
- Se revisaron las 16 fotografías disponibles y 13 asociaciones se mantienen como específicas. Las referencias visuales genéricas se rotulan como tales.
- Los 180 SVG generados con poses demasiado esquemáticas se conservan bajo `assets/exercises/unverified-generated/`, pero no se muestran al usuario, no se precargan y el backend rechaza su acceso.

El punto 4 se considera completado como trabajo de código/cobertura estructurada. Aun así, las guías generadas no son validación profesional individual; una persona cualificada debería revisarlas antes de hacer afirmaciones de técnica certificada.

## Punto 5 — Entrenamiento en vivo (conservado de v40.8)
- Elegí una rutina y tocá iniciar para abrir la sesión.
- Anotá repeticiones/minutos y carga; marcá cada serie terminada en “Listo”. En cardio, marcá la actividad como completada.
- El borrador se guarda automáticamente en el navegador. El estado de pausa, el tiempo acumulado, notas y el temporizador de descanso vigente forman parte del borrador.
- “Pausar sesión” detiene el tiempo activo. “Reanudar sesión” lo pone en marcha otra vez.
- “Salir y guardar para retomar” pausa la sesión y vuelve al plan sin eliminar el borrador. Para volver, abrí Entrenar.
- Si cerrás o recargás la app, se pregunta si querés recuperar la sesión; al recuperarla queda en pausa para evitar que el reloj corra sin confirmación.
- “Finalizar y guardar” valida los rangos, registra la sesión y muestra un resumen de tiempo, series completas, ejercicios con datos y volumen calculado con las series marcadas como listas.
- Los registros del borrador son locales a este navegador/dispositivo; no son sincronización en vivo entre dispositivos. Si borrás datos del sitio, podés perder borradores locales.

### Punto 8 — Nutrición, progreso y hábitos (v40.11)
- La vista Nutrición incluye una tendencia de los últimos siete días con calorías, proteína y vasos de agua comparados con sus objetivos.
- Los promedios consideran únicamente los días con datos, y la interfaz advierte que los registros son estimaciones y no representan necesariamente todo lo consumido.
- El registro de hidratación conserva un historial por fecha. El último registro antiguo se migra desde el campo `water` si no existía todavía en `waterLogs`.
- La vista Progreso incluye cinco hábitos diarios marcables y resumen visual de los últimos siete días.
- `habitLogs` y `waterLogs` se conservan en la persistencia local, la exportación/importación y la normalización del estado para sincronización manual en la nube.
- No requiere cambios en tablas SQL de Supabase.

### Pruebas locales v40.11 (históricas)
`npm test`: 106 pruebas aprobadas, 0 fallidas en la entrega v40.11. No sustituían la comprobación interactiva en Render ni en un teléfono real.

## Cómo probar localmente
1. Descomprimir el ZIP o clonar el repositorio de GitHub.
2. Usar Node.js 20 o superior.
3. Ejecutar `npm install`.
4. Ejecutar `npm test` y confirmar que todos los tests pasan.
5. Ejecutar `npm start` y abrir la URL local indicada por el servidor.
6. Probar navegación, consulta IA (requiere clave configurada), biblioteca, favoritos, cambio de ejercicio, nutrición, progreso, comunidad y GPS.

## Cómo publicar con GitHub + Render
1. Respaldar el estado actual y crear una rama nueva para probar cambios.
2. Aplicar o subir cambios al repositorio existente, no crear un servicio duplicado innecesariamente.
3. Ejecutar las pruebas localmente.
4. Subir la rama y revisar el diff; no incluir secretos ni `.env`.
5. Crear un Pull Request o integrar en la rama que Render despliega solo después de pasar las comprobaciones.
6. Revisar en Render los logs de build/arranque y abrir la URL publicada.
7. Validar configuración de Supabase, Gemini, almacenamiento, RLS y permisos con cuentas de prueba. No afirmar que esas integraciones funcionan por el solo hecho de que la suite local pase.

## Punto actual: 10 — auditoría integral y mantenimiento (v40.17)
Esta entrega añade exportación de recordatorios al calendario (`.ics`) y confirmación de privacidad antes de descargar archivos GPX. Los avisos internos dependen de que la app esté abierta; no hay push remoto. Los pagos/anuncios siguen desactivados hasta integrar proveedores reales.

## Limitaciones conocidas
No se ha validado en esta entrega un proyecto de Supabase real, una llamada real a Gemini, un despliegue productivo de Render ni teléfonos físicos. Pro y publicidad reales permanecen desactivados. La biblioteca requiere revisión técnica humana para dar por validadas profesionalmente sus instrucciones.

## Cambios v40.11
- Tendencia semanal de nutrición e hidratación.
- Registro de cinco hábitos y resumen semanal.
- Historial de agua persistente por fecha, compatible con datos anteriores.
- 106 pruebas locales aprobadas en esa versión; no prueba credenciales reales ni producción.

## Cambios v40.12
- Exportación `.ics` de recordatorios recurrentes y validación de horarios/días.
- Confirmación de privacidad antes de exportar un GPX con coordenadas.
- Monetización mantenida apagada; no hay pagos ni anuncios reales.
- 114 pruebas automatizadas aprobadas en esta entrega; falta la validación manual en Render y dispositivos físicos.

## Cambios v40.9
- Referencias fotográficas más frecuentes en la biblioteca sin confundirlas con demostraciones exactas.
- Guía visual de progreso en tarjetas.
- Acceso rápido del entrenador para analizar datos recientes.
- Pruebas automatizadas locales: 100 aprobadas; no prueban credenciales reales de Gemini/Supabase ni teléfonos físicos.


## Punto 9 — GPS, recordatorios y monetización (v40.12)
- El GPS ya guardaba puntos del recorrido localmente y permitía exportarlos como GPX. Ahora muestra confirmación antes de descargar coordenadas.
- El perfil permite descargar un archivo iCalendar (`.ics`) de recordatorios semanales. Importalo en tu calendario; esta función no sincroniza con la app ni detecta si completaste la sesión.
- Los recordatorios internos necesitan que la app esté abierta para revisar y disparar avisos; no son push remotos.
- Los pagos Pro y anuncios siguen desactivados hasta completar una integración real y verificable.


## Auditoría integral v40.17
- 124 pruebas aprobadas, 0 fallidas.
- 16 imágenes frecuentes renovadas en formato WebP; cada uso debe seguir siendo una referencia ilustrativa y no una técnica certificada.
- Retirado el archivo redundante de zancada; recursos estáticos y precaché revisados.
- Puerto local predeterminado: `8787` (salvo que `PORT` esté configurado).
- No se probaron credenciales de producción ni un teléfono real; seguir la checklist de la auditoría antes de declarar el lanzamiento público.
