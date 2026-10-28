// Arma supabase/APLICAR_MIGRACIONES.sql: todas las migraciones en orden, en un solo archivo para pegar en el
// SQL Editor de Supabase. Cada migración tiene su propia transacción y se puede ejecutar más de una vez
// (supabase/tests/run.sh aplica cada una dos veces y comprueba que los datos previos siguen).
// Uso: node tools/build-migrations-bundle.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const dir = new URL('../supabase/migrations/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const head = `-- FittForma AI — todas las migraciones de la base, en orden (${files[0]} → ${files.at(-1)}).
-- Pegá este archivo completo en Supabase → SQL Editor → Run, en el proyecto de la app.
-- Es seguro aunque algunas ya estén aplicadas: cada bloque se puede ejecutar más de una vez, no borra tablas,
-- datos ni políticas que no vuelva a crear, y no desactiva RLS. Requiere haber aplicado antes schema.sql y community.sql.
-- Generado con: node tools/build-migrations-bundle.mjs (no editar a mano).
`;
const body = files.map(f => `\n-- ===================================================================\n-- ${f}\n-- ===================================================================\n${readFileSync(new URL(f, dir), 'utf8').trim()}\n`).join('');
const tail = `\n-- Que la API de Supabase vea enseguida las funciones nuevas (evita «Could not find the function … in the schema cache»).\nnotify pgrst, 'reload schema';\n`;
writeFileSync(new URL('../supabase/APLICAR_MIGRACIONES.sql', import.meta.url), head + body + tail);
console.log(`supabase/APLICAR_MIGRACIONES.sql: ${files.length} migraciones`);
