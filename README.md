# FittForma AI — v42.1

Aplicación fitness web instalable como PWA: frontend móvil en `index.html` (HTML/CSS/JS sin
compilación), backend Node.js sin dependencias (`backend/server.mjs`), IA con Gemini desde el
servidor y comunidad opcional con Supabase. Se despliega en Render desde GitHub (`render.yaml`).

## Novedades v42.0

- 6 secciones (Inicio · Entrenar · Nutrición · Progreso · Comunidad · Perfil) y FittAI.
- Rutinas propias, entrenamiento libre, sesiones y comidas editables, Nutrición en pestañas y Perfil agrupado.
- Detalle y matriz de funciones: `docs/AUDITORIA_v42.md`.

## Novedades v41.0

- **Navegación**: 5 destinos en móvil (Inicio · Entrenar · Progreso · Comunidad · Perfil);
  Nutrición, Coach IA y Correr con GPS en el menú «Más». En escritorio (≥1024 px), barra lateral fija
  con sección «Herramientas» y un Inicio a dos columnas.
- **Insignias**: reglas en un único lugar (`achievements.js`), categorías por disciplina, topes de
  plausibilidad, sin duplicados del día, mensajes concretos («Te faltan 3 repeticiones para Plata I»),
  galería con medallas SVG por rango, detalle de los 12 niveles con fecha de obtención y lista de
  marcas con borrado (que quita las insignias que dependían de ellas). Ver `docs/INSIGNIAS.md`.
- **Sin falsas verificaciones**: los estados son «Declarada» o «Con ruta GPS» (comprobación en el
  dispositivo). Ninguna insignia se presenta como verificada.
- **Progreso** en cuatro secciones: Resumen · Insignias · Historial · Peso.
- **Inicio** muestra la insignia más cercana a subir de nivel con su avance real.
- **Comunidad**: publicaciones de texto (con foto opcional) y de logros, vista previa de lo que se
  comparte y para quién, edición del texto propio e indicador de mensajes sin leer. Requiere la
  migración `supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql`; sin ella la app sigue
  funcionando con transformaciones y lo explica en pantalla.
- Correcciones: `renderProgress` ya no falla con sesiones sin `exercises`; capa CSS final con tokens
  y controles de formulario coherentes; se quitaron emojis usados como iconos.

## Ejecutar en local

```bash
npm start                 # http://localhost:8787 (sin GEMINI_API_KEY la IA queda en modo demo)
npm test                  # pruebas automáticas (node --test)
```

Pruebas de base de datos y de extremo a extremo: `docs/PRUEBAS.md`.
Integración entre secciones en navegador (con `npm start` en otra terminal): `node tests/e2e/integration.e2e.mjs`.

## Desplegar (Render + Supabase)

1. **Supabase (una sola vez, antes del deploy)**: en el SQL Editor de un proyecto de *pruebas*,
   ejecutá `supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql`. Es aditiva y
   re-ejecutable (no borra datos). Verificá con dos cuentas reales y recién después aplicala en
   producción. No vuelvas a ejecutar `schema.sql` ni `community.sql`.
2. **Render**: variables `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL` y una clave pública
   (`SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`). Nunca `service_role`/`sb_secret_`.
3. Hacer merge a la rama que Render despliega. El service worker cambia a `fittforma-ai-static-v42-1`
   y la app ofrece actualizar.

## Documentación

- `docs/INSIGNIAS.md` — reglas, umbrales y evidencia de las insignias.
- `docs/PRUEBAS.md` — cómo correr las pruebas unitarias, SQL/RLS y E2E.
- `ESTADO_Y_PENDIENTES.md` — estado y límites conocidos.
- `CHANGELOG.md` — historial de versiones.
- `SECURITY_REVIEW.md`, `GUIA_COMPLETA_PROYECTO.md`, `GUIA_DESDE_CERO.md`, `docs/auditorias/` — material de versiones anteriores.
