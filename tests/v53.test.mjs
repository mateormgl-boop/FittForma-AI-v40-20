// v53: Comunidad de deportistas — estadísticas públicas (sin datos corporales), rankings por categoría y comparación.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = file => { const ctx = { window: {} }; ctx.globalThis = ctx; vm.runInNewContext(readFileSync(file, 'utf8'), ctx); return ctx; };
const sctx = load('athlete-stats.js'), S = sctx.FittFormaAthleteStats || sctx.window.FittFormaAthleteStats;
const html = readFileSync('index.html', 'utf8');
const community = readFileSync('community.js', 'utf8');
const sql = readFileSync('supabase/migrations/2026-10-27_v53_athlete_community.sql', 'utf8');
const sqlCode = sql.replace(/--[^\n]*/g, '');

const set = (reps, weight = '', done = true) => ({ reps: String(reps), weight: String(weight), done });
const sess = (date, exercises, status = 'completed') => ({ date, status, exercises });
const ex = (name, entries) => ({ name, entries });
const canonical = n => ({ 'Plancha con apoyo de antebrazos': 'Plancha frontal' }[n] || n);

test('estadísticas: constancia y entrenamientos de los últimos 30 días con registros reales', () => {
  const r = S.compute({
    today: '2026-10-27',
    sessions: [sess('2026-10-27', []), sess('2026-10-27', []), sess('2026-10-10', []), sess('2026-09-20', []), sess('2026-10-26', [], 'partial')],
    activities: [{ date: '2026-10-25', type: 'Caminar', distance: 3, minutes: 40 }]
  });
  assert.equal(S.windowStart('2026-10-27'), '2026-09-28');
  assert.equal(r.workouts_30d, 4, 'tres sesiones completas en la ventana + una actividad; la parcial no cuenta');
  assert.equal(r.active_days_30d, 3, 'días distintos');
  assert.equal(r.workouts_total, 5);
  assert.equal(r.stats_date, '2026-10-27');
});

test('estadísticas: running solo con carreras plausibles de los últimos 30 días', () => {
  const r = S.compute({ today: '2026-10-27', activities: [
    { date: '2026-10-20', type: 'Correr', distance: 5.2, minutes: 30 },
    { date: '2026-10-21', type: 'Correr', distance: 10, minutes: 12 },   // 1,2 min/km: imposible, se descarta
    { date: '2026-08-01', type: 'Correr', distance: 8, minutes: 45 },    // fuera de la ventana
    { date: '2026-10-22', type: 'Caminar', distance: 4, minutes: 50 }
  ] });
  assert.equal(r.run_count_30d, 1); assert.equal(r.run_km_30d, 5.2); assert.equal(r.run_minutes_30d, 30);
  assert.ok(r.run_minutes_30d >= r.run_km_30d * 2.5, 'cumple el CHECK del servidor');
});

test('estadísticas: mejores series solo del mismo ejercicio, sin lastre y completadas', () => {
  const r = S.compute({ today: '2026-10-27', canonical, sessions: [
    sess('2026-10-01', [ex('Flexiones clásicas', [set(25), set(40, '', false), set(60, '10')]), ex('Flexiones diamante', [set(50)])]),
    sess('2026-10-02', [ex('Dominadas', [set(8)]), ex('Dominadas asistidas', [set(20)])]),
    sess('2026-10-03', [ex('Sentadilla al aire', [set(30)]), ex('Sentadilla goblet', [set(15, '20')])], 'partial'),
    sess('2026-10-04', [ex('Plancha con apoyo de antebrazos', [set(95)])])
  ] });
  assert.equal(r.best_pushups, 25, 'no cuenta la serie sin completar, la serie con lastre ni otra variante');
  assert.equal(r.best_pullups, 8, 'las dominadas asistidas son otra métrica');
  assert.equal(r.best_air_squats, 30, 'las series hechas de una sesión parcial cuentan como récord');
  assert.equal(r.best_plank_seconds, 95, 'alias de la biblioteca resuelto a Plancha frontal');
});

test('estadísticas: nivel, rango, insignias y nada de datos corporales', () => {
  const badges = [{ payload: { exerciseId: 'run-5k', exerciseName: 'Correr 5 km', category: 'running', rank: 'silver', level: 3, measure: 'km', evidence: 'gps_device', earnedAt: '2026-10-20', threshold: 5 } },
    { payload: { exerciseId: 'push', exerciseName: 'Flexiones', category: 'strength', rank: 'bronze', level: 1, measure: 'reps', evidence: 'session', earnedAt: '2026-10-01' } }];
  const r = S.compute({ today: '2026-10-27', xp: 905, trainingLevel: 'intermediate', muscle: { overall: 3, ranked: 14 }, badges, weight: 80, height: 1.8, measurements: { waist: 80 } });
  assert.equal(r.xp_level, 4); assert.equal(r.training_level, 'intermediate'); assert.equal(r.overall_rank, 3); assert.equal(r.ranked_muscles, 14);
  assert.equal(r.badges_count, 2); assert.equal(r.badges[0].exerciseName, 'Correr 5 km'); assert.equal(r.badges[0].evidence, 'gps_device');
  assert.equal(S.compute({ trainingLevel: 'pro' }).training_level, null);
  const keys = Object.keys(r).join(' ');
  assert.doesNotMatch(keys, /weight|height|peso|altura|measure|waist|goal|photo|body/i, 'la fila no tiene datos corporales');
  assert.doesNotMatch(JSON.stringify(r.badges), /threshold/, 'de las insignias solo se comparte el logro');
});

test('estadísticas: respetan los topes y la coherencia que exige el servidor', () => {
  const many = Array.from({ length: 250 }, (_, i) => sess('2026-10-27', [ex('Flexiones clásicas', [set(5000)])]));
  const r = S.compute({ today: '2026-10-27', sessions: many, xp: 1e9 });
  assert.equal(r.workouts_30d, 180); assert.equal(r.active_days_30d, 1); assert.equal(r.best_pushups, 300); assert.equal(r.xp_level, 2000);
  assert.ok(r.active_days_30d <= r.workouts_30d && r.workouts_30d <= r.workouts_total && r.run_count_30d <= r.workouts_30d);
  for (const def of Object.values(S.EXERCISES)) assert.match(sql, new RegExp(`${def.column} \\w+ not null default 0 check \\(${def.column} between 0 and ${def.max}\\)`), `tope de ${def.column} igual en SQL`);
});

test('ranking: mismas categorías en la app y en el servidor, cada una con qué mide, período y orden', () => {
  const keys = S.CATEGORIES.map(c => c.key);
  assert.deepEqual([...keys].sort(), ['badges', 'constancy', 'level', 'plank', 'pullups', 'pushups', 'rank', 'running', 'squats']);
  const serverList = sqlCode.match(/p_category not in \(([^)]+)\)/)[1].replace(/'/g, '').split(',').map(s => s.trim()).sort();
  assert.deepEqual(serverList, [...keys].sort());
  for (const c of S.CATEGORIES) { assert.ok(c.label && c.measures && c.period && c.order, `categoría ${c.key} documentada`); assert.ok(c.measures.length > 30); }
  assert.match(sqlCode, /rank\(\) over \(order by c\.val desc, c\.tie desc\)/, 'el orden se calcula en el servidor');
  assert.equal(S.categoryValue('running', { run_km_30d: 5.5 }), 5.5);
});

test('comparación: misma métrica y unidad; lo que falta queda como «Sin datos disponibles» (null)', () => {
  const me = { stats_visible: true, stats_fresh: true, training_level: 'beginner', overall_rank: 2, xp_level: 3, badges_count: 4, active_days_30d: 10, workouts_30d: 12, run_km_30d: 0, run_minutes_30d: 0, best_pushups: 20, best_pullups: 0, best_air_squats: 0, best_plank_seconds: 60 };
  const friend = { stats_visible: true, stats_fresh: false, training_level: 'advanced', overall_rank: -1, xp_level: 7, badges_count: 9, active_days_30d: 20, workouts_30d: 25, run_km_30d: 12, run_minutes_30d: 70, best_pushups: 35, best_pullups: 5, best_air_squats: 40, best_plank_seconds: 0 };
  const rows = Object.fromEntries(S.compare(me, friend).map(r => [r.key, r]));
  assert.equal(rows.best_pushups.diff, -15);
  assert.equal(rows.overall_rank.theirs, null, 'sin rango todavía: no se compara');
  assert.equal(rows.active_days_30d.theirs, null, 'datos de 30 días desactualizados: no se comparan');
  assert.equal(rows.run_km_30d.mine, null, 'sin carreras: sin datos, no «0 km»');
  assert.equal(rows.best_plank_seconds.theirs, null);
  assert.equal(rows.training_level.diff, null, 'el nivel de entrenamiento no se resta');
  assert.equal(S.compare(me, { stats_visible: false }).every(r => r.theirs === null), true, 'estadísticas ocultas: nada');
  for (const r of S.COMPARE) assert.ok(r.label && r.period, `fila ${r.key} con período`);
});

test('Comunidad: abre en Todos, sin feed, y el mismo perfil completo desde las tres pestañas', () => {
  const view = html.slice(html.indexOf('id="view-community"'), html.indexOf('id="view-profile"'));
  const tabs = [...view.matchAll(/role="tab" data-community-tab="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ['world', 'ranking', 'friends']);
  assert.match(view, /id="communityTabWorld"[^>]*aria-selected="true"/);
  assert.match(community, /showCommunitySubView\('world'\);\n  \}/, 'vista inicial');
  assert.doesNotMatch(view, /communityFeed"|data-feed-mode|communityStories|Para vos/);
  for (const id of ['communityPeople', 'rankingList', 'rankingPodium', 'communityFriends', 'communityUserProfile', 'communityCompare', 'communityStatsPublic', 'communityOpenPublish']) assert.match(view, new RegExp(`id="${id}"`), id);
  assert.match(community, /function athleteCard\(/);
  assert.equal((community.match(/data-community-open-user="\$\{uid\}"/g) || []).length >= 3, true, 'tarjetas, podio y filas abren el perfil');
  assert.match(community, /\[data-community-open-user\]'\)\.forEach\(b=>b\.addEventListener\('click',\(\)=>openUser\(/);
});

test('privacidad: estadísticas solo por funciones del servidor, públicas por defecto y ocultables', () => {
  assert.doesNotMatch(community, /from\('community_athlete_stats'\)\.select\([^)]*\)(?!\.eq\('user_id',user\.id\))/, 'el cliente solo lee su propia fila');
  assert.match(community, /from\('community_athlete_stats'\)\.select\('stats_public,stats_date,updated_at'\)\.eq\('user_id',user\.id\)/);
  assert.match(sql, /stats_public boolean not null default true/);
  assert.match(sql, /revoke all on public\.community_athlete_stats from anon/);
  assert.doesNotMatch(sqlCode, /drop table|disable row level security|delete from|drop function|drop policy if exists (?!athlete_stats_)/i, 'migración aditiva');
  // v61 (pedido de la persona dueña): públicas desde el inicio. Se publican al iniciar sesión, sin esperar el aviso,
  // y nunca si la persona las ocultó.
  assert.match(community, /if\(ownStats\?\.stats_public===false\)return ownStats;/, 'si las ocultó, no se publican');
  assert.match(community, /if\(user&&user\.id!==wasId\)\{ownStats=null;ownStatsLoaded=false;statsSig='';setTimeout\(\(\)=>\{syncStats\(\)/, 'se publican al iniciar sesión');
  assert.match(html, /Tu peso, tu altura y tus objetivos son privados: solo se muestran los que actives en «Datos físicos». Nunca se publican tus medidas ni tus fotos de progreso/);
});

test('mensajes solo con seguimiento mutuo; seguir y bloquear siguen disponibles en el perfil', () => {
  assert.match(community, /mutual=fs==='accepted'&&p\.follows_me/);
  assert.match(community, /\$\{mutual\?'<button class="btn ghost" type="button" data-user-message>Mensaje<\/button>':''\}/);
  assert.match(community, /data-community-block>Bloquear/);
  assert.match(community, /data-user-follow/);
});

test('v53: archivos publicados, traducciones y versión', () => {
  const sw = readFileSync('sw.js', 'utf8'), server = readFileSync('backend/server.mjs', 'utf8'), i18n = readFileSync('i18n-v53.js', 'utf8');
  for (const f of ['athlete-stats.js', 'i18n-v53.js']) { assert.match(sw, new RegExp(`"\\./${f.replace('.', '\\.')}"`)); assert.match(server, new RegExp(`'/${f.replace('.', '\\.')}'`)); assert.match(html, new RegExp(`src="\\./${f.replace('.', '\\.')}"`)); }
  for (const s of ['Todos', 'Ranking', 'Amigos', 'Todavía no tenés amigos en tu comunidad', 'Sin datos disponibles', 'Tu progreso']) assert.ok(i18n.includes(`["${s}"`), s);
  for (const row of i18n.matchAll(/^\s*\[("[^\n]*")\],?$/gm)) assert.equal(JSON.parse(`[${row[1]}]`).length, 6, row[1].slice(0, 40));
  assert.match(sw, /fittforma-ai-static-v64-0/);
});

test('v53.1: rango por músculo validado (sin datos corporales) y misma regla en SQL', () => {
  assert.deepEqual({ ...S.muscleRanks({ biceps: 3, cuadriceps: 12, gluteos: -1, 'Mal Nombre': 2, peso: 'x' }) }, { biceps: 3, cuadriceps: 8, gluteos: -1 });
  const r = S.compute({ today: '2026-10-27', muscle: { overall: 2, ranked: 2, byMuscle: { biceps: 2, triceps: 1 } } });
  assert.deepEqual({ ...r.muscle_ranks }, { biceps: 2, triceps: 1 });
  const extras = readFileSync('supabase/migrations/2026-10-28_v53_profile_extras.sql', 'utf8'), code = extras.replace(/--[^\n]*/g, '');
  assert.match(code, /not between -1 and 8/);
  assert.match(code, /show_muscles boolean not null default true/);
  assert.doesNotMatch(code, /drop table|disable row level security|delete from|drop function/i, 'migración aditiva');
});

test('v53.1: «Mi físico» una cosa por sección; sin Plus cada 30 días, controlado en el servidor', () => {
  const code = readFileSync('supabase/migrations/2026-10-28_v53_profile_extras.sql', 'utf8').replace(/--[^\n]*/g, '');
  assert.match(code, /primary key \(user_id, kind\)/);
  assert.match(code, /kind in \('pair','single'\)/);
  assert.match(code, /interval '30 days'[\s\S]*not public\.monetization_is_plus\(new\.user_id\)/);
  assert.match(code, /revoke delete on public\.community_physique from anon, authenticated/, 'borrar y volver a subir no saltea el plazo');
  assert.match(code, /community_media_read_physique[\s\S]*community_viewer_can_see/, 'las fotos respetan la privacidad del perfil');
  assert.match(community, /Date\.parse\(row\.changed_at\)>Date\.now\(\)-30\*864e5/, 'la app avisa antes de subir');
  assert.match(community, /uploadImage\(file,paths\[0\]\)/, 'se recomprime y se quitan los metadatos');
});

test('v53.1: Todos, bandera, foto de perfil editable, «Ver cómo me ven» y acceso a Músculos desde Inicio', () => {
  assert.match(html, /role="tab" data-community-tab="world"[^>]*>Todos<\/button>/);
  assert.match(html, /id="communityCountry"/);
  assert.match(html, /id="communityOwnAvatarBtn"/);
  assert.match(html, /id="communityPhotoViewer"/);
  assert.match(html, /data-home-muscles[^>]*>[\s\S]{0,600}<b>Músculos<\/b>/);
  assert.match(html, /function showMuscles\(\)\{switchView\('progress'\);showProgressTab\('muscles'\);\}/);
  assert.match(community, /async function openUserLegacy\(uid,opts=\{\}\)\{\n\s+if\(!client\|\|!uid\)return;if\(user&&uid===user\.id&&!opts\.asOthers\)/, '«Ver cómo me ven» también sin la migración v53');
  assert.match(community, /return openUserLegacy\(uid,opts\)/);
  assert.match(community, /function flagEmoji\(/);
  const i18n = readFileSync('i18n-v53.js', 'utf8');
  for (const s of ['Mi físico', 'Mapa de músculos', 'Músculos', 'Bandera (opcional)']) assert.ok(i18n.includes(`["${s}"`), s);
});
