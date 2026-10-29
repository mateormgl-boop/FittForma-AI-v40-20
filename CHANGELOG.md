# FittForma AI — Registro de cambios

## v63.1 — Mensaje correcto cuando Supabase no puede mandar el correo (29 de octubre de 2026)

- Al crear una cuenta, si Supabase llegó a su límite de correos por hora («email rate limit exceeded»), la app decía «Probaste muchas veces seguidas», y no era cierto.
- Ahora explica que no se pudo mandar el correo de confirmación por el límite de correos por hora y que hay que probar en un rato.
- La causa de fondo se arregla en Supabase:
  - apagar «Confirm email»: no se manda ningún correo y la cuenta queda lista al instante;
  - o configurar un servidor de correo propio (SMTP), con un límite mucho mayor.

## v63.0 — Crear cuenta e iniciar sesión, fácil (28 de octubre de 2026)

- **Al abrir la app por primera vez:** «Crear cuenta», «Iniciar sesión» o «Seguir sin cuenta».
- **Una sola pantalla de cuenta para toda la app.** Se abre desde:
  - la bienvenida;
  - Inicio, con la tarjeta «Guardá tu progreso», que se puede cerrar;
  - el menú «Más»;
  - Perfil;
  - Comunidad, con «Entrá a Comunidad» arriba de todo.
- Ya no hay formularios escondidos: el de Comunidad estaba debajo del editor de perfil.
- **Más fácil en el celular:**
  - teclado de correo y autocompletar;
  - 👁 para ver la contraseña;
  - recuerda tu correo en este dispositivo;
  - Enter para entrar.
- **Errores en palabras simples:** contraseña incorrecta, cuenta sin confirmar, correo ya registrado, demasiados intentos y sin conexión.
  - Si el correo ya tiene cuenta, pasa sola a «Iniciar sesión».
- **«¿Olvidaste tu contraseña?»:** llega un enlace y, al tocarlo, la app pide la contraseña nueva.
- **«Reenviar el correo de confirmación»** si Supabase todavía pide confirmar el correo.
- **Al entrar, un aviso claro:** «¡Listo! Ya iniciaste sesión».
- **«Continuar con Google»** aparece solo si el proyecto de Supabase tiene Google activado.
- Perfil ya no muestra instrucciones técnicas («configurá SUPABASE_URL…») a quien usa la app.
- Sin migraciones nuevas.

## v62.0 — Más interacción en toda la app y datos físicos privados con opción de mostrarlos (28 de octubre de 2026)

- **Todo lo que muestra un número lleva a su sección** (con el dedo o con Enter):
  - Inicio: los números de la semana (entrenamientos, comidas, agua, días activos), los círculos de hoy, «Tu constancia», lo último que hiciste y la próxima insignia.
  - Perfil: entrenamientos, días activos, insignias e insignias destacadas.
  - Progreso: los mosaicos y las series por grupo muscular.
- **Comunidad:**
  - En un chat, tocar el nombre o la foto abre el perfil de esa persona.
  - Tocar una insignia (tuya o de otra persona) abre su ficha: rango, nivel de 15, categoría, marca del nivel, fecha y cómo se registró.
  - En las tuyas aparece «Ver en mis insignias».
- **Datos físicos privados por defecto:**
  - Peso actual, altura, peso objetivo y objetivo de entrenamiento no se muestran en Comunidad.
  - En Comunidad → Mi perfil → «Datos físicos» cada uno se activa por separado.
  - Solo se sube a la nube lo que está activado. Si cambiás el peso en Perfil, se actualiza solo si lo activaste. Al apagarlo, se quita de la nube.
  - Los ve quien puede ver tu perfil (si es privado, solo tus seguidores aceptados) y nunca alguien bloqueado.
- **Base de datos:** migración aditiva `2026-10-31_v62_body_share.sql` (incluida en `APLICAR_MIGRACIONES.sql`). También fija el `search_path` de tres funciones que marcaba el asesor de seguridad de Supabase.

## v61.0 — Comunidad: estadísticas públicas desde el inicio, una sola foto de perfil, versus por músculo y Legendario (28 de octubre de 2026)

- **Estadísticas públicas desde el inicio:**
  - Nivel, insignias, constancia, running y músculos se publican al iniciar sesión, sin tener que entrar antes a Comunidad.
  - Cada persona las puede ocultar con «Ocultar mis estadísticas».
  - Peso, altura, medidas y objetivos nunca se publican.
- **Una sola foto de perfil:**
  - Al elegir la foto en Perfil, la casilla «También en Comunidad» (marcada) la sube también a Comunidad.
  - Si alguien tiene foto en Perfil pero no en Comunidad, Comunidad le ofrece «Usar mi foto» de un toque, o «Elegir otra».
  - La foto nunca se sube sola: siempre la confirma la persona.
- **Versus músculo por músculo:**
  - La comparación muestra el mapa de músculos de las dos personas, uno al lado del otro.
  - Muestra el rango de cada músculo y cuántos músculos van a favor de cada una.
- **Legendario en Comunidad:** las insignias se compartían con un tope viejo de 12 niveles, que las cortaba en Diamante. Ahora llegan hasta Legendario (15).
- **Pruebas:** dos pasos E2E que exigían «no publicar antes del aviso» se actualizaron a la nueva regla, que pidió la persona dueña.
- Sin migraciones nuevas.

## v60.0 — Avisos según tu semana, sesión más cómoda y lista de lanzamiento web (28 de octubre de 2026)

- **Avisos según Mi semana:**
  - El recordatorio dice lo que toca hoy («Hoy toca: Piernas») y no avisa los días de descanso.
  - «Agregar al calendario» descarga un archivo .ics con un evento semanal por cada día de entrenamiento. Lo avisa el calendario del celular, aunque la app esté cerrada.
- **Sesión de entrenamiento:**
  - Al terminar el descanso vibra y suena un pitido corto. Se pueden apagar, y la preferencia queda en el dispositivo.
  - «Discos» en ejercicios con barra: cuántos discos poner por lado, con barra de 20, 15 o 10 kg. Si el peso no se puede armar exacto, muestra lo más cercano y cuánto falta.
  - «Superserie con el siguiente»: se pasa al otro ejercicio sin descanso y se descansa al cerrar la ronda.
- **Lista de lanzamiento web (lo que aplica a una app):**
  - Página 404 propia, en el idioma de la persona.
  - robots.txt.
  - Título de la pestaña por sección y enlaces directos (`/#nutrition`, `/#train`…).
  - Vista previa al compartir: título, descripción e imagen de 1200×630 hecha con una captura real de la app.
  - Datos estructurados de aplicación web, sin reseñas ni puntajes.
  - Preguntas frecuentes en Perfil → Ayuda y privacidad.
  - Política de privacidad (`privacidad.html`) escrita según lo que hace el código.
  - Etiqueta accesible en las miniaturas de «Mi físico».
- **v59.1 (incluida):** los estilos se actualizan junto con la app (antes quedaban guardados 1 hora y la v59 se veía con los estilos viejos), y los íconos tienen tamaño propio.
- **Pruebas:** la prueba de Comunidad «Descartar denuncia» ya no falla según el orden de la lista.
- **No incluido, a propósito:**
  - Analítica: hace falta tu ID y un aviso de consentimiento.
  - Reseñas, casos de éxito y fotos: no hay reales y no se inventan.
  - Mapa: no hay un local físico.
- Sin migraciones nuevas.

## v59.0 — Calorías por ejercicio, Mi semana compacta y revisión visual (28 de octubre de 2026)

- **Calorías estimadas mientras entrenás:**
  - Al completar todas las series de un ejercicio aparece «¡Press de banca completo! ≈ 33 kcal (estimación)».
  - Durante la sesión se ve el total estimado en vivo.
  - Al terminar, el resumen muestra las calorías de la sesión, el detalle por ejercicio y los récords nuevos (por ejemplo, «22 kg × 10 (antes 20 kg)»).
  - Cálculo: MET 3,5 (Compendio 2011, código 02054) × tu peso × tiempo de trabajo y descanso de las series hechas; para la sesión se usa el mayor entre ese cálculo y el de la duración. Siempre se aclara que es una estimación.
  - Sin peso cargado no se inventa: se pide cargarlo y «Cargar peso» lleva al campo en Perfil.
- **Entrenamiento diario en espera:** el círculo negro se reemplazó por un anillo de progreso con el tiempo que falta y cuándo se habilita.
- **Mi semana compacta:**
  - Los 7 días en una fila, cada uno con un mini dibujo de los músculos que toca (o descanso / elegir).
  - Al tocar un día se abre una hoja desde abajo con las combinaciones dibujadas y los músculos de cada una; también descanso, sin asignar, tus rutinas y grupos a mano.
  - «Hoy toca» muestra el mapa de músculos del día.
- **Revisión visual en el celular (tema oscuro):**
  - Encabezados de sección más finos.
  - Entrenar sin tarjetas dentro de tarjetas, y las combinaciones ya no se cortan a la derecha.
  - Inicio: accesos rápidos en 4 columnas.
  - Hidratación: el aviso sin registros ya no se corta.
  - Comunidad: el aviso de conexión ocupa todo el ancho.
- Sin emojis en la interfaz (íconos dibujados) y textos nuevos traducidos a los 6 idiomas.
- Sin migraciones nuevas.

## v58.0 — Mi semana, rutinas listas, Inicio personalizable, qué comer según tu objetivo e insignias nuevas (28 de octubre de 2026)

- **Mi semana (Entrenar):**
  - De lunes a domingo elegís qué trabajar cada día: una combinación (pecho y tríceps, espalda y bíceps, piernas, hombros y core, torso, glúteos…), grupos elegidos a mano, una de tus rutinas o descanso.
  - «Hoy toca» sigue tu semana y «Ver la sesión» la arma con tu equipamiento, nivel y objetivo.
  - Si no armaste la semana, recomienda qué entrenar hoy según lo que hace más tiempo que no entrenás (por ejemplo, «Hace 5 días que no entrenás piernas»).
- **Rutinas listas (11):**
  - Cuerpo completo 2 y 3 días.
  - En casa.
  - Músculos opuestos.
  - Empuje · Tracción · Piernas de 3 y 6 días.
  - Fuerza básica.
  - Torso · Tren inferior.
  - Pares clásicos de 4 y 5 días.
  - Glúteos y piernas.

  Con «Usar esta» se completa tu semana, y después podés cambiar cualquier día.
- **Recomendada para vos:**
  - Sale de tu objetivo, nivel, equipamiento y días por semana, y de lo que entrenaste las últimas semanas: las combinaciones que ya usás y los grupos que quedaron sin entrenar.
  - Siempre dice por qué la recomienda.
- **Inicio personalizable:**
  - Con «Personalizar inicio» elegís qué tarjetas ver y en qué orden; se guarda también en tu copia en la nube.
  - Tarjeta nueva «Lo que hiciste en el gym»: tus últimos entrenamientos de fuerza con cada ejercicio y su mejor serie, «Repetir» para volver a hacer la misma sesión y «Registrar uno».
  - «Entrenamiento de hoy» muestra lo que toca según Mi semana.
- **Nutrición:**
  - «Menú de ejemplo según tu objetivo» (pestaña Plan):
    - desayuno, almuerzo, merienda y cena armados con la base de alimentos;
    - las cantidades se ajustan a tus calorías y proteína, con topes para que las porciones sean razonables;
    - varias opciones por comida («Otra opción») y «Agregar a hoy».
    - Si con porciones razonables no llega a tus calorías, lo dice en vez de forzar.
  - «Completá tu día» (pestaña Hoy): cuánto te falta y 3 opciones concretas que entran en lo que te queda; prioriza proteína si falta. Si ya llegaste a tus calorías, no sugiere comer más.
  - Los alimentos y las comidas sugeridas se muestran traducidos.
- **Insignias rediseñadas como la imagen de referencia:**
  - Medalla hexagonal de metal con bisel, cara con brillo y figura grande del ejercicio.
  - Las 36 figuras del centro se redibujaron como siluetas rellenas y con volumen, por ejemplo el brazo flexionado de bíceps, la persona colgada en dominadas o los abdominales marcados.
  - Bronce cobre, Plata acero, Oro, Diamante azul brillante con destellos y Legendario negro con corona.
  - Galería «Sistema de insignias»: leyenda de rangos y una tarjeta por ejercicio con su fila de rangos encendidos.
  - No cambia ningún nivel ni umbral.
  - Corregido: la ficha de una insignia decía «/12»; ahora cuenta sobre los 15 niveles.
- **Sin migraciones nuevas.** Pruebas en `tests/v58.test.mjs` y `tests/e2e/v58.e2e.mjs`.

## v57.0 — Nutrición con cantidades, insignias Legendario, Músculos desde Bronce y ficha más clara (28 de octubre de 2026)

- **Nutrición: escribís lo que comiste con la cantidad y la app lo lee.**
  - Ejemplo: «100 g de hamburguesa, 2 croquetas de papa y 200 g de pan».
  - Busca cada alimento en toda la base (306 alimentos), no solo en una lista corta.
  - Entiende gramos, mililitros, unidades («2 huevos», «3 croquetas») y porciones comunes («un plato», «un vaso»).
  - «Lo que reconocí» muestra cada alimento con sus gramos aproximados. Se pueden cambiar los gramos, elegir otra variante o quitar un alimento, y el total se recalcula.
  - Lo que no reconoce se avisa con un ejemplo de cómo escribirlo; no se inventa.
  - Los platos con «con» se mantienen juntos (por ejemplo, «fideos con tuco»).
  - **25 alimentos nuevos:**
    - De USDA: facturas, panqueques, waffles, brownie, galletitas con chips, cheesecake, tarta de manzana, masitas secas, maicena, masa de tarta y burrito.
    - Recetas caseras (marcadas como estimación): croquetas de papa, alfajor de maicena y de chocolate, tarta y empanada de jamón y queso, fideos y polenta con tuco, ensalada mixta, sándwich de milanesa, pizza casera, hamburguesa casera al pan, revuelto gramajo y panqueques finos.
    - Ningún alimento que ya existía cambió sus valores.
- **Insignias: 15 niveles, con «Legendario» de material negro.**
  - Arriba de Diamante hay tres niveles nuevos: Legendario I, II y III. La medalla es negra con borde y corona dorados.
  - Los techos son más altos. Por ejemplo, dominadas: 25, 30 y 40 repeticiones (antes terminaba en 20). Flexiones: 125, 150 y 200.
  - Los 12 niveles anteriores tienen los mismos umbrales: nadie pierde una insignia ya ganada.
  - Migración aditiva `2026-10-30_v57_legend_badges.sql` para que Comunidad acepte los niveles 13 a 15.
- **Músculos:**
  - La escalera empieza en Bronce y sube por Plata, Oro, Platino, Esmeralda, Rubí, Diamante y Campeón hasta Leyenda (negro con brillo dorado).
  - Usa las mismas series que antes para cada rango: los rangos guardados siguen valiendo lo mismo.
  - Un músculo sin series dice «Sin entrenar».
  - El mapa muscular está redibujado:
    - cuerpo oscuro con volumen;
    - abdominales por bloques;
    - tres cabezas del cuádriceps, dos de los gemelos y dos de los isquiotibiales;
    - líneas de definición.
  - La sección tiene un orden más claro: tu rango, el mapa grande, «Qué entrenar» y el detalle músculo por músculo. «Comparar» muestra frente y espalda por separado.
- **Ficha del ejercicio en dos pestañas:**
  - «Cómo se hace»: músculos, pasos, dosis, alternativas y video.
  - «Mi progreso»: «Lo hice», rango e historial.
- **Animaciones más livianas:**
  - Las 193 animaciones pasaron de GIF a WebP animado: de 34 MB a 9 MB.
  - Tienen el mismo contenido y más color.
- **Copia automática en la nube:**
  - Con la sesión iniciada, tus cambios se suben solos unos segundos después, o al salir de la app.
  - Nunca pisa una copia más nueva hecha desde otro dispositivo: en ese caso se pausa y te pide elegir entre cargar o guardar.
  - Si este dispositivo quedó vacío, no reemplaza la copia de la nube.
  - Se puede apagar.
- **Traducciones:**
  - Las 31 fichas de v56 están en inglés, portugués, francés, italiano y alemán.
  - También textos de la ficha que quedaban en español en todos los ejercicios: equipamiento, avisos y alternativas.
- Pruebas: `tests/v57.test.mjs`, `tests/e2e/v57.e2e.mjs`, `tests/e2e/cloud-backup.e2e.mjs` y `supabase/tests/rls_v57_test.sql`.

## v56.0 — Ejercicios nuevos, biblioteca mejorada, progresión con números y Progreso más completo (28 de octubre de 2026)

- **Hidratación:** en Inicio y en el menú rápido, «+1 vaso de agua» ahora se llama «Hidratación» (y sigue sumando un vaso al tocarlo).
- **31 ejercicios nuevos** (187 en total). Algunos de ellos:
  - Sentadilla trasera, búlgara, sumo y con salto.
  - Peso muerto sumo y rumano con barra.
  - Press inclinado con barra, fondos en paralelas, aperturas en máquina.
  - Remo en barra T, remo invertido y remo renegado.
  - Press militar con barra, curl con barra, curl inclinado, press cerrado.
  - Rueda abdominal, elevación de piernas colgado, leñador en polea.
  - Swing con pesa rusa, saltar la cuerda, escaladores, entre otros.

  Cada uno trae:
  - ficha técnica completa;
  - animación propia (`tools/exercise-gifs`);
  - fotos reales de posición inicial y final, de dominio público (free-exercise-db, con su fuente en `assets/exercises/lib/SOURCES.md`);
  - músculos que trabaja, para que cuente en los rangos.

  Se agregaron al final de la biblioteca para no cambiar los planes ya generados.
- **Biblioteca de ejercicios:**
  - Filtros por nivel y por tipo (fuerza, cardio, movilidad).
  - Orden: recomendado, A–Z, más hechos, hechos hace poco y nuevos primero.
  - Vista en cuadrícula o en lista (se recuerda).
  - Búsqueda por músculo (por ejemplo, «glúteo medio»).
  - Cada tarjeta muestra los músculos principales, el nivel y cuántas veces lo hiciste.
- **Ficha del ejercicio:**
  - «Tu historial»: veces registrado, mejor marca, fuerza máxima estimada (Epley, solo de 1 a 12 repeticiones, orientativa), gráfico de las últimas sesiones y detalle de las últimas 5.
  - «Agregar a la rutina» (a una existente o a una nueva).
  - Las alternativas se tocan y abren su propia ficha.
- **Progresión con números:**
  - En la sesión, cada ejercicio sugiere qué hacer, por ejemplo «Probá 47,5 kg × 6 en cada serie».
  - Usa progresión doble: primero sumar repeticiones y después carga.
  - Se calcula solo con lo que registraste. El peso sugerido aparece como guía en el campo vacío y no se carga solo.
- **División semanal:**
  - Elegís una división: Empuje · Tracción · Piernas, Torso · Tren inferior, Pares clásicos + piernas, Músculos opuestos + piernas o Cuerpo completo.
  - La app te dice qué toca hoy, según la última que hiciste.
- **Progreso:**
  - Calendario del mes con los días de entrenamiento y de actividad: se toca un día para ver qué hiciste y se puede ir a meses anteriores.
  - Series por grupo muscular de esta semana, con la referencia de unas 10 series semanales.
- **Nutrición:** «Repetir las comidas de ayer»; no duplica las que ya registraste hoy.
- **Perfil:**
  - El formulario de «Objetivo y actualidad» se pliega cuando ya cargaste tus datos.
  - Las secciones de configuración quedan bajo el título «Ajustes».
- **Insignias:** «Press militar con barra de pie» cuenta para el desafío de carga del press militar (no cambia ningún nivel ya obtenido).
- **Sin migraciones nuevas.** Pruebas en `tests/v56.test.mjs` y `tests/e2e/v56.e2e.mjs`.

## v55.0 — Entrenar por grupos, «Lo hice», Músculos más claro y guía de alimentación (27 de octubre de 2026)

- **Entrenar por grupos musculares** («¿Qué vas a entrenar hoy?»):
  - Combinaciones que se entrenan juntas habitualmente:
    - Empuje · Tracción · Piernas.
    - Torso · Tren inferior.
    - Pares clásicos: pecho y tríceps, espalda y bíceps, hombros y core.
    - Músculos opuestos: pecho y espalda, brazos.
    - Cuerpo completo.
  - «Elegí vos los grupos»: se marcan los grupos a mano (por ejemplo, pecho y gemelos).
  - La sesión se arma con tu equipamiento, nivel y objetivo, y se ve antes de empezar. Después se puede empezar ahora o guardar como rutina.
  - Si con tu equipamiento no hay ejercicios para un grupo (por ejemplo, bíceps solo con peso corporal), se avisa en vez de inventar.
- **«Lo hice» en la ficha de cada ejercicio:** registra un ejercicio suelto (series, repeticiones o segundos, peso, fecha) sin hacer una rutina.
  - Cuenta para marcas, insignias y músculos.
  - Si no cargás minutos, no se estiman.
- **Comunidad:**
  - Tu rango aparece al lado de tu nombre y del de cada persona (tarjetas, perfil y ranking).
  - «Mis músculos» en tu perfil, calculado en el dispositivo aunque el servidor todavía no tenga la migración de v53.1.
  - Volvieron las cuentas sugeridas en Todos.
  - Mensajes más claros cuando no se puede cambiar la foto de perfil, explicando qué falta en el servidor.
- **Músculos rediseñado:**
  - Explica en palabras simples qué es tu rango.
  - «Qué entrenar para subir» muestra tus músculos más atrasados, con el botón «Entrenar esto hoy» que arma la sesión.
  - Leyenda de colores y músculos agrupados por zona.
  - Contraste correcto en el tema claro.
- **Nutrición:**
  - Guía «Cómo comer según tu objetivo» (bajar grasa, mantener, ganar músculo, fuerza, resistencia) con:
    - el plato por proporciones;
    - energía;
    - proteína en g/kg y en gramos con tu peso;
    - carbohidratos para resistencia;
    - «Priorizá» y «Moderá»;
    - fuentes.
  - 17 recetas nuevas (25 en total) calculadas con la base de alimentos (USDA), con filtro «Para tu objetivo».
  - Es orientativa y no reemplaza a un profesional.
- **Sin migraciones nuevas.** Pruebas en `tests/v55.test.mjs` y `tests/e2e/v55.e2e.mjs`.

## v54.0 — Comunidad: semana, reto entre amigos, evolución, avisos e historial privado (29 de octubre de 2026)

- **Ranking de esta semana:** en Constancia y Running se elige «Últimos 30 días» o «Esta semana». La semana va de lunes a hoy y se reinicia cada lunes.
- **Reto de la semana** en Amigos:
  - Gana quien suma más días activos de lunes a domingo, entre vos y las personas que seguís.
  - Muestra cuántos días quedan, una barra por persona (de 0 a 7 días) y quién ganó la semana pasada.
- **Evolución semanal** en «Comparar»: barras de las últimas 8 semanas, tuyas y de tu amigo.
  - Muestra los días activos y los entrenamientos y actividades.
  - Si una semana no tiene datos, se ve gris («Sin datos disponibles»); no se estima nada.
  - El servidor guarda una foto de las estadísticas por semana.
- **Avisos (campanita)** en la cabecera de Comunidad, con la cantidad sin leer.
  - Avisa cuando alguien te sigue, te pide seguirte, acepta tu solicitud, te escribe o te supera en el rango general.
  - Los crea solo el servidor y no se repiten.
  - Al abrirlos quedan leídos. Tocar uno lleva al perfil, al chat o a las solicitudes.
- **Historial privado de «Mi físico»:** al cambiar una sección, las fotos anteriores quedan guardadas y solo las ve su dueño. Se pueden borrar.
- **Revisión visual a 320 px en tema claro y oscuro:**
  - Tarjetas sin superposiciones.
  - Rango legible en el tema claro.
  - Buscador con más espacio.
  - Línea del ganador corregida.
- **Correcciones de v53.1 que no habían llegado a `main`:**
  - La búsqueda de Todos ya no se pierde si llega durante una carga.
  - Se tradujo el acceso a Músculos.
- **Migración aditiva** `2026-10-29_v54_weekly_alerts.sql`, probada en `supabase/tests/rls_v54_test.sql`. Pruebas en `tests/v54.test.mjs` y `tests/e2e/athletes.e2e.mjs`.

## v53.1 — Perfil de Comunidad: músculos, bandera, «Mi físico» y foto de perfil (28 de octubre de 2026)

- **«Todo el mundo» ahora se llama «Todos».**
- **Mapa de músculos en el perfil de Comunidad:**
  - Cuerpo de frente y de espalda, pintado con el rango de cada músculo, más los tres mejores.
  - Se muestra por defecto y se oculta en Mi perfil › «Mostrar mi mapa de músculos en el perfil».
- **Acceso a Músculos desde Inicio:** nuevo mosaico «Músculos», junto a FittAI, Hidratación y Nutrición.
- **Bandera:** se elige el país en Mi perfil › Editar perfil. Se ve junto al nombre en el perfil, las tarjetas y el ranking.
- **«Mi físico»** arriba del perfil, con dos secciones:
  - «Antes y después» (dos fotos) y «Una foto» con descripción.
  - Una sola cosa por sección. Sin membresía Plus se puede cambiar cada 30 días; con Plus, cuando quieras. Quitarla se puede siempre.
  - El límite lo controla el servidor: borrar y volver a subir no saltea el plazo.
- **Foto de perfil:** tocar tu foto en Mi perfil la muestra en grande, con «Cambiar foto» y «Quitar foto». Si no tenés foto, abre el selector.
  - El estado de la subida se ve al lado.
  - Las fotos de otros perfiles y de «Mi físico» también se abren en grande.
- **«Ver cómo me ven» funciona aunque falte la migración v53.** Antes, sin la migración, volvía a Mi perfil.
- **Insignias:** si Supabase rechaza una insignia porque falta la migración v49, la app ahora lo dice claramente en lugar de mostrar un error técnico.
- **Migración aditiva** `2026-10-28_v53_profile_extras.sql`, probada en `supabase/tests/rls_v53b_test.sql`.

## v53.0 — Comunidad de deportistas (27 de octubre de 2026)

- **Comunidad sin feed:** tres apartados, «Todo el mundo» (predeterminado), «Ranking» y «Amigos».
  - Se quitaron de la interfaz el feed, «Para vos», las historias y Explorar. Las tablas y funciones del backend siguen intactas.
  - Mensajes y Mi perfil pasan a la cabecera de Comunidad.
- **Todo el mundo:** directorio de usuarios reales con búsqueda y carga de a 20.
  - Cada tarjeta muestra foto, nombre, @usuario, nivel de entrenamiento, nivel de XP, rango principal, hasta 3 insignias destacadas, el último logro y el botón Seguir.
- **Perfil completo**, el mismo componente desde las tres pestañas:
  - Encabezado con rango, insignias, seguidores, seguir, comparar, mensaje (solo con seguimiento mutuo) y bloquear.
  - Estadísticas: constancia y running de 30 días, actividades y mejores series.
  - Insignias con categoría, rango, nivel, fecha y si vienen de GPS, de un entrenamiento o son autorregistradas.
  - Publicaciones del perfil.
- **Ranking:** 9 categorías, cada una con qué mide, el período, el orden y quiénes participan.
  - Categorías: rango general, constancia, insignias, nivel de XP, running (km), flexiones, dominadas, sentadilla al aire y plancha.
  - Alcance: todo el mundo o amigos, con podio.
  - El orden lo calcula el servidor.
- **Amigos:** personas que seguís con la solicitud aceptada.
  - Puesto en el ranking de amigos y botón Comparar.
  - Estado vacío: «Todavía no tenés amigos en tu comunidad».
- **Comparación «Tu progreso» vs. «Progreso de tu amigo»:** misma métrica, unidad y período.
  - Si falta un dato muestra «Sin datos disponibles»; no estima nada.
  - Aclara que no es un diagnóstico ni una medición de masa muscular.
- **Estadísticas públicas por defecto:**
  - Se publican recién después de mostrar el aviso en Comunidad.
  - Se pueden ocultar en Mi perfil o en Progreso › Músculos.
  - Nunca incluyen peso, altura, medidas, objetivos ni fotos.
- **Publicar en el perfil:** foto con descripción o antes y después, desde Mi perfil › «Publicar en mi perfil».
- **Progreso › Músculos:** el ranking con amigos usa las estadísticas de Comunidad. Tocar una fila abre el perfil.
- **PGRST201:** las consultas de publicaciones ya no usan el embed ambiguo `community_posts → community_profiles`.
  - Los autores se piden aparte.
  - Las solicitudes de seguimiento usan la función `community_follow_requests`.
- **Otros cambios:**
  - `athlete-stats.js`, con funciones puras y pruebas en `tests/v53.test.mjs`.
  - Traducciones en `i18n-v53.js`.
  - Migración aditiva `2026-10-27_v53_athlete_community.sql`, probada en `supabase/tests/rls_v53_test.sql`.
  - `tests/e2e/athletes.e2e.mjs`.

## v52.0 — Mapa de avances: rango por músculo (26 de octubre de 2026)

- Nueva pestaña **Progreso › Músculos**.
- **Rangos:** cada músculo sube de rango según las series que completás.
  - Una serie hecha suma 1 al músculo principal del ejercicio y 0,5 a cada secundario.
  - Son 9 rangos con emblemas propios: Hierro, Bronce, Plata, Oro, Rubí, Esmeralda, Diamante, Campeón y Leyenda.
- **Mapa del cuerpo** de frente y de espalda, con cada músculo pintado del color de su rango. Se compara «Hace 30 días» con «Hoy».
- **Rango general:** es el del músculo mediano, así que sube entrenando todo el cuerpo. Se muestra junto con el equilibrio entre músculos y los tres músculos que más conviene entrenar.
- **Lista por músculo** con cuántas series faltan para el rango siguiente.
- **Aviso al guardar un entrenamiento** cuando un músculo sube de rango.
- **Lo que mide:** constancia y volumen de entrenamiento, no fuerza ni tamaño muscular. La pantalla lo explica.
- **Rango por ejercicio** en la ficha: mejora desde tu primera vez (1RM estimado, repeticiones o segundos), mejor serie y «serie para el siguiente rango». No compara con otras personas.
- **Músculos que trabajaste** al terminar cada entrenamiento y en el historial.
- **Kilos levantados por semana** (8 semanas) con la variación frente a la semana anterior.
- **Estilo «arena»** en los rangos: negro profundo y azul eléctrico, nombre gigante y emblema con brillo, y escalera vertical con haz de luz y la marca «Vos».
- **Fila de ejercicios** en la sesión en curso, para saltar entre ejercicios y ver cuáles completaste.
- **Ranking con amigos** (opcional, apagado por defecto). Solo se comparte el rango general y solo lo ven los seguidores que aprobaste. Requiere la migración `2026-10-26_v52_rank_board.sql`.
- **Otros cambios:**
  - `muscle-ranks.js` (funciones puras con pruebas en `tests/v52.test.mjs`).
  - `anatomy.js` suma `muscleFillSvg`.
  - Traducciones en `i18n-v52.js`.
  - Migración aditiva `2026-10-26_v52_rank_board.sql` (tabla `community_rank_shares` con RLS y función `community_rank_board`), probada en `supabase/tests/rls_v52_test.sql` y `tests/e2e/rank-board.e2e.mjs`.

## v51.0 — Galería de ejercicios, hidratación y «Objetivo y actualidad» (19 de octubre de 2026)

**Galería de ejercicios**
- Los 162 GIF se generaron de nuevo:
  - Encuadre automático medido en cada ejercicio: la figura y el equipo entran completos, sin cortes.
  - Figura más clara: músculos perfilados, torso más ancho, luz con volumen y contornos limpios.
  - Pausa en la posición inicial y en la final, para que se entienda el recorrido.
  - Línea de trayectoria (verde) del punto que más se mueve en los ejercicios de repeticiones.
- La galería y la ficha muestran el GIF entero y cuadrado. Una regla de las tarjetas (`object-fit:cover`) lo recortaba.
- En la ficha, el título va en una franja propia y no tapa la animación.

**Hidratación**
- Botella con el nivel de agua, porcentaje y barra de progreso.
- Marca del ritmo esperado según la hora (dentro del horario del recordatorio, 9 a 21 h por defecto).
- Botones rápidos: mi vaso, lata (330 ml), botella (500 ml) y botella grande (750 ml), además de otra cantidad y deshacer.
- Línea de tiempo de hoy con hora y acumulado, racha de días con el objetivo cumplido y hora del último registro.
- Gráfico de 7 días con la línea del objetivo.
- La tarjeta no tenía estilos propios (la botella se veía gigante y negra); ahora funciona en tema claro y oscuro.

**Objetivo y actualidad (Perfil, con acceso desde Inicio)**
- Actualidad:
  - Sexo, con la opción «prefiero no decir».
  - Edad, altura y peso.
  - Cintura y % de grasa, opcionales.
  - Actividad habitual.
- Objetivo: bajar, mantener o subir de peso, peso meta, ritmo semanal y fecha objetivo opcional.
- Resultados (`body-goals.js`):
  - IMC con la categoría de la OMS y la relación cintura/altura.
  - Metabolismo basal con Mifflin-St Jeor, o Katch-McArdle si hay % de grasa.
  - Gasto diario y calorías sugeridas, con límites seguros.
  - Proteína y agua.
  - Distancia a la meta y fecha estimada.
- Avisos:
  - Ritmo agresivo.
  - Meta con un IMC menor de 18,5.
  - Meta contraria al objetivo.
  - Fecha ya pasada.
  - Menores de 18: no se calculan calorías ni ritmos.
- Botón para aplicar las referencias a los objetivos de Nutrición y de agua, con confirmación.
- «Calcular objetivos con mi perfil» (Nutrición) usa el mismo cálculo y ahora considera el sexo, el objetivo y el ritmo.
- Datos privados: nunca se muestran en Comunidad. FittAI los recibe solo si la persona comparte sus registros.

**Otros**
- Traducciones de los textos nuevos a inglés, portugués, francés, italiano y alemán (`i18n-v51.js`).
- Pruebas nuevas:
  - `tests/v51.test.mjs`.
  - `tests/e2e/body-goals.e2e.mjs`: 36 comprobaciones en celular y escritorio.
- No hay migraciones de base de datos.

## v50.0 — Animaciones de ejercicios, GPS en segundo plano, calorías, alimentos y comunidad real (19 de octubre de 2026)

**Entrenamiento**
- Animación GIF propia para cada uno de los 162 ejercicios de la biblioteca, sin reutilizar animaciones:
  - Figura anatómica propia con los músculos que trabajan en rojo y fondo de gimnasio oscuro.
  - Movimiento real de cada ejercicio, de la posición inicial a la final.
  - Generador reproducible en `tools/exercise-gifs`.
- Las fotos reales de uso libre quedan como complemento en la ficha.

**GPS y calorías**
- Corredor, caminata y bicicleta como actividades propias:
  - Tiempo total y en movimiento.
  - Ritmo o velocidad, media, actual y máxima.
  - Desnivel solo con altitud precisa.
  - Estado de la señal.
  - Resumen al finalizar con comparación con las actividades anteriores.
- Un corte breve de señal ya no detiene el registro: empieza un tramo nuevo sin sumar el hueco.
- Se corrigió el tiempo en movimiento al caminar despacio.
- Calorías estimadas, distintas por actividad:
  - Correr y caminar: ecuaciones de la ACSM.
  - Bicicleta y fuerza: Compendio 2011.
  - Se usa el peso de cada momento y se guarda en cada registro.
  - Sin peso, no se calculan.
- Progreso: gasto estimado por actividad por semana y por mes, separado de lo consumido.
- `mobile/`: proyecto Android (Capacitor 8) con GPS en segundo plano y notificación persistente.
  Hay que compilarlo y probarlo en un celular (ver `docs/GPS_SEGUNDO_PLANO.md`).

**Nutrición**
- 281 alimentos con datos USDA SR28 verificables por número NDB:
  - Variantes de preparación.
  - Gramos, mililitros y porciones.
  - Sinónimos.
  - Recetas uruguayas marcadas como estimación.
- Buscador con categorías, favoritos y frecuentes, y registro directo por comida.
- Productos envasados de Open Food Facts con respaldo local.

**Comunidad**
- Perfiles nuevos públicos por defecto.
- Directorio de usuarios reales con búsqueda y «Ver más».
- Perfiles privados con datos básicos y un aviso, sin exponer su contenido.
- Quitar foto de perfil; fotos de perfil en los comentarios.
- Migración aditiva `2026-10-24_v50_community_directory.sql`:
  - Arregla el alta cuando el usuario automático ya existía.
- Se corrigió un error al redibujar la foto propia.

**Pruebas:** unitarias 242, SQL 194 comprobaciones, E2E de GPS, nutrición, comunidad (54), entrenamiento, flujos,
integración y monetización.

## v49.0 — Rediseño de entrenamiento, insignias y comunidad (19 de octubre de 2026)

**Entrenamiento y biblioteca**
- Mapa muscular propio (`anatomy.js`):
  - Figura de frente y espalda con 20 regiones con identificador estable.
  - Resalta el músculo principal y los secundarios de cada ejercicio.
- Ficha del ejercicio con la distribución de la referencia:
  - Grupo, músculos, equipamiento, nivel y tipo de movimiento.
  - Inicio y fin.
  - Posición inicial; se agregó en 33 fichas que no la tenían.
  - Pasos, respiración, errores, recomendaciones y dosis.
- Entrenamiento en curso:
  - Grupos, duración, ejercicios y series completadas, volumen en vivo y récords.
  - Tabla por serie: anterior, kg, reps o segundos, listo.
  - Plancha en segundos; ejercicios sin carga con lastre opcional.
- Récords solo con datos reales:
  - El peso exige repeticiones.
  - El cardio no cuenta como repeticiones.
  - 1RM estimado señalado como estimación.
  - Registros manuales marcados.
- Registro manual con un valor por serie y volumen real.
- El entrenamiento diario se mantiene cada 12 h (decisión confirmada).

**Insignias**
- Emblema hexagonal con relieve: el marco cambia por rango y cada actividad tiene su símbolo.
- Insignias por carga (press de banca, sentadilla con barra, peso muerto, press militar):
  - Mejor serie válida ÷ peso corporal, con umbrales configurables y documentados.
  - Nunca se usa el volumen.
- Constancia: entrenamientos completos y racha de días seguidos.
- Fuente honesta: Declarada, Registrada en sesión o Con ruta GPS. Nunca «verificada».
- Pantalla de logro que no se repite al recargar (`celebratedAt`).
- Destacadas (máx. 3) también en el perfil social.

**Comunidad**
- Barra propia (Inicio, Explorar, Crear, Mensajes, Perfil) dentro de la sección. La barra inferior principal no cambia.
- Feed:
  - Novedades de quienes seguís; Para vos, Siguiendo y Recientes.
  - Fotos 4:5, me gusta, comentar, compartir y guardar.
  - #hashtags, menú «⋯» y entrenamiento vinculado.
- Explorar: personas sugeridas reales, búsqueda por persona o #hashtag y grilla con filtros.
- Mensajes: lista de conversaciones y chat que se actualiza mientras está abierto; solo con seguimiento mutuo.
- Perfiles sociales:
  - Foto, conteos reales, 3 insignias, seguir y mensaje.
  - Grilla y Guardadas.

**Base de datos:** dos migraciones aditivas, `2026-10-22_v49_badges.sql` y `2026-10-23_v49_community.sql`.

**Corregido**
- La validación del usuario público no funcionaba en navegadores actuales.
- Los avisos de Publicar se escribían en un elemento oculto.
- La notificación quedaba debajo del botón «+».

**Pruebas**
- 227 automáticas.
- SQL/RLS: 167.
- Integración: 115.
- Flujos e idiomas: 22.
- Entrenamiento e insignias E2E: 29.
- Comunidad E2E: 43.
- Monetización E2E: 47.

## v48.0 — Auditoría integral y monetización (18 de octubre de 2026)

**Entrenamiento**
- Planificador nuevo (`training-core.js`) con 156 ejercicios canónicos.
- El objetivo, el nivel, el equipo y los días cambian la rutina de verdad: series, repeticiones, descansos, orden y balance empuje/tracción.
- Se eliminaron los duplicados y la movilidad ya no se trata como fuerza.
- Biblioteca con imagen propia y correcta por ejercicio:
  - 224 fotos WebP de free-exercise-db (Unlicense).
  - 44 ilustraciones SVG originales.
- Ficha con posición inicial, pasos, respiración, errores comunes y músculos (`exercise-guides.js`).
- Progresión diaria: una sesión diaria cada **12 h**, controlada con la hora del servidor y sin duplicados (RPC `complete_daily_training`, idempotente).
- Las sesiones extra, propias, libres y manuales no desbloquean la siguiente sesión diaria. Una sesión parcial no cuenta.

**Insignias, perfil e hidratación**
- Medallas rediseñadas por rango.
- Pantalla de logro y hasta 3 insignias destacadas en el perfil.
- Criterios más exigentes para los ejercicios fáciles.
- Perfil:
  - Peso en kg o lb.
  - Altura validada.
  - Historial de peso.
  - Preferencias de entrenamiento.
- Hidratación completa:
  - Registro en ml.
  - Botones rápidos.
  - Deshacer.
  - Meta recomendada.
  - Recordatorio.
  - Semana.

**Monetización** (apagada por defecto; ver `docs/MONETIZACION.md`)
- Banners en Inicio, Comunidad y Explorar.
- Intersticiales solo en pausas naturales, cada 5–10 min de uso activo. Nunca durante un entrenamiento, el GPS, las comidas, la IA, el inicio de sesión, un pago, una foto o un guardado.
- Videos recompensados voluntarios para:
  - IA: +3 consultas.
  - Fotos en Comunidad: +1 foto, con el borrador conservado y sin publicación automática.
- Los videos recompensados usan un comprobante de un solo uso validado en el servidor.
- La cuota de IA se aplica en el servidor y se devuelve si Gemini falla. El límite de fotos lo aplica la base.
- Plus («FittForma AI Plus», antes «Pro»): sin anuncios y con más IA y más fotos. Se verifica en el servidor con Google Play (subscriptionsv2, acknowledge y RTDN).
- Los precios no cambiaron.
- La CSP permite los dominios de Google solo si se configura Ad Manager.
- Corregido: las métricas de anuncios compartían el límite por minuto con la IA y con los canjes. Ahora tienen límites separados.

**Pruebas**
- 209 automáticas.
- 115 de integración.
- 47 E2E de monetización.
- 33 de Comunidad.
- 133 SQL/RLS.

## v47.0 — Rediseño completo y Etapa 9: entrega (17 de octubre de 2026)

- Diseño nuevo según las referencias claras y oscuras: tema claro por defecto y tema oscuro, elegibles en el encabezado y en Perfil; color propio por sección (Inicio, Entrenar, Correr, Nutrición, Progreso, Comunidad, Perfil, FittAI).
- Logo nuevo (la «F» que forma una persona corriendo) en el encabezado, los íconos de la app y FittAI. Es una recreación en vector hasta tener el archivo original.
- Sistema visual en `design.css`: botones, pestañas, tarjetas, formularios, gráficos y encabezados de sección iguales en toda la app.
- Inicio: franja con la semana, accesos rápidos, «Actividad reciente» con registros reales y estadísticas con íconos. Entrenar: biblioteca en cuadrícula con fotos. Nutrición: anillo de calorías y macros con color. Progreso: gráfico de peso nuevo. Comunidad: fotos que no cargan muestran un fondo neutro.
- Corregido: fechas con hora completa mostraban «Invalid Date»; el editor de rutinas a veces perdía el foco al abrirse; el encabezado fijo dejaba ver el contenido de abajo.
- Contraste AA en ambos temas (auditoría en el navegador a 390 y 1366 px) y sombras neutras en el tema oscuro.
- Entrega: `docs/DESPLIEGUE.md` con variables, orden de migraciones, comprobaciones y vuelta atrás. Sin migraciones nuevas.
- Pruebas: 200 automáticas, 115 integración, flujos críticos, 91 SQL/RLS y 33 Comunidad.

## v46.0 — Etapa 8: ajustes de diseño (17 de octubre de 2026)

- Pulido con la skill *impeccable* (`audit` + `polish`), conservando el diseño de las referencias.
- Contraste: el degradado de acento se oscurece un paso para que el texto blanco pase 4.5:1 (antes 4.43:1); insignia de nivel, placeholders (4.2 → 5.6:1) y días del calendario corregidos.
- Tamaño mínimo de 11 px para rótulos que estaban entre 8 y 10,5 px (barra inferior, calendario, métricas, Progreso, Correr); pie de página a 12 px.
- Profundidad con sombras desplazadas en vez de halos de color; sin texto con degradado.
- Superficies del navegador con la paleta: selección de texto, cursor, foco visible, barra de desplazamiento y números tabulares.
- Detector de impeccable: de 143 a menos de 90 avisos; los restantes son reglas antiguas ya reemplazadas en pantalla o decisiones del diseño de referencia (rótulos sobre los títulos).
- `.claude/settings.json` registra el marketplace `pbakaus/impeccable` y activa el plugin para las próximas sesiones.
- Pruebas: 200 automáticas, 115 integración, 22 flujos críticos, 91 SQL/RLS y 33 Comunidad; barrido visual en español y alemán de 360 a 1366 px.

## v45.0 — Etapa 7: pruebas (17 de octubre de 2026)

- Nueva prueba de flujos críticos (`tests/e2e/flows.e2e.mjs`): generar plan, propuesta de FittAI (aprobar, deshacer, rechazar), GPS simulado, foto de comida, hábitos, exportar → borrar → importar, idiomas, fechas localizadas y uso sin conexión.
- Comunidad E2E: guardar y recuperar la copia en la nube contra PostgREST (33 pasos).
- Traducción: unos 900 textos que seguían en español en los otros 5 idiomas (`i18n-extra.js`), patrones para textos con números y fechas en el formato del idioma elegido.
- Corregido: los placeholders de los cuadros de texto y las etiquetas de las fotos de ejercicios no se traducían.
- `npm run test:e2e` corre integración y flujos críticos.
- Pruebas: 197 automáticas, 115 de integración, 22 de flujos críticos, 91 SQL/RLS y 33 E2E de Comunidad.

## v44.0 — Etapa 6: seguridad y datos (17 de octubre de 2026)

- Corregido un fallo que permitía fabricar un «seguimiento mutuo» para enviar mensajes a perfiles privados.
- Copias importadas o de la nube validadas (`sanitizeState`): no pueden inyectar código ni dejar la app inutilizable.
- Base de datos: fechas puestas por el servidor, límites anti-spam, columnas editables explícitas, mensajes nunca creados como leídos, búsqueda corregida, tamaño máximo de la copia en la nube, denuncias conservadas al eliminar un post.
- Servidor: mismo origen obligatorio en los POST, cuota diaria de IA, contexto de FittAI filtrado (sin foto de perfil), sin confiar en `X-Forwarded-For`, CSP acotada.
- supabase-js 2.45.4 y Leaflet 1.9.4 con integridad SRI.
- Eliminar cuenta: verificación previa, listado paginado y la base no elimina la cuenta si quedan fotos.
- Migración aditiva `supabase/migrations/2026-10-19_v44_security_hardening.sql`. Informe: `docs/SEGURIDAD_v44.md`.
- Pruebas: 193 automáticas, 115 de integración en navegador (incluye una copia maliciosa), 91 SQL/RLS con los permisos por defecto de Supabase y 30 E2E de Comunidad.

## v43.0 — Diseño según referencias, FittAI que guía por la app y etapa 5 (18 de octubre de 2026)

- Diseño: acento degradado azul-violeta, tarjetas con ilustración en Entrenar, Nutrición y Comunidad, tarjeta del plan actual, fichas de variación en Progreso (4 semanas vs. 4 previas), indicadores de la semana en Inicio, botón «+» con registro rápido y pantalla de bienvenida solo la primera vez.
- Perfil: foto de perfil (JPG/PNG/WebP, recorte cuadrado de 256 px, guardada en el perfil local) y nivel por XP con fórmula pública basada en registros reales.
- FittAI conoce todas las secciones y ofrece botones «Ir a…» hacia destinos permitidos (lista blanca compartida entre app y servidor, máx. 3). Sin IA configurada responde una guía local que se identifica como tal.
- Nutrición «Plan y recetas»: plan semanal de comidas y 8 recetas con macros estimados; cargar una receta en el formulario de registro.
- Comunidad: moderación de denuncias (descartar o eliminar publicación) solo para cuentas agregadas por SQL a `community_moderators`.
- Cuenta: eliminar la cuenta en la nube con confirmación escrita «ELIMINAR» (borra archivos de Storage y, en cascada, todos los datos de la base); los datos del dispositivo se conservan salvo que se pida lo contrario.
- Traducción de mensajes dinámicos (saludo, faltantes para insignias, niveles, actividad semanal).
- Migración aditiva `supabase/migrations/2026-10-18_v43_moderation_account_deletion.sql`.
- Pruebas: 185 automáticas, 107 comprobaciones de integración en navegador (móvil y escritorio), 64 SQL/RLS y 30 E2E de Comunidad (incluye moderación y eliminación de cuenta).

## v42.1 — Períodos, cuerpo, notificaciones y FittAI con contexto (17 de octubre de 2026)

- Progreso: actividad por 7 días, 4 o 12 semanas con comparación contra el período anterior equivalente (running manual vs GPS); peso por 1/3/6 meses o todo.
- Pestaña «Cuerpo»: medidas corporales validadas y fotos de progreso privadas guardadas solo en el dispositivo.
- Campana de notificaciones en Inicio: insignias nuevas, recordatorio del día, sesión en curso y mensajes sin leer, con estado de leído.
- FittAI recibe resumen nutricional, agua, rutinas propias e insignias; un interruptor visible permite no compartir registros (el servidor lo respeta). Límite de consulta a 32 KB.

## v42.0 — Seis secciones, rutinas propias y entrenamiento libre (17 de octubre de 2026)

- Navegación de 6 secciones: Inicio, Entrenar, Nutrición, Progreso, Comunidad y Perfil. FittAI (antes Coach) en Entrenar, «Más» y la barra lateral.
- Inicio: saludo según la hora, acciones rápidas que ejecutan la función real (siguiente sesión, comida, +1 agua, correr, insignias, FittAI).
- Entrenar: rutinas propias con CRUD completo y plantillas desde el plan; entrenamiento libre; agregar/quitar series y ejercicios en curso; descanso automático; lanzador también tras guardar.
- Nutrición en pestañas (Hoy · Registrar · Objetivos · Historial) y edición de comidas sin duplicar.
- Progreso: corregir o eliminar sesiones, con recálculo de insignias.
- Perfil: cabecera con estadísticas reales y grupos plegables; un solo nombre visible.
- Pruebas: 175 automáticas, 55 comprobaciones de integración en navegador, 44 SQL/RLS y 22 E2E de Comunidad. Informe: `docs/AUDITORIA_v42.md`.

## v41.0 — Navegación de 5 destinos, insignias con reglas únicas y comunidad ampliada (17 de octubre de 2026)

- Base: se incorporó el ZIP v40.21 sobre el repositorio (que contenía v40.2); se retiraron solo assets que v40.21 ya no usaba.
- Navegación: 5 destinos móviles; Nutrición, Coach IA y Correr con GPS en «Más». Escritorio ≥1024 px con barra lateral e Inicio a dos columnas.
- Insignias: catálogo, categorías, umbrales, topes de plausibilidad, deduplicación, mensajes de progreso y medallas SVG en `achievements.js`. Galería, detalle de 12 niveles con fecha, lista de marcas con borrado y revocación. Estados «Declarada» y «Con ruta GPS»; ninguno se presenta como verificado.
- Progreso: secciones Resumen, Insignias, Historial y Peso. Inicio: próxima insignia con avance real.
- Comunidad: publicaciones de texto (foto opcional) y de logros con vista previa, edición del texto propio, mensajes sin leer. Migración aditiva `supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql`; sin ella la app degrada a transformaciones y lo indica.
- Corregido: `renderProgress` con sesiones sin `exercises`; el pie de página no coincidía con su traducción; grilla antigua de Progreso en escritorio.
- Diseño: capa final de tokens, controles de formulario coherentes, cabecera de posts y subpestañas de Comunidad sin cortes en móvil, sin emojis como iconos.
- Pruebas: 169 automáticas (`npm test`), 44 comprobaciones SQL/RLS (`npm run test:sql`) y 22 pasos E2E de Comunidad contra PostgREST local.

## v40.21 — Nueva navegación y diseño visual de app móvil

- Inicio nuevo con datos reales: saludo, objetivo semanal con anillo, tira de la semana, entrenamiento de hoy con botón que arranca la sesión, accesos de color (Entrenar, Nutrición, Coach IA, Correr con GPS, Progreso, Comunidad), anillos de kcal/proteína/agua, hábitos marcables e insignias.
- Barra inferior de seis pestañas (Inicio · Entrenar · Nutrición · Progreso · Comunidad · Perfil) con etiquetas legibles; Coach y Correr salen del menú «Más».
- Entrenar agrupa Sesión · Ejercicios · Rutinas · Correr · Coach con una fila de subpestañas.
- Biblioteca de ejercicios en filas con foto y chips de grupo muscular (el selector original queda oculto como respaldo).
- Nutrición: «Resumen de hoy» e Hidratación primero en móvil, con anillo de calorías.
- Sistema visual común (azul oscuro con brillo celeste, tarjetas con degradado, botones y chips unificados, burbujas del Coach).
- Corregido: «Ver mi plan» llevaba a una vista equivocada; CSS inválido `font:… inherit`.
- Conserva insignias (v40.20) y Comunidad por secciones (v40.19). Sin cambios en SQL ni backend.
- 157 pruebas automáticas; capturas en Chromium móvil a 360/390/412 px y escritorio.

## v40.20 — Insignias personales y retos medibles

- Nuevo centro de insignias en Progreso con 12 niveles por desafío: Bronce, Plata, Oro y Diamante, tres niveles por rango.
- Desafíos para ejercicios medibles de la biblioteca (repeticiones, isometrías y cardio), marcas de ejercicios personalizados, distancias de correr/caminar/ciclismo y constancia por días activos.
- El progreso considera la mejor serie guardada en entrenamientos y los récords personales declarados; las marcas manuales no se presentan como verificadas.
- Las carreras GPS válidas según controles básicos de plausibilidad pueden actualizar insignias con distintivo GPS; registros manuales de distancia solo cuentan como logro personal.
- Insignias integradas con el estado de usuario existente (exportación, importación, guardado local y sincronización explícita). Sin cambios al esquema SQL.
- Vista previa de insignias en Perfil. La publicación de insignias en Comunidad se deja para una fase posterior.
- El service worker precarga `achievements.js` y usa caché `fittforma-ai-static-v40-20`.
- La verificación de código local es necesaria, pero la integración con credenciales reales y dispositivos físicos sigue pendiente.


## v40.19 — Comunidad por secciones y corrección de PGRST201

- El feed referencia explícitamente `community_posts_user_id_fkey`; los comentarios, `community_comments_user_id_fkey`.
- Se añadió una recuperación no destructiva que consulta publicaciones y perfiles por separado si PostgREST sigue informando una relación ambigua o falta el nombre de FK esperado.
- Comunidad ahora tiene cinco paneles internos: Feed, Explorar, Publicar, Mensajes y Mi perfil. La búsqueda muestra resultados dentro de Explorar; el feed principal queda separado.
- Pestañas adaptadas a móvil, estados ARIA y navegación por teclado.
- Caché de PWA y versiones actualizadas a `0.40.19` / `fittforma-ai-static-v40-19`.

# Cambios recientes

## v40.18 — actualización de la PWA y auditoría independiente
- **Service worker:** el `index.html`, los `.js`, `.json`, `.css` y `supabase-config.js` se piden primero a la red (con tiempo máximo de 5 s) y solo se usa la copia guardada sin conexión. Antes se servía primero la copia guardada, de modo que una versión nueva podía no verse hasta limpiar los datos del sitio. Las imágenes siguen con copia guardada primero.
- **Aviso de actualización:** si se instala un service worker nuevo, aparece «Hay una versión nueva» con los botones Actualizar y Después. No recarga solo, para no cortar un entrenamiento.
- **Perfil → Versión de la app:** muestra la versión y el botón «Buscar actualización», que consulta al servidor y recarga si hay otra versión.
- Versión `0.40.18` / caché `fittforma-ai-static-v40-18` en paquetes, backend, navegador, traducciones y pruebas.
- 6 pruebas nuevas (`tests/pwa-update.test.mjs`); una de ellas falla con el service worker de la v40.17, como debe. `npm test`: 136 aprobadas, 0 fallidas.
- No se modificó el esquema SQL de Supabase ni la lógica de Gemini.

## v40.17 — auditoría previa a producción
- `npm test`: 130 aprobadas, 0 fallidas; la misma suite pasa desde el ZIP extraído.
- Diagnóstico de Supabase consulta en solo lectura cinco tablas principales, las RPC `search_community_profiles` y `community_ranked_post_ids`, y, con sesión iniciada, mensajes, bloqueos y sincronización de cuenta.
- Validación de configuración pública alineada entre backend/navegador: HTTPS, host de proyecto `*.supabase.co`, sin credenciales/query/fragmento/ruta adicional y clave pública anon/publishable válida.
- Errores distinguen configuración ausente, tabla o RPC faltante, red/CDN y RLS/permisos. No se escriben datos durante el diagnóstico.
- Se corrigieron asociaciones engañosas para ciclismo indoor/exterior y flexiones de rodilla/curls femorales, que ahora usan referencias apropiadas de familia.
- Se añadieron tipos explícitos a los botones que carecían de ellos y una prueba que impide regresiones de ese tipo.
- Se confirmó que los 45 recursos del precaché existen; se revisaron 213 assets y 24 imágenes rasterizadas activas sin duplicados exactos ni pares perceptualmente casi idénticos según el umbral utilizado.
- La integración real de Render/Supabase/Gemini y los dispositivos físicos sigue pendiente de prueba del usuario.

# CHANGELOG — FittForma AI

## v40.16 — diagnóstico de conexión y estabilización de la auditoría
- Añadida una ruta de diagnóstico visible desde Comunidad: permite repetir la inicialización de Supabase y hacer una consulta de solo lectura a `community_profiles`.
- `/api/public-config` devuelve solo los valores de conexión públicos permitidos y metadatos diagnósticos: versión, tipo de clave pública y motivo si la configuración está ausente/inválida. Nunca devuelve Gemini ni claves de servidor.
- El backend acepta `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`; ambas opciones pasan validación para rechazar `service_role`/`sb_secret_`.
- `supabase-js` intenta un segundo CDN si el primero no carga.
- Corregidas fechas diarias de Comunidad y límites de anuncios para usar calendario local en vez de UTC, que podía desplazar el día en Uruguay.
- La exportación de datos retarda la revocación de la URL Blob para evitar cortar descargas.
- Se amplió la suite a **124 pruebas aprobadas, 0 fallidas**; las mismas pruebas se repiten desde el ZIP extraído.
- Mantiene las mejoras visuales y la limpieza de duplicados de imágenes de v40.15.
- Pendiente de aceptación externa: credenciales reales de Supabase/Gemini, pruebas RLS y dos cuentas, Render y teléfono físico.

## v40.14 — Punto 10: auditoría final y corrección de configuración de Supabase
- El frontend puede obtener la configuración pública de Supabase desde `GET /api/public-config` usando `SUPABASE_URL` y `SUPABASE_ANON_KEY` (o `SUPABASE_PUBLISHABLE_KEY`) configuradas en Render.
- El backend devuelve únicamente la URL del proyecto y una clave publicable/anon válida; no serializa variables de entorno completas, GEMINI_API_KEY ni SUPABASE_SERVICE_ROLE_KEY.
- Se rechazan claves `sb_secret_` y JWT cuyo claim `role` no sea exactamente `anon`; el cliente local también valida el claim de las claves JWT antiguas.
- La Comunidad muestra un mensaje concreto cuando la configuración falta, en lugar de culpar directamente al esquema SQL.
- Caché PWA, cabeceras de versión y paquetes actualizados a v40.14 / 0.40.14.
- Pruebas locales: consultar `AUDITORIA_PUNTO_10_FittForma_AI_v40_13.md`.

# Cambios de FittForma AI

## v40.12 — Punto 9: GPS, recordatorios y preparación de monetización
- Suite `npm test`: 114 pruebas aprobadas, 0 fallidas.
- Se añadió la descarga de recordatorios recurrentes en formato iCalendar (.ics), construidos a partir de los días y hora guardados. El calendario puede avisar aunque FittForma esté cerrada, pero el evento no detecta si se registró una sesión en la app.
- La creación del .ics valida que los recordatorios estén activados, que haya días elegidos y que la hora sea válida; incluye aviso 10 minutos antes y usa la hora local elegida.
- La exportación GPX ahora solicita confirmación explícita porque el archivo contiene coordenadas precisas. La descarga sigue siendo iniciada por el usuario y se genera localmente.
- Se revisa la preparación de monetización: Google Ad Manager permanece desactivado y Pro no acepta pagos ni aparenta tener suscripciones verificadas. La integración de pagos reales sigue pendiente de elegir y configurar un proveedor.
- Se actualizó versión y caché PWA para que el navegador solicite recursos de v40.12.

## Versiones anteriores
- v40.11: nutrición, progreso e historial de hábitos.
- v40.10: comunidad.
- v40.9: entrenador IA y mejoras visuales/progresión.
- v40.8: entrenamiento en vivo.
