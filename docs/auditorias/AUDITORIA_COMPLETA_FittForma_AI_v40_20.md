# Auditoría de FittForma AI — v40.20

## Alcance de la versión

Se parte de `FittForma_AI_v40_19_comunidad_feed_pgrst201.zip`. La actualización incorpora el centro de insignias personales sin reemplazar la arquitectura existente ni modificar los scripts SQL de Supabase.

## Funciones nuevas

- Centro de insignias en **Progreso**, con medallas visuales, barra de progreso, siguiente objetivo y 12 niveles por desafío: Bronce I–III, Plata I–III, Oro I–III y Diamante I–III.
- Desafíos de repeticiones para flexiones, dominadas, sentadillas, abdominales, fondos, burpees, zancadas, elevaciones de talones, jumping jacks y escaladores.
- Desafíos de tiempo para planchas, isometrías, equilibrio y movimientos similares detectados en la biblioteca de ejercicios.
- Desafíos de tiempo para ejercicios de cardio/máquinas según el tipo registrado en la biblioteca.
- Desafíos por distancia de correr, caminar y ciclismo: una actividad por hito.
- Constancia por días distintos en los que se registró una sesión o una actividad; introducir solamente una marca no suma un día activo.
- Ejercicios personalizados con registro de mejor serie.
- Vista previa de las cuatro insignias más recientes en Perfil y botón para abrir la colección completa.
- La colección usa el estado existente de la app (`badgeRecords`, `badgeUnlocks`), con persistencia local, exportación/importación y compatibilidad con el guardado/sincronización actual de datos. No se añade ninguna tabla ni migración SQL.
- Se versiona la app en `0.40.20`, se actualiza la caché del service worker y se incluye `achievements.js` en los recursos guardados para uso offline.
- Se agregan cadenas de traducción para la interfaz del centro de insignias en los seis idiomas disponibles.

## Marcas personales y GPS

Las marcas de ejercicios y carreras introducidas manualmente son **personales/declaradas**. Las sesiones guardadas pueden contribuir al mejor resultado de un ejercicio cuando sus series aparecen como completadas; no son prueba independiente de que una persona ejecutó el movimiento.

Una actividad de distancia solo se marca con distintivo GPS cuando procede del registro GPS de la app y supera controles de plausibilidad: tipo esperado, duración mínima de 60 segundos, al menos cinco puntos válidos y cuatro posiciones distintas, precisión declarada no superior a 45 m, velocidad media dentro de límites básicos y revisión de saltos rápidos entre puntos. Los controles reducen errores obvios, pero no autentican físicamente a la persona ni evitan toda manipulación del dispositivo/datos. Por eso no se describe como verificación antifraude infalible.

## Pruebas locales

- `npm test`: **149 pruebas aprobadas, 0 fallidas**.
- Se añadieron pruebas para motor de insignias, rangos/niveles, progreso, plausibilidad GPS e integración con Perfil/Progreso/caché PWA. Se añadió una prueba HTTP que confirma que el backend sirve `achievements.js` y sigue bloqueando `backend/server.mjs`.
- La suite existente también verifica la sintaxis de los archivos JavaScript y del script principal incrustado en `index.html`.
- `node --check achievements.js`, `node --check backend/server.mjs`, `node --check community.js` y `node --check i18n.js`: correctos.
- El endpoint local `/healthz` respondió `200` con versión `0.40.20`.

## Pendiente de comprobar fuera del entorno local

- Probar el registro manual y la conservación de insignias desde un navegador/teléfono real.
- Confirmar guardado y recuperación de los nuevos campos con una cuenta de Supabase real en Render. La app reutiliza el objeto de usuario existente, pero no se verificó contra las credenciales de producción.
- Probar una carrera GPS real, revisando permisos, señales y recorrido en Android/iPhone.
- Publicar insignias dentro de Comunidad y definir privacidad/visibilidad; deliberadamente queda para una fase posterior.
- Verificación por cámara, clasificación antifraude avanzada, pagos y anuncios reales no se implementan en esta versión.
