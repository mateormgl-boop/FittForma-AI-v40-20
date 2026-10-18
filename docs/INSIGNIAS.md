# Sistema de insignias — reglas (v41.0, ampliado en v49)

Fuente única de reglas: `achievements.js` (`window.FittFormaBadgeEngine`). La interfaz
(Progreso, Inicio, Perfil y Comunidad) no define umbrales ni categorías propias.

## Rangos y niveles

Cada desafío tiene 12 niveles: Bronce I–III, Plata I–III, Oro I–III y Diamante I–III.

| Rango | Qué representa |
|---|---|
| Bronce I–III | Primeras marcas alcanzables por alguien que empieza. |
| Plata I–III | Base consolidada tras algunas semanas de práctica regular. |
| Oro I–III | Nivel intermedio sostenido. |
| Diamante I–III | Nivel avanzado; Diamante III es una marca destacada para un aficionado. |

Los umbrales de los ejercicios principales se conservan desde v40.20: cambiarlos alteraría el
significado de insignias ya obtenidas (sus IDs son `desafío:nivel`).

## Métrica por actividad

| Categoría | Ejemplos | Métrica | Bronce I → Diamante III | Tope por serie |
|---|---|---|---|---|
| Calistenia | Flexiones | repeticiones seguidas | 5 → 100 | 250 |
| | Dominadas | repeticiones seguidas | 1 → 20 | 80 |
| | Fondos en paralelas | repeticiones seguidas | 3 → 60 | 150 |
| Tren inferior | Sentadillas, zancadas | repeticiones seguidas | 10 → 250 | 1000 |
| | Elevación de talones | repeticiones seguidas | 15 → 300 | 1000 |
| Zona abdominal y core | Abdominales, escaladores | repeticiones seguidas | 10 → 250 | 1000 |
| Duración y control | Plancha frontal, sentadilla isométrica | segundos sostenidos | 15 → 360 s | 3600 / 2400 s |
| | Plancha lateral, equilibrio a una pierna | segundos sostenidos | 10 → 300 s | 1800 / 3600 s |
| Resistencia cardiovascular | Burpees | repeticiones seguidas | 3 → 75 | 400 |
| | Jumping jacks | repeticiones seguidas | 20 → 500 | 3000 |
| Running | Correr | km en una sola actividad | 1 → 42,2 (maratón) | 100 km |
| Caminata y ciclismo | Caminar / Bicicleta | km en una sola actividad | 1 → 50 / 3 → 200 | 80 / 400 km |
| Constancia | Días con actividad | días distintos con rutina o actividad | 1 → 120 | — |
| Fuerza / otros de la biblioteca | Ejercicios del catálogo | repeticiones (o segundos/minutos) | escala genérica 1 → 50 reps | 300 reps |

Running usa hitos reconocibles (5 km, 10 km, media maratón 21,1 km, maratón 42,2 km).
Se cuenta siempre la **mejor serie o actividad individual**, nunca la suma de varias.

## Validación y prevención de abusos

- `validateRecord`: rechaza valores ≤ 0, decimales en repeticiones, valores por encima del tope
  por serie y la misma marca repetida el mismo día.
- Los registros por encima del tope que pudieran existir en datos antiguos no cuentan para el progreso.
- Borrar una marca recalcula ese desafío y quita las insignias que dependían solo de ella.

## Evidencia: declarada vs. GPS (no existe "verificada")

| Estado | Significado |
|---|---|
| Declarada | Marca manual o serie anotada en una sesión. Cuenta para el progreso personal; nadie la comprobó. |
| Con ruta GPS | Distancia registrada con GPS que pasó controles básicos **en el dispositivo** (precisión ≤ 45 m, ≥ 5 puntos, velocidad plausible, sin saltos). Es evidencia, no verificación independiente. |

FittForma todavía no verifica marcas en el servidor. Por eso:

- Ninguna pantalla muestra una insignia como "verificada".
- Al compartir en Comunidad, la base de datos solo acepta `evidence` = `declared` o `gps_device`
  (y `gps_device` solo para distancias), y la interfaz la presenta como "Declarada por el autor" o
  "Ruta GPS según el dispositivo del autor".
- Una verificación real requeriría validar la ruta en el servidor (función con clave de servicio)
  y guardar el resultado en una columna que el cliente no pueda escribir. No está implementado.

## v49: diseño del emblema

- **Forma:** hexágono con relieve. El marco cambia por rango, para que se distinga también sin color:
  - Bronce: liso.
  - Plata: biselado.
  - Oro: con puntas y laureles.
  - Diamante: gema facetada con destellos.
- **Nivel I–III:** 1 a 3 marcas debajo del emblema. En la pantalla de logro se ve además el número romano.
- **Símbolo:** cada desafío tiene el suyo (`SYMBOL_BY_ID` en `achievements.js`):
  - Press de banca: barra y banco.
  - Dominadas: barra fija.
  - Flexiones, sentadillas, abdominales y plancha: la figura del ejercicio.
  - Running: corredor.
  - Racha: llama.
  - Entrenamientos: mancuerna con tilde.

  Los ejercicios de la biblioteca toman el símbolo por movimiento o grupo (bíceps, tríceps, hombros, glúteos, piernas).
- **Tamaño:** se lee desde 24 px.
- **Color de la categoría:** queda como un anillo interior.

## v49: insignias por marca con carga (peso y repeticiones)

| Desafío | Ejercicios que cuentan | Bronce I → Diamante III (× peso corporal) |
|---|---|---|
| Press de banca · carga | Press de banca (con barra) | 0,30 · 0,40 · 0,50 · 0,60 · 0,70 · 0,80 · 0,90 · 1,00 · 1,15 · 1,30 · 1,50 · 1,75 |
| Sentadilla con barra · carga | Sentadilla con barra / trasera | 0,40 · 0,50 · 0,65 · 0,80 · 0,95 · 1,10 · 1,25 · 1,40 · 1,60 · 1,80 · 2,00 · 2,40 |
| Peso muerto · carga | Peso muerto (con barra / convencional) | 0,50 · 0,65 · 0,80 · 1,00 · 1,15 · 1,30 · 1,50 · 1,70 · 1,90 · 2,10 · 2,40 · 2,80 |
| Press militar · carga | Press militar (con barra / de pie) | 0,20 · 0,25 · 0,30 · 0,40 · 0,45 · 0,50 · 0,60 · 0,70 · 0,80 · 0,90 · 1,00 · 1,15 |

**Criterio:**
- **Qué se mide:** el peso de la **mejor serie válida** dividido el peso corporal cargado en Perfil.
- **Serie válida:**
  - marcada como completada;
  - al menos 1 repetición;
  - peso mayor que 0 y hasta 500 kg.
- **Lo que no cuenta:** el volumen de la sesión (series × reps × kg). Tampoco se suman series.
- **Sin peso corporal:** si no está cargado en Perfil, **no se asigna nivel**. La app pide cargarlo y muestra la mejor serie registrada.
- **Variantes excluidas:**
  - Mancuernas: el peso por mano no es comparable con la barra.
  - Peso muerto rumano: es otro ejercicio.
- **Cambios de peso corporal:** si el peso corporal cambia, las insignias ya obtenidas **no se quitan**, porque son historial. Solo cambia el cálculo de los niveles siguientes.
- **Origen de los umbrales:** son una **propuesta configurable** (tabla `LOAD_CHALLENGES` en `achievements.js`). Se basan en rangos habituales de fuerza relativa para población general:
  - Diamante III: un nivel avanzado de un aficionado entrenado.
  - Bronce: lo alcanzable al empezar con técnica.

  No son estándares oficiales. Se pueden ajustar sin cambiar los IDs.
- **Marca manual:** no se puede declarar a mano en el formulario de insignias. Se calcula con las series de los entrenamientos y con los registros manuales de entrenamiento.

## v49: constancia

| Desafío | Métrica | Bronce I → Diamante III |
|---|---|---|
| Entrenamientos completados | sesiones completas (las parciales no suman) | 1 · 3 · 5 · 10 · 15 · 20 · 30 · 40 · 50 · 75 · 100 · 150 |
| Racha de días activos | racha más larga de días seguidos con entrenamiento o actividad | 2 · 3 · 4 · 5 · 7 · 10 · 14 · 21 · 30 · 45 · 60 · 90 |

**Ritmo de carrera:** no tiene insignia todavía. Hace falta definir distancias de referencia y validar el ritmo con GPS; queda pendiente.

## v49: de dónde sale cada marca (nunca «verificada»)

| Etiqueta | Origen |
|---|---|
| Declarada | Marca anotada a mano (registro manual o formulario de insignias). |
| Registrada en sesión | Series marcadas como completadas en un entrenamiento de la app. |
| Con ruta GPS | Distancia con GPS que pasa los controles básicos del dispositivo. |

Ninguna de las tres es una verificación independiente. La base de datos rechaza `verified` en los logros compartidos (`supabase/migrations/2026-10-22_v49_badges.sql` amplía las medidas y la fuente `session`).

## v49: historial, mejor nivel y pantalla de logro

- **Historial completo** (`state.badgeUnlocks`): al subir de nivel se conservan todos los niveles anteriores. Obtener Plata I no borra Bronce.
- **Mejor nivel por desafío** (`FittFormaTraining.highestPerChallenge`): una insignia de running no reemplaza una de fuerza.
- **Pantalla de logro:**
  - Se muestra solo al desbloquear algo nuevo: al terminar un entrenamiento o una carrera, al guardar una marca manual o al cargar un peso corporal que habilita un nivel.
  - Cada desbloqueo celebrado guarda `celebratedAt`, así que no reaparece al recargar ni al abrir el perfil.
  - El desbloqueo usa el id `desafío:nivel`, así que no se duplica.
- **Destacadas:** como máximo 3, elegidas por la persona entre las obtenidas. Sin elección, se completan con las de mayor nivel; no hay repetidas.
