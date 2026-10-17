# Auditoría integral de FittForma AI — v40.17

**Alcance:** revisión estática del proyecto completo entregado, revisión de recursos, validación de configuración Supabase, pruebas automatizadas locales y verificación del ZIP extraído. Esto no equivale a una prueba de penetración ni valida credenciales o servicios reales del usuario.

## Resultado

- `npm test`: **130 pruebas aprobadas, 0 fallidas**.
- Se repitió la suite tras extraer el ZIP final y se obtuvo el mismo resultado.
- Las comprobaciones de sintaxis JavaScript/MJS y parseo del script inline principal están incluidas en la suite.
- La versión del frontend, backend, traducciones y caché PWA coincide en `0.40.17` / `v40.17` / `fittforma-ai-static-v40-17`.

## Cambios y hallazgos corregidos

### 1. Configuración de Supabase más estricta

- El navegador y el backend ahora validan de manera equivalente la URL HTTPS del proyecto, limitándola a un subdominio de proyecto `*.supabase.co` y rechazando credenciales en la URL, query, fragmento o rutas adicionales.
- Se aceptan claves `sb_publishable_...` con caracteres esperados o JWT legacy cuyo claim `role` sea exactamente `anon`.
- Se rechazan placeholders, `sb_secret_...`, claves que incluyan `service_role` y JWT con rol diferente de `anon` antes de exponerlos desde `/api/public-config`.
- El endpoint solo devuelve URL y clave de cliente pública aceptada junto a metadatos diagnósticos; no devuelve `GEMINI_API_KEY`, secretos ni el resto del entorno.

### 2. Diagnóstico de Comunidad

- El botón **Comprobar conexión** hace consultas de solo lectura a cinco tablas principales: perfiles, publicaciones, seguidores, likes y comentarios.
- También prueba las funciones RPC de lectura `search_community_profiles` y `community_ranked_post_ids` para detectar un `community.sql` incompleto o permisos de ejecución ausentes.
- Cuando el usuario ya inició sesión, revisa además mensajes, bloqueos y `user_app_data`.
- Los errores distinguen falta de configuración, fallas de SDK/red, tablas ausentes, funciones RPC no publicadas y problemas de RLS/permisos. Las pruebas no escriben ni borran datos.
- Esto diagnostica la estructura expuesta por la clave pública, pero no certifica RLS con cuentas reales diferentes.

### 3. Asociación de imágenes

- “Bicicleta suave” y ciclismo al aire libre utilizan `cycling-outdoor.webp` como referencia de familia; ciclismo indoor/spinning usa `cycling.webp`.
- “Flexión de rodilla” y curl femoral/isquiotibiales ya no heredan imágenes de push-ups o curls de bíceps; usan la referencia muscular neutra de piernas.
- Se añadieron pruebas de ejecución para comprobar los mapeos y la bandera `specific` de variantes reales.
- Se mantiene la distinción entre foto específica y referencia genérica. Las imágenes no certifican la técnica de cada variante.

### 4. Interfaz y formularios

- Los botones HTML estáticos y las plantillas de interfaz declaran explícitamente `type="button"` o `type="submit"`, reduciendo el riesgo de envíos de formulario accidentales.
- Se añadió una prueba de regresión que falla si una etiqueta `<button>` no declara tipo.
- La suite verifica las referencias locales revisadas, el precaché PWA y la alineación de versiones.

### 5. Imágenes y recursos

- Se comprobaron 213 archivos dentro de `assets`; no hay duplicados binarios exactos por SHA-256.
- Se revisaron las 24 imágenes rasterizadas activas. No se detectaron pares casi idénticos con el cálculo perceptual de hash usado (distancia Hamming <= 10/64).
- La lista del service worker contiene 45 recursos; ninguno falta en el paquete.
- Las nueve referencias locales literales extraídas de la página y los recursos raíz en lista blanca existen.
- Las imágenes generadas no verificadas bajo `assets/exercises/unverified-generated/` siguen fuera de la lista pública del backend y del precaché. Las 24 imágenes activas no sustituyen fotografías específicas de las 180 variantes únicas del catálogo; esa cobertura aún se puede ampliar.

### 6. Gemini

- El backend mantiene el modelo predeterminado `gemini-3.8-flash` y evita enviar `temperature` a familias Gemini 3/4.
- Google publica `gemini-3.8-flash` como identificador estable: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
- La disponibilidad real depende de la clave, cuotas, cuenta y configuración de producción. La suite no realiza llamadas externas con la clave del usuario.

## Verificaciones ejecutadas

- `npm test`: 130/130 aprobadas.
- `node --check` de JavaScript/MJS y parseo del script inline principal.
- Validación de configuración del navegador y backend con casos positivos/negativos: HTTP/HTTPS, host ajeno, subdominios inesperados, rutas, URL con credenciales, clave publishable, JWT `anon`, JWT `service_role` y placeholders.
- Pruebas HTTP locales de `/api/status`, `/api/public-config`, `/healthz`, recursos de la app y rechazo de clave de servidor.
- Verificación del archivo ZIP final tras extracción.

## Pendientes que requieren el entorno real

1. Desplegar en Render y verificar que `/api/status` devuelva versión `0.40.17`; mirar únicamente `supabase.configured` en `/api/public-config` (no publicar la respuesta completa).
2. Confirmar que Comunidad inicialice en el proyecto Supabase real; entrar y pulsar **Comprobar conexión**. Luego probar registro/inicio de sesión y funciones sociales con dos cuentas.
3. Revisar políticas RLS y Storage/bucket privado con cuentas reales; no se ejecuta ningún SQL nuevo en esta actualización.
4. Realizar una consulta real al entrenador IA y comprobar errores/cuotas en Render → Logs. La clave de Gemini no se imprime ni se comparte.
5. Verificar diseño, permisos GPS, PWA, recordatorios y navegación en iPhone/Android reales. No se completó una captura de navegador headless en este entorno; por eso no se declara una revisión visual íntegra.
6. La moderación de denuncias necesita un flujo administrativo real. Pagos Pro y publicidad permanecen desactivados hasta integrar proveedores reales y probar webhooks/controles del lado del servidor.

## Conclusión

La v40.17 mejora la validación y el diagnóstico sin cambiar `supabase/schema.sql` ni `supabase/community.sql`. Es una versión candidata para que el usuario pruebe el despliegue. El funcionamiento real de Supabase y Gemini solo puede confirmarse en el servicio Render del usuario.
