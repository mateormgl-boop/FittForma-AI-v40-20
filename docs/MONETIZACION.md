# FittForma AI — Publicidad, recompensas y Plus (v48 + v81)

Estado: **implementado y probado en local, APAGADO por defecto** (`MONETIZATION_ENABLED=false`).
Con la configuración por defecto, la app funciona igual que antes: no hay anuncios, no hay límites nuevos y no se cobra nada.
No hay identificadores de anuncios, precios ni credenciales reales en el repositorio. Este documento explica qué falta configurar.

## Qué hace

| Parte | Comportamiento | Quién decide |
|---|---|---|
| Banners | Un banner pequeño en Inicio, en Comunidad (después de la 3.ª publicación) y en Explorar. El alto queda reservado, así la pantalla no salta, y el banner se pide solo cuando se ve. | El servidor (`/api/entitlements`) |
| Intersticiales | Solo en pausas naturales: entrenamiento guardado, carrera guardada, volver al menú o cambiar de sección. Hacen falta 5–10 min de uso activo (7 por defecto) y al menos 4 cambios de sección. **Nunca** durante un entrenamiento, el descanso, el GPS, el registro de comidas, el chat de IA, el inicio de sesión, un pago, la subida de una foto o un guardado. | `monetization-core.js` (`interstitialDecision`) |
| IA | 6 consultas gratis por día (40 con Plus). Al agotarlas: esperar a mañana o mirar un video voluntario para sumar +3 consultas, hasta 3 videos por día. | **Servidor**: la consulta se descuenta antes de llamar a Gemini y se devuelve si Gemini falla. |
| Fotos en Comunidad | 2 fotos gratis por día (10 con Plus). Después, 1 foto extra por video, hasta 3 por día. El borrador nunca se borra y la foto **no se publica sola**: la persona toca «Publicar». | **Base de datos** (trigger `monetization_guard_photo_post`) y servidor |
| Videos recompensados | Primero se explica y se pide aceptar. El servidor emite un comprobante de un solo uso; se canjea una sola vez y solo si pasó el tiempo mínimo del video. Cerrar el video, no tener inventario o un error no suma nada. | Servidor (`/api/rewards/start`, `/api/rewards/claim`) |
| Plus | Sin anuncios, más IA y más fotos. Se activa solo con una compra verificada en el servidor: Google Play en Android o Mercado Pago en la web. | Servidor + tabla `community_memberships` |
| Métricas | Contadores agregados, sin datos personales. Solo se cuentan impresiones que el proveedor confirma (`slotRenderEnded` con anuncio, `rewardedSlotReady`). Las recompensas las cuenta el servidor al canjear. | `/api/metrics`, `/api/metrics/summary` |

La tarjeta de Plus ya no fija un precio orientativo en el código: muestra el monto y la moneda configurados en Render cuando Mercado Pago está habilitado. Sin configuración completa, el botón de compra permanece oculto y no se inicia ningún cobro.

## Archivos

- `monetization-core.js`: reglas compartidas por el navegador, el servidor y las pruebas (límites, política de intersticiales, cuotas).
- `ads.js`: integración en el navegador (GPT de Google Ad Manager, proveedor de prueba, videos, Plus con Google Play y Mercado Pago).
- `backend/monetization.mjs`: plan verificado, cuotas, comprobantes, Google Play (subscriptionsv2 + acknowledge + RTDN), Mercado Pago (checkout recurrente + Webhook HMAC) y métricas.
- `backend/server.mjs`: rutas de cuotas, métricas, Google Play y `/api/billing/mercadopago/{checkout,verify,webhook}`; cuota de IA en `/api/coach`; la CSP suma los dominios de Google **solo** con `ADS_PROVIDER=gam`.
- `supabase/migrations/2026-10-21_v48_monetization.sql`: tablas de contadores, comprobantes y compras; trigger del límite de fotos (desactivado); `my_photo_quota()`. Es aditiva y re-ejecutable.
- `supabase/migrations/2026-11-24_v81_mercadopago_memberships.sql`: referencias privadas de suscripciones Mercado Pago. Es aditiva y re-ejecutable.
- `community.js`: aviso de fotos, video voluntario y borrador conservado.
- Pruebas:
  - `tests/monetization.test.mjs`
  - `tests/mercadopago.test.mjs`
  - `supabase/tests/rls_v48m_test.sql`
  - `tests/e2e/monetization.e2e.mjs`

## Variables de entorno (Render → Environment)

| Variable | Ejemplo | Notas |
|---|---|---|
| `MONETIZATION_ENABLED` | `true` | Interruptor general. Por defecto `false`. |
| `ADS_PROVIDER` | `gam` | `none` (por defecto), `gam` o `test`. `test` solo funciona con `ADS_ALLOW_TEST=true`, muestra «Anuncio de prueba» y **nunca** genera ingresos. **No usar `test` en producción.** |
| `GAM_NETWORK_CODE` | *(tu código de red)* | Número público de Google Ad Manager. Sin este dato, `gam` queda en `none`. |
| `GAM_SLOT_HOME`, `GAM_SLOT_COMMUNITY`, `GAM_SLOT_EXPLORE` | `/<red>/fittforma_home` | Rutas de bloques de anuncios de banner. |
| `GAM_SLOT_REWARDED` | `/<red>/fittforma_rewarded` | Bloque de anuncios recompensado (web). |
| `GAM_SLOT_INTERSTITIAL` | `/<red>/fittforma_interstitial` | Bloque de anuncios intersticial (web). |
| `ADS_CONSENT` | `google-cmp` | Mientras no haya un consentimiento confirmado, se piden anuncios no personalizados. |
| `AI_FREE_PER_DAY` / `AI_PLUS_PER_DAY` | `6` / `40` | |
| `AI_CREDITS_PER_VIDEO` / `AI_MAX_VIDEOS_PER_DAY` | `3` / `3` | |
| `ADS_INTERSTITIAL_MIN_MINUTES` | `7` | Se acota a 5–10. |
| `ADS_SECTION_CHANGES` | `4` | |
| `ADS_MIN_REWARD_SECONDS` | `10` | Tiempo mínimo entre la emisión y el canje del comprobante. |
| `PHOTOS_*_PER_DAY` | | Solo para el modo sin base. Con Supabase, los límites de fotos se leen de `monetization_settings`, la misma fuente que usa el trigger. |
| `APP_TIMEZONE` | `America/Montevideo` | Día de los contadores. Tiene que coincidir con `monetization_settings.timezone`. |
| `SUPABASE_SERVICE_ROLE_KEY` | *(secreto)* | **Solo en el servidor.** Sin esta clave, los contadores quedan en memoria (se reinician con cada despliegue) y no hay fotos extra ni Google Play. |
| `ADMIN_METRICS_TOKEN` | *(secreto largo)* | Para leer `/api/metrics/summary` con el encabezado `X-Admin-Token`. |
| `GOOGLE_PLAY_PACKAGE_NAME` | `com.tuempresa.fittforma` | |
| `GOOGLE_PLAY_PLUS_PRODUCT_IDS` | `fittforma_plus_monthly` | Lista separada por comas. También va en `membership-config.js` → `googlePlayProductIds`. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | *(JSON de la cuenta de servicio)* | **Secreto.** Permiso «Ver datos financieros» y «Gestionar pedidos» en Play Console. |
| `GOOGLE_PLAY_RTDN_TOKEN` | *(secreto largo)* | La suscripción push de Pub/Sub apunta a `https://<tu-dominio>/api/billing/play/rtdn?token=<este valor>`. |

## Pasos que tiene que hacer la persona dueña del proyecto

1. **Base de datos.** Aplicar las migraciones pendientes en el orden de `supabase/migrations` (incluida `2026-11-24_v81_mercadopago_memberships.sql`), o usar el consolidado `supabase/APLICAR_MIGRACIONES.sql`. El límite de fotos queda **apagado**.
2. **Google Ad Manager.**
   - Crear la cuenta y obtener el código de red.
   - Crear 5 bloques de anuncios: 3 banners, 1 recompensado web y 1 intersticial web.
   - Aprobar el sitio y configurar el mensaje de consentimiento de Google (Privacy & messaging) para la UE, el Reino Unido y Suiza.
   - Publicar `ads.txt` cuando Google lo pida.
3. **Render.** Cargar primero `SUPABASE_SERVICE_ROLE_KEY` y las variables de configuración. Para probar cuotas y membresía, usar `MONETIZATION_ENABLED=true`; los anuncios requieren además `ADS_PROVIDER=gam` y sus identificadores reales. Se puede dejar `ADS_PROVIDER=none` mientras no haya bloques publicitarios. Activar `MERCADOPAGO_ENABLED=true` solo después de probar checkout y Webhooks.
4. **Límite de fotos.** Cuando se quiera activar: `update public.monetization_settings set photo_limit_enabled = true;` (en el SQL editor de Supabase).
5. **Plus con Google Play.** Requiere una **app de Android**: este repositorio no tiene un proyecto Android. Pasos:
   - Empaquetar la PWA como TWA (por ejemplo con Bubblewrap) y habilitar Play Billing en la TWA (Digital Goods API).
   - Crear la suscripción en Play Console con su precio real.
   - Crear la cuenta de servicio y vincularla.
   - Crear el tema de Pub/Sub y configurarlo en «Monetization setup» (RTDN).
   - El botón «Suscribirme con Google Play» solo aparece dentro de esa app y con sesión iniciada.
6. **Web.** No hay pagos web. Si en el futuro se agregan (por ejemplo, Stripe), tienen que escribir `community_memberships` solo desde el servidor, con `source='web'`. Nunca se deben mezclar con las compras de Play.

## Límites conocidos (honestos)

- **Videos recompensados en la web:**
  - GPT no ofrece verificación del lado del servidor (SSV) para la web.
  - El servidor exige un comprobante de un solo uso, un tiempo mínimo y un tope diario. Eso evita repeticiones y abusos simples, pero no puede probar criptográficamente que el video se vio.
  - En la app de Android con AdMob sí existe SSV, pero no está implementada porque no hay proyecto Android.
- **Intersticiales web:** Google decide cuándo mostrarlos con sus propios disparadores (navegación). La app solo habilita el bloque en las pausas permitidas; no puede forzarlo.
- **Personas sin cuenta:**
  - La cuota de IA se cuenta por IP anonimizada (hash).
  - Varias personas detrás de la misma IP comparten la cuota.
  - Cambiar de red reinicia el contador. Con cuenta, se cuenta por usuario.
- **Contadores en memoria:** sin `SUPABASE_SERVICE_ROLE_KEY`, los contadores se reinician con cada despliegue.
- **Resumen de métricas:** `/api/metrics/summary` muestra lo acumulado desde el último reinicio del servidor. Con Supabase, además se guardan por día en `monetization_usage` (sujeto `metrics`).
- **Ingresos:** esta app no calcula ingresos. La fuente es el informe de Google Ad Manager, Mercado Pago o Play Console.

## Costos y riesgos

- **Gemini:** el límite por consulta reduce el gasto. Cada video suma como máximo 3 consultas y hay como máximo 3 videos por día por persona.
- **Supabase:**
  - Cada consulta a `/api/entitlements` hace pocas llamadas RPC.
  - El navegador guarda el resultado 60 s y el servidor guarda el plan 2 min.
  - Los límites de fotos se guardan 60 s.
- **Experiencia y políticas:** demasiados anuncios empeoran la retención. Los valores por defecto son conservadores. Las políticas de Google prohíben premiar los clics y colocar anuncios cerca de botones de acción. La app cumple ambas reglas: la recompensa es por ver el video, nunca por hacer clic.
- **Privacidad:** antes de activar anuncios en la UE/EEE hace falta el mensaje de consentimiento de Google (o otra CMP certificada). También hay que actualizar la política de privacidad.

## Cómo probar en local

```bash
npm test                                           # incluye tests/monetization.test.mjs
PGHOST=... bash supabase/tests/run.sh              # incluye rls_v48m_test.sql
SUPABASE_UMD=... node tests/e2e/monetization.e2e.mjs   # levanta su propio backend en modo prueba
```

El E2E de monetización necesita PostgREST con la base `ff_e2e`, con todas las migraciones aplicadas. El rol `authenticator` debe poder asumir `service_role`: en la base local, `grant service_role to authenticator`. El detalle está en `docs/PRUEBAS.md`.

## Membresía web con Mercado Pago (v81)

La web ya cuenta con un flujo opcional de suscripción mensual mediante Mercado Pago. Está **apagado por defecto** y no genera cobros hasta que se configure explícitamente.

- El checkout se crea desde el servidor para una cuenta autenticada y el correo asociado a Supabase. La referencia externa vincula la suscripción con una sola cuenta.
- La app redirige al checkout alojado por Mercado Pago. El retorno del navegador **no** activa Plus por sí solo: el servidor consulta el estado directamente a Mercado Pago.
- Los Webhooks se aceptan solo con firma HMAC-SHA256 válida (`x-signature`, `x-request-id` y `data.id`) y se vuelve a consultar el estado remoto antes de modificar la membresía.
- La tabla `monetization_mp_subscriptions` está protegida por RLS; solo el backend con `SUPABASE_SERVICE_ROLE_KEY` puede asociar y consultar suscripciones.
- Google Play sigue disponible para Android. Mercado Pago agrega el camino web. Ambos escriben la membresía desde el servidor.

### Variables nuevas en Render → Environment

| Variable | Ejemplo | Notas |
|---|---|---|
| `MERCADOPAGO_ENABLED` | `true` | Interruptor explícito; por defecto apagado. |
| `MERCADOPAGO_ACCESS_TOKEN` | *(credencial privada)* | Token de producción o pruebas. Solo en el servidor. |
| `MERCADOPAGO_WEBHOOK_SECRET` | *(firma secreta)* | Firma secreta configurada en Webhooks. Solo en el servidor. |
| `MERCADOPAGO_PLUS_AMOUNT` | `199` | Monto mensual que decida el responsable; no se fija un precio en el código. |
| `MERCADOPAGO_CURRENCY_ID` | `UYU` | Se admite `UYU` o `USD`. |
| `PUBLIC_SITE_URL` | `https://tu-dominio` | Origen HTTPS real de la app y URL de retorno. |

También se requieren `SUPABASE_URL`, `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`, y `SUPABASE_SERVICE_ROLE_KEY` (esta última **solo** en el servidor). Aplicá primero `supabase/migrations/2026-11-24_v81_mercadopago_memberships.sql` o el consolidado `supabase/APLICAR_MIGRACIONES.sql`.

### Configuración en Mercado Pago

1. Crear o seleccionar la aplicación en Mercado Pago Developers y copiar el Access Token del entorno de pruebas.
2. En Webhooks, configurar `https://tu-dominio/api/billing/mercadopago/webhook` y el evento de suscripción/preapproval (`subscription_preapproval`).
3. Copiar la firma secreta de Webhooks a `MERCADOPAGO_WEBHOOK_SECRET`.
4. Configurar importe, moneda y `PUBLIC_SITE_URL` con el precio y dominio aprobados.
5. Probar alta, renovación/estado, webhook con firma incorrecta y asociación con una cuenta diferente.
6. Recién después de validar, cargar las credenciales de producción y poner `MERCADOPAGO_ENABLED=true`.

El precio de la tarjeta se obtiene de Render; no queda un precio orientativo hardcodeado. El botón de compra permanece oculto mientras falte configuración. Una suscripción pendiente nunca concede Plus.

**Límite actual:** el sistema sincroniza el estado autorizado y los cambios recibidos por Webhook, pero todavía no incluye un panel propio para pausar, cancelar o reanudar. Hasta agregar autogestión, esas acciones se realizan desde Mercado Pago.