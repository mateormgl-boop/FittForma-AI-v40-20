# Guía rápida de FittForma AI — v40.19

Para una descripción completa del producto, sus módulos, instrucciones de prueba en PC/iPhone, checklist manual, configuración y hoja de ruta, consultar `GUIA_COMPLETA_PROYECTO.md`.

## Arranque local

Requiere Node.js 20 o superior. En la raíz del proyecto:

```bash
npm test
npm start
```

Abrí en el navegador la dirección y el puerto que indique el servidor (por defecto es `http://localhost:8787`). Para acceder desde un teléfono, la PC y el teléfono deben estar en la misma Wi-Fi y el servidor debe escuchar en una interfaz accesible de la LAN; usar la IP local de la PC, no `localhost` en el teléfono.

Para el seguimiento de nutrición y hábitos, probá Nutrición → tendencia semanal, sumá/restá vasos de agua y comprobá que la hidratación anterior no desaparezca al cambiar de fecha. En Progreso, marcá algunos hábitos y recargá la app para confirmar que se conserven. Los datos locales se quedan en ese navegador.

Las integraciones con Gemini y Supabase necesitan configuración por entorno. En Render, configurá `SUPABASE_URL` y `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`, más `GEMINI_API_KEY`. Después de publicar, Comunidad tiene el botón “Comprobar conexión” y cinco secciones internas para repetir la inicialización y probar una lectura sin modificar datos. No expongas claves privadas ni uses la clave `service_role` en el frontend.


Para programar recordatorios aunque cierres FittForma, guardá los recordatorios en Perfil, descargá el `.ics` e importalo en tu calendario. Para revisar rutas, exportá GPX solo si querés compartir las coordenadas exactas. Los cobros Pro continúan desactivados.
