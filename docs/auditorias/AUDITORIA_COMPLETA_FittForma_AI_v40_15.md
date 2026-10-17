# Auditoría integral de FittForma AI — v40.15

**Alcance:** revisión estática del proyecto completo entregado, pruebas automáticas locales, comprobación de recursos locales/precaché y revisión visual de los recursos de ejercicio. No equivale a una prueba de penetración ni a una validación de los servicios productivos del usuario.

## Resultado general

- Versión coherente en frontend, traducciones, service worker y paquetes: `0.40.15` / `v40.15` / caché `fittforma-ai-static-v40-15`.
- Suite final `npm test`: **121 pruebas aprobadas, 0 fallidas**.
- Antes de corregir, el árbol de v40.14 reportaba 114 aprobadas y 5 fallidas. Las fallas se debían a expectativas de pruebas que todavía exigían `40.13`; se alinearon las aserciones con la versión real y se agregaron pruebas de regresión visual.
- El análisis HTTP local del backend sigue comprobando el endpoint `/api/public-config`, su respuesta pública y el rechazo de claves de servidor. Esto no valida las credenciales reales del usuario.

## Hallazgos y correcciones

### 1. Imágenes duplicadas o casi idénticas

- En un contacto visual de una versión anterior, `gym-v19.webp` y `gym-v20.webp` aparecían casi idénticas; también `running-v21.webp` parecía un recorte de `running-outdoor.webp`. En el árbol actual `gym-v19.webp` y `running-v21.webp` ya no existen; `gym-v20.webp` se conserva porque es la imagen hero referenciada por `index.html` y `sw.js`.
- En el conjunto visual activo de v40.14 se detectó otra duplicación perceptual: `lunge.webp` y `reverse-lunge-reference.webp` mostraban prácticamente la misma posición de zancada. Se eliminó `reverse-lunge-reference.webp` y se quitó su referencia del código y del service worker.
- Las zancadas sin una imagen distinta ahora usan `lunge.webp` como referencia de familia, con etiqueta visual `REFERENCIA`; ya no se presentan como una fotografía específica de la variante asistida.
- Tras los cambios, el análisis de bytes no encontró archivos duplicados idénticos. El hash perceptual (pHash; distancia de Hamming ≤7/64) no encontró pares casi idénticos entre las 24 imágenes rasterizadas activas dentro de `assets`. Los íconos del proyecto conservan sus versiones de distintos tamaños de manera intencional.

### 2. Renovación y coherencia visual

- Se renovaron 16 imágenes WebP de movimientos habituales con un conjunto visual coherente para tarjetas pequeñas y modales móviles.
- Se ajustaron descripciones alternativas y leyendas: se habla de “imagen de referencia” y no se afirma que una ilustración visual demuestre o certifique la técnica.
- Las reglas de referencia por familia se separaron para evitar asociaciones claramente poco relacionadas: flexiones frente a press de banca, remo frente a jalón, bíceps frente a tríceps, zancadas frente a sentadillas y puente de glúteos frente a ejercicios generales de pierna.
- La referencia de plancha ya no se asigna indiscriminadamente a crunch, dead bug, Pallof press y demás ejercicios de core. Cuando no hay imagen pertinente, se usa la referencia genérica del grupo muscular.
- La bicicleta suave se muestra con `cycling-outdoor.webp` como referencia exterior; la bicicleta estática conserva `cycling.webp`. Los 180 SVG dentro de `assets/exercises/unverified-generated/` siguen en cuarentena: la app no los utiliza como demostración exacta, el service worker no los precarga y el backend rechaza su acceso público.

**Límite visual:** las 16 imágenes nuevas se recortaron de una lámina visual a aproximadamente 361–362 × 234–237 px para tarjetas móviles; sirven a tamaños actuales, pero pueden verse blandas al ampliarlas en pantallas de alta densidad. Son ilustrativas y no equivalen a una revisión profesional del movimiento. Para un acabado premium conviene sustituirlas progresivamente por imágenes individuales de mayor resolución verificadas para cada variante.

### 3. Recursos, estructura y accesibilidad

- Archivos del proyecto: 269 antes de añadir este informe; el ZIP final incluye 270 archivos contando la auditoría.
- Recursos declarados en el precaché del service worker: 45; faltantes: 0.
- Referencias locales estáticas encontradas en el HTML principal: 12; faltantes: 0.
- IDs literales del HTML estático: 269; IDs duplicados: 0.
- La marca gráfica usa `alt=""` intencionalmente al estar acompañada por texto de marca visible.
- No se encontraron archivos idénticos por SHA-256 dentro del conjunto rasterizado activo.
- Se corrigió además la configuración de generación para no enviar `temperature` a modelos Gemini 3/4, de acuerdo con la guía de migración del proveedor. La versión PWA y los paquetes quedaron alineados para forzar una caché nueva al publicar.

### 4. Seguridad y servicios

- `supabase-config.js` permanece vacío en el ZIP para no distribuir credenciales.
- El backend entrega por `/api/public-config` solo la URL del proyecto y una clave pública publishable/anon validada. No serializa el entorno completo, `GEMINI_API_KEY` ni claves de servicio. La prueba automatizada rechaza una JWT con rol `service_role`.
- No se modificaron `supabase/schema.sql` ni `supabase/community.sql`; esta versión no requiere volver a ejecutarlos.
- El modelo predeterminado de Gemini queda `gemini-3.8-flash`. Se retiró el parámetro legacy `temperature` para solicitudes de la familia Gemini 3/4; el fallback `gemini-3.5-flash-lite` usa la configuración por defecto sin ese parámetro. Que el identificador exista no demuestra que la clave, cuota o proyecto del usuario estén operativos.
- Los pagos y los anuncios reales siguen desactivados; no se simulan compras.

## Validaciones ejecutadas

- `npm test`: 121 aprobadas, 0 fallidas.
- La suite incluye sintaxis JS/MJS y del script inline, pruebas del catálogo, comprobaciones de imágenes (incluida la asignación de bicicleta al aire libre), flujos locales de entrenamiento/nutrición/hábitos, configuración Supabase, seguridad del endpoint, compatibilidad de parámetros de generación de Gemini 3/4 y el service worker.
- Se comprobaron los archivos referenciados por el precaché del service worker y las referencias locales estáticas de la página principal.
- Se inspeccionó una hoja de contacto de las imágenes sustituidas y una comparación lado a lado del duplicado de zancadas.

## Lo que no quedó verificado

- No se consiguió completar una captura fiable de Chromium headless en este entorno; por eso esta entrega no se presenta como una validación visual integral del navegador.
- No se probaron credenciales reales del proyecto Supabase, inicio de sesión con cuentas reales, políticas RLS/Storage, publicaciones y mensajes entre dos usuarios, ni una llamada viva a Gemini.
- No se probó el despliegue de Render del usuario ni instalación/actualización PWA, GPS o recordatorios en un teléfono físico.

## Pasos recomendados para aceptar la versión en producción

1. Hacer una copia de seguridad del repositorio y actualizarlo desde el ZIP conservando la estructura de carpetas.
2. Conservar los valores propios de `supabase-config.js` si se completaron; no subir secretos a GitHub. En Render verificar `SUPABASE_URL`, `SUPABASE_ANON_KEY` (o `SUPABASE_PUBLISHABLE_KEY`) y `GEMINI_API_KEY`.
3. Esperar `Live` en Render y revisar `/api/public-config` sin divulgar la respuesta completa, ya que contiene la clave pública.
4. Probar el entrenador IA, registro/login y Comunidad con cuentas de prueba separadas; revisar privacidad y RLS.
5. Probar navegación, imágenes, sesión activa, nutrición, hábitos, GPS y PWA en un móvil real.

**Conclusión:** v40.15 pasa la suite automatizada local (121/121) y corrige las aserciones obsoletas, la imagen redundante de zancada, una asignación de ciclismo y el envío de parámetros legacy de sampling para Gemini 3/4. Sigue siendo necesario hacer la aceptación de producción con los servicios y dispositivos reales.
