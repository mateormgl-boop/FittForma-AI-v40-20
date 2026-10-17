# Auditoría integral de FittForma AI — v40.16

**Base:** proyecto v40.15 extraído desde el ZIP, con correcciones de diagnóstico y robustez.  
**Alcance:** análisis estático de archivos, configuración pública, referencias locales, service worker, recursos visuales y pruebas automatizadas locales. No equivale a una prueba de penetración ni a una aceptación de producción.

## Resumen de resultado

- Versión actual: `0.40.16` en paquetes/backend; vista `v40.16`; caché PWA `fittforma-ai-static-v40-16`.
- `npm test`: **124 aprobadas, 0 fallidas**. Se corrigió una expectativa de test que no coincidía con el estado de configuración de Supabase en la prueba HTTP. El estado esperado es `true` cuando el test entrega credenciales públicas de prueba al proceso.
- Se repitió `npm test` desde una copia extraída del ZIP de entrega.
- `node --check` pasó para `backend/server.mjs`, `community.js`, `i18n.js`, `ads.js` y `sw.js`; la suite valida también el script inline de la página principal.
- La prueba local HTTP sin variables Supabase devuelve `configured:false`, `issue:missing_project_url` y el estado de backend en modo demo. Con valores públicos de prueba, los tests confirman que `/api/public-config` está configurado sin filtrar claves de servicio ni Gemini.
- No se incluyeron archivos `.env` reales ni credenciales de producción.

## Correcciones de esta versión

### 1. Diagnóstico y reintento de Supabase
- `/api/public-config` devuelve `version`, `supabase.configured`, `keyType` e `issue` diagnóstico, más solo la URL y clave pública anon/publishable cuando son válidas.
- Admite `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY` en Render.
- Rechaza claves de servidor/secretas; no devuelve `GEMINI_API_KEY`, variables del entorno completo ni `SUPABASE_SERVICE_ROLE_KEY`.
- `/api/status` incluye versión y booleano de conexión configurada; `/healthz` informa la versión.
- El frontend diagnostica endpoint caído, versión antigua, variables ausentes, URL inválida, clave pública inválida o SDK que no carga. Si falla el CDN primario de `supabase-js`, intenta una segunda fuente (`unpkg`).
- Comunidad incorpora “Comprobar conexión”: repite inicialización y consulta `community_profiles` en modo lectura para diferenciar errores de configuración, SDK, red, tabla y permisos. No escribe ni cambia datos.
- Esta mejora resuelve el defecto de diseño por el que el frontend esperaba una configuración local vacía en ZIP, aunque la configuración estuviera disponible como variables de entorno de Render. La causa exacta del error del usuario solo puede confirmarse cuando pruebe el despliegue con sus variables reales.

### 2. Otras correcciones de robustez
- La fecha diaria en Comunidad y los contadores de anuncios usa fecha local en lugar de `toISOString()` (UTC), evitando desplazamientos de día en zonas con UTC negativo.
- La exportación de datos espera antes de revocar la URL Blob para reducir fallas de descarga en ciertos navegadores.
- La interfaz muestra mensajes más útiles para volver a probar la conexión desde la propia Comunidad.

### 3. Auditoría visual heredada de v40.15
- Se retiró el recurso redundante `reverse-lunge-reference.webp`; las variantes sin foto propia usan una referencia de familia etiquetada como tal.
- `gym-v19.webp` y `running-v21.webp` ya no están; `gym-v20.webp` permanece porque se usa como imagen principal de la app.
- “Bicicleta suave” apunta a `cycling-outdoor.webp`; la bicicleta fija mantiene `cycling.webp`.
- No se detectaron duplicados SHA-256 ni pares de imágenes rasterizadas activas con distancia pHash ≤7/64 en el conjunto de 24 recursos rasterizados activos.
- Se actualizaron 16 referencias visuales de ejercicios a partir de una lámina coherente. Sus recortes tienen aproximadamente 362×235 px; pueden ser blandos al ampliarse y son referencias ilustrativas, no una validación profesional de técnica.
- 180 SVG generados dudosos permanecen en cuarentena en `assets/exercises/unverified-generated/`: el backend no los sirve y el service worker no los precarga.

## Verificaciones estáticas

- IDs del DOM HTML estático: 270, sin duplicados (se analizaron nodos HTML, separando IDs dinámicos presentes en templates JavaScript).
- Referencias locales `src`/`href` del HTML inspeccionadas: 13; faltantes: 0.
- Recursos enumerados por el precaché del service worker: 45; faltantes: 0.
- Sintaxis JS/MJS comprobada en los scripts principales: correcta.
- Scripts y paquetes están alineados con `0.40.16`; service worker actualizado a la caché v40.16.

## Pruebas que todavía requieren el entorno del usuario

Esta entrega **no** prueba credenciales reales ni accede a cuentas externas del usuario. Para cerrar la aceptación faltan:

1. Desplegar el ZIP y comprobar que `/api/status` muestra `version: "0.40.16"`.
2. Abrir Comunidad y usar “Comprobar conexión”; verificar si el mensaje cambia a conexión de Supabase correcta o entrega un error concreto.
3. Probar inicio/registro de sesión, publicación y comentarios con dos cuentas de prueba. Confirmar RLS, privacidad, bloqueos y Storage con reglas reales.
4. Hacer una consulta real a Gemini con `GEMINI_API_KEY` y comprobar respuestas, cuotas y logs.
5. Probar entrenamiento en vivo, nutrición/hábitos, exportaciones, GPS, recordatorios e instalación/actualización PWA en móvil físico.
6. Inspeccionar el diseño en Safari/Chrome móvil; la captura Chromium headless no se considera una verificación fiable de esta entrega.

## Instrucciones de actualización

- Hacer copia de seguridad del repositorio actual antes de copiar archivos.
- Mantener la estructura del ZIP y subir los archivos a la raíz esperada por `package.json`.
- En Render, configurar `SUPABASE_URL` y uno de `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`; mantener `GEMINI_API_KEY` como secreto de backend.
- No añadir `service_role` ni claves secretas al frontend; no publicar respuestas completas de `/api/public-config` porque incluyen la clave pública.
- No ejecutar otra vez `supabase/schema.sql` ni `supabase/community.sql` para esta versión: la actualización no modifica esos esquemas.

## Conclusión

v40.16 mejora el diagnóstico de Supabase y la robustez de la aplicación; pasa 124/124 pruebas automatizadas locales y comprobaciones estáticas descritas. Se entrega como candidata a prueba en producción, no como lanzamiento certificado. La confirmación de Supabase, Gemini y experiencia móvil depende de la verificación del usuario en Render y dispositivos reales.
