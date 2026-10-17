# Sistema de insignias — reglas (v41.0)

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
