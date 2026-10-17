# Auditoría v40.21

## Verificado automáticamente (en este entorno)
- `npm test`: 157 pruebas, 0 fallidas (incluye `tests/home-structure.test.mjs`).
- Auditoría estática: rutas, scripts vs. precaché del service worker, IDs duplicados o faltantes, handlers, botones sin type, CSS inválido, secretos: sin hallazgos.
- Cruce código↔SQL: todas las tablas y RPC usadas existen; RLS activo en las 11 tablas; `community_message_events` sin políticas a propósito (se escribe con trigger `security definer`).
- Chromium móvil con datos ficticios a 360/390/412 px y escritorio 1280 px: sin errores de consola, sin desborde horizontal.

## NO verificado (requiere tu entorno)
- Render, Supabase real (RLS con usuarios reales, feed/mensajes), Gemini, OAuth, teléfonos físicos y PWA instalada.
