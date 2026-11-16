// v75–v79: menos scroll, compartir e invitar, gasto real estimado, base más rápida y la etapa nueva
// (calentamiento sugerido y comparar fotos).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), css = read('design.css'), sw = read('sw.js'), server = read('backend/server.mjs'), i18n = read('i18n-v53.js'), community = read('community.js');
await import(path.join(root, 'body-goals.js'));
await import(path.join(root, 'training-core.js'));
const B = globalThis.FittFormaBody, T = globalThis.FittFormaTraining;
const day = n => { const d = new Date('2026-11-16T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

test('v75: Ejercicios agrupados por músculo y plegados cuando no se busca ni se filtra', () => {
  assert.match(html, /const grouped=filtered\.length&&!q&&g==='all'&&kind==='all'&&lv==='all'&&sort==='default'&&!exerciseFavoritesOnly;/);
  assert.match(html, /<details class="ex-group"\$\{exerciseGroupsOpen\.has\(name\)\?' open':''\}/);
  assert.match(css, /#exerciseLibraryResults\.is-grouped\{display:grid!important;grid-template-columns:1fr!important/);
});

test('v75: historial de a 10, registrar con botones arriba, Correr ordenado, Progreso y Músculos plegados, recetas de a 6', () => {
  assert.match(html, /let historyShown=10;/);
  assert.match(html, /state\.sessions\.slice\(0,historyShown\)/);
  assert.match(html, /data-history-more>Ver más/);
  for (const [card, label] of [['mealFormCard', 'Escribir'], ['foodFinder', 'Buscar'], ['barcodeCard', 'Escanear'], ['photoMealCard', 'Foto'], ['mealFavoritesAnchor', 'Favoritas']]) {
    assert.match(html, new RegExp(`data-reg-go="${card}"[^>]*>(?:<svg[\\s\\S]*?</svg>)<b>${label}</b>`), label);
    assert.match(html, new RegExp(`id="${card}"`), card);
  }
  const gps = html.indexOf('id="gpsTrackingCard"'), start = html.indexOf('id="gpsStart"'), stats = html.indexOf('class="stats gps-stats"');
  assert.ok(gps < start && start < stats, '«Iniciar GPS» antes de los números');
  assert.match(html, /<details class="gps-more"><summary>Privacidad y cómo funciona el GPS<\/summary>/);
  assert.equal((html.match(/<div class="eyebrow">Registro sin GPS<\/div>/g) || []).length, 1, 'un solo registro sin GPS');
  assert.match(html, /data-manual-kind="Correr"[\s\S]*data-manual-kind="Caminar"[\s\S]*data-manual-kind="Bicicleta"/);
  assert.match(html, /<form id="activityForm" hidden>/);
  assert.match(html, /<details class="run-plan-weeks"><summary>Ver las semanas del plan<\/summary><div id="runningPlanOutput"/);
  assert.match(html, /<details class="progress-more card"><summary><span><b>Más estadísticas<\/b>/);
  assert.match(html, /<details class="mr-zone" data-mr-zone=/);
  assert.match(html, /<details class="badge-help"><summary>¿Qué significa cada estado\?<\/summary>/);
  assert.match(html, /\(recipesAll\?list:list\.slice\(0,6\)\)/);
});

test('v76: imagen para compartir e invitación, sin datos personales ni servidores', () => {
  const card = read('share-card.js');
  assert.ok(server.includes("'/share-card.js'"), 'el servidor la publica');
  assert.ok(sw.includes('"./share-card.js"'), 'funciona sin conexión');
  assert.match(html, /<script src="\.\/share-card\.js"><\/script>/);
  assert.doesNotMatch(card, /fetch\(|XMLHttpRequest|sendBeacon/, 'la imagen se arma en el teléfono');
  assert.match(card, /nav\?\.canShare\?\.\(\{ files: \[file\] \}\)/);
  assert.match(html, /id="summaryShareImage" type="button">Compartir como imagen<\/button>/);
  assert.match(html, /<div class="cm-invite" id="communityInvite">/);
  assert.match(community, /data-invite>Invitar a un amigo<\/button>/);
  globalThis.FittFormaI18n = undefined;
  const m = globalThis.FittFormaShareCard?.metricsOf ? globalThis.FittFormaShareCard.metricsOf : null;
  if (m) assert.deepEqual(m({ minutes: 0, sets: 3 }).map(x => x[0]), ['3']);
});

test('v77: gasto real estimado con comidas y tendencia del peso', () => {
  const meals = Array.from({ length: 21 }, (_, i) => ({ date: day(i + 1), calories: 2300 }));
  const weights = Array.from({ length: 28 }, (_, i) => ({ date: day(27 - i), kg: 80 - i * 0.05 }));
  const r = B.adaptiveExpenditure(meals, weights, '2026-11-16');
  assert.equal(r.ok, true);
  assert.equal(r.avgIntake, 2300);
  assert.equal(r.weeklyKg, -0.35);
  assert.equal(r.tdee, 2690, '2300 + 0,35/7 × 7700');
  assert.equal(r.confidence, 'alta');
  assert.equal(B.adaptiveExpenditure(meals.slice(0, 5), weights, '2026-11-16').reason, 'few-meals');
  assert.equal(B.adaptiveExpenditure(meals, weights.slice(0, 2), '2026-11-16').reason, 'few-weights');
  assert.equal(B.adaptiveExpenditure(meals.map(m => ({ ...m, calories: 500 })), weights, '2026-11-16').reason, 'few-meals', 'días incompletos no cuentan');
  const rising = Array.from({ length: 28 }, (_, i) => ({ date: day(27 - i), kg: 80 + i * 0.05 }));
  assert.equal(B.adaptiveExpenditure(meals.map(m => ({ ...m, calories: 900 })), rising, '2026-11-16').reason, 'inconsistent', 'comer 900 kcal y subir de peso no cierra');
  const today = [...meals, { date: '2026-11-16', calories: 5000 }];
  assert.equal(B.adaptiveExpenditure(today, weights, '2026-11-16').avgIntake, 2300, 'el día de hoy (incompleto) no cuenta');
  assert.equal(B.suggestedCalories(2690, 'lose'), 2250);
  assert.equal(B.suggestedCalories(2690, 'gain'), 2950);
  assert.equal(B.suggestedCalories(2690, 'maintain'), 2700);
  assert.match(html, /<div class="card adaptive-card" id="adaptiveCard"><\/div>/);
  assert.match(html, /renderCompleteDay\(\);renderAdaptiveTdee\(\);/);
  assert.match(html, /<img class="meal-thumb" src="\.\/assets\/illustrations\/meal-\$\{/, 'íconos por tipo de comida');
});

test('v78: migración de rendimiento aditiva y con prueba RLS', () => {
  const sql = read('supabase/migrations/2026-11-16_v78_performance_security.sql');
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|policy)|disable row level security|delete from|truncate/i, 'no borra nada ni apaga RLS');
  for (const ix of ['community_reports_resolved_by_idx', 'community_reports_post_id_idx', 'monetization_play_purchases_user_id_idx', 'community_saved_posts_post_id_idx', 'community_notifications_actor_id_idx']) assert.match(sql, new RegExp(`create index if not exists ${ix}`));
  assert.match(sql, /alter policy %I on %I\.%I/);
  assert.match(read('supabase/tests/rls_v78_test.sql'), /PRUEBAS v78 PASARON/);
  assert.ok(read('supabase/APLICAR_MIGRACIONES.sql').includes('2026-11-16_v78_performance_security.sql'));
});

test('v79: calentamiento sugerido y comparar dos fotos', () => {
  assert.deepEqual(T.warmupSets(80), [{ pct: 50, reps: 8, kg: 40 }, { pct: 70, reps: 5, kg: 55 }]);
  assert.deepEqual(T.warmupSets(21), [{ pct: 50, reps: 8, kg: 10 }, { pct: 70, reps: 5, kg: 15 }]);
  assert.deepEqual(T.warmupSets(15), [], 'con poco peso no hace falta');
  assert.deepEqual(T.warmupSets('x'), []);
  assert.match(html, /<p class="warmup-hint"><b>Calentamiento sugerido<\/b>/);
  assert.match(html, /const warm=ei===activeSession\.exercises\.findIndex\(x=>x\.kind!=='cardio'&&sessionUsesLoad\(x\)\)/, 'solo en el primer ejercicio con carga');
  assert.match(html, /<details class="photo-compare"/);
});

test('v75–v79: textos traducidos', () => {
  for (const s of ['Escribir', 'Escanear', 'Guardar una actividad', 'Privacidad y cómo funciona el GPS', 'Ver las semanas del plan', 'Más estadísticas', 'Compartir como imagen', 'Invitá a un amigo', 'Tu gasto real estimado', 'Cuánto gastás por día', 'Calentamiento sugerido', 'Comparar dos fotos', 'Para ganar músculo', 'Proteína 30 %'])
    assert.ok(i18n.includes(`["${s}"`), s);
});
