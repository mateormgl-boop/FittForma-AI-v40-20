# Recursos visuales de FittForma AI

- `exercises/*.webp`: imágenes ilustrativas de referencia (varias generadas por IA con apariencia fotográfica). Se muestran como específicas solo cuando el movimiento es razonablemente coincidente; no certifican técnica profesional. Las variantes sin imagen adecuada usan referencias de familia etiquetadas como `REFERENCIA`.
- `exercises/reference-*.svg`: referencias de grupo muscular empleadas como imágenes genéricas cuando no hay una foto fiable de la variante. La interfaz las identifica como orientativas, no como demostraciones biomecánicas.
- `exercises/unverified-generated/*.svg`: esquemas generados por ejercicio que se conservaron para revisión futura, pero se pusieron en cuarentena. La inspección visual de sus hojas de contacto mostró poses simplificadas y equipo que no representa con suficiente fiabilidad todas las variantes. La aplicación no los utiliza, el service worker no los precarga y el backend no los sirve públicamente hasta que se revisen/reemplacen.
- `hero/*.webp`: recursos visuales de cabecera.

Las fichas técnicas son educativas y orientativas. Antes de presentarlas como técnica validada, deben revisarse con una persona cualificada y probarse con el catálogo en la aplicación real.


## Revisión visual v40.15

- Las imágenes de los movimientos principales fueron renovadas con un conjunto visual consistente y recortadas para fichas móviles.
- Las imágenes son referencias ilustrativas; no equivalen a revisión biomecánica profesional ni certifican cada variante. La interfaz las etiqueta como imagen/referencia cuando no coinciden exactamente con la variante.
- Se eliminó `reverse-lunge-reference.webp`, visualmente casi idéntica a `lunge.webp`; las zancadas para las que no hay una imagen distinta usan la imagen de familia con la etiqueta `REFERENCIA`.
- Se mantienen fuera del uso público los SVG de `unverified-generated/`, porque no son demostraciones fiables de la técnica.
