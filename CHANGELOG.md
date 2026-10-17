## v40.2 — rediseño de navegación móvil (15 de octubre de 2026)

- La barra inferior móvil ahora prioriza cinco destinos directos: Inicio, Entrenar, Progreso, Comunidad y Perfil.
- Se movieron Entrenador IA, Correr y Nutrición al menú secundario accesible desde la cabecera, junto con la instalación PWA.
- Se reforzaron los estados activos, `aria-current`, el control `aria-expanded` y los focos visibles para navegación por teclado.
- Se versionó la caché del service worker y los paquetes a v40.2 para facilitar la actualización de la PWA.
- Se añadieron pruebas de regresión para comprobar el orden de la navegación móvil y la accesibilidad de las secciones secundarias.

## v40.2 — estabilización técnica (15 de octubre de 2026)

- Corregido el cálculo de IP para rate limiting detrás del proxy de Render, con confianza explícita en los encabezados de edge solo cuando `TRUST_RENDER_CLIENT_IP=true`.
- Añadida validación de `PORT`, limpieza de la clave Gemini y bind explícito a `0.0.0.0`.
- La carga de estado local intenta recuperar claves de versiones anteriores si la clave vigente está corrupta o es incompatible.
- El SQL base elimina condicionalmente las políticas de sincronización antes de recrearlas, permitiendo volver a aplicar el esquema sin el error de políticas duplicadas.
- Inicio/cierre de sesión y sincronización con Supabase ahora capturan fallos de red; si falla el procesamiento de la copia remota se conserva el estado local anterior.
- Renovado el nombre de caché del Service Worker para forzar actualización en instalaciones PWA existentes.
- Ampliadas pruebas automáticas para separación de IP por proxy y recuperación/manejo de errores.

**Alcance:** se modifica el código y se valida localmente. No se considera reemplazo de un rate limiter distribuido, autenticación por cuenta, pruebas RLS de Supabase real o pruebas en teléfono físico.

## v40.0 — revisión de seguridad social y ranking equilibrado
- Ranking orgánico pondera actividad de 30 días, días activos, interacción, recencia y descubrimiento de cuentas pequeñas; limita actividad masiva, excluye publicaciones de más de 90 días y diversifica por autor.
- Pro queda como distintivo informativo, sin prioridad automática en publicaciones orgánicas.
- Bloqueo aplicado a través de RLS en perfiles, publicaciones, likes, comentarios, fotos, seguimientos y chat. Al bloquear se eliminan los seguimientos de ambos sentidos y se guarda una etiqueta de nombre/usuario para reconocer la cuenta al desbloquear.
- Chat con límites en la base de datos (10 mensajes/minuto, 100/día por cuenta), bloqueo transaccional por usuario contra envíos paralelos y eliminación de conversación para ambas personas.
- Se indica que los progresos publicados son autodeclarados/no verificados y se añaden retos personales semanales locales.
- Se alinean etiquetas de versión, traducciones, caché PWA y documentación.

## v39.0 — ranking orgánico por actividad
- El feed incorpora actividad, interacciones limitadas, recencia y una pequeña ponderación de seguidores.
- Se elimina la prioridad automática de Pro sobre publicaciones orgánicas.

## v38.0 — chat mutuo
- Chat privado condicionado a seguimiento mutuo aceptado; estado de Pro protegido en la base de datos.

## v37.0 — comunidad inicial
- Perfiles, publicaciones de transformaciones, fotos en bucket privado, likes, comentarios, seguimientos y denuncias.

## v36.1 — recordatorios y compatibilidad móvil
- Preferencias de recordatorios locales, traducciones y ajustes de PWA.


## Revisión integral adicional (14-10-2026)
- Añadida prueba automatizada `tests/syntax.test.mjs` para ejecutar `node --check` en los archivos JS/MJS del proyecto y validar los scripts inline de `index.html`.
- Actualizada la auditoría para distinguir pruebas locales de verificaciones todavía pendientes en Supabase/Render y dispositivos reales.
