// v62: más interacción en toda la app (lo que muestra un número lleva a su sección; chat → perfil; insignias con ficha)
// y datos físicos PRIVADOS por defecto que cada persona puede elegir mostrar en Comunidad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8'), community = readFileSync('community.js', 'utf8'), css = readFileSync('design.css', 'utf8');
const mig = readFileSync('supabase/migrations/2026-10-31_v62_body_share.sql', 'utf8'), bundle = readFileSync('supabase/APLICAR_MIGRACIONES.sql', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');

test('navegación: lo tocable lleva a su sección (también con teclado)', () => {
  assert.match(html, /function goTo\(target\)\{/);
  assert.match(html, /window\.FittFormaGo=goTo;/);
  for (const t of ['hydration', 'calendar', 'nutrition', 'progress:history', 'progress:muscles']) assert.ok(html.includes(`data-go="${t}"`) || html.includes(`'${t}'`), t);
  assert.match(html, /document\.addEventListener\('keydown',e=>\{if\(e\.key!=='Enter'&&e\.key!==' '\)return;const g=e\.target\.closest\?\.\('\[data-go\]'\)/);
  assert.match(css, /\[data-go\]\{cursor:pointer/);
});

test('Comunidad: el chat abre el perfil y las insignias abren su ficha', () => {
  assert.match(html, /<button type="button" class="community-chat-who" id="communityChatWho"/);
  assert.match(community, /\$\('communityChatWho'\)\?\.addEventListener\('click',e=>\{const uid=e\.currentTarget\.dataset\.uid;if\(uid\)openUser\(uid\);\}\)/);
  assert.match(community, /function showBadgeInfo\(b,own\)/);
  assert.match(community, /data-bi-mine>Ver en mis insignias/);
  assert.match(community, /window\.FittFormaGo\?\.\('badge:'\+String\(b\.exerciseId\|\|''\)\)/);
  assert.equal((community.match(/data-badge-key="\$\{badgeKey\(b\)\}"/g) || []).length, 2, 'destacadas y lista de insignias');
  assert.match(html, /<dialog class="cm-badge-info" id="communityBadgeInfo"/);
});

test('datos físicos: todo apagado por defecto y solo se sube lo activado', () => {
  for (const id of ['communityBodyWeight', 'communityBodyHeight', 'communityBodyTarget', 'communityBodyGoal'])
    assert.match(html, new RegExp(`<input id="${id}" type="checkbox">`), id + ' sin «checked»');
  assert.match(community, /chosen\[k\]\?\(now\[k\]\?\?null\):null/, 'lo no elegido va en null');
  assert.match(community, /if\(!ownBody\)return; \/\/ nunca eligió mostrar nada/);
  assert.match(html, /Tu peso, tu altura y tus objetivos son privados: solo se muestran los que actives en «Datos físicos»/);
  assert.doesNotMatch(html, /window\.FittFormaBodyNow=[^\n]*(waist|bodyFat|age|sex)/, 'nunca medidas, edad ni sexo');
});

test('migración v62: aditiva, con RLS y sin lectura directa de terceros', () => {
  assert.doesNotMatch(mig, /\bdrop\s+(table|function|column)\b/i);
  assert.doesNotMatch(mig, /disable row level security/i);
  assert.match(mig, /alter table public\.community_body enable row level security;/);
  assert.match(mig, /create policy community_body_select_own on public\.community_body for select to authenticated using \(user_id = auth\.uid\(\)\);/);
  assert.match(mig, /revoke all on public\.community_body from anon, authenticated;/);
  assert.match(mig, /public\.community_can_view_profile\(b\.user_id, auth\.uid\(\)\)/);
  assert.ok(bundle.includes('2026-10-31_v62_body_share.sql'), 'incluida en APLICAR_MIGRACIONES.sql');
});

test('textos nuevos traducidos', () => {
  for (const s of ['Ver perfil ›', 'Ver en mis insignias', 'Datos físicos', 'Mostrar mi peso actual', 'Sin cargar en Perfil', 'Los eligió mostrar esta persona. No es una evaluación de salud.'])
    assert.ok(i18n.includes(JSON.stringify(s) + ','), s);
  assert.ok(i18n.includes('nivel (\\d+) de 15'), 'nivel X de 15');
});
