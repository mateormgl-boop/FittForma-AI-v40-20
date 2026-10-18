# FittForma AI — Registro de cambios

## v48.0 — Auditoría integral y monetización (18 de octubre de 2026)

**Entrenamiento**
- Planificador nuevo (`training-core.js`) con 156 ejercicios canónicos.
- El objetivo, el nivel, el equipo y los días cambian la rutina de verdad: series, repeticiones, descansos, orden y balance empuje/tracción.
- Se eliminaron los duplicados y la movilidad ya no se trata como fuerza.
- Biblioteca con imagen propia y correcta por ejercicio:
  - 224 fotos WebP de free-exercise-db (Unlicense).
  - 44 ilustraciones SVG originales.
- Ficha con posición inicial, pasos, respiración, errores comunes y músculos (`exercise-guides.js`).
- Progresión diaria: una sesión diaria cada **12 h**, controlada con la hora del servidor y sin duplicados (RPC `complete_daily_training`, idempotente).
- Las sesiones extra, propias, libres y manuales no desbloquean la siguiente sesión diaria. Una sesión parcial no cuenta.

**Insignias, perfil e hidratación**
- Medallas rediseñadas por rango.
- Pantalla de logro y hasta 3 insignias destacadas en el perfil.
- Criterios más exigentes para los ejercicios fáciles.
- Perfil:
  - Peso en kg o lb.
  - Altura validada.
  - Historial de peso.
  - Preferencias de entrenamiento.
- Hidratación completa:
  - Registro en ml.
  - Botones rápidos.
  - Deshacer.
  - Meta recomendada.
  - Recordatorio.
  - Semana.

**Monetización** (apagada por defecto; ver `docs/MONETIZACION.md`)
- Banners en Inicio, Comunidad y Explorar.
- Intersticiales solo en pausas naturales, cada 5–10 min de uso activo. Nunca durante un entrenamiento, el GPS, las comidas, la IA, el inicio de sesión, un pago, una foto o un guardado.
- Videos recompensados voluntarios para:
  - IA: +3 consultas.
  - Fotos en Comunidad: +1 foto, con el borrador conservado y sin publicación automática.
- Los videos recompensados usan un comprobante de un solo uso validado en el servidor.
- La cuota de IA se aplica en el servidor y se devuelve si Gemini falla. El límite de fotos lo aplica la base.
- Plus («FittForma AI Plus», antes «Pro»): sin anuncios y con más IA y más fotos. Se verifica en el servidor con Google Play (subscriptionsv2, acknowledge y RTDN).
- Los precios no cambiaron.
- La CSP permite los dominios de Google solo si se configura Ad Manager.
- Corregido: las métricas de anuncios compartían el límite por minuto con la IA y con los canjes. Ahora tienen límites separados.

**Pruebas**
- 209 automáticas.
- 115 de integración.
- 47 E2E de monetización.
- 33 de Comunidad.
- 133 SQL/RLS.

## v47.0 — Rediseño completo y Etapa 9: entrega (17 de octubre de 2026)

- Diseño nuevo según las referencias claras y oscuras: tema claro por defecto y tema oscuro, elegibles en el encabezado y en Perfil; color propio por sección (Inicio, Entrenar, Correr, Nutrición, Progreso, Comunidad, Perfil, FittAI).
- Logo nuevo (la «F» que forma una persona corriendo) en el encabezado, los íconos de la app y FittAI. Es una recreación en vector hasta tener el archivo original.
- Sistema visual en `design.css`: botones, pestañas, tarjetas, formularios, gráficos y encabezados de sección iguales en toda la app.
- Inicio: franja con la semana, accesos rápidos, «Actividad reciente» con registros reales y estadísticas con íconos. Entrenar: biblioteca en cuadrícula con fotos. Nutrición: anillo de calorías y macros con color. Progreso: gráfico de peso nuevo. Comunidad: fotos que no cargan muestran un fondo neutro.
- Corregido: fechas con hora completa mostraban «Invalid Date»; el editor de rutinas a veces perdía el foco al abrirse; el encabezado fijo dejaba ver el contenido de abajo.
- Contraste AA en ambos temas (auditoría en el navegador a 390 y 1366 px) y sombras neutras en el tema oscuro.
- Entrega: `docs/DESPLIEGUE.md` con variables, orden de migraciones, comprobaciones y vuelta atrás. Sin migraciones nuevas.
- Pruebas: 200 automáticas, 115 integración, flujos críticos, 91 SQL/RLS y 33 Comunidad.

## v46.0 — Etapa 8: ajustes de diseño (17 de octubre de 2026)

- Pulido con la skill *impeccable* (`audit` + `polish`), conservando el diseño de las referencias.
- Contraste: el degradado de acento se oscurece un paso para que el texto blanco pase 4.5:1 (antes 4.43:1); insignia de nivel, placeholders (4.2 → 5.6:1) y días del calendario corregidos.
- Tamaño mínimo de 11 px para rótulos que estaban entre 8 y 10,5 px (barra inferior, calendario, métricas, Progreso, Correr); pie de página a 12 px.
- Profundidad con sombras desplazadas en vez de halos de color; sin texto con degradado.
- Superficies del navegador con la paleta: selección de texto, cursor, foco visible, barra de desplazamiento y números tabulares.
- Detector de impeccable: de 143 a menos de 90 avisos; los restantes son reglas antiguas ya reemplazadas en pantalla o decisiones del diseño de referencia (rótulos sobre los títulos).
- `.claude/settings.json` registra el marketplace `pbakaus/impeccable` y activa el plugin para las próximas sesiones.
- Pruebas: 200 automáticas, 115 integración, 22 flujos críticos, 91 SQL/RLS y 33 Comunidad; barrido visual en español y alemán de 360 a 1366 px.

## v45.0 — Etapa 7: pruebas (17 de octubre de 2026)

- Nueva prueba de flujos críticos (`tests/e2e/flows.e2e.mjs`): generar plan, propuesta de FittAI (aprobar, deshacer, rechazar), GPS simulado, foto de comida, hábitos, exportar → borrar → importar, idiomas, fechas localizadas y uso sin conexión.
- Comunidad E2E: guardar y recuperar la copia en la nube contra PostgREST (33 pasos).
- Traducción: unos 900 textos que seguían en español en los otros 5 idiomas (`i18n-extra.js`), patrones para textos con números y fechas en el formato del idioma elegido.
- Corregido: los placeholders de los cuadros de texto y las etiquetas de las fotos de ejercicios no se traducían.
- `npm run test:e2e` corre integración y flujos críticos.
- Pruebas: 197 automáticas, 115 de integración, 22 de flujos críticos, 91 SQL/RLS y 33 E2E de Comunidad.

## v44.0 — Etapa 6: seguridad y datos (17 de octubre de 2026)

- Corregido un fallo que permitía fabricar un «seguimiento mutuo» para enviar mensajes a perfiles privados.
- Copias importadas o de la nube validadas (`sanitizeState`): no pueden inyectar código ni dejar la app inutilizable.
- Base de datos: fechas puestas por el servidor, límites anti-spam, columnas editables explícitas, mensajes nunca creados como leídos, búsqueda corregida, tamaño máximo de la copia en la nube, denuncias conservadas al eliminar un post.
- Servidor: mismo origen obligatorio en los POST, cuota diaria de IA, contexto de FittAI filtrado (sin foto de perfil), sin confiar en `X-Forwarded-For`, CSP acotada.
- supabase-js 2.45.4 y Leaflet 1.9.4 con integridad SRI.
- Eliminar cuenta: verificación previa, listado paginado y la base no elimina la cuenta si quedan fotos.
- Migración aditiva `supabase/migrations/2026-10-19_v44_security_hardening.sql`. Informe: `docs/SEGURIDAD_v44.md`.
- Pruebas: 193 automáticas, 115 de integración en navegador (incluye una copia maliciosa), 91 SQL/RLS con los permisos por defecto de Supabase y 30 E2E de Comunidad.

## v43.0 — Diseño según referencias, FittAI que guía por la app y etapa 5 (18 de octubre de 2026)

- Diseño: acento degradado azul-violeta, tarjetas con ilustración en Entrenar, Nutrición y Comunidad, tarjeta del plan actual, fichas de variación en Progreso (4 semanas vs. 4 previas), indicadores de la semana en Inicio, botón «+» con registro rápido y pantalla de bienvenida solo la primera vez.
- Perfil: foto de perfil (JPG/PNG/WebP, recorte cuadrado de 256 px, guardada en el perfil local) y nivel por XP con fórmula pública basada en registros reales.
- FittAI conoce todas las secciones y ofrece botones «Ir a…» hacia destinos permitidos (lista blanca compartida entre app y servidor, máx. 3). Sin IA configurada responde una guía local que se identifica como tal.
- Nutrición «Plan y recetas»: plan semanal de comidas y 8 recetas con macros estimados; cargar una receta en el formulario de registro.
- Comunidad: moderación de denuncias (descartar o eliminar publicación) solo para cuentas agregadas por SQL a `community_moderators`.
- Cuenta: eliminar la cuenta en la nube con confirmación escrita «ELIMINAR» (borra archivos de Storage y, en cascada, todos los datos de la base); los datos del dispositivo se conservan salvo que se pida lo contrario.
- Traducción de mensajes dinámicos (saludo, faltantes para insignias, niveles, actividad semanal).
- Migración aditiva `supabase/migrations/2026-10-18_v43_moderation_account_deletion.sql`.
- Pruebas: 185 automáticas, 107 comprobaciones de integración en navegador (móvil y escritorio), 64 SQL/RLS y 30 E2E de Comunidad (incluye moderación y eliminación de cuenta).

## v42.1 — Períodos, cuerpo, notificaciones y FittAI con contexto (17 de octubre de 2026)

- Progreso: actividad por 7 días, 4 o 12 semanas con comparación contra el período anterior equivalente (running manual vs GPS); peso por 1/3/6 meses o todo.
- Pestaña «Cuerpo»: medidas corporales validadas y fotos de progreso privadas guardadas solo en el dispositivo.
- Campana de notificaciones en Inicio: insignias nuevas, recordatorio del día, sesión en curso y mensajes sin leer, con estado de leído.
- FittAI recibe resumen nutricional, agua, rutinas propias e insignias; un interruptor visible permite no compartir registros (el servidor lo respeta). Límite de consulta a 32 KB.

## v42.0 — Seis secciones, rutinas propias y entrenamiento libre (17 de octubre de 2026)

- Navegación de 6 secciones: Inicio, Entrenar, Nutrición, Progreso, Comunidad y Perfil. FittAI (antes Coach) en Entrenar, «Más» y la barra lateral.
- Inicio: saludo según la hora, acciones rápidas que ejecutan la función real (siguiente sesión, comida, +1 agua, correr, insignias, FittAI).
- Entrenar: rutinas propias con CRUD completo y plantillas desde el plan; entrenamiento libre; agregar/quitar series y ejercicios en curso; descanso automático; lanzador también tras guardar.
- Nutrición en pestañas (Hoy · Registrar · Objetivos · Historial) y edición de comidas sin duplicar.
- Progreso: corregir o eliminar sesiones, con recálculo de insignias.
- Perfil: cabecera con estadísticas reales y grupos plegables; un solo nombre visible.
- Pruebas: 175 automáticas, 55 comprobaciones de integración en navegador, 44 SQL/RLS y 22 E2E de Comunidad. Informe: `docs/AUDITORIA_v42.md`.

## v41.0 — Navegación de 5 destinos, insignias con reglas únicas y comunidad ampliada (17 de octubre de 2026)

- Base: se incorporó el ZIP v40.21 sobre el repositorio (que contenía v40.2); se retiraron solo assets que v40.21 ya no usaba.
- Navegación: 5 destinos móviles; Nutrición, Coach IA y Correr con GPS en «Más». Escritorio ≥1024 px con barra lateral e Inicio a dos columnas.
- Insignias: catálogo, categorías, umbrales, topes de plausibilidad, deduplicación, mensajes de progreso y medallas SVG en `achievements.js`. Galería, detalle de 12 niveles con fecha, lista de marcas con borrado y revocación. Estados «Declarada» y «Con ruta GPS»; ninguno se presenta como verificado.
- Progreso: secciones Resumen, Insignias, Historial y Peso. Inicio: próxima insignia con avance real.
- Comunidad: publicaciones de texto (foto opcional) y de logros con vista previa, edición del texto propio, mensajes sin leer. Migración aditiva `supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql`; sin ella la app degrada a transformaciones y lo indica.
- Corregido: `renderProgress` con sesiones sin `exercises`; el pie de página no coincidía con su traducción; grilla antigua de Progreso en escritorio.
- Diseño: capa final de tokens, controles de formulario coherentes, cabecera de posts y subpestañas de Comunidad sin cortes en móvil, sin emojis como iconos.
- Pruebas: 169 automáticas (`npm test`), 44 comprobaciones SQL/RLS (`npm run test:sql`) y 22 pasos E2E de Comunidad contra PostgREST local.

## v40.21 — Nueva navegación y diseño visual de app móvil

- Inicio nuevo con datos reales: saludo, objetivo semanal con anillo, tira de la semana, entrenamiento de hoy con botón que arranca la sesión, accesos de color (Entrenar, Nutrición, Coach IA, Correr con GPS, Progreso, Comunidad), anillos de kcal/proteína/agua, hábitos marcables e insignias.
- Barra inferior de seis pestañas (Inicio · Entrenar · Nutrición · Progreso · Comunidad · Perfil) con etiquetas legibles; Coach y Correr salen del menú «Más».
- Entrenar agrupa Sesión · Ejercicios · Rutinas · Correr · Coach con una fila de subpestañas.
- Biblioteca de ejercicios en filas con foto y chips de grupo muscular (el selector original queda oculto como respaldo).
- Nutrición: «Resumen de hoy» e Hidratación primero en móvil, con anillo de calorías.
- Sistema visual común (azul oscuro con brillo celeste, tarjetas con degradado, botones y chips unificados, burbujas del Coach).
- Corregido: «Ver mi plan» llevaba a una vista equivocada; CSS inválido `font:… inherit`.
- Conserva insignias (v40.20) y Comunidad por secciones (v40.19). Sin cambios en SQL ni backend.
- 157 pruebas automáticas; capturas en Chromium móvil a 360/390/412 px y escritorio.

## v40.20 — Insignias personales y retos medibles

- Nuevo centro de insignias en Progreso con 12 niveles por desafío: Bronce, Plata, Oro y Diamante, tres niveles por rango.
- Desafíos para ejercicios medibles de la biblioteca (repeticiones, isometrías y cardio), marcas de ejercicios personalizados, distancias de correr/caminar/ciclismo y constancia por días activos.
- El progreso considera la mejor serie guardada en entrenamientos y los récords personales declarados; las marcas manuales no se presentan como verificadas.
- Las carreras GPS válidas según controles básicos de plausibilidad pueden actualizar insignias con distintivo GPS; registros manuales de distancia solo cuentan como logro personal.
- Insignias integradas con el estado de usuario existente (exportación, importación, guardado local y sincronización explícita). Sin cambios al esquema SQL.
- Vista previa de insignias en Perfil. La publicación de insignias en Comunidad se deja para una fase posterior.
- El service worker precarga `achievements.js` y usa caché `fittforma-ai-static-v40-20`.
- La verificación de código local es necesaria, pero la integración con credenciales reales y dispositivos físicos sigue pendiente.


## v40.19 — Comunidad por secciones y corrección de PGRST201

- El feed referencia explícitamente `community_posts_user_id_fkey`; los comentarios, `community_comments_user_id_fkey`.
- Se añadió una recuperación no destructiva que consulta publicaciones y perfiles por separado si PostgREST sigue informando una relación ambigua o falta el nombre de FK esperado.
- Comunidad ahora tiene cinco paneles internos: Feed, Explorar, Publicar, Mensajes y Mi perfil. La búsqueda muestra resultados dentro de Explorar; el feed principal queda separado.
- Pestañas adaptadas a móvil, estados ARIA y navegación por teclado.
- Caché de PWA y versiones actualizadas a `0.40.19` / `fittforma-ai-static-v40-19`.

# Cambios recientes

## v40.18 — actualización de la PWA y auditoría independiente
- **Service worker:** el `index.html`, los `.js`, `.json`, `.css` y `supabase-config.js` se piden primero a la red (con tiempo máximo de 5 s) y solo se usa la copia guardada sin conexión. Antes se servía primero la copia guardada, de modo que una versión nueva podía no verse hasta limpiar los datos del sitio. Las imágenes siguen con copia guardada primero.
- **Aviso de actualización:** si se instala un service worker nuevo, aparece «Hay una versión nueva» con los botones Actualizar y Después. No recarga solo, para no cortar un entrenamiento.
- **Perfil → Versión de la app:** muestra la versión y el botón «Buscar actualización», que consulta al servidor y recarga si hay otra versión.
- Versión `0.40.18` / caché `fittforma-ai-static-v40-18` en paquetes, backend, navegador, traducciones y pruebas.
- 6 pruebas nuevas (`tests/pwa-update.test.mjs`); una de ellas falla con el service worker de la v40.17, como debe. `npm test`: 136 aprobadas, 0 fallidas.
- No se modificó el esquema SQL de Supabase ni la lógica de Gemini.

## v40.17 — auditoría previa a producción
- `npm test`: 130 aprobadas, 0 fallidas; la misma suite pasa desde el ZIP extraído.
- Diagnóstico de Supabase consulta en solo lectura cinco tablas principales, las RPC `search_community_profiles` y `community_ranked_post_ids`, y, con sesión iniciada, mensajes, bloqueos y sincronización de cuenta.
- Validación de configuración pública alineada entre backend/navegador: HTTPS, host de proyecto `*.supabase.co`, sin credenciales/query/fragmento/ruta adicional y clave pública anon/publishable válida.
- Errores distinguen configuración ausente, tabla o RPC faltante, red/CDN y RLS/permisos. No se escriben datos durante el diagnóstico.
- Se corrigieron asociaciones engañosas para ciclismo indoor/exterior y flexiones de rodilla/curls femorales, que ahora usan referencias apropiadas de familia.
- Se añadieron tipos explícitos a los botones que carecían de ellos y una prueba que impide regresiones de ese tipo.
- Se confirmó que los 45 recursos del precaché existen; se revisaron 213 assets y 24 imágenes rasterizadas activas sin duplicados exactos ni pares perceptualmente casi idénticos según el umbral utilizado.
- La integración real de Render/Supabase/Gemini y los dispositivos físicos sigue pendiente de prueba del usuario.

# CHANGELOG — FittForma AI

## v40.16 — diagnóstico de conexión y estabilización de la auditoría
- Añadida una ruta de diagnóstico visible desde Comunidad: permite repetir la inicialización de Supabase y hacer una consulta de solo lectura a `community_profiles`.
- `/api/public-config` devuelve solo los valores de conexión públicos permitidos y metadatos diagnósticos: versión, tipo de clave pública y motivo si la configuración está ausente/inválida. Nunca devuelve Gemini ni claves de servidor.
- El backend acepta `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`; ambas opciones pasan validación para rechazar `service_role`/`sb_secret_`.
- `supabase-js` intenta un segundo CDN si el primero no carga.
- Corregidas fechas diarias de Comunidad y límites de anuncios para usar calendario local en vez de UTC, que podía desplazar el día en Uruguay.
- La exportación de datos retarda la revocación de la URL Blob para evitar cortar descargas.
- Se amplió la suite a **124 pruebas aprobadas, 0 fallidas**; las mismas pruebas se repiten desde el ZIP extraído.
- Mantiene las mejoras visuales y la limpieza de duplicados de imágenes de v40.15.
- Pendiente de aceptación externa: credenciales reales de Supabase/Gemini, pruebas RLS y dos cuentas, Render y teléfono físico.

## v40.14 — Punto 10: auditoría final y corrección de configuración de Supabase
- El frontend puede obtener la configuración pública de Supabase desde `GET /api/public-config` usando `SUPABASE_URL` y `SUPABASE_ANON_KEY` (o `SUPABASE_PUBLISHABLE_KEY`) configuradas en Render.
- El backend devuelve únicamente la URL del proyecto y una clave publicable/anon válida; no serializa variables de entorno completas, GEMINI_API_KEY ni SUPABASE_SERVICE_ROLE_KEY.
- Se rechazan claves `sb_secret_` y JWT cuyo claim `role` no sea exactamente `anon`; el cliente local también valida el claim de las claves JWT antiguas.
- La Comunidad muestra un mensaje concreto cuando la configuración falta, en lugar de culpar directamente al esquema SQL.
- Caché PWA, cabeceras de versión y paquetes actualizados a v40.14 / 0.40.14.
- Pruebas locales: consultar `AUDITORIA_PUNTO_10_FittForma_AI_v40_13.md`.

# Cambios de FittForma AI

## v40.12 — Punto 9: GPS, recordatorios y preparación de monetización
- Suite `npm test`: 114 pruebas aprobadas, 0 fallidas.
- Se añadió la descarga de recordatorios recurrentes en formato iCalendar (.ics), construidos a partir de los días y hora guardados. El calendario puede avisar aunque FittForma esté cerrada, pero el evento no detecta si se registró una sesión en la app.
- La creación del .ics valida que los recordatorios estén activados, que haya días elegidos y que la hora sea válida; incluye aviso 10 minutos antes y usa la hora local elegida.
- La exportación GPX ahora solicita confirmación explícita porque el archivo contiene coordenadas precisas. La descarga sigue siendo iniciada por el usuario y se genera localmente.
- Se revisa la preparación de monetización: Google Ad Manager permanece desactivado y Pro no acepta pagos ni aparenta tener suscripciones verificadas. La integración de pagos reales sigue pendiente de elegir y configurar un proveedor.
- Se actualizó versión y caché PWA para que el navegador solicite recursos de v40.12.

## Versiones anteriores
- v40.11: nutrición, progreso e historial de hábitos.
- v40.10: comunidad.
- v40.9: entrenador IA y mejoras visuales/progresión.
- v40.8: entrenamiento en vivo.
