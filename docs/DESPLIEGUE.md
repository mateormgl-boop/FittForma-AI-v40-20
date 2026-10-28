# Despliegue de FittForma AI v62.0

Esta guía es la lista de pasos para publicar v62.0. **No se desplegó a producción**: el despliegue lo
hace la persona dueña del proyecto, después de revisar y aprobar el PR.

## Base de datos: aplicar todas las migraciones de una vez

Si Comunidad dice «Comunidad se está actualizando…» o «Could not find the function … in the schema cache», a la base de Supabase le faltan migraciones.

1. Abrí tu proyecto en Supabase → **SQL Editor** → **New query**.
2. Pegá el contenido completo de `supabase/APLICAR_MIGRACIONES.sql` y tocá **Run**.
3. Recargá la app.

Detalles del archivo:
- Tiene las 14 migraciones (v41 a v62), en orden.
- Cada una va en su propia transacción y se puede ejecutar más de una vez: no borra datos ni desactiva RLS.
- Al final recarga la caché de la API de Supabase.
- Se regenera con `node tools/build-migrations-bundle.mjs`.
- `tests/migrations-bundle.test.mjs` comprueba que esté al día.

## Qué cambia en v62.0

- **Hay una migración nueva:** `supabase/migrations/2026-10-31_v62_body_share.sql`.
  - Si ya aplicaste `APLICAR_MIGRACIONES.sql` antes, alcanza con pegar en el SQL Editor solo este archivo (y `notify pgrst, 'reload schema';`).
  - Es aditiva y re-ejecutable: crea la tabla `community_body` (RLS activo, solo la dueña la lee y la escribe) y la función `community_body_info`.
  - Fija el `search_path` de `community_valid_muscle_ranks`, `community_stats_fresh` y `touch_user_app_data_updated_at` sin cambiar lo que hacen.
  - Sin la migración, la app sigue funcionando: la tarjeta «Datos físicos» se oculta.
- **Archivos que se actualizan:** `community.js`, `index.html`, `design.css`, `i18n-v53.js` y `privacidad.html`.
- El service worker cambia a `fittforma-ai-static-v62-0`.

## Qué cambia en v61.0

- **No hay migraciones nuevas.** Usa las funciones que ya están en `APLICAR_MIGRACIONES.sql` (aplicado en el proyecto el 28/10/2026).
- **Archivos que se actualizan:** `community.js`, `index.html`, `design.css` e `i18n-v53.js`.
- El service worker cambia a `fittforma-ai-static-v61-0`.

## Qué cambia en v60.0

- **No hay migraciones nuevas.**
- **Archivos nuevos:** `404.html`, `robots.txt`, `privacidad.html`, `legal-config.js` y `og-image.png`. El servidor los publica en la lista de archivos permitidos.
- **Antes de publicar, completá `legal-config.js`** con el nombre (persona o empresa) responsable y un correo de contacto real.
  - Mientras estén vacíos, la política de privacidad muestra un aviso en lugar de inventarlos.
  - Conviene que un profesional revise la política según tu país.
- **Opcional:** variable `PUBLIC_SITE_URL` en Render (por ejemplo `https://tu-app.onrender.com`, solo https).
  - Con ella, la imagen para compartir y `og:url` van con la dirección completa, como piden Facebook y otras redes.
  - Sin ella, la imagen usa una dirección relativa (WhatsApp suele mostrarla igual).
- **404:** a un navegador se le muestra la página propia; a la app y a las APIs, JSON como antes.
- **Estilos:** `design.css` se sirve con `no-cache` y se pide como `design.css?v=60.0` (v59.1).
- El service worker cambia a `fittforma-ai-static-v60-0`.

## Qué cambia en v59.0

- **No hay migraciones nuevas.** Las calorías de cada sesión se guardan en la propia sesión (`calories`), que ya viaja en la copia en la nube.
- **Archivos que se actualizan:** `activity-core.js` (`estimateExerciseCalories`), `index.html`, `design.css` e `i18n-v53.js`.
- El service worker cambia a `fittforma-ai-static-v59-0`.
- Si todavía no se aplicó, sigue pendiente la migración de v57 `2026-10-30_v57_legend_badges.sql`.

## Qué cambia en v58.0

- **No hay migraciones nuevas.** Mi semana, el diseño de Inicio y las sugerencias de comida se guardan en los datos de la persona (`weekPlan` y `homeLayout`), que ya viajan en la copia en la nube.
- **Archivos que se actualizan:** `training-core.js` (semana, rutinas listas y recomendaciones), `nutrition-guides.js` (menú según el objetivo y «Completá tu día»), `achievements.js` (dibujo de las insignias), `index.html`, `design.css` e `i18n-v53.js`.
- El service worker cambia a `fittforma-ai-static-v58-0`.
- Si todavía no se aplicó, sigue pendiente la migración de v57 `2026-10-30_v57_legend_badges.sql`, para publicar logros Legendario en Comunidad.

## Qué cambia en v57.0

- **Migración nueva (aditiva):** `supabase/migrations/2026-10-30_v57_legend_badges.sql`.
  - Solo reemplaza dos funciones de validación (`community_valid_achievement` y `community_valid_featured`) para aceptar los niveles 13 a 15 con rango `legend`.
  - No borra tablas, datos ni políticas, y se puede ejecutar más de una vez.
  - Sin ella, la app funciona igual, pero Comunidad rechaza publicar un logro Legendario.
- **Animaciones:** `assets/exercises/gif/` (GIF) se reemplaza por `assets/exercises/anim/` (WebP animado, 9 MB en total). `exercise-gifs.js` apunta a los archivos nuevos.
- **Archivos que se actualizan:** `food-db.js`, `food-core.js`, `achievements.js`, `muscle-ranks.js`, `anatomy.js`, `community.js`, `athlete-stats.js` e `i18n-v53.js`.
- La copia automática en la nube usa la tabla `user_app_data` que ya existía; no necesita cambios en Supabase.
- El service worker cambia a `fittforma-ai-static-v57-0`.

## Qué cambia en v56.0

- **No hay migraciones nuevas.**
- **Archivos nuevos:**
  - 31 animaciones en `assets/exercises/gif/` (desde v57, todas en `assets/exercises/anim/` como WebP animado).
  - 62 fotos en `assets/exercises/lib/`.
- **Archivos que se actualizan:** `exercise-gifs.js`, `exercise-media.js`, `exercise-guides.js` y `training-core.js`.
- El service worker cambia a `fittforma-ai-static-v56-0`, así que los teléfonos descargan la versión nueva al abrir la app.
- Siguen pendientes en producción las migraciones de v49 a v54 indicadas abajo, si todavía no se aplicaron.

## Qué cambia en v55.0

- **No hay migraciones nuevas.** Todo lo de v55 funciona en el dispositivo o con funciones que ya existían.
- Archivo nuevo: `nutrition-guides.js`. Ya está en la caché del service worker y en la lista del servidor.
- **Importante si en producción no se ve la foto de perfil, los músculos o las insignias en Comunidad:** casi seguro faltan migraciones anteriores en Supabase. Hay que aplicarlas en este orden:
  1. `2026-10-22_v49_badges.sql`
  2. las de v50
  3. `2026-10-27_v53_athlete_community.sql`
  4. `2026-10-28_v53_profile_extras.sql`
  5. `2026-10-29_v54_weekly_alerts.sql`
- Desde v55 la app dice qué falta (por ejemplo, «falta el bucket» o «falta la columna») en vez de un error genérico.

## Qué cambia en v54.0

- **Migración nueva (aditiva):** `supabase/migrations/2026-10-29_v54_weekly_alerts.sql`. Se aplica después de las dos de v53.
  - Semana actual en `community_athlete_stats` (`week_start` lo fija el servidor, más días, entrenamientos y km de la semana) con validación `CHECK`.
  - Tabla `community_athlete_weekly`: una foto por semana, guardada por un trigger. Solo se lee con funciones.
  - Funciones `community_week_board`, `community_week_winners` y `community_weekly_history`.
  - Tabla `community_notifications`:
    - Los avisos los crean solo triggers (seguir, solicitud, aceptar, mensaje y rango superado).
    - Cada persona lee, marca como leídos o borra solo los suyos.
    - Función `community_notifications_list`.
  - Tabla `community_physique_history`: privada, con una política de Storage que deja a cada persona leer sus propias fotos de «Mi físico».
  - No borra ni cambia nada existente y se puede ejecutar más de una vez.
- **Sin esta migración:** la app sigue funcionando. Se ocultan la campanita, el reto y el historial, el ranking semanal avisa que falta la actualización, y las estadísticas se publican sin las columnas nuevas.

## Qué cambió en v53.1

- **Migración nueva (aditiva):** `supabase/migrations/2026-10-28_v53_profile_extras.sql`. Se aplica después de la de v53.
  - `community_profiles.country_code`: bandera opcional, código ISO de 2 letras.
  - Tabla `community_physique` con RLS para «Mi físico».
    - Hay una fila por persona y sección.
    - Un trigger exige 30 días entre cambios sin Plus (`monetization_is_plus`).
    - No se permite DELETE, así que el plazo no se saltea.
    - La política de Storage solo deja leer las fotos actuales de perfiles visibles.
  - `community_athlete_stats.muscle_ranks` (validado de -1 a 8 por músculo) y `show_muscles`.
  - Funciones `community_athlete_extras`, `community_flags` y `community_viewer_can_see`.
  - No borra ni cambia nada existente y se puede ejecutar más de una vez.
- **Sin esta migración:** no aparecen la bandera, «Mi físico» ni el mapa de músculos. El resto funciona igual.
- **Insignias que no se publican:** si la app dice que falta `2026-10-22_v49_badges.sql`, aplicala. Sin esa migración la base rechaza las insignias de entrenamientos, rachas y peso corporal.
- **Orden recomendado en el editor SQL de Supabase:** todas las migraciones de `supabase/migrations/` por fecha, empezando por la primera que falte. Todas se pueden volver a ejecutar sin problema.

## Qué cambió en v53.0

- **Archivos nuevos:** `athlete-stats.js` e `i18n-v53.js`. Ya están en la lista del servidor y en el service worker.
- **Migración nueva (aditiva):** `supabase/migrations/2026-10-27_v53_athlete_community.sql`. Hay que aplicarla para que
  funcionen las estadísticas, el Ranking, Amigos y la comparación.
  - Crea la tabla `community_athlete_stats` con RLS: cada persona solo lee y escribe su propia fila.
    - Las columnas son solo deportivas: no hay peso, altura, medidas, objetivos ni fotos.
    - Los topes y la coherencia se validan con `CHECK`.
    - Un trigger del servidor fija la fecha y limita cuánto pueden subir los récords por día.
  - Crea las funciones `community_people`, `community_athlete_profile`, `community_leaderboard` y
    `community_follow_requests` (`security definer`).
    - Respetan perfiles privados, bloqueos y la opción de ocultar las estadísticas.
  - No borra ni modifica tablas, registros, funciones ni políticas. `community_rank_shares` y `community_rank_board` de
    v52 quedan instaladas, aunque el cliente ya no las usa.
  - Se puede ejecutar más de una vez.
- **Cómo aplicarla:**
  1. En el panel de Supabase, abrí el editor SQL del proyecto.
  2. Pegá el archivo completo y ejecutalo.
  3. Recargá el esquema de la API (Settings › API › «Reload schema») si las funciones no aparecen enseguida.
  4. Probá antes en un proyecto de prueba con `bash supabase/tests/run.sh`.
- **Sin la migración:**
  - «Todo el mundo» usa el directorio de v50, sin estadísticas.
  - Ranking y Amigos muestran que falta la actualización v53.
  - El resto de la app funciona.
- **Privacidad:** las estadísticas son públicas por defecto, por decisión del producto. Cada persona las publica recién
  cuando ve el aviso en Comunidad y puede ocultarlas en Mi perfil.
- **Límite conocido:** los entrenamientos se registran en el dispositivo, así que el servidor no puede demostrar que
  un número sea real. Las defensas son:
  - Topes y coherencia entre columnas.
  - Fecha del servidor.
  - Récords que suben como mucho una vez cada 20 h y hasta +50 %.
  - Orden calculado en el servidor.
- **No hay insignia de cuenta verificada:** la app no tiene un sistema de verificación, así que no se muestra.

## Qué cambió en v52.0

- **Archivos nuevos:** `muscle-ranks.js` e `i18n-v52.js`. Ya están en la lista del servidor y en el service worker.
- **Migración nueva (aditiva):** `supabase/migrations/2026-10-26_v52_rank_board.sql`.
  - Crea la tabla `community_rank_shares` con RLS: cada persona solo escribe su fila.
  - Crea la función `community_rank_board()`: tu rango y el de quienes seguís con solicitud aceptada, sin bloqueos.
  - No modifica ni borra datos existentes y se puede ejecutar más de una vez.
- **Sin la migración:** todo lo demás funciona; la tarjeta del ranking muestra que falta aplicar la actualización.

## Qué cambió en v51.0

- **Archivos nuevos:** `body-goals.js` e `i18n-v51.js`. Ya están en la lista de archivos que entrega el servidor y en
  el service worker.
- **GIF regenerados:** `assets/exercises/gif/` pasa a unos 29 MB, porque cada GIF tiene más cuadros y pausas. Se siguen
  cargando solo al verlos y no se precargan en el service worker.
- **Sin migraciones:** los datos nuevos del perfil (sexo, cintura, % de grasa, objetivo, ritmo, fecha) viven en el estado
  local y en la copia privada en la nube que ya existía.
- **Mobile:** `npm --prefix mobile run sync` copia los archivos nuevos (toma la lista del servidor).

## Qué cambió en v50.0

- **Archivos y cambios:**
  - `exercise-gifs.js` y `assets/exercises/gif/` (162 GIF, unos 19 MB; se cargan solo al verlos).
  - `activity-core.js`, `native-gps.js`, `food-db.js`, `food-core.js`, `i18n-v50.js`.
  - `mobile/` (app Android, opcional).
- **Migración nueva (aditiva):**
  - `2026-10-24_v50_community_directory.sql`: perfiles públicos por defecto, directorio, datos básicos de privados
    y lectura de la foto de perfil actual.
- **Sin la migración v50:** la app sigue funcionando con la búsqueda de perfiles anterior y oculta el directorio.
- **Perfiles existentes:** no cambian su privacidad; solo los nuevos empiezan públicos.
- **App Android:** ver `docs/GPS_SEGUNDO_PLANO.md`. Compilarla requiere Android Studio y un celular para probar.

## Qué cambió en v49.0

- **Archivos y cambios:**
  - `anatomy.js` (mapa muscular).
  - Entrenamiento e insignias rediseñados.
  - Comunidad como red social integrada.
- **Migraciones nuevas (aditivas):**
  - `2026-10-22_v49_badges.sql`: medidas nuevas en los logros compartidos.
  - `2026-10-23_v49_community.sql`: guardadas, destacadas, foto de perfil, entrenamiento vinculado, conversaciones, conteos y sugeridos.
- **Sin migración v49:** la app sigue funcionando y oculta guardar, la foto de perfil y el entrenamiento vinculado.

## Qué cambió en v48.0

- Planificador de rutinas nuevo (`training-core.js`), biblioteca con imagen propia y guía por ejercicio
  (`exercise-media.js`, `exercise-guides.js`, `assets/exercises/`), progresión diaria cada 12 h controlada
  con hora del servidor, sesiones extra/manuales, insignias rediseñadas, perfil e hidratación completos.
- Publicidad, recompensas y Plus (`monetization-core.js`, `ads.js`, `backend/monetization.mjs`): **apagado por
  defecto**. Qué configurar para activarlo: `docs/MONETIZACION.md`.
- **Dos migraciones nuevas** (aditivas): `2026-10-20_v48_daily_training.sql` y `2026-10-21_v48_monetization.sql`.
- Variable nueva recomendada (solo servidor): `SUPABASE_SERVICE_ROLE_KEY`, para guardar contadores y comprobantes
  en la base. Sin ella todo funciona, pero los contadores de monetización quedan en memoria.

## 1. Antes de desplegar

1. Revisar el PR en GitHub y mirar las capturas de las pruebas visuales.
2. Correr las pruebas en una máquina con Node 20 o más reciente:
   - `npm test` (227 pruebas automáticas).
   - Con `npm start` en otra terminal: `APP_URL=http://localhost:8787 npm run test:e2e`.
   - Opcional, con Postgres y PostgREST locales: `npm run test:sql` y `tests/e2e/community.e2e.mjs`
     (cómo prepararlos en `docs/PRUEBAS.md`).
3. Abrir la app en el celular con `npm start` en la red local, o en un entorno de prueba de Render,
   y probar: cambiar el tema, registrar un entrenamiento, una comida y agua, y abrir Comunidad.

## 2. Supabase (solo si no se hizo en versiones anteriores)

Las migraciones son aditivas y se pueden ejecutar más de una vez. Se ejecutan en este orden, primero en
un proyecto de **pruebas** y después en producción:

1. `supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql`
2. `supabase/migrations/2026-10-18_v43_moderation_account_deletion.sql`
3. `supabase/migrations/2026-10-19_v44_security_hardening.sql`
4. `supabase/migrations/2026-10-20_v48_daily_training.sql` (entrenamiento diario cada 12 h, idempotente)
5. `supabase/migrations/2026-10-21_v48_monetization.sql` (contadores, comprobantes, Google Play; el límite de
   fotos queda **desactivado** hasta `update public.monetization_settings set photo_limit_enabled = true`)
6. `supabase/migrations/2026-10-22_v49_badges.sql` (insignias por carga, entrenamientos, racha y fuente «sesión»)
7. `supabase/migrations/2026-10-23_v49_community.sql` (comunidad v49; después de aplicarla, en Supabase:
   *Settings › API › Reload schema* o `notify pgrst, 'reload schema';`)
8. `supabase/migrations/2026-10-24_v50_community_directory.sql` (directorio y privacidad v50; después, recargar el
   esquema igual que en el paso 7)
9. `supabase/migrations/2026-10-26_v52_rank_board.sql` (ranking de rangos con amigos)
10. `supabase/migrations/2026-10-27_v53_athlete_community.sql` (comunidad de atletas; después, recargar el esquema)
11. `supabase/migrations/2026-10-28_v53_profile_extras.sql` (músculos en el perfil, bandera y «Mi físico»)
12. `supabase/migrations/2026-10-29_v54_weekly_alerts.sql` (ranking semanal, historial y avisos)
13. `supabase/migrations/2026-10-30_v57_legend_badges.sql` (insignias de 15 niveles con Legendario)

No volver a ejecutar `schema.sql` ni `community.sql`. RLS queda activado en todas las tablas: no
desactivarlo para resolver errores.

## 3. Variables de entorno en Render

| Variable | Obligatoria | Valor |
|---|---|---|
| `SUPABASE_URL` | Para Comunidad y copia en la nube | URL del proyecto (`https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY` | Para Comunidad | Clave **pública** (anon o `sb_publishable_…`) |
| `GEMINI_API_KEY` | Para FittAI con IA | Clave de Google AI Studio (queda solo en el servidor) |
| `GEMINI_MODEL` | No | Ya definida en `render.yaml` |
| `TRUST_RENDER_CLIENT_IP` | No | `true` (ya en `render.yaml`) |

Nunca cargar `service_role` ni `sb_secret_…`: el servidor las rechaza y la app avisa. Sin
`GEMINI_API_KEY`, FittAI responde con la guía local y lo dice. Sin Supabase, la app funciona en el
dispositivo y Comunidad muestra qué variable falta.

## 4. Publicar

1. Hacer merge del PR a la rama que despliega Render (`render.yaml` mantiene el nombre del servicio
   `fittforma-ai-v19-final` para no cambiar el dominio).
2. Render ejecuta `npm install` y `npm start`; el chequeo de salud es `GET /healthz`.

## 5. Comprobar después de publicar

- `https://<dominio>/healthz` responde `{"ok":true,"service":"fittforma-ai","version":"0.47.0"}`.
- `https://<dominio>/api/public-config` muestra `"configured":true` (si se cargó Supabase).
- `https://<dominio>/api/status` muestra `"configured":true` (si se cargó Gemini).
- Al abrir la app instalada, aparece el aviso de actualización (service worker
  `fittforma-ai-static-v47-0`). Después de actualizar, el pie dice «Versión 47.0».
- La app abre en tema claro la primera vez; el botón del encabezado y Perfil → Apariencia cambian el tema.

## 6. Volver atrás

Si algo falla, en Render elegir el despliegue anterior y usar **Rollback**. Como v47 no cambia la
base de datos, no hay nada que revertir en Supabase. Los datos de cada persona quedan en su
dispositivo y no se pierden al cambiar de versión.

## Probado en esta entrega

- Arranque como en Render (`npm start` con variables): `/healthz` y `/api/status` informan 0.47.0.
- El servidor no entrega `.env`, `.git`, `backend/`, `supabase/`, `PRODUCT.md` ni `.impeccable/` (404).
- Un POST a `/api/coach` desde otro origen se rechaza con 403.
- Una clave de Supabase con formato inválido se rechaza y la app indica el motivo.

## No se pudo probar aquí

- El proyecto real de Supabase y las cuentas reales.
- Gemini con una clave real.
- El servicio real de Render y su dominio.
- GPS, cámara e instalación de la PWA en un teléfono físico.
