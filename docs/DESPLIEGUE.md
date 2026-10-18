# Despliegue de FittForma AI v48.0

Esta guía es la lista de pasos para publicar v48.0. **No se desplegó a producción**: el despliegue lo
hace la persona dueña del proyecto, después de revisar y aprobar el PR.

## Qué cambia en v48.0

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
   - `npm test` (209 pruebas automáticas).
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
