# Auditoría del punto 4 — FittForma AI v40.5

## Alcance de esta etapa

Se inició la auditoría real de la biblioteca, sin dar por verificada la correspondencia biomecánica de todos los recursos. Se inspeccionaron la estructura del catálogo, los nombres de los archivos de imagen, la función que selecciona ilustraciones y las reglas compartidas para músculos, técnica y errores frecuentes.

## Inventario inicial

- 190 entradas de catálogo entre las modalidades `gym`, `home` y `bodyweight`.
- 180 nombres únicos de ejercicios.
- 171 entradas de fuerza y 19 de cardio en las entradas extraídas; algunos ejercicios se repiten deliberadamente entre modalidades.
- 180 SVG de esquema con nombres individuales existen en `assets/exercises/generated/`, pero la inspección visual de muestras reveló que estos recursos muestran figuras de palitos genéricas y el nombre del ejercicio, no una demostración biomecánica específica ni una secuencia de fases. La existencia del archivo no prueba que el movimiento esté bien representado.
- Hay fotografías WEBP de referencia para un conjunto pequeño de movimientos, pero algunas reglas anteriores las asignaban a familias demasiado amplias (por ejemplo, una foto de press con mancuernas podía aparecer para una máquina o una barra).

## Correcciones aplicadas en v40.4

1. Se redujo la lista de fotografías etiquetadas como específicas a variantes que coinciden razonablemente con la foto disponible.
2. Para ejercicios sin fotografía suficientemente coincidente, la ficha muestra una ilustración del grupo muscular y la identifica explícitamente como referencia general, no como demostración exacta.
3. Se dejó de mostrar el SVG de figura de palitos como si fuera una ilustración personalizada fiable. Los SVG se conservan en el proyecto, pero no se usan como evidencia de técnica correcta hasta una revisión visual ejercicio por ejercicio.
4. Se corrigió un error de clasificación de `curl femoral`: las reglas genéricas de `curl` lo identificaban como ejercicio de bíceps y le podían mostrar instrucciones y errores propios de un curl de brazo. Ahora dispone de músculos, pasos y errores específicos antes de las reglas genéricas.
5. Se añadieron pruebas automatizadas para evitar que vuelvan esas dos clases de error.

## Lo que no se debe considerar terminado

- No se ha verificado visualmente cada una de las 180 variantes.
- No se han revisado manualmente todos los grupos musculares, respiración, equipo, dosis o errores para cada ficha.
- No se han creado todavía secuencias anatómicamente fieles de posición inicial, fase media y final para cada ejercicio.
- No se ha incorporado aún una taxonomía estructurada y revisada de músculos primarios/secundarios, dificultad, equipo y sustituciones.
- La búsqueda y los filtros existen, pero favoritos y sustitución de ejercicios requieren una revisión funcional separada.

## Siguiente trabajo recomendado dentro del punto 4

1. Convertir el catálogo a un esquema de datos explícito y validable, conservando compatibilidad con las rutinas guardadas.
2. Revisar primero los 30 ejercicios más comunes, priorizando sentadilla, press de banca, jalón, remo, peso muerto, hip thrust, flexiones, plancha y variantes de curl.
3. Para cada ejercicio: nombre normalizado, modalidad, grupo, músculos primarios/secundarios, equipo, nivel, instrucciones, respiración, errores y alternativas.
4. Añadir un control de calidad que impida usar imágenes genéricas como demostraciones exactas.
5. Completar favoritos y sustitución con comprobación de modalidad/equipo y pruebas de regresión.
6. Seguir con el resto del catálogo por lotes, documentando las variantes pendientes en vez de inferir que ya fueron validadas.

## Pruebas

La suite automatizada local debe ejecutarse con `npm test`. Sus resultados validan el código y las reglas descritas, pero no reemplazan la inspección humana de cada ilustración ni una revisión por profesional del ejercicio.


## Cambios adicionales en v40.5

- La biblioteca incorpora favoritos guardados localmente en el dispositivo, con filtro para mostrar solo los favoritos de la modalidad activa. Si el navegador bloquea el almacenamiento, se muestra un aviso.
- Las rutinas generadas permiten cambiar un ejercicio por una alternativa del mismo grupo muscular y tipo (fuerza/cardio) disponible en la modalidad configurada. Se conservan las series y repeticiones de la rutina; el usuario debe verificar que el equipo y la variante le resulten adecuados.
- Se agregó una suite de regresión para comprobar la presencia de estas funciones.
- Las alternativas son una primera mejora funcional; todavía falta ampliar el modelo de datos y revisar individualmente equivalencia, músculos secundarios, técnica y progresión para cada pareja de ejercicios.
