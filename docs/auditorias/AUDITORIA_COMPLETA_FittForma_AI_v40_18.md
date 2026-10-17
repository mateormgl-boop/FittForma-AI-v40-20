# Auditoría FittForma AI v40.18

Base: ZIP v40.17 (278 archivos). Entorno: Node 22, sin acceso a Render, Supabase ni Gemini reales y sin navegador.

## 1. Qué se probó y cómo

| Tipo | Qué | Resultado |
|---|---|---|
| Automatizada | `npm test` en el proyecto | 136 aprobadas, 0 fallidas |
| Automatizada | Misma suite desde el ZIP final extraído en carpeta limpia | ver sección 5 |
| Mutación | Pruebas nuevas contra el `sw.js` de la v40.17 | falla la prueba 1, como se esperaba |
| Estática | 44 rutas locales referenciadas (HTML, service worker, JS) | 0 inexistentes |
| Estática | Identificadores que usa el JS frente al HTML | 0 sin definir |
| Estática | Handlers inline sin función | 0 |
| Estática | Tablas, RPC y columnas del código frente al SQL | coinciden (2 alertas descartadas, ver 2) |
| Estática | RLS en las 11 tablas | activada en todas |
| Integración local | Servidor real con credenciales falsas | ver sección 3 |

## 2. Hallazgos

**Corregido en v40.18**
1. **Service worker con copia guardada primero para todo.** Una versión nueva podía no verse, y `supabase-config.js` también quedaba guardado. Es la causa más probable de que siguiera apareciendo el mensaje antiguo de la comunidad: ese texto no existe en el código de la v40.17.
2. **Sin aviso de nueva versión ni forma de saber qué versión se usa.** Añadidos.

**Falsas alertas descartadas**
- `community_follows.display_name/username`: son columnas de relaciones anidadas (`community_profiles!..._fkey(...)`), no de esa tabla.
- `community_message_events` sin políticas: intencional (`revoke all`; solo la usa el limitador `security definer`).

**Revisado sin problemas**
- Mensajes privados: lectura y envío solo entre seguidores mutuos y sin bloqueos. Publicaciones y perfiles respetan visibilidad y bloqueos.
- Backend: límite de tamaño por cabecera y durante la lectura, tiempo máximo de 30 s a Gemini, límite de solicitudes, lista blanca de archivos públicos, defensa de rutas. La clave de Gemini viaja en cabecera y no se imprime en logs.
- Pagos y anuncios: desactivados en configuración y la interfaz lo declara. No hay notificaciones push reales; los recordatorios son locales.

**Pendiente de decisión o desarrollo (no corregido)**
- La sincronización con la nube es manual (subir/descargar). Favoritos y borradores de entrenamiento y GPS son solo locales.
- 180 SVG en `assets/exercises/unverified-generated/` están en cuarentena: ocupan espacio en el repositorio pero no se sirven.
- Textos nuevos de la v40.18 solo están en español (no se añadieron al diccionario de traducciones).
- Rediseño visual: planificado para la v40.19.

## 3. Prueba local de integración del servidor
Con `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` de prueba: `/healthz` 200; `/api/public-config` devuelve `configured:true`, `version:0.40.18`; `/api/status` correcto. Una clave de Gemini falsa no apareció en ninguna respuesta pública (public-config, status, index, supabase-config, sw). `index.html`, `sw.js` y `supabase-config.js` se sirven con `no-cache`; las imágenes con `max-age=3600`. `package.json`, `backend/`, `supabase/`, `.gitignore` y rutas con `..` devuelven 404.
Esto es una simulación local: no demuestra que funcione Render, Supabase ni Gemini.

## 4. Lo que requiere prueba real
Render (deploy y variables), Supabase (registro, perfiles, publicaciones, mensajes, bloqueos con cuentas reales), Gemini (respuesta del coach), instalación PWA y actualización en teléfonos, GPS y notificaciones en dispositivos físicos. El usuario indicó que Gemini ya fue probado y funciona; no se pudo verificar desde aquí.

## 5. Verificación del ZIP final
ZIP final extraído en carpeta limpia (273 archivos): `npm test` = 136 pruebas, 136 aprobadas, 0 fallidas. Diferencias frente al ZIP v40.17: solo se añadieron `AUDITORIA_COMPLETA_FittForma_AI_v40_18.md` y `tests/pwa-update.test.mjs`; no se eliminó ningún archivo. Búsqueda de secretos (claves `AIza…`, `sb_secret_`, JWT, claves privadas): sin coincidencias en el código. `supabase-config.js` conserva URL y clave vacías (la configuración llega desde las variables de Render).

## 6. No resuelto y qué falta
- Causa confirmada del mensaje antiguo de la comunidad: no se puede confirmar desde aquí. Falta el resultado de `/api/public-config` en Render (solo `version`, `configured`, `issue`) y una prueba en el teléfono tras actualizar.
- Modelo `gemini-3.8-flash`: el usuario indica que ya probó Gemini; no se pudo verificar con la API real.
- Sincronización automática, recordatorios push, pagos, anuncios y rediseño visual: sin implementar (ver sección 2).
