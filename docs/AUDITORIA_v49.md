# FittForma AI v49: Etapa 1, auditoría y plan

**Base:** rama `claude/v48-audit` (v48.0).
**Alcance:** el pedido «Rediseño integral, entrenamientos, insignias y comunidad», con las 5 imágenes de referencia.
**Método:** se leyó el código real y se compararon capturas actuales de la app (celular, tema oscuro) con las referencias. En esta etapa **no se modificó código**.

## Cómo está conectado hoy

- **Frontend:** `index.html` (vanilla JS, unas 5500 líneas). Otros módulos:
  - `training-core.js`: planificador, biblioteca de 156 ejercicios y reglas diarias.
  - `exercise-guides.js` y `exercise-media.js`: fichas e imágenes.
  - `achievements.js`: insignias.
  - `community.js`: comunidad.
  - `ads.js` y `monetization-core.js`: publicidad y Plus.
  - `design.css`: sistema visual.
  - `i18n*.js`: idiomas.
- **Backend:** `backend/server.mjs`, Node sin dependencias. Atiende la IA, la configuración pública, la hora del servidor (`/api/time`) y la monetización.
- **Datos:**
  - `localStorage`, con una copia opcional en la nube (`user_app_data`).
  - Supabase para comunidad, entrenamiento diario (RPC `complete_daily_training`) y monetización. RLS está activo en todas las tablas.
- **Navegación inferior** (celular): Inicio, Entrenar, Nutrición, Progreso, Comunidad, Perfil, más el menú «Más» con FittAI y Correr. Las pruebas exigen exactamente esos 6 destinos y **se conservan**.

## Problemas encontrados

### Parte 1: diseño general

1. **Colores de Comunidad:** usa un encabezado rosa/violeta grande y pestañas de texto. Las referencias piden fondo azul oscuro, tarjetas y acentos azules.
2. **Botón «+»:**
   - Se superpone a la última tarjeta.
   - Su notificación ya se corrigió en v48.
   - En Comunidad no abre «crear publicación».
3. **Emojis como íconos:** quedan algunos (por ejemplo «✓» en registros previos). La regla nueva pide íconos coherentes.

### Parte 2: entrenamientos y biblioteca

1. **Pantalla de entrenamiento:**
   - Es una pila larga de tarjetas: sesión, descanso y ejercicios.
   - **No muestra** el grupo muscular de la sesión, la cantidad de ejercicios ni los ejercicios completados.
   - No indica récords durante la sesión.
   - Los valores anteriores no se precargan en los campos.
2. **Plancha y ejercicios por tiempo:** se registran en el campo «Reps» (máx. 200) y muestran «Kg». El campo `load` de la biblioteca no se usa en la interfaz.
3. **Movilidad:** se dibuja como fuerza, con un campo de kg.
4. **Récords personales (`deriveExerciseRecords`):**
   - Una serie con peso pero sin repeticiones cuenta como récord de peso.
   - Los minutos de cardio y los segundos de plancha aparecen como «Más repeticiones».
   - Un registro manual con fecha vieja puede aparecer como «Última vez».
5. **Registro manual:**
   - Copia el mismo peso a todas las series.
   - Guarda `volumeKg: 0` aunque se haya cargado peso.
6. **Ficha del ejercicio:**
   - **No hay mapa muscular.** La referencia muestra una figura anatómica con el músculo principal resaltado.
   - Las 33 fichas internas de `index.html` no tienen «posición inicial».
7. **Imágenes:**
   - Hay 156 ejercicios con imagen propia: 118 fotos con licencia libre de inicio y fin, y 44 ilustraciones originales.
   - No se encontraron archivos duplicados.
   - Caso límite: «Caminata a ritmo cómodo» comparte foto con «Caminata rápida de recuperación».
   - Las referencias usan **fotos realistas del mismo modelo** para cada ejercicio. Eso no se puede generar aquí con permisos claros (ver «Decisiones»).
8. **Progresión diaria:**
   - Hoy es de **12 h**, como pediste en v48 («la de 24 horas que sean 12 horas mejor»).
   - El pedido nuevo dice **24 h**. Hace falta confirmar cuál.
   - La regla ya resiste recargas, otros dispositivos y duplicados (RPC con `FOR UPDATE` e idempotencia).

### Parte 3: insignias

1. **Forma y símbolos:**
   - La forma cambia por rango: disco de bronce, escudo de plata, roseta de oro, gema de diamante.
   - El símbolo es genérico por categoría: no hay barra con banco, ni barra de dominadas, ni bíceps, ni glúteos.
   - Las referencias usan un **hexágono** con el símbolo propio de la actividad.
2. **Insignias por peso:** **no existen**. Ni press de banca ni ningún ejercicio con carga. Los ejercicios con peso se excluyen y la lectura de sesiones ignora el peso.
3. **Medidas que faltan:** no hay insignias por ritmo de carrera, cantidad de entrenamientos ni racha.
4. **Manual o verificado:**
   - Los datos distinguen la fuente (manual, sesión, GPS), pero la interfaz solo muestra «Declarada» o «Con ruta GPS».
   - Un registro manual guardado no muestra la pantalla de logro.
5. **Pantalla de logro:**
   - Se evita repetirla con una lista en memoria.
   - No hay una marca guardada de «ya vista». Hoy funciona porque solo se celebran los desbloqueos nuevos, pero no está protegido de forma explícita.
6. **Mejor nivel:** se calcula **por ejercicio**, no por categoría. Eso está bien para «una insignia de running no reemplaza una de fuerza», pero hay código duplicado en 3 lugares.
7. **Insignias destacadas:** como máximo 3, elegibles, con relleno automático. Ya funciona y tiene pruebas. Solo aparecen en el perfil general, **no en el perfil social ni en la comunidad**.

### Parte 4: comunidad

1. **Navegación:**
   - Todo vive en una pantalla con 5 pestañas de texto.
   - No hay pantalla de perfil de **otra** persona, ni historias, ni lupa, ni acceso a mensajes arriba a la derecha.
2. **Mensajes:**
   - Se elige el contacto en un `<select>`. No hay lista de conversaciones con el último mensaje.
   - No se actualizan solos.
   - La regla de seguimiento mutuo **sí está protegida por RLS** y se conserva.
3. **Feed:**
   - Carga 30 publicaciones, sin «cargar más».
   - Cada me gusta o comentario redibuja todo.
   - Las fotos piden URL firmada de a una.
   - No hay guardar, compartir ni hashtags.
4. **Avatar:** no hay foto en el perfil social. La columna `avatar_path` existe pero no se usa.
5. **Error de estados:** en Publicar, `status()` escribe en un elemento escondido dentro del formulario de transformación, así que los mensajes no se ven.
6. **Datos que faltan para algunas funciones de las referencias:**
   - publicaciones guardadas;
   - historias;
   - hashtags indexados;
   - ubicación;
   - vínculo de una publicación con un entrenamiento;
   - **videos** (solo hay fotos).

   Los **seguidores falsos, «Reels», «Hombres/Mujeres» y la cantidad de seguidores inventada de las referencias no se agregan**: no hay datos reales para eso.

## Plan de cambios por etapa y archivo

### Etapa 2: entrenamientos e imágenes

- **`index.html` (pantalla de entrenamiento):**
  - Encabezado compacto con rutina, grupos musculares, duración en vivo, «ejercicios X/Y», «series X/Y» y barra de progreso.
  - Tarjeta por ejercicio con foto y mapa muscular.
  - Filas de serie con kg y reps propios (ya son independientes), valor anterior como sugerencia y botones de agregar/quitar serie.
  - Descanso integrado entre series.
  - Récord indicado solo cuando la serie lo supera con datos reales.
  - **Se mantienen los ids** que usan las pruebas (`finishWorkout`, `data-e/data-s/data-k`, `data-session-add-set`, etc.).
- **Campos según el tipo de ejercicio** (usa `load`):
  - con carga: kg + reps;
  - sin carga: reps;
  - por tiempo: segundos, nuevo campo `seconds` (las sesiones viejas siguen leyéndose);
  - cardio: minutos;
  - movilidad: sin kg.
- **`deriveExerciseRecords`:**
  - Separar récord de peso (requiere reps > 0), mejor repetición, mejor tiempo y repeticiones estimadas al máximo (e1RM, marcado como estimación).
  - Excluir cardio de «repeticiones».
  - Los registros manuales cuentan, pero llevan la etiqueta «manual».
- **Registro manual:** peso por serie y volumen real.
- **`assets/anatomy/`:** mapa muscular propio en SVG (frente y espalda, con regiones nombradas).
- **`exercise-guides.js`:** el músculo principal y los secundarios se resaltan en la ficha y en la tarjeta del ejercicio. Es un solo recurso con identificadores estables por músculo, así que cubre los 156 ejercicios sin reutilizar imágenes de otros.
- **Ficha:** mismo orden que la referencia:
  - encabezado con grupo;
  - músculos y figura;
  - equipo, nivel y tipo de movimiento;
  - posición inicial y final;
  - pasos numerados;
  - respiración, errores y recomendaciones;
  - series, repeticiones y descanso.

  Se completa «posición inicial» en las 33 fichas internas.
- **Duración del entrenamiento diario:** cambiar a 24 h solo si lo confirmás.
- **Pruebas:** unitarias de récords y de campos por tipo; E2E de entrenamiento con pesos distintos por serie (20 y 40 kg).

### Etapa 3: insignias

- **`achievements.js`:** emblema **hexagonal** con relieve por rango (bronce, plata, oro, diamante), números I–III, y **símbolo propio por actividad**:
  - press de banca (barra y banco), dominadas (barra fija), flexiones, sentadillas, abdominales, plancha;
  - fuerza (bíceps), piernas, glúteos, hombros, bíceps, tríceps;
  - running, resistencia (cronómetro), movilidad, constancia.

  Tiene que leerse bien a 24 px.
- **Insignias por marca de carga** (press de banca, sentadilla con barra, peso muerto, press militar, dominadas lastradas si hay datos):
  - Criterio: **mejor serie válida = peso × reps, con reps ≥ 1**, y nivel por **peso relativo al peso corporal** (con peso corporal cargado) o por kg absolutos (sin él).
  - Los umbrales quedan en una tabla configurable y documentada en `docs/INSIGNIAS.md` antes de aplicarse.
  - Nunca se usa el volumen de la sesión como peso.
- **Insignias nuevas:**
  - ritmo de carrera (mejor 5 km / 10 km con GPS);
  - entrenamientos completados;
  - racha de días.
- **Fuente de cada insignia:**
  - «Manual» (declarada por vos), «Registrada en una sesión» o «Con ruta GPS».
  - Nada se marca como «verificado» sin una fuente que lo compruebe.
- **Pantalla de logro:** marca persistente `celebratedAt` por desbloqueo; nunca vuelve a aparecer al recargar. También se celebra al guardar un registro manual.
- **Insignias destacadas:** las 3 se publican en el perfil social (nueva columna opcional) y junto al nombre en la comunidad.
- **Pruebas:**
  - el historial se conserva;
  - no hay desbloqueos duplicados;
  - nunca hay más de 3 destacadas;
  - umbrales por peso y reps;
  - celebración una sola vez.

### Etapa 4: comunidad

- **`index.html` y `community.js`:**
  - Encabezado «Comunidad» con lupa (Explorar), ícono de mensajes con contador y botón «+» (Crear).
  - Pestañas «Para vos / Siguiendo».
  - Fila de **destacados** con personas seguidas que publicaron en las últimas 24 h. No son historias efímeras nuevas: son un acceso a sus publicaciones recientes reales.
  - Pantallas propias: Explorar, Crear publicación, Conversaciones, Chat y **Perfil social** (propio y de otras personas, con grilla de fotos).
  - **Se conserva la barra inferior principal** y no se agrega otra.
- **Feed:**
  - Tarjeta con avatar, nombre, antigüedad, foto, texto con **#hashtags** clicables, me gusta, comentar, compartir (enlace o compartir del sistema) y **guardar**.
  - «Cargar más» (paginado).
  - Me gusta sin redibujar todo.
  - URLs firmadas en lote.
- **Explorar:** personas sugeridas reales (perfiles públicos, sin contar seguidores ficticios), búsqueda de usuarios y publicaciones, y filtros que funcionan con datos reales (Todos, Transformaciones, Logros, Texto/Fotos y hashtag).
- **Mensajes:** lista de conversaciones con el último mensaje y no leídos, más un chat individual. Actualización periódica mientras el chat está abierto. Solo con **seguimiento mutuo** (se conserva la regla RLS).
- **Perfil social:**
  - foto, nombre, usuario, descripción;
  - publicaciones, seguidores y seguidos (conteos reales);
  - **3 insignias destacadas**;
  - seguir / dejar de seguir, mensaje si está permitido;
  - edición propia y foto de perfil (`avatar_path` existente, carpeta propia en Storage).
- **Migración aditiva `v49_community.sql`:**
  - `community_saved_posts` (RLS: solo dueño);
  - `featured_badges jsonb` validado en `community_profiles`;
  - columna `hashtags text[]` derivada del texto con índice GIN;
  - `linked_session jsonb` opcional (resumen que la persona elige compartir: título, duración, ejercicios; **nunca** peso corporal ni altura);
  - RPC `community_conversations()` (últimos mensajes por contacto mutuo, con RLS).
- **Privacidad:** se conservan los perfiles públicos y privados y las reglas de visibilidad. No se publica nada personal automáticamente.
- **Corrección:** los estados de Publicar quedan visibles.
- **Pruebas:**
  - RLS de las tablas y columnas nuevas;
  - E2E de comunidad adaptado a las pantallas nuevas (crear → guardado confirmado, guardar, perfil ajeno, mensajes solo mutuos);
  - verificación de la barra inferior.

### Etapa 5: integración

Pruebas completas (unitarias, integración, flujos, comunidad, monetización y SQL), revisión visual a 360/390/1366 px en tema claro y oscuro, informe final de 10 puntos y PR.

## Decisiones que necesito confirmar

1. **Entrenamiento diario: ¿12 h o 24 h?** Hoy son 12 h por tu pedido anterior; el pedido nuevo dice 24 h.
2. **Imágenes estilo referencia:**
   - Puedo hacer y verificar el **mapa muscular propio** para todos los ejercicios, combinado con las fotos de inicio y fin que ya tienen licencia libre.
   - **No puedo generar fotos realistas de un mismo modelo** para 156 ejercicios con permisos claros.
   - Para eso hace falta una sesión de fotos propia o un banco con licencia comercial. Si los conseguís, la asociación ya funciona por identificador estable y se reemplazan por lotes.
