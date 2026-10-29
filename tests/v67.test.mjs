// v67: velocidad (las traducciones se descargan solo si el idioma no es español) y seguridad en la base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8'), i18n = readFileSync('i18n.js', 'utf8'), sw = readFileSync('sw.js', 'utf8');
const mig = readFileSync('supabase/migrations/2026-11-03_v67_security.sql', 'utf8'), bundle = readFileSync('supabase/APLICAR_MIGRACIONES.sql', 'utf8');
const PACKS = ['i18n-extra.js', 'i18n-v48.js', 'i18n-v50.js', 'i18n-v51.js', 'i18n-v52.js', 'i18n-v53.js'];

test('en español no se descargan las traducciones (~1,8 MB menos)', () => {
  for (const f of PACKS) assert.doesNotMatch(html, new RegExp(`<script src="\\./${f.replace('.', '\\.')}"`), `${f} ya no va en index.html`);
  assert.match(html, /<script src="\.\/i18n\.js" defer><\/script>/);
  assert.match(i18n, /const PACKS=\['\.\/i18n-extra\.js','\.\/i18n-v48\.js','\.\/i18n-v50\.js','\.\/i18n-v51\.js','\.\/i18n-v52\.js','\.\/i18n-v53\.js'\];/);
  assert.match(i18n, /el\.async=false/, 'en orden: i18n-extra.js primero');
  assert.match(i18n, /if\(active!=='es'&&packsState!=='ready'\)\{const want=active;loadPacks\(\)\.then\(\(\)=>\{if\(active===want\)applyLanguage\(want\);\}\);\}/);
  const saved = PACKS.reduce((n, f) => n + statSync(f).size, 0);
  assert.ok(saved > 1_500_000, `se ahorran ${saved} bytes en español`);
});

test('el service worker no guarda las traducciones de antemano', () => {
  const assets = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS')));
  for (const f of PACKS) assert.ok(!assets.includes(`./${f}`), f);
  assert.ok(assets.includes('./i18n.js'));
  assert.match(sw, /const CODE_PATH = \/\(\?:\^\\\/\$\|\\\.\(\?:html\|js\|mjs\|json\|css\)\$\)\/i;/, 'se guardan al pedirse (red primero)');
});

test('seguridad: tres funciones solo con sesión, sin tocar lo que se ve sin sesión', () => {
  const code = mig.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(code, /drop |disable row level security|delete from|truncate|alter table/i);
  for (const f of ['community_are_mutual_follows(uuid, uuid)', 'community_is_moderator()', 'community_suggested_profiles()']) {
    assert.ok(code.includes(`revoke execute on function public.${f} from public, anon;`), f);
    assert.ok(code.includes(`grant execute on function public.${f} to authenticated;`), f);
  }
  for (const f of ['community_users_blocked', 'community_viewer_can_see', 'community_avatar_readable', 'community_directory', 'community_profile_basic']) assert.ok(!code.includes(f), `${f} sigue disponible sin sesión`);
  assert.ok(bundle.includes('2026-11-03_v67_security.sql'));
});
