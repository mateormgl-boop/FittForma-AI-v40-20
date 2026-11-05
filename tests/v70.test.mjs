// v70: miembros Plus en Comunidad (insignia opcional), insignia del plan al lado del nombre y detalles visuales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');

test('v70: la insignia Plus en Comunidad es opcional y la membresía ajena no se lee', () => {
  const sql = read('supabase/migrations/2026-11-05_v70_plus_badge.sql');
  assert.match(sql, /add column if not exists show_plus boolean not null default false/, 'apagada por defecto');
  assert.match(sql, /drop policy if exists community_memberships_read_active/);
  assert.match(sql, /community_memberships_read_own[\s\S]*using \(user_id = auth\.uid\(\)\)/, 'cada persona lee solo su fila');
  assert.match(sql, /revoke select on public\.community_memberships from anon/);
  assert.match(sql, /community_plus_ids[\s\S]*cp\.show_plus[\s\S]*monetization_is_plus[\s\S]*community_can_view_profile/);
  assert.match(sql, /community_plus_featured[\s\S]*cp\.visibility = 'public'[\s\S]*limit least\(greatest\(coalesce\(p_limit, 6\), 1\), 10\)/);
  assert.doesNotMatch(sql, /drop table|delete from|truncate|disable row level security/i, 'aditiva: no borra datos ni apaga RLS');
  assert.match(read('supabase/APLICAR_MIGRACIONES.sql'), /2026-11-05_v70_plus_badge\.sql/);
});

test('v70: la app muestra Plus solo con lo que confirma la base y nunca concede Plus desde el cliente', () => {
  const js = read('community.js'), ads = read('ads.js'), html = read('index.html');
  assert.match(js, /rpc\('community_plus_ids'/);
  assert.match(js, /rpc\('community_plus_featured'/);
  assert.doesNotMatch(js, /from\('community_memberships'\)/, 'la app no lee membresías ajenas');
  assert.match(ads, /const isPlus = \(\) => ent\?\.plan === 'plus' && ent\?\.planVerified === true;/);
  assert.match(ads, /showPlusRow'\); if \(spr\) spr\.hidden = !\(isPlus\(\) && signed\)/, 'el interruptor solo con Plus verificado');
  assert.match(html, /id="communityPlusRow" aria-label="Miembros Plus" hidden/);
  assert.match(html, /id="showPlusRow" hidden><input id="showPlusToggle" type="checkbox">/, 'empieza apagado');
  assert.match(html, /id="planChip" type="button" hidden/);
});

test('v70: detalles visuales', () => {
  const html = read('index.html'), css = read('design.css');
  assert.match(html, /classList\.toggle\('is-tucked'/, 'el botón + se corre al bajar');
  assert.match(css, /\.ff-fab\.is-tucked\{/);
  assert.match(html, /<details class="profile-edit" id="profileEdit">/);
  assert.match(html, /'tus primeras 4 semanas':'tocá para empezar'/);
  assert.match(css, /\.reminder-pref-row\[hidden\]\{display:none!important\}/);
  assert.match(css, /\.plan-chip\{[^}]*font-size:12px/);
});
