# Backend FittForma AI

- `GEMINI_API_KEY`: clave privada, solo en Render Environment. Nunca publicarla en GitHub.
- `GEMINI_MODEL`: modelo principal configurado en Render; el servidor usa `gemini-3.8-flash` si no se establece.
- `GEMINI_FALLBACK_MODELS`: lista opcional separada por comas; por defecto se prueba `gemini-3.5-flash-lite` ante errores temporales del modelo principal. Los errores 429 no rotan de modelo para no eludir límites de cuota.
- `POST /api/coach` recibe un campo `language` (`es`, `en`, `pt`, `fr`, `it` o `de`) y devuelve respuestas en ese idioma.
- `POST` desde navegador valida el origen cuando el header `Origin` está presente; sigue existiendo limitación por IP. Para lanzamiento público, añadir autenticación y cuotas por cuenta.
- `GET /healthz` sirve para los chequeos de disponibilidad; `GET /api/status` no revela la clave y muestra solo si está configurada.
