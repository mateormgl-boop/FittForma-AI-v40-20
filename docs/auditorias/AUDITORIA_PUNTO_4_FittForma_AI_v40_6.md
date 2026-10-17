# Auditoría del punto 4 — FittForma AI v40.6

## Alcance de la entrega

Esta versión continúa sobre v40.5 e incorpora una primera tanda de guías específicas, mejora las alternativas y restringe las sustituciones automáticas. No declara terminado el punto 4: siguen pendientes la revisión individual de las fichas restantes y la inspección visual/técnica de todos los recursos.

## Inventario de partida

- El catálogo base contiene 190 entradas distribuidas en las modalidades de gimnasio, casa y peso corporal, con nombres repetidos deliberadamente entre modalidades y aproximadamente 180 nombres únicos según el inventario anterior.
- Hay 16 fotografías WEBP para un subconjunto de ejercicios; se inspeccionó visualmente una hoja de contacto. Se detectó que la foto etiquetada como press de hombros mostraba un press con mancuernas y no una máquina, y que la imagen de zancada correspondía mejor a una posición de zancada estática que a la fase de paso hacia atrás. Se corrigieron esas dos asignaciones. También se analizaron 188 archivos SVG: todos son XML bien formado, pero muchos recursos generados son esquemáticos y no demuestran de manera fiable la biomecánica exacta. Cuando la foto no coincide suficientemente, la interfaz sigue usando una referencia general rotulada como tal.
- Las guías detalladas de esta versión cubren 36 nombres de ejercicios frecuentes. Es una revisión editorial específica del código y las instrucciones; no es una certificación profesional ni una prueba de que las ilustraciones reproduzcan todas las variantes.

## Cambios realizados en v40.6

1. **Datos estructurados para 36 fichas.** Las guías incluyen patrón de movimiento, músculos principales, músculos secundarios/estabilizadores, equipo, nivel orientativo, tres pasos de ejecución, claves de técnica, respiración, errores frecuentes, descanso orientativo y alternativas.
2. **Músculos separados por rol.** Las fichas con guía muestran principales y secundarios/estabilizadores de forma distinta, en vez de una frase genérica.
3. **Alternativas por modalidad.** El modal lista opciones que existen en el catálogo de la modalidad seleccionada. Cuando no encuentra equivalencia clara, informa que la equivalencia no está verificada.
4. **Sustitución de rutina más conservadora.** Para ejercicios con patrón identificable, el reemplazo prioriza ese patrón y el tipo de actividad. Si no se identifica con suficiente confianza un patrón o no hay candidato, no altera la rutina automáticamente. Conserva series y repeticiones al cambiar el ejercicio.
5. **Actualización PWA y versiones.** La versión visible, `package.json`, el paquete del backend y la caché del service worker se actualizaron a 40.6.
6. **Auditoría visual inicial de fotografías.** Se inspeccionó una hoja de contacto de las 16 fotografías WEBP y se retiraron dos asociaciones demasiado específicas para la variante descrita.
7. **Pruebas añadidas.** Se incluyen comprobaciones para la cobertura del primer lote, los campos de guía, alternativas, selección por patrón y dos asociaciones visuales corregidas.

## Validaciones ejecutadas

- `npm test`: 84 pruebas aprobadas, 0 fallidas (repetidas desde la copia extraída del ZIP).
- `node --check` para los archivos JS/MJS y parseo del script inline principal, incluido dentro de la suite.
- Pruebas HTTP locales del backend, de recursos estáticos y de cabeceras de seguridad (como parte de la suite existente).
- Inspección automática de los nombres de las 36 guías: todos coinciden con un nombre del catálogo. También se verificó la existencia de los nombres de alternativas explícitas y el XML de los 188 SVG. La revisión de la hoja de contacto descubrió y corrigió dos asociaciones de fotos demasiado amplias.

## Pendientes para completar el punto 4

- Revisar manualmente el resto de las 180 variantes únicas y su correspondencia exacta con las instrucciones.
- Auditar cada recurso visual y reemplazar/retirar imágenes inexactas; faltan secuencias realistas por fase para la mayoría de variantes.
- Extender los datos estructurados al catálogo restante y normalizar equipamiento, dificultad, patrón, músculos primarios/secundarios y regresiones/progresiones.
- Probar interacciones reales en móvil (favoritos, búsqueda, filtros, modal y sustitución) y obtener revisión de un profesional competente antes de presentar la técnica como validada.
- Probar el despliegue con Render, la configuración real de Supabase/Gemini y dispositivos físicos en etapas posteriores.

## Conclusión

La biblioteca queda notablemente más específica en las 36 fichas trabajadas y las sustituciones son más prudentes. El punto 4 permanece **en desarrollo**, ya que el catálogo completo y las ilustraciones todavía necesitan auditoría individual.
