// v74: primera impresión. Bienvenida con dónde entrenás y experiencia, primer entrenamiento listo,
// Inicio y Entrenar con lo de hoy arriba, consejo de la semana y pantallas vacías con dibujo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), css = read('design.css'), sw = read('sw.js'), community = read('community.js'), i18n = read('i18n-v53.js');
const ILL = ['place-gym', 'place-home', 'place-bodyweight', 'empty-routines', 'empty-history', 'empty-body', 'empty-photos', 'empty-friends', 'tip-warmup', 'tip-water', 'tip-progress', 'tip-sleep', 'tip-protein', 'tip-rest'];

test('v74: los dibujos son SVG propios, livianos, sin imágenes externas ni scripts', () => {
  for (const n of ILL) {
    const f = `assets/illustrations/${n}.svg`;
    assert.ok(existsSync(path.join(root, f)), f);
    const svg = read(f);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 120 120" role="img"/, `${n}: SVG de 120×120`);
    assert.ok(svg.length < 4000, `${n}: liviano (${svg.length} bytes)`);
    assert.doesNotMatch(svg, /<script|<image|href=|url\(http|on[a-z]+=/i, `${n}: sin scripts ni recursos externos`);
    assert.ok(sw.includes(`"./assets/illustrations/${n}.svg"`), `${n}: guardado para usar sin conexión`);
  }
});

test('v74: bienvenida con «¿Dónde entrenás?», experiencia y primer entrenamiento listo', () => {
  for (const v of ['gym', 'home', 'bodyweight']) assert.match(html, new RegExp(`<label class="place-card"><input type="radio" name="welcomePlace" value="${v}"(?: checked)?><span class="place-box"><img src="\\./assets/illustrations/place-${v}\\.svg" alt=""`));
  for (const v of ['beginner', 'intermediate', 'advanced']) assert.match(html, new RegExp(`name="welcomeLevel" value="${v}"`));
  assert.match(html, /<fieldset class="welcome-choice"><legend>¿Dónde entrenás\?<\/legend>/);
  assert.match(html, /<button class="btn full welcome-cta" type="submit" id="welcomeSubmit">Armar mi plan<\/button>/);
  assert.match(html, /<div class="welcome-step welcome-ready" id="welcomeStep3" hidden>/);
  for (const id of ['welcomeStartNow', 'welcomeSeePlan', 'welcomeLater', 'welcomeReadyDay', 'welcomeReadyMeta', 'welcomeReadyList']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /equipment:choice\('welcomePlace',state\.profile\.equipment\),level:choice\('welcomeLevel',state\.profile\.level\)/, 'guarda equipamiento y experiencia');
  assert.match(html, /if\(!makePlan\(\{quiet:true\}\)\)\{/, 'arma el plan sin el aviso de siempre');
  assert.match(html, /\$\('welcomeStartNow'\)\.onclick=\(\)=>\{welcomeShown=false;closeWelcome\(\);startWorkout\(0\);\};/, '«Empezar ahora» sin el recorrido encima');
  assert.match(html, /function makePlan\(opts=\{\}\)\{[\s\S]*?if\(!opts\.quiet\)toast\('¡Rutina creada según tu objetivo, nivel y equipamiento!'\);\s*return Boolean\(state\.plan\?\.days\?\.length\);/);
  assert.match(css, /\.welcome\{overflow-y:auto;align-items:flex-start\}/, 'se puede desplazar en pantallas chicas');
  assert.match(css, /\.place-card input:checked\+\.place-box,\.level-pill input:checked\+span\{/);
  assert.match(css, /\.place-card input:focus-visible\+\.place-box/, 'foco visible con teclado');
});

test('v74: Entrenar con lo de hoy arriba y lo demás plegado', () => {
  assert.match(html, /<h3>¿Qué vas a entrenar hoy\?<\/h3>`\+dailyCardMarkup\(\)\+weekPlanMarkup\(\)\+/, 'el entrenamiento diario va primero');
  assert.match(html, /<details class="train-more" id="trainMore"\$\{trainMoreOpen\(\)\?' open':''\}><summary><span class="train-more-text"><b>Otras formas de entrenar<\/b>/);
  assert.match(html, /const TRAIN_MORE_KEY='fittforma-train-more-v74'/);
  assert.match(html, /<div class="week-plan" id="weekPlan">\$\{showToday\?`<div class="wp-today">\$\{todayBox\}<\/div>`:''\}<div class="wp-head">/, 'lo de hoy antes de los días');
  assert.match(html, /const showToday=rec\.source==='week'\|\|!state\.plan\?\.days\?\.length;/, 'con plan no repite una recomendación');
  assert.match(html, /<button type="button" class="btn" id="wpStartNow">Empezar<\/button><button type="button" class="btn ghost btn-sm" id="wpStartToday">Ver la sesión<\/button>/);
  assert.match(html, /function startWeekDayNow\(day\)\{/);
  assert.match(html, /setFocusDraft\(d\);openTrainMore\(\);\$\('focusPreview'\)/, '«Ver la sesión» abre lo plegado');
  for (const id of ['startFreeWorkout', 'openManualLog', 'goPlan', 'focusPicker']) assert.ok(html.includes(id), id);
});

test('v74: Inicio con lo de hoy y los accesos rápidos arriba, consejo de la semana y gym corto', () => {
  assert.match(html, /const HOME_DEFAULT_ORDER=\['today','tiles','week','summary','gym','badges','body','habits','recent','quote','stats'\];/);
  assert.match(html, /\['quote','Consejo de la semana'\]/);
  assert.doesNotMatch(html, /Disciplina hoy/, 'sin la frase fija');
  assert.match(html, /<section class="home-card home-tip" aria-labelledby="homeTipTitle"><img class="home-tip-img" id="homeTipImg"/);
  const tips = html.match(/const HOME_TIPS=\[([\s\S]*?)\n  \];/)[1];
  const imgs = [...tips.matchAll(/img:'([a-z]+)'/g)].map(m => m[1]);
  assert.deepEqual(imgs, ['warmup', 'water', 'progress', 'sleep', 'protein', 'rest'], 'un dibujo por consejo');
  for (const m of tips.matchAll(/title:'([^']+)',text:'([^']+)'/g)) for (const s of [m[1], m[2]]) assert.ok(i18n.includes(`["${s}"`), `traducido: ${s}`);
  assert.match(html, /return HOME_TIPS\[Math\.floor\(\(days\+3\)\/7\)%HOME_TIPS\.length\];/, 'cambia cada lunes');
  assert.match(html, /cta:'Empezar entrenamiento',action:'week:start'/, 'el botón grande empieza el entrenamiento de hoy');
  assert.match(html, /if\(parts\[1\]==='start'\)\{startWeekDayNow\(todayRecommendation\(\)\.day\);return;\}/);
  assert.match(html, /const all=gymSessions\(\),list=all\.slice\(0,1\);/, 'solo la última sesión');
  assert.match(html, /data-go="progress:history">Ver todo el historial<\/button>/);
});

test('v74: pantallas vacías con dibujo', () => {
  assert.match(html, /<div class="empty"><img src="\.\/assets\/illustrations\/empty-routines\.svg" alt="" width="72" height="72" loading="lazy"><strong>Todavía no tenés rutinas propias<\/strong>/);
  assert.match(html, /<div class="empty"><img src="\.\/assets\/illustrations\/empty-history\.svg"[^>]*><strong>Todavía no hay sesiones<\/strong>/);
  assert.match(html, /<div class="empty empty-sm"><img src="\.\/assets\/illustrations\/empty-body\.svg"[^>]*><p class="muted small">Todavía no registraste medidas\./);
  assert.match(html, /<div class="empty empty-sm"><img src="\.\/assets\/illustrations\/empty-photos\.svg"[^>]*><p class="muted small">Sin fotos todavía\.[^']*<\/p><\/div>'/);
  assert.match(community, /<img class="cm-empty-img" src="\.\/assets\/illustrations\/empty-friends\.svg" alt="" width="72" height="72" loading="lazy"><strong>Todavía no tenés amigos en tu comunidad<\/strong>/);
  assert.match(community, /<img class="cm-empty-img"[^>]*><strong>Todavía no hay nada en tu muro<\/strong>/);
});

test('v74: textos nuevos traducidos', () => {
  for (const s of ['¿Dónde entrenás?', 'Tu experiencia', 'Armar mi plan', 'Tu primer entrenamiento está listo', 'Ver mi plan', 'Más tarde', 'Otras formas de entrenar', 'Ver todo el historial', 'Consejo de la semana', 'Si igual querés entrenar, abrí «Otras formas de entrenar».'])
    assert.ok(i18n.includes(`["${s}"`), s);
  assert.match(i18n, /\|Frase del día\|Consejo de la semana\|Tu constancia\)\$\//, '«Subir/Bajar Consejo de la semana» en Personalizar inicio');
});
