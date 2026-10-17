# FittForma AI v40.2 — Punto 3: rediseño de navegación móvil

**Fecha:** 15 de octubre de 2026  
**Base:** v40.1 estabilización técnica  
**Alcance:** navegación, acceso a secciones, estados accesibles y versionado de PWA.

## Cambios realizados

1. La barra inferior móvil tiene cinco destinos directos: Inicio, Entrenar, Progreso, Comunidad y Perfil.
2. Entrenador IA, Correr y Nutrición siguen disponibles en un menú secundario accesible desde el botón “Más” en la cabecera.
3. La opción para instalar la PWA se encuentra en ese menú secundario; en modo instalado se oculta como antes.
4. Se mantienen los estados activos de la navegación y se actualiza `aria-current` para el destino principal; el menú comunica su estado con `aria-expanded` y se cierra al elegir una sección, tocar fuera o pulsar Escape.
5. Se agregaron indicadores de foco visibles para controles de navegación por teclado.
6. Se mantiene el espacio inferior para que la barra fija no tape el contenido y se conservan las áreas seguras de iOS mediante `env(safe-area-inset-bottom)`.
7. Se actualizó la versión visible, los paquetes y el nombre de caché de service worker a v40.2.
8. Se añadieron traducciones para las nuevas etiquetas del menú en los seis idiomas disponibles.

## Verificación ejecutada

- `npm test`: **73 aprobadas, 0 fallidas**.
- `node --check i18n.js`: aprobado.
- `node --check backend/server.mjs`: aprobado.
- La prueba de regresión confirma el orden de los cinco destinos principales y que Entrenador IA, Correr y Nutrición continúan accesibles desde “Más”.
- El servidor local respondió con HTTP 200.

## Límites

No se certificó visualmente en dispositivos físicos iPhone/Android. El intento de captura con Chromium headless no terminó dentro del tiempo disponible, por lo que no se presenta como una prueba visual aprobada. Se recomienda comprobar la barra, el menú y las áreas seguras en al menos un iPhone y un Android antes de publicar.

## Archivos principales modificados

- `index.html`
- `i18n.js`
- `sw.js`
- `package.json`
- `backend/package.json`
- `tests/community.test.mjs`
- `tests/runtime.test.mjs`
- `tests/sanity.test.mjs`
- `README.md`
- `CHANGELOG.md`

## Resultado

La navegación móvil queda reorganizada sin eliminar funciones: cinco secciones frecuentes pasan a estar siempre visibles y las tres herramientas complementarias se mantienen accesibles en el menú secundario. Esta auditoría cubre la navegación estática y las pruebas automatizadas; no sustituye una prueba de uso real en teléfono.
