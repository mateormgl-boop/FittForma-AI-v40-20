// Copia la app web (los mismos archivos públicos que sirve backend/server.mjs) a mobile/www para empaquetarla.
// Si FITTFORMA_APP_URL está definida (por ejemplo https://tu-app.onrender.com), la app carga esa dirección para que
// FittAI, la nube y los pagos usen el servidor real; si no, usa la copia local (funciones locales + GPS).
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const here = dirname(fileURLToPath(import.meta.url)), mobile = join(here, '..'), root = join(mobile, '..'), www = join(mobile, 'www');
const server = readFileSync(join(root, 'backend', 'server.mjs'), 'utf8');
const list = server.match(/PUBLIC_ROOT_FILES\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
if (!list) throw new Error('No se encontró PUBLIC_ROOT_FILES en backend/server.mjs');
const files = [...list[1].matchAll(/'\/([^']+)'/g)].map(m => m[1]).filter(f => existsSync(join(root, f)));
rmSync(www, { recursive: true, force: true }); mkdirSync(www, { recursive: true });
for (const f of files) cpSync(join(root, f), join(www, f));
cpSync(join(root, 'assets'), join(www, 'assets'), { recursive: true, filter: src => !src.includes('unverified-generated') });
const cfgPath = join(mobile, 'capacitor.config.json'), cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const url = (process.env.FITTFORMA_APP_URL || '').trim();
if (url) { if (!/^https:\/\//.test(url)) throw new Error('FITTFORMA_APP_URL debe empezar con https://'); cfg.server = { url, cleartext: false }; }
else delete cfg.server;
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`${files.length} archivos + assets copiados a mobile/www${url ? ` · la app cargará ${url}` : ' · modo local'}`);
