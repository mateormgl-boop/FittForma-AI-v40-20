## v40.21 — Navegación nueva y diseño

- Reestructura de Inicio/Entrenar y diseño visual aplicado a todas las pantallas.
- Pendiente: probar en teléfonos reales y en la app instalada (PWA), y confirmar Comunidad, Gemini y Supabase en Render con cuenta real.
- Observación: `renderProgress` falla si una sesión guardada no tiene `exercises` (datos antiguos o importados incompletos); no se tocó en esta versión.

## v40.20 — Sistema de insignias personales

- Centro de insignias integrado en Progreso y vista previa en Perfil.
- Doce niveles por desafío: Bronce I–III, Plata I–III, Oro I–III y Diamante I–III.
- Cobertura de ejercicios de fuerza/core/cardio detectados en la biblioteca, ejercicios personalizados, distancias de running/caminata/ciclismo y constancia por días con actividad registrada.
- Los registros manuales se identifican como personales; las distancias GPS pueden marcarse como GPS después de controles básicos de recorrido, duración, precisión y velocidad. No se presenta como verificación infalible.
- Estado persistido en el objeto de usuario existente; sin nuevas tablas ni migraciones SQL.
- Pendiente: compartir insignias en Comunidad con controles de privacidad, validación con datos reales de Render/Supabase y pruebas en dispositivos físicos.

## v40.19 — Comunidad por secciones y corrección de PGRST201

- Suite final local y desde ZIP extraído: 144 pruebas aprobadas, 0 fallidas.
- Interfaz de Comunidad con cinco secciones internas y etiquetas principales traducidas a seis idiomas.

- Feed/comments usan claves foráneas explícitas hacia community_profiles y recuperación por consultas separadas si PostgREST conserva ambigüedad.
- Comunidad ahora tiene cinco paneles internos: Feed, Explorar, Publicar, Mensajes y Mi perfil.
- Pendiente tras desplegar: confirmar en Supabase real que la FK nombrada coincide con la restricción de producción y probar el feed, comentarios, seguimientos y mensajes con una cuenta real.

# Estado y pendientes de FittForma AI

## v40.18 — actualización de la PWA y auditoría independiente

- Corregida la estrategia de caché del service worker (red primero para código y configuración).
- Añadidos aviso de nueva versión y botón «Buscar actualización» en Perfil.
- Auditoría de rutas, identificadores, SQL frente a código, RLS, backend y funciones simuladas: ver `AUDITORIA_COMPLETA_FittForma_AI_v40_18.md`.
- Suite local: 136 aprobadas, 0 fallidas, repetida desde un ZIP extraído en carpeta limpia.
- Pendiente: pruebas reales en Render, Supabase, Gemini y teléfonos; rediseño visual por pantallas (v40.19); sincronización automática; recordatorios push reales; pagos y anuncios reales.

## v40.17 — Auditoría previa a producción; aceptación real pendiente

- Diagnóstico de conexión ampliado a cinco tablas de Comunidad, dos RPC de lectura y, con sesión iniciada, tablas de chat/bloqueos/sincronización.
- Validación de URL/clave pública más estricta y mapeo visual corregido para ciclismo indoor y ejercicios de flexión de rodilla/curl femoral.
- El número definitivo de pruebas se registra en la auditoría `AUDITORIA_COMPLETA_FittForma_AI_v40_17.md`: 130 aprobadas y 0 fallidas.
- Añadido reintento desde Comunidad, verificación de lectura sin escritura y mensajes que distinguen configuración, SDK, tablas y RLS.
- `/api/public-config` informa de versión, tipo de clave pública y causa de configuración ausente/inválida sin exponer claves privadas.
- Corregidas fechas que usaban UTC en Comunidad y contadores diarios; exportación de datos con revocación de Blob URL retardada.
- Suite local repetida desde el código y el ZIP extraído: 130 pruebas aprobadas, 0 fallidas.
- Pendiente: desplegar y probar las credenciales reales y los flujos en Render/Supabase/Gemini.


## Versión actual: v40.17

### Auditoría integral v40.17
- Suite local final: 130 pruebas aprobadas, 0 fallidas.
- Corregidas las comprobaciones antiguas que aún buscaban `40.13`; paquetes, cabecera visible, traducciones y caché PWA ahora coinciden en `0.40.17` / `v40.17`, con caché `fittforma-ai-static-v40-17`.
- No faltan archivos en la lista de precaché del service worker ni rutas locales estáticas que se verificaron automáticamente.
- Los IDs de plantilla duplicados corresponden a expresiones dinámicas reutilizadas, no a IDs literales duplicados en el HTML; el logo de marca usa `alt=""` intencionalmente al estar acompañado de texto visible.
- No hay imágenes rasterizadas activas idénticas por SHA-256 ni pares con distancia pHash ≤10/64 en las 24 imágenes rasterizadas activas. Se retiró una imagen de zancada redundante, se renovaron 16 imágenes de movimiento y se ajustó la bicicleta suave para usar ciclismo exterior como referencia. `gym-v20.webp` permanece como hero; `gym-v19.webp` y `running-v21.webp` ya no están.
- Imágenes generadas de aspecto fotográfico siguen siendo ilustrativas y no equivalen a validación profesional de la técnica.
- Pendiente: pruebas de aceptación en Render/Supabase/Gemini real, cuentas comunitarias, RLS/Storage, instalación PWA y GPS en teléfonos físicos. La captura Chromium headless local no pudo completarse en este entorno, así que no se declara validación visual completa del navegador.


### Punto 1 — Auditoría inicial
Realizada. Consultar `AUDITORIA_FINAL_FittForma_AI_v40_0.md` y `AUDITORIA_PUNTO_1_FittForma_AI_v40.md`.

### Punto 2 — Estabilización técnica
Implementada en v40.1 y continuada en versiones posteriores. Pruebas locales aprobadas; no equivale a certificación de seguridad de producción.

### Punto 3 — Rediseño integral móvil
Implementado en v40.3 y conservado: identidad visual oscura, Inicio, CTA directo a IA y navegación con Inicio, Entrenar, Nutrición, Progreso, Comunidad y Perfil. Requiere validación final en dispositivos físicos y PWA productiva.

### Punto 4 — Biblioteca de ejercicios
Cerrado como etapa de implementación/cobertura de código en v40.7 y conservado en v40.9.
- 190 registros, 180 nombres únicos en las modalidades existentes.
- 36 guías específicas y guías orientativas para todos los nombres restantes.
- Todos los nombres únicos cuentan con familia de movimiento y campos de ficha en ejecución.
- Favoritos locales y reemplazo conservador por modalidad/patrón presentes.
- Fotos no coincidentes no se fuerzan a variantes. Los 180 SVG generados visualmente no fiables están en cuarentena, no salen por el backend ni se precargan en la PWA.

**Límite pendiente:** las 144 guías generadas por taxonomía no están revisadas manualmente una por una ni certificadas por un profesional. Recursos específicos y técnica del catálogo deben continuar siendo evaluados antes de afirmar validación profesional/comercial. Las pruebas locales no comprueban servicios reales o teléfonos físicos.

### Punto 5 — Entrenamiento en vivo
Implementado en v40.9 en su flujo principal:
- Registro de series, repeticiones/minutos, pesos y marcas de completado.
- Temporizador de tiempo activo y pausa/reanudación explícita.
- “Salir y guardar para retomar”, recuperación en pausa después de recargar o volver a abrir y guardado de borrador local.
- El temporizador de descanso se conserva cuando su cuenta atrás sigue vigente.
- Validación de rangos, resumen al finalizar, métricas guardadas en el historial y enlace al progreso.
- Suite de pruebas local: 99 aprobadas, 0 fallidas en esta entrega.

**Pendiente de validación externa:** probar en iPhone/Android reales, revisar pérdida de almacenamiento/cuota local, cerrar el navegador desde el sistema, probar modo avión/conexión intermitente y verificar visualmente en Render. El borrador es local al dispositivo/navegador; todavía no es sincronización de sesiones activas entre dispositivos.

### Punto 6 — Entrenador de IA (base existente, continuada en v40.9)
- El backend recibe un resumen acotado de historial, actividades y peso; el prompt solicita distinguir registros de inferencias y evitar recomendaciones de carga sin datos suficientes.
- Se agrega un acceso rápido para revisar el progreso reciente.
- Pendiente: cuotas persistentes por cuenta y validación externa con Gemini real; la cuota actual del cliente no equivale a un control de costes por usuario en servidor.

### Punto 7 — Comunidad
Implementado en v40.10. La aplicación contiene feed, perfiles, publicaciones e interacciones sociales con políticas RLS definidas en `supabase/community.sql`. Aún requiere validación en el proyecto real con cuentas de prueba, incluidos bloqueos, moderación, privacidad y permisos.

### Punto 8 — Nutrición, progreso y hábitos
Implementado en v40.11: historial semanal de nutrición e hidratación, promedios que excluyen días sin registro, seguimiento de cinco hábitos diarios y resumen de siete días. Los datos de hábitos y agua se incluyen en la copia local y la normalización de estado/nube. La gráfica representa solo los registros disponibles, no la ingesta completa ni datos médicos.

### Punto 9 — GPS, recordatorios y preparación de monetización (v40.12)
- v40.12 permite exportar recordatorios guardados a `.ics` para importarlos en una agenda externa. La agenda externa no sabe si el usuario completó el entrenamiento; los avisos internos de la app requieren que se abra la app para comprobar el estado.
- La exportación GPX ya existente ahora solicita confirmación de privacidad antes de generar un archivo con coordenadas exactas.
- Monetización real permanece desactivada: no hay proveedor de pagos configurado y los anuncios no se habilitan sin IDs reales y aprobados.
- Punto 10: auditoría final, pruebas en despliegue, PWA y dispositivos físicos.

### v40.9 — mejora visual y punto 6
- Las fotos reales existentes se reutilizan como referencias de familia cuando la variante exacta no tiene fotografía. El distintivo REFERENCIA advierte que no es una demostración biomecánica exacta.
- Las tarjetas incluyen una guía visual de progresión técnica, control y avance gradual.
- El entrenador IA ofrece un prompt rápido para revisar el progreso reciente. La respuesta real de Gemini requiere credenciales válidas y pruebas desde el servicio desplegado.
- Validación automatizada local ejecutada después de los cambios; no equivale a prueba real de Gemini/Supabase en producción.


### v40.11 — punto 8, nutrición, progreso y hábitos
- Se incorpora análisis semanal con promedios de calorías/proteína en días con comidas registradas y de vasos de agua en días con registro de hidratación.
- Se preserva historial de hidratación por fecha y se migra el registro antiguo más reciente sin borrar los demás datos.
- Se añade check-in diario de cinco hábitos, con historial visual de siete días.
- Los hábitos y registros de agua son parte del estado exportado/importado y del bloque de estado preparado para sincronización manual.
- Suite local a ejecutar antes de publicar; requiere comprobación manual visual en Render.


### Punto 10 — auditoría final y Supabase (v40.14)
- Se corrigió el camino de configuración: el frontend antes dependía de `supabase-config.js`, vacío en el ZIP distribuido. Ahora puede recuperar la configuración pública desde `GET /api/public-config` con variables de entorno existentes en Render.
- El endpoint solo permite URL del proyecto y clave publicable/anon; rechaza `sb_secret_` y JWT con rol distinto de `anon`.
- Comunidad informa qué variables faltan si la conexión no puede inicializarse.
- Se agregaron pruebas HTTP de configuración y de rechazo de una clave `service_role` colocada por error.
- Pendiente externo: confirmar en Render que existen `SUPABASE_URL` y `SUPABASE_ANON_KEY` (o `SUPABASE_PUBLISHABLE_KEY`), probar inicio de sesión y uso de comunidad con dos cuentas reales, revisar RLS, fotos, bloqueos, chat y permisos.
- Pendiente externo: probar Gemini real, PWA y GPS en dispositivos físicos. La suite local no prueba estas integraciones externas.

### v40.12 — punto 9, GPS, recordatorios y monetización
- Se agregó descarga `.ics` para calendario externo con recurrencia semanal según la configuración del usuario.
- Se añadió confirmación antes de exportar GPX, explicando que contiene coordenadas precisas.
- Se mantuvieron los anuncios y pagos reales desactivados. La cuota de anuncios en navegador no debe considerarse una protección de costes de servidor.
- Pendiente: push remoto con servidor y permisos; seleccionar proveedor de pagos, configurar webhooks verificados, proteger el estado Pro en backend y probar cuentas de extremo a extremo antes de activar monetización.
