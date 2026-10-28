# Pruebas

## 1. Pruebas automáticas (sin servicios externos)

```bash
npm test
```

Cubre sintaxis, estructura, motor de insignias, PWA, backend HTTP local, i18n y contratos de la
migración. No se conecta a Supabase, Gemini ni Render.

### v58

- `tests/v58.test.mjs` (9 pruebas):
  - Semana de lunes a domingo; cada rutina lista arma una semana válida con ejercicios.
  - «Qué toca hoy» primero sigue tu semana y, si no la armaste, lo que hace más que no entrenás.
  - Las series sin completar no cuentan.
  - La rutina recomendada respeta objetivo, nivel, equipamiento y días, y explica por qué.
  - Inicio: todas las tarjetas son bloques ordenables.
  - Menú según el objetivo: 5 objetivos × 3 opciones dentro de ±16 % de las calorías y con la proteína, y porciones de 5 a 450 g.
  - «Completá tu día» no sugiere comer más si ya llegaste.
  - Insignias: contorno propio por rango, degradados metálicos, destellos en Diamante y corona en Legendario.
  - Textos traducidos.
- `tests/e2e/v58.e2e.mjs` (30 pasos, solo la app):
  - Recomendación sin semana; rutina recomendada con motivos; «Usar esta»; cambiar un día; grupos a mano; «Ver la sesión».
  - Inicio con «Hoy toca»; «Lo que hiciste en el gym» con «60 kg × 8»; «Repetir»; personalizar y recargar.
  - «Completá tu día» y agregar; menú con «Otra opción» y «Agregar a hoy».
  - Galería «Sistema de insignias» y ficha con 15/15.
  - Inglés, 320 px y sin errores de JavaScript.

### v57

- `tests/v57.test.mjs`:
  - El lector de comidas reconoce «100 g de hamburguesa, 2 croquetas de papa y 200 g de pan» con 100, 90 y 200 g.
  - Los platos con «con» no se parten, las unidades usan su peso típico y lo desconocido se avisa.
  - Hay 15 niveles de insignias con Legendario; los 12 umbrales anteriores de dominadas no cambian y todos crecen.
  - La migración v57 es aditiva y solo acepta los niveles 13 a 15 con rango `legend`.
  - Músculos va de Bronce a Leyenda con los mismos mínimos de series; Leyenda se pinta negra con borde dorado.
  - La ficha tiene las dos pestañas.
  - Guardas de la copia automática en la nube.
  - Cada texto de las 31 fichas nuevas tiene su fila de traducción.
- `tests/e2e/v57.e2e.mjs` (19 pasos, solo la app):
  - Gramos por alimento editables y guardados.
  - Medalla Legendario con 40 dominadas.
  - Escalera de Músculos, «Sin entrenar», mapa y «Comparar».
  - Ficha en pestañas con animación WebP, traducida al inglés.
  - 320 px sin desborde y sin errores de JavaScript.
- `tests/e2e/cloud-backup.e2e.mjs` (15 pasos, con PostgREST y PostgreSQL local, igual que `community.e2e.mjs`):
  - La primera copia se sube sola y los cambios se suben al salir de la app.
  - No pisa una copia más nueva de otro dispositivo y avisa qué hacer.
  - Después de elegir, sigue sola.
  - Con el dispositivo vacío no reemplaza la nube.
  - Apagada no sube nada, y el botón manual sigue funcionando.
- `supabase/tests/rls_v57_test.sql`: 6 comprobaciones de los logros Legendario (válidos e inválidos) y de que los de antes siguen siendo válidos.

### v56

- `tests/v56.test.mjs`:
  - Los 31 ejercicios nuevos están completos: biblioteca, ficha, alternativas existentes, animación, músculos, fotos y fuente.
  - Van al final de la biblioteca.
  - Los desafíos de carga reconocen los nombres nuevos.
  - Progresión doble con números y sin inventar cargas.
  - «Hoy toca» de la división semanal.
  - Contratos de la interfaz.
- `tests/e2e/v56.e2e.mjs` (31 pasos, solo la app):
  - Hidratación.
  - Filtros, orden, búsqueda por músculo y vista en lista.
  - Historial de la ficha, agregar a rutina y alternativas.
  - Ejercicio nuevo completo.
  - División semanal y sugerencia «Probá 47,5 kg × 6».
  - El peso sugerido es solo una guía.
  - Calendario del mes y series por grupo.
  - Repetir comidas sin duplicar.
  - Perfil plegado.
  - 320 px sin desborde y sin errores de JavaScript.

### v55

- `tests/v55.test.mjs`:
  - Las 11 combinaciones arman sesiones sin repetidos y con ejercicios reales; con poco equipamiento se avisa qué grupo falta.
  - «Lo hice» no estima minutos ni acepta fechas futuras.
  - Cada músculo se relaciona con un grupo entrenable.
  - Las recetas resuelven todos sus ingredientes y los kcal cierran con los macros.
  - Las guías tienen rangos de proteína con fuente.
- `tests/e2e/v55.e2e.mjs` (24 pasos, solo la app):
  - Combinaciones, elegir grupos, empezar y guardar como rutina.
  - «Lo hice» con validación.
  - «Entrenar esto hoy» desde Músculos.
  - La guía usa el objetivo y el peso.
  - Filtro de recetas.
  - Sin desborde a 320 px y sin errores de JavaScript.

### v54

- `supabase/tests/rls_v54_test.sql` (41 comprobaciones):
  - Avisos: los crea el servidor, son privados, no se duplican y se ocultan con bloqueo.
  - Semana validada y fijada por el servidor.
  - Ranking semanal con alcance «amigos».
  - Ganador de la semana pasada.
  - Evolución que respeta la opción de ocultar.
  - «Te superó en el rango».
  - Historial privado de «Mi físico».
- `tests/v54.test.mjs`: cálculo de la semana y contratos de la migración y de la interfaz.
- `tests/e2e/athletes.e2e.mjs` (63 pasos):
  - Suma ranking de esta semana, reto, evolución en la comparación, avisos reales e historial privado.
  - Con `SHOTS_NARROW=<carpeta>` guarda capturas a 320 px en tema claro y oscuro.

### v53.1

- `supabase/tests/rls_v53b_test.sql` (33 comprobaciones):
  - Bandera válida y propia.
  - «Mi físico»: una cosa por sección, 30 días sin Plus, sin atajo de borrar y volver a subir, cambio libre con Plus, carpeta propia.
  - Privacidad, bloqueos y mapa de músculos validado y ocultable.
- `tests/e2e/athletes.e2e.mjs` (53 pasos) suma:
  - Foto de perfil tocando el avatar y visor en grande.
  - Bandera, «Mi físico» (antes y después, una foto, límite de 30 días, visor) y mapa de músculos.
  - «Ver cómo me ven» y acceso a Músculos desde Inicio.

### v53

- `npm test` incluye `tests/v53.test.mjs`:
  - Cálculo de estadísticas: 30 días, running plausible y mejores series del mismo ejercicio sin lastre.
  - Topes iguales a los de SQL y ausencia de datos corporales.
  - Categorías del ranking iguales en la app y en el servidor.
  - Comparación con «Sin datos disponibles».
  - Estructura de Comunidad sin feed.
  - Traducciones y versión.
- `supabase/tests/rls_v53_test.sql` (52 comprobaciones):
  - Públicas por defecto y ocultables.
  - Solo la fila propia y topes.
  - Perfiles privados y bloqueos.
  - Alcance amigos, orden del servidor y datos de 30 días frescos.
  - Límite de subida de récords y solicitudes de seguimiento sin embed.
- `tests/e2e/athletes.e2e.mjs` (mismas variables que `community.e2e.mjs`, 39 pasos): cubre las pruebas 1 a 15 del
  pedido de rediseño.
  - Todo el mundo por defecto, sin feed, tarjetas y búsqueda.
  - Perfil completo, comparación, ranking y amigos.
  - Seguir y dejar de seguir, mensajes solo mutuos y perfil privado.
  - Ocultar estadísticas, Mapa de avances, publicar en el perfil, estado vacío y consola sin errores.
- `tests/e2e/community.e2e.mjs` y `tests/e2e/rank-board.e2e.mjs` se adaptaron: publicaciones dentro del perfil y
  ranking con las estadísticas v53. Los pasos del feed y de la búsqueda por #hashtag se quitaron porque esas funciones
  ya no existen en la interfaz.

### v52

- `npm test` incluye `tests/v52.test.mjs`:
  - Rangos por músculo y por ejercicio.
  - Volumen semanal y músculos de la sesión.
  - Fila de ejercicios y contrato de la migración del ranking.
- `supabase/tests/rls_v52_test.sql` (20 comprobaciones):
  - Compartir es opcional y solo se escribe la fila propia.
  - Sin sesión no se ve nada.
  - Solo se ve el rango de quienes seguís con solicitud aceptada, sin bloqueos.
  - Al desactivar, se borra.
- `tests/e2e/rank-board.e2e.mjs` (mismas variables que `community.e2e.mjs`):
  - Ranking apagado por defecto.
  - Activar y desactivar.
  - La marca «Vos» y el orden del ranking.

### v51

- `npm test` incluye `tests/v51.test.mjs`:
  - Galería sin recortes.
  - Ritmo y racha de hidratación.
  - IMC, cintura/altura, metabolismo basal, resumen del objetivo y sus avisos.
  - Privacidad respecto de Comunidad.
- `APP_URL=… node tests/e2e/body-goals.e2e.mjs`, a 390 px y 1280 px. Cubre:
  - Acceso desde Inicio y validaciones.
  - Guardado, recarga y cálculos con valores conocidos.
  - Aplicar las referencias a Nutrición y agua.
  - Línea de tiempo, barra y gráfico de hidratación.
- Para regenerar los GIF: `node tools/exercise-gifs/build.mjs` (unos 7 minutos).
  - Vista previa de algunos: `node tools/exercise-gifs/preview.mjs salida.png "nombre"`.

### v50

- `APP_URL=… node tests/e2e/gps.e2e.mjs`: GPS simulado (posiciones controladas). Cubre:
  - Bicicleta, caminata y carrera.
  - Pausa, saltos descartados, cortes de señal y recuperación del borrador.
  - Calorías con el peso vigente y el resumen en Progreso.
- `APP_URL=… node tests/e2e/nutrition.e2e.mjs`: buscador de alimentos. Cubre:
  - Variantes, gramos, ml y porciones.
  - Registro, favoritos y frecuentes, edición y eliminación.
  - Open Food Facts simulado, y su caída.
- `tests/e2e/community.e2e.mjs` suma los pasos v50:
  - Perfil nuevo público y directorio.
  - Perfil privado con aviso y solicitud de seguimiento.
  - Búsqueda de personas.
  - Subir y quitar la foto de perfil, y cambio de privacidad.
- `supabase/tests/rls_v50_test.sql`: directorio, privados, foto de perfil, bloqueos, sesión anónima y alta con
  usuario repetido.
- **Requieren un celular físico:** GPS con la pantalla bloqueada o en segundo plano, la notificación persistente y
  la app Android (ver `docs/GPS_SEGUNDO_PLANO.md`).

## 2. SQL y RLS sobre PostgreSQL local

`supabase/tests/run.sh` crea una base temporal en un PostgreSQL **de pruebas**, carga un stub mínimo de
Supabase (`auth.uid()`, roles `anon`/`authenticated`, `storage`), aplica `schema.sql`,
`community.sql` y cada migración **dos veces** (para comprobar que es re-ejecutable), verifica que una
publicación anterior a la migración siga siendo válida y ejecuta `rls_v41_test.sql`, `rls_v43_test.sql` y `rls_v44_test.sql` (91 comprobaciones:
suplantación, privacidad, bloqueo, mensajes, no leídos, Pro, storage, datos de la app, evidencia de logros,
moderación de denuncias, eliminación de la propia cuenta, seguimientos falsificados, fechas del cliente,
límites anti-spam, búsqueda y tamaño de la copia). El stub aplica los permisos por defecto de Supabase
(`alter default privileges ... grant all to anon, authenticated`) para no ocultar errores de permisos.

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres npm run test:sql
```

Requiere `psql` y un servidor PostgreSQL 15+ desechable. **Nunca** lo ejecutes contra Supabase de
producción: el stub crea esquemas `auth` y `storage` falsos.

Limitación: el stub no reproduce todo Supabase (GoTrue, Storage real, extensiones, grants por defecto).
Las pruebas con dos cuentas en un proyecto Supabase de pruebas siguen siendo necesarias.

## 3. Comunidad de extremo a extremo (navegador + PostgREST)

`tests/e2e/community.e2e.mjs` usa Chromium (Playwright), supabase-js real y PostgREST real sobre la
base de datos local; solo `/auth/v1` y `/storage/v1` se simulan en el navegador. Recorre 33 pasos:
feed anónimo, inicio de sesión, no leídos, publicar texto con foto (con y sin consentimiento),
compartir un logro, me gusta sin duplicar, comentar, editar, mensajes, eliminar, moderar denuncias, guardar y recuperar la copia en la nube y eliminar la propia cuenta. El script recrea
sus usuarios, perfiles y seguimientos en cada ejecución.

Preparación (resumen):

1. Base `ff_e2e` con `supabase/tests/supabase_stub.sql`, `schema.sql`, `community.sql` y la migración;
   rol `authenticator` (`login noinherit`) con `grant anon, authenticated to authenticator`;
   migraciones v41, v43, v44, v48 y v49 aplicadas (el script crea los usuarios de prueba).
2. PostgREST 12 con `db-anon-role = "anon"` y un `jwt-secret` guardado en un archivo.
3. `npm start` en otra terminal.
4. Ejecutar:

```bash
JWT_SECRET_FILE=/ruta/secret POSTGREST_URL=http://127.0.0.1:3300 \
SUPABASE_UMD=/ruta/node_modules/@supabase/supabase-js/dist/umd/supabase.js \
PGHOST=... PGPORT=... PGUSER=... node tests/e2e/community.e2e.mjs
```

### Entrenamiento e insignias (v49)

`tests/e2e/workout.e2e.mjs` (con `npm start` en otra terminal) recorre 29 pasos:
- **Pesos por serie:** dos series con pesos distintos se guardan por separado.
- **Volumen:** en vivo y guardado.
- **Récords:** el récord es el mejor peso real, no el volumen; se marca solo al superar el historial.
- **Plancha:** en segundos y sin kg.
- **Ficha:** con mapa muscular.
- **Registro manual:** un valor por serie, ubicado por fecha.
- **Insignia por carga:** 80 kg con 80 kg de peso corporal da Oro II; conserva el historial, informa la fuente real y la celebración no se repite al recargar.
- **Perfil:** como máximo 3 insignias destacadas.

`supabase/tests/rls_v49_test.sql` y `rls_v49c_test.sql` cubren los logros nuevos y la comunidad v49:
- guardadas, destacadas y foto de perfil propia;
- entrenamiento vinculado sin datos corporales;
- conversaciones, conteos y sugeridos, con privacidad y bloqueos.

### Monetización (v48)

`tests/e2e/monetization.e2e.mjs` levanta su propio backend (puerto 8811) con `MONETIZATION_ENABLED=true`,
`ADS_PROVIDER=test` y Gemini simulado (`tests/e2e/fixtures/mock-gemini.mjs`), y una pasarela local (puerto 3400)
que imita `/auth/v1/user` y reenvía `/rest/v1` a PostgREST. Recorre 47 pasos: banners e intersticiales (con reloj
controlado: nunca durante un entrenamiento, el chat de IA ni antes del intervalo), IA agotada → video
aceptado/cerrado/sin inventario/con error/completado, fotos 1-2-3 con borrador conservado y sin publicación
automática, bloqueo de la base para una 4.ª foto, Plus sin anuncios, error de red y métricas confirmadas.
Requisitos extra: migraciones v48 aplicadas en `ff_e2e` y `grant service_role to authenticator` (solo en la base
local de pruebas). No necesita `npm start`.

## 4. Pendiente manual (no automatizable aquí)

- Supabase real con dos cuentas: RLS, OAuth de Google, confirmación por correo, Storage y URLs firmadas.
- Gemini con clave válida (cuotas, idioma, propuestas).
- Anuncios reales de Google Ad Manager (cuenta, bloques, consentimiento) y compras reales de Google Play (necesita
  la app de Android): ver `docs/MONETIZACION.md`.
- Teléfonos físicos: instalación PWA, GPS en exterior, notificaciones, cámara para código de barras.

## 4. Flujos críticos e idiomas (navegador)

`tests/e2e/flows.e2e.mjs` (22 pasos, con `npm start` en otra terminal): generar el plan, propuesta de FittAI
(aprobar, deshacer, rechazar), GPS con posiciones simuladas y reloj controlado (distancia, ritmo, señal imprecisa),
foto de comida (no registra sin confirmar), hábitos, exportar → borrar → importar, navegación en los 6 idiomas,
ningún texto en español visible con la app en inglés, fechas en el formato del idioma y apertura sin conexión
desde el service worker. Junto con la integración: `npm run test:e2e`.
