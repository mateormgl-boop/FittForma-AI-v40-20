# Despliegue de FittForma AI v52.0

Esta guía es la lista de pasos para publicar v52.0. **No se desplegó a producción**: el despliegue lo
hace la persona dueña del proyecto, después de revisar y aprobar el PR.

## Qué cambia en v52.0

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
