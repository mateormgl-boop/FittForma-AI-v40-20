# Auditoría v72 — revisión completa de la app (5 de noviembre de 2026)

Pedido de la persona dueña: «examiná toda la app y fijate qué podés mejorar en todos los sentidos».
La revisión fue de solo lectura; los arreglos se hacen por etapas (la primera es v72).

## Cómo se revisó

- **Pantallas:** recorrido automático por las 20 pantallas y pestañas a 320 y 390 px, en claro y oscuro, con
  datos de ejemplo de 8 semanas. Se midieron desbordes, errores de la página, objetivos táctiles, texto chico y
  textos cortados, y se miraron las capturas una por una.
- **Accesibilidad:** axe-core 4.10 (reglas WCAG 2.1 A y AA) en cada pantalla.
- **Idiomas:** la app en inglés, buscando textos que quedan en español.
- **Velocidad:** primera apertura con un celular de gama media simulado (4G lenta: 1,6 Mbps y 150 ms; CPU 4 veces más lenta).
- **Código:** ESLint sobre el script principal, búsqueda de inyección de HTML en las plantillas, revisión del servidor
  y del service worker.
- **Producción (Supabase):** avisos de seguridad y rendimiento de Supabase y consultas de solo lectura (totales, sin
  datos personales).
- **Google Play:** requisitos para apps con contenido de usuarios y la declaración de apps de salud.

No se pudo revisar la versión publicada en Render: la red de este entorno no deja conectarse a `onrender.com`.
Tampoco se pudo compilar la app de Android: no hay SDK de Android y `dl.google.com` está bloqueado.

## Resultado general

La app está sólida: ninguna pantalla tiró errores, nada se desborda a 320 px, axe encontró solo dos tipos de
problema y hay muchas pruebas (unitarias, de seguridad de la base y de navegador). Lo que más faltaba no eran
funciones nuevas: la base de producción estaba atrasada, la app pesa mucho al abrir, todavía no puede cobrar y le
faltaban requisitos de Google Play. En producción había 10 cuentas, 2 activas en la última semana y 1 publicación.

## Hallazgos

### 1. Producción
- **La migración de v70 no estaba aplicada.** Seguía la política vieja que dejaba a cualquiera leer qué cuentas
  tienen membresía. **Arreglado en v72:** aplicada en producción con autorización y verificada (solo queda
  `community_memberships_read_own`, sin lectura anónima, los 10 perfiles intactos).

### 2. Google Play
- **Faltaban normas de la comunidad aceptadas antes de publicar** (la política de contenido de usuarios lo exige;
  ya había «Reportar» y «Bloquear»). **Arreglado en v72.**
- **Los recordatorios no funcionaban en la app de Android:** usaban notificaciones del navegador, que no existen en
  la app. **Arreglado en v72** con el plugin oficial `@capacitor/local-notifications` (falta probarlo en un teléfono).
- **Pendiente de la persona dueña:** completar `legal-config.js` (nombre y correo de contacto; la política y las
  normas lo piden y hoy dicen «todavía no publicado») y los formularios de Play Console «Apps de salud» y
  «Seguridad de los datos».

### 3. Ingresos
- La app no puede cobrar: la compra de Plus usa una función de Google que no anda en la app de Android tal como está
  armada (Capacitor), y los anuncios están apagados. Hace falta Google Play Billing nativo y, para anuncios, AdMob
  con la cuenta de la persona dueña.

### 4. Velocidad
- Primera apertura simulada: primer contenido 4,2 s, pantalla principal 6,3 s, carga completa 11,9 s, 2,1 MB, 33 pedidos.
- El servidor no comprime: 2,2 MB de código pasarían a unos 600 KB con gzip.
- Sin `ETag` ni `Last-Modified`: cada apertura con internet vuelve a bajar todo el código (el service worker pide
  primero a la red y el navegador no puede preguntar «¿cambió?»).
- Al abrir se cargan guías de ejercicios, base de alimentos y Comunidad aunque no se usen, y se arman unos 6.400
  elementos de pantalla de una vez.

### 5. Seguridad y base de datos (avisos de Supabase)
- `community_users_blocked` se puede consultar desde afuera para cualquier par de cuentas (deja saber quién bloqueó
  a quién). Propuesta: que solo responda sobre pares que incluyen a quien pregunta.
- 52 políticas RLS recalculan `auth.uid()` por fila y 5 claves foráneas no tienen índice.
- La protección contra contraseñas filtradas requiere el plan Pro de Supabase; gratis se puede exigir un mínimo de 8 caracteres.
- No se encontró inyección de HTML: los datos de personas pasan por `esc()`.

### 6. Experiencia y diseño
- Músculos muestra «SIN ENTRENAR» en grande a quien tiene cientos de series (el rango general es el del músculo menos entrenado).
- Hay dos planificadores semanales («Mi semana» en Entrenar y «Tu semana» en Rutinas).
- Entrenar ofrece muchas opciones antes de empezar; falta un botón principal «Empezar el de hoy».
- El botón «+» tapa contenido cuando no se mueve.
- FittAI muestra textos técnicos («la monetización no está activa», «Backend… clave privada»).
- El plan pago tiene tres nombres: «Miembros», «FittForma AI Plus» y «FittForma Pro».
- Detalles: «Rutina propia4 nov.» sin espacio en Historial; Ranking sin conexión muestra una caja vacía.

### 7. Accesibilidad e idiomas
- axe: contraste bajo en 3 pantallas (el peor, 1,9:1 en Nutrición › Plan) y 2 listas mal armadas.
- Objetivos táctiles chicos: filas de «Series por grupo muscular» (20 px) y desplegables «¿Cómo se calcula?» (18 px).
- En inglés quedaban 158 textos en español, casi todos de Nutrición › Plan y recetas.

### 8. Código
- `index.html` pesa 980 KB, de los cuales 638 KB son un único script. Obliga a `unsafe-inline` en la política de seguridad.
- `renderRunningHistory` está duplicada (la primera no se usa) y hay 19 variables sin uso.

## Plan por etapas

| Etapa | Qué | Estado |
|---|---|---|
| v72 | Migración v70 en producción, normas de la comunidad con aceptación, recordatorios nativos en Android | Hecho (Android sin probar en un teléfono) |
| v73 | Velocidad: compresión, `ETag`/304, cargar cada sección al abrirla | Pendiente |
| v74 | Base y seguridad: bloqueos solo para pares propios, índices, `(select auth.uid())`, contraseñas de 8+ | Pendiente |
| v75 | Experiencia: rango de Músculos, un solo planificador, Entrenar más simple, botón +, textos técnicos, un nombre para el plan, contraste, traducciones de Nutrición | Pendiente |
| Después | Google Play Billing y AdMob (necesitan las cuentas de la persona dueña) | Pendiente |

## Lo que quedó fuera de v72 y por qué

- **Aviso nativo al terminar el descanso:** Android 12 o más demora las alarmas que no son exactas, y las exactas
  piden un permiso especial al usuario. Para descansos de 60–180 s llegaría tarde; queda para cuando se decida pedir
  ese permiso.
- **Bloquear publicaciones desde la base si no se aceptaron las normas:** hoy lo controla la app (es lo que exige
  Google Play) y la base guarda la aceptación. Hacerlo también en la base rompería a quien tenga la app vieja
  abierta durante el despliegue; se puede sumar más adelante.
