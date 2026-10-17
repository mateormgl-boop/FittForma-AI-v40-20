# Pruebas

## 1. Pruebas automáticas (sin servicios externos)

```bash
npm test
```

Cubre sintaxis, estructura, motor de insignias, PWA, backend HTTP local, i18n y contratos de la
migración. No se conecta a Supabase, Gemini ni Render.

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
base de datos local; solo `/auth/v1` y `/storage/v1` se simulan en el navegador. Recorre 30 pasos:
feed anónimo, inicio de sesión, no leídos, publicar texto con foto (con y sin consentimiento),
compartir un logro, me gusta sin duplicar, comentar, editar, mensajes, eliminar, moderar denuncias y eliminar la propia cuenta. El script recrea
sus usuarios, perfiles y seguimientos en cada ejecución.

Preparación (resumen):

1. Base `ff_e2e` con `supabase/tests/supabase_stub.sql`, `schema.sql`, `community.sql` y la migración;
   rol `authenticator` (`login noinherit`) con `grant anon, authenticated to authenticator`;
   migraciones v41, v43 y v44 aplicadas (el script crea los usuarios de prueba).
2. PostgREST 12 con `db-anon-role = "anon"` y un `jwt-secret` guardado en un archivo.
3. `npm start` en otra terminal.
4. Ejecutar:

```bash
JWT_SECRET_FILE=/ruta/secret POSTGREST_URL=http://127.0.0.1:3300 \
SUPABASE_UMD=/ruta/node_modules/@supabase/supabase-js/dist/umd/supabase.js \
PGHOST=... PGPORT=... PGUSER=... node tests/e2e/community.e2e.mjs
```

## 4. Pendiente manual (no automatizable aquí)

- Supabase real con dos cuentas: RLS, OAuth de Google, confirmación por correo, Storage y URLs firmadas.
- Gemini con clave válida (cuotas, idioma, propuestas).
- Teléfonos físicos: instalación PWA, GPS en exterior, notificaciones, cámara para código de barras.
