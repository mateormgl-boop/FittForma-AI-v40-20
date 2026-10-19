# FittForma AI — v49.0

Aplicación fitness web instalable como PWA: frontend móvil en `index.html` (HTML/CSS/JS sin
compilación), backend Node.js sin dependencias (`backend/server.mjs`), IA con Gemini desde el
servidor y comunidad opcional con Supabase. Se despliega en Render desde GitHub (`render.yaml`).

## Novedades v49.0

- Entrenamiento rediseñado: mapa muscular propio en cada ejercicio, ficha completa, tabla por serie con récords reales y plancha en segundos.
- Insignias hexagonales con símbolo por actividad, insignias por carga relativa al peso corporal, constancia y racha; la fuente de cada marca queda explícita.
- Comunidad como red social integrada: feed con novedades, Explorar, Crear, Mensajes y perfiles sociales, con la barra inferior de la app intacta.
- Requiere aplicar dos migraciones nuevas (ver `docs/DESPLIEGUE.md`).

## Novedades v48.0

- Rutinas que cambian de verdad con el objetivo, el nivel, el equipo y los días. Biblioteca de 156 ejercicios con imagen propia y una ficha de técnica.
- Una sesión diaria cada 12 h, controlada con la hora del servidor. Sesiones extra y manuales separadas. Insignias rediseñadas, con hasta 3 destacadas. Perfil e hidratación completos.
- Publicidad, videos recompensados y FittForma AI Plus, **apagados por defecto**. Cómo activarlos: `docs/MONETIZACION.md`.

## Novedades v47.0

- Rediseño completo según las referencias: tema claro (por defecto) y oscuro, un color por sección, logo nuevo y fotos reales en Inicio y Entrenar.
- Tema elegible desde el encabezado o en Perfil → Apariencia e idioma; se recuerda en el dispositivo.
- Inicio con «Actividad reciente» (solo registros reales) y gráfico de peso rehecho en Progreso.
- Guía de despliegue: `docs/DESPLIEGUE.md`. Sistema visual: `DESIGN.md`.

## Novedades v46.0

- Etapa 8, ajustes de diseño con la skill *impeccable*: mejor contraste, textos legibles (mínimo 11 px) y profundidad sin halos, con el mismo diseño.
- La skill queda configurada en `.claude/settings.json` (marketplace `pbakaus/impeccable`).

## Novedades v45.0

- Etapa 7, pruebas: flujos críticos de punta a punta (GPS, propuestas de FittAI, copia en la nube, uso sin conexión) y la app completa traducida a los 6 idiomas.

## Novedades v44.0

- Etapa 6, seguridad y datos: correcciones en la base, el servidor y la app. Detalle en `docs/SEGURIDAD_v44.md`.

## Novedades v43.0

- Diseño según las referencias: acento degradado, tarjetas ilustradas, botón «+» de registro rápido y bienvenida inicial.
- Foto de perfil y nivel por XP con fórmula visible.
- FittAI conoce toda la app y te lleva a cada sección con botones «Ir a…».
- Plan semanal de comidas y recetas; moderación de denuncias; eliminar la cuenta en la nube; mensajes dinámicos traducidos.

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
Pruebas en navegador (con `npm start` en otra terminal): `npm run test:e2e` (integración entre secciones y flujos críticos).

## Desplegar (Render + Supabase)

1. **Supabase (una sola vez, antes del deploy)**: en el SQL Editor de un proyecto de *pruebas*,
   ejecutá `supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql`. Es aditiva y
   re-ejecutable (no borra datos). Verificá con dos cuentas reales y recién después aplicala en
   producción. Después ejecutá `supabase/migrations/2026-10-18_v43_moderation_account_deletion.sql`
   (v43: moderación y eliminación de cuenta) y luego `supabase/migrations/2026-10-19_v44_security_hardening.sql`
   (v44: seguridad). Ambas son aditivas y re-ejecutables. No vuelvas a ejecutar
   `schema.sql` ni `community.sql`. Para nombrar moderadores (no se puede desde la app):
   `insert into public.community_moderators(user_id) values ('UUID-DEL-USUARIO');`
2. **Render**: variables `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL` y una clave pública
   (`SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`). Nunca `service_role`/`sb_secret_` como clave pública.
   Opcional desde v48: `SUPABASE_SERVICE_ROLE_KEY` **solo como variable del servidor**, para los contadores de
   monetización; nunca llega al navegador.
3. Hacer merge a la rama que Render despliega. El service worker cambia a `fittforma-ai-static-v49-0`
   y la app ofrece actualizar.

## Documentación

- `docs/DESPLIEGUE.md` — pasos para publicar v49 en Render y comprobarlo.
- `docs/MONETIZACION.md` — anuncios, recompensas, Plus: variables, pasos externos, límites y costos.
- `docs/AUDITORIA_v49.md` — auditoría y plan de la v49 (entrenamiento, insignias, comunidad).
- `docs/AUDITORIA_v48.md` — auditoría integral v48 (problemas encontrados).
- `DESIGN.md` — sistema visual (temas, colores por sección, componentes).
- `docs/INSIGNIAS.md` — reglas, umbrales y evidencia de las insignias.
- `docs/SEGURIDAD_v44.md` — revisión de seguridad de la Etapa 6.
- `docs/PRUEBAS.md` — cómo correr las pruebas unitarias, SQL/RLS y E2E.
- `ESTADO_Y_PENDIENTES.md` — estado y límites conocidos.
- `CHANGELOG.md` — historial de versiones.
- `SECURITY_REVIEW.md`, `GUIA_COMPLETA_PROYECTO.md`, `GUIA_DESDE_CERO.md`, `docs/auditorias/` — material de versiones anteriores.
