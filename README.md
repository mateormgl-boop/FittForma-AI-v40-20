# FittForma AI — v65.0

Aplicación fitness web instalable como PWA: frontend móvil en `index.html` (HTML/CSS/JS sin
compilación), backend Node.js sin dependencias (`backend/server.mjs`), IA con Gemini desde el
servidor y comunidad opcional con Supabase. Se despliega en Render desde GitHub (`render.yaml`).

## Novedades v65.0

- Recordatorios de agua visibles: 2, 3 o 4 por día, con calendario que avisa con la app cerrada.
- «Enviar una sugerencia» (solo con cuenta; las leés en Supabase).
- Migración nueva: `supabase/migrations/2026-11-01_v65_feedback.sql` (incluida en `APLICAR_MIGRACIONES.sql`).

## Novedades v64.0

- Entrenamiento: orden real de los ejercicios, trapecio y antebrazos, sesiones de 75, 90 y más de 90 minutos con tiempo estimado, calculadora de RM, aviso de salud visible y «Cómo la armamos».
- Sin migraciones nuevas.

## Novedades v63.0

- Crear cuenta e iniciar sesión, fácil: una sola pantalla para toda la app (bienvenida, Inicio, Más, Perfil y Comunidad), con errores claros, recuperación de contraseña y el aviso «¡Listo! Ya iniciaste sesión».
- Sin migraciones nuevas.

## Novedades v62.0

- Más interacción en toda la app: los números y mosaicos de Inicio, Perfil y Progreso llevan a su sección; en Comunidad, el chat abre el perfil y las insignias abren su ficha.
- Peso, altura, peso objetivo y objetivo: privados por defecto; cada persona elige cuáles mostrar en Comunidad.
- Migración nueva: `supabase/migrations/2026-10-31_v62_body_share.sql` (ya incluida en `supabase/APLICAR_MIGRACIONES.sql`).

## Novedades v61.0

- Comunidad: estadísticas públicas desde el inicio (ocultables), una sola foto de perfil entre Perfil y Comunidad, versus músculo por músculo e insignias hasta Legendario.
- Sin migraciones nuevas.

## Novedades v60.0

- Avisos con lo que toca cada día según Mi semana, y calendario semanal (.ics) que avisa aunque la app esté cerrada.
- Sesión: vibración y pitido al terminar el descanso, calculadora de discos y superseries.
- Página 404 propia, robots.txt, títulos y enlaces por sección, vista previa al compartir, preguntas frecuentes y política de privacidad.
- Hay que completar `legal-config.js` (responsable y correo de contacto) y, si querés, `PUBLIC_SITE_URL` en Render.
- Sin migraciones nuevas.

## Novedades v59.0

- Calorías estimadas al completar cada ejercicio, en vivo durante la sesión y en el resumen final (con detalle por ejercicio y récords nuevos). Sin peso cargado no se calcula: se pide cargarlo.
- La tarjeta «Entrenamiento diario» en espera muestra un anillo con el tiempo que falta (antes se veía un círculo negro).
- Mi semana compacta: los 7 días en una fila con el dibujo de los músculos y una hoja para elegir cada día.
- Revisión visual en el celular: encabezados más finos, sin tarjetas anidadas en Entrenar, accesos rápidos en 4 columnas y textos que ya no se cortan.
- Sin migraciones nuevas.

## Novedades v58.0

- Mi semana: elegís qué entrenar cada día (por ejemplo, pecho y tríceps el lunes y espalda y bíceps el martes). «Hoy toca» sigue tu semana.
- 11 rutinas listas y una recomendada para vos, según tu objetivo, nivel, equipamiento, días disponibles y lo que entrenaste. Siempre dice por qué.
- Inicio personalizable (mostrar, ocultar y ordenar tarjetas) y «Lo que hiciste en el gym», con tus mejores series y «Repetir».
- Nutrición: menú de ejemplo según tu objetivo, con cantidades, y «Completá tu día» con lo que te falta.
- Insignias rediseñadas como medallas de metal y galería «Sistema de insignias».
- Sin migraciones nuevas.

## Novedades v57.0

- Nutrición: escribís lo que comiste con cantidades (por ejemplo, «100 g de hamburguesa, 2 croquetas de papa y 200 g de pan»). Ves los gramos de cada alimento y los podés cambiar. Hay 25 alimentos nuevos.
- Insignias de 15 niveles, con Legendario (medalla negra) y techos más altos; los niveles ya ganados no cambian.
- Músculos: escalera desde Bronce hasta Leyenda, mapa muscular redibujado y sección más clara.
- Ficha del ejercicio en dos pestañas: «Cómo se hace» y «Mi progreso».
- Animaciones en WebP animado (de 34 MB a 9 MB).
- Copia automática en la nube, sin pisar copias de otro dispositivo.
- Las 31 fichas nuevas están traducidas a 5 idiomas.
- Migración nueva aditiva: `2026-10-30_v57_legend_badges.sql`.

## Novedades v56.0

- 31 ejercicios nuevos (187 en total), cada uno con ficha, animación propia y fotos de dominio público.
- Biblioteca con filtros por nivel y tipo, orden, vista en lista y búsqueda por músculo.
- Ficha del ejercicio con «Tu historial», «Agregar a la rutina» y alternativas que se tocan.
- Progresión con números en la sesión.
- División semanal con «Hoy toca».
- Progreso: calendario del mes y series por grupo muscular de la semana.
- «Repetir las comidas de ayer».
- Perfil más ordenado y el acceso «Hidratación» en Inicio.
- Sin migraciones nuevas.

## Novedades v55.0

- Entrenar por grupos musculares: combinaciones habituales o elegidas a mano.
- «Lo hice» en la ficha de cada ejercicio.
- Rango junto al nombre en Comunidad y «Mis músculos» en el perfil.
- Músculos más claro, con «Entrenar esto hoy».
- Guía de alimentación por objetivo y 17 recetas nuevas calculadas con la base de alimentos.
- Sin migraciones nuevas.

## Novedades v54.0

- Comunidad:
  - Ranking de esta semana.
  - Reto semanal entre amigos.
  - Evolución de las últimas 8 semanas al comparar.
  - Avisos con campanita.
  - Historial privado de «Mi físico».
- Requiere aplicar `2026-10-29_v54_weekly_alerts.sql` (ver `docs/DESPLIEGUE.md`).

## Novedades v53.1

- Comunidad: «Todos», mapa de músculos en el perfil, bandera, «Mi físico» (antes y después y una foto) y foto de perfil que se ve en grande y se cambia tocándola.
- Acceso a Músculos desde Inicio.
- Requiere aplicar `2026-10-28_v53_profile_extras.sql` (ver `docs/DESPLIEGUE.md`).

## Novedades v53.0

- Comunidad de deportistas: «Todo el mundo», «Ranking» y «Amigos», sin feed general.
- Perfil completo con rango, nivel, insignias, estadísticas deportivas y publicaciones.
- Comparación con amigos usando la misma métrica, unidad y período.
- Rankings por categoría ordenados en el servidor.
- Estadísticas públicas por defecto y ocultables; nunca datos corporales.
- Requiere aplicar `2026-10-27_v53_athlete_community.sql` (ver `docs/DESPLIEGUE.md`).

## Novedades v51.0

- GIF de ejercicios regenerados: encuadre automático, figura más clara, pausas y trayectoria; se ven enteros.
- Hidratación renovada: botella, ritmo según la hora, botones rápidos, línea de tiempo, racha y gráfico semanal.
- «Objetivo y actualidad» en Perfil: sexo, edad, altura, peso, cintura, % de grasa, objetivo, ritmo y fecha.
  - Calcula IMC, metabolismo, calorías, proteína, agua y fecha estimada.
  - Las referencias se pueden aplicar a Nutrición y agua.
- Sin migraciones nuevas.

## Novedades v50.0

- Animación GIF propia para cada ejercicio (figura anatómica, músculos en rojo, fondo de gimnasio).
- GPS más robusto, con velocidad máxima, tiempo en movimiento y estado de la señal.
- App Android en `mobile/` para registrar con el celular bloqueado.
- Calorías estimadas por correr, caminar, bicicleta y fuerza.
- 281 alimentos verificables con buscador, porciones y recetas uruguayas estimadas.
- Comunidad con usuarios reales, perfiles públicos por defecto y privacidad aplicada en la base.
- Requiere aplicar `2026-10-24_v50_community_directory.sql` (ver `docs/DESPLIEGUE.md`).

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
