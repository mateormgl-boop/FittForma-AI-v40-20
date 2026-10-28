// v61: estadísticas públicas desde el inicio (se publican al iniciar sesión, ocultables), una sola foto de perfil
// (Perfil ↔ Comunidad, siempre con confirmación de la persona), versus músculo por músculo e insignias Legendario en Comunidad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8'), community = readFileSync('community.js', 'utf8'), css = readFileSync('design.css', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');

test('las insignias se comparten hasta Legendario (15 niveles), no se cortan en Diamante', () => {
  assert.doesNotMatch(html, /Math\.min\(12,Math\.max\(1,Number\((u|entry)\.level\)/, 'sin el tope viejo de 12 niveles');
  assert.equal((html.match(/Math\.min\(BadgeEngine\.LEVELS\|\|15,Math\.max\(1,Number\((u|entry)\.level\)\|\|1\)\)/g) || []).length, 2, 'destacadas y compartibles');
});

test('estadísticas: se publican al iniciar sesión y nunca si la persona las ocultó', () => {
  assert.doesNotMatch(community, /if\(!ownStats&&!noticeState\(\)\)return null;/);
  assert.match(community, /if\(ownStats\?\.stats_public===false\)return ownStats;/);
  assert.match(community, /if\(user&&user\.id!==wasId\)\{ownStats=null;ownStatsLoaded=false;statsSig='';setTimeout\(\(\)=>\{syncStats\(\)/);
  assert.match(html, /Nunca se publican tu peso, tu altura, tus medidas, tus objetivos ni tus fotos de progreso/);
});

test('foto de perfil única: Perfil ↔ Comunidad, siempre con una acción de la persona', () => {
  assert.match(html, /window\.FittFormaLocalAvatar=\(\)=>validAvatar\(state\.profile\?\.avatar\)\?state\.profile\.avatar:''/);
  assert.match(html, /<input type="checkbox" id="avatarUseInCommunity" checked>/);
  assert.match(html, /if\(cloudUser&&\$\('avatarUseInCommunity'\)\?\.checked\)window\.FittFormaCommunity\?\.setAvatar\?\.\(file\)/);
  assert.match(community, /function renderAvatarOffer\(\)/);
  assert.match(community, /data-avatar-offer-use/); assert.match(community, /setAvatar:changeAvatar\}/);
  assert.doesNotMatch(community, /renderAvatarOffer\(\)[^;]*changeAvatar\(fileFromDataUrl/, 'la oferta no sube sola: hace falta tocar «Usar mi foto»');
  assert.match(html, /id="communityAvatarOffer" hidden/);
});

test('versus: compara músculo por músculo con los rangos que publicó cada persona', () => {
  assert.match(community, /async function muscleCompareHtml\(uid,them\)/);
  assert.match(community, /\$\{await muscleCompareHtml\(uid,them\)\}/);
  assert.match(community, /client\.rpc\('community_athlete_extras',\{p_user:user\.id\}\),client\.rpc\('community_athlete_extras',\{p_user:uid\}\)/);
  assert.match(css, /\.cm-mvs-row\{/); assert.match(css, /\.cm-avatar-offer\{/);
});

test('textos nuevos traducidos', () => {
  for (const s of ['¿Usar tu foto de perfil en Comunidad?', 'Usar mi foto', 'También en Comunidad', 'Músculos', 'Ninguno de los dos tiene músculos con rango todavía.'])
    assert.ok(i18n.includes(JSON.stringify(s) + ','), s);
  assert.ok(i18n.includes('a tu favor · (\\d+) a favor de'), 'resumen del versus');
});
