# Revisión de producto, sección por sección (5 de noviembre de 2026)

Pedido de la persona dueña: «¿viste toda la app parte por parte y te fijaste qué podés mejorar? Agregar cosas,
sacar, mejorar interfaces, agregar imágenes o dibujos…».

La auditoría de v72 (`docs/AUDITORIA_v72.md`) miró sobre todo lo roto o lo que faltaba para publicar. Esta revisión
mira el producto: qué sobra, qué falta y cómo se siente cada pantalla.

## Cómo se hizo

- Mapa de cada pantalla, con 8 semanas de datos de ejemplo y como persona nueva: cada bloque en orden, con su alto,
  sus botones, sus campos, sus imágenes y dibujos y su cantidad de palabras.
- Capturas de página completa, no solo de la primera pantalla, a 390 px.
- Recorrido de la primera vez (bienvenida → «Contanos un poco»).

## Lo general

- **Pantallas muy largas.** En un celular, 844 px es una pantalla:

  | Pantalla | Alto | Pantallas de scroll |
  |---|---|---|
  | Ejercicios | 17.130 px (los 74 ejercicios seguidos) | 20 |
  | Nutrición › Plan | 7.428 px | 9 |
  | Correr | 6.162 px | 7 |
  | Progreso › Historial | 5.349 px | 6 |
  | Progreso › Resumen | 5.039 px | 6 |
  | Músculos | 4.971 px | 6 |

- **Mucho texto explicativo.** Insignias tiene 820 palabras, la tarjeta de GPS 239 y el primer bloque de Nutrición › Plan 253. Propuesta: una línea y un botón «?» que abra la explicación.
- **Casi no hay dibujos.** Fuera de Ejercicios (74 imágenes), Recetas (25) y el cuerpo de Músculos, las pantallas son solo texto y números. Inicio, Progreso, Perfil, Rutinas y FittAI no tienen ninguna imagen.
- **El botón «+»** flota sobre el contenido. Propuesta: pasarlo al centro de la barra de abajo, como el «+» de Instagram, y que no tape nada.

## Sección por sección

### Bienvenida y primera vez
- **Bien:** «Contanos un poco» pide nombre, objetivo y días por semana.
- **Agregar:** dónde entrenás (gimnasio, casa o sin equipo) y el nivel, con tarjetas con dibujo en vez de listas desplegables. Al terminar, que arme el plan y muestre «Tu primer entrenamiento», listo para empezar.

### Inicio
- **Bien:** saludo, semana, progreso semanal y recomendación del día.
- **Reordenar:** los accesos rápidos (Entrenar, Comida, Agua, Correr…) están a mitad de pantalla; van arriba, debajo del saludo.
- **Acortar:** «Lo que hiciste en el gym» ocupa 558 px con tres sesiones completas; alcanza con la última y «Ver todo».
- **Cambiar:** la frase fija («Disciplina hoy…») por un «Consejo de la semana» con dibujo, que vaya cambiando.
- **Agregar:** un botón grande «Empezar entrenamiento de hoy».

### Entrenar
- **Problema:** antes de empezar hay un solo bloque de 1.426 px con 26 botones y 13 campos.
- **Propuesta:** arriba, una tarjeta grande «Tu entrenamiento de hoy» con «Empezar». El resto plegado en «Otras opciones»: grupos musculares, entrenamiento libre, registrar uno hecho, calculadora de RM y crear rutina.
- **Agregar:**
  - Series de calentamiento sugeridas, al 50 % y al 70 % del peso de trabajo.
  - Esfuerzo opcional por serie (cuántas repeticiones te quedaron).
  - Resumen final para compartir como imagen.
- **Dibujos:** cada grupo muscular con el cuerpo chiquito pintado, reutilizando el dibujo que ya existe.

### Sesión en curso
- **Bien:** «Última vez», próxima serie, récord al momento, descanso con sonido y calculadora de discos.
- **Acortar:** la caja «Última vez / Siguiente paso» repite lo que ya dicen la columna «Anterior» y la «Próxima serie»; alcanza con una línea.
- **Agregar:** al terminar, «Compartir resumen» como imagen para Instagram o TikTok, con la marca de la app. Ayuda a que la app se conozca.

### Ejercicios
- **Problema:** 74 ejercicios seguidos, 17.130 px.
- **Propuesta:** el buscador arriba y los ejercicios agrupados por músculo, plegados o con «Ver más».
- **Agregar:** «Ejercicios parecidos» en la ficha.

### Rutinas
- **Problema:** hay dos planificadores de la semana («Mi semana» en Entrenar y «Tu semana» acá) y el armado del plan queda abajo de todo. A una persona nueva le aparecían tres avisos vacíos; v73 ya quitó el repetido.
- **Propuesta:** unir los dos planificadores, subir «Personalizá tu plan» y sumar plantillas listas con dibujo.

### Correr
- **Problema:**
  - Hay dos formularios «Registro sin GPS» (uno para caminata o bici y otro para carrera).
  - La pantalla mide 6.162 px.
  - El texto de privacidad está arriba del botón «Iniciar GPS».
- **Propuesta:**
  - Un solo formulario con el tipo de actividad.
  - «Iniciar GPS» grande y arriba; la privacidad en un «?».
  - Las semanas del plan, plegadas.
- **Agregar:** el mapa de la última salida en el historial y récords de carrera (mejor kilómetro, mejor 5 km).

### FittAI
- **Hecho en v73:** un estado claro, sin textos técnicos.
- **Agregar:** «Preguntas de hoy» según tus registros y respuestas guardadas.

### Nutrición
- **Hoy:** está bien. Le faltan íconos por tipo de comida: hoy todas muestran el mismo tenedor.
- **Registrar:** hay cinco formas de cargar (escribir, buscar, código de barras, foto y favoritas) en una columna larga. Propuesta: cuatro botones grandes arriba («Escribir», «Escanear», «Foto», «Favoritas»).
- **Plan:** mide 7.428 px. Propuesta: recetas en un carrusel con foto y filtro por momento del día, y la guía en tarjetas cortas.
- **Agregar:** gasto calórico real estimado con tu tendencia de peso y lo que comiste, para ajustar el objetivo de calorías solo. La tendencia de peso ya existe desde v71.
- **Pendiente:** 158 textos en inglés siguen en español, casi todos de esta sección.

### Progreso
- **Resumen:**
  - Tiene 10 bloques y 5 son resúmenes parecidos: las tarjetas de arriba, Resumen, Tu actividad, Comparación semanal y Resumen del mes. Propuesta: uno solo, con «Semana / Mes / Todo» y un gráfico.
  - Además repite «Hábitos de hoy», que ya está en Inicio.
- **Insignias:** las explicaciones van a un «?», y primero se muestran las que están cerca de desbloquearse.
- **Historial:** de a 10 sesiones, con «Ver más».
- **Cuerpo:** está bien (tendencia del peso). Agregar comparar dos fotos lado a lado.
- **Músculos:**
  - Hecho en v73: «En camino a Bronce» en lugar de «SIN ENTRENAR» para quien ya entrena.
  - «Músculo por músculo» ocupa 1.915 px; propuesta: plegarlo por zona.

### Comunidad
- **Problema:** con 10 cuentas y 1 publicación, se ve vacía.
- **Propuesta:**
  - «Invitá a un amigo» con un enlace.
  - Una cuenta oficial de FittForma que publique retos y consejos reales. La manejás vos; no se inventan personas ni publicaciones.
- **Agregar:** un reto semanal entre amigos, con aviso cuando alguien te pasa.

### Perfil
- **Problema:** el formulario «Objetivo y actualidad» (12 campos) está dentro de Perfil.
- **Propuesta:** una tarjeta resumen y «Editar» en una hoja aparte.

### Ajustes
- Está bien ordenado. No hay cambios.

## Dibujos e imágenes que sumaría

Ilustraciones propias hechas en SVG, livianas, con los colores de la app y en claro y oscuro. Sin fotos de stock ni personas reales.

1. **Bienvenida:** tres escenas (gimnasio, casa y aire libre) para elegir dónde entrenás.
2. **Estados vacíos:**
   - Rutinas y Historial.
   - Cuerpo: medidas y fotos.
   - Insignias por desbloquear.
   - Comunidad sin amigos.
   - Primer mensaje a FittAI.
3. **Íconos de comida:** desayuno, almuerzo, merienda y cena, o por tipo de alimento.
4. **Celebraciones:** primer entrenamiento, primera semana completa y un mes de constancia.
5. **Consejo de la semana** en Inicio, con su dibujo.

## Orden propuesto

| Etapa | Qué | Por qué primero |
|---|---|---|
| v74 · Primera impresión (**hecha el 6 de noviembre**) | Bienvenida con tarjetas y dibujos, primer entrenamiento listo, Inicio reordenado, Entrenar con un botón principal, estados vacíos ilustrados | Es lo que ve cada persona nueva: decide si se queda |
| v75 · Menos scroll | Ejercicios por grupos, un solo resumen en Progreso, Historial de a 10, Correr con un formulario, Registrar comida con botones arriba | Las pantallas más largas son las que más se usan |
| v76 · Crecer | Resumen para compartir como imagen, invitar amigos, cuenta oficial | Con 10 cuentas, crecer importa más que cualquier función |
| v77 · Nutrición inteligente | Gasto real estimado, íconos de comida, traducciones de Nutrición | Diferencia la app de un simple contador de calorías |
| Técnica | Base y seguridad (bloqueos, índices, reglas más rápidas) | Necesario antes de tener muchas cuentas |
