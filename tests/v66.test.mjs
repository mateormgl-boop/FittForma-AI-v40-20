// v66: Comunidad propia — muro de amigos (no es un feed general), aplausos y comentarios con aviso,
// actividades compartidas solo si la persona lo elige y desafíos del mes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const html = readFileSync('index.html', 'utf8'), css = readFileSync('design.css', 'utf8'), community = readFileSync('community.js', 'utf8');
const mig = readFileSync('supabase/migrations/2026-11-02_v66_wall_challenges.sql', 'utf8'), bundle = readFileSync('supabase/APLICAR_MIGRACIONES.sql', 'utf8');
const code = mig.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');

test('migración v66: aditiva, con RLS y en el paquete para pegar', () => {
  assert.doesNotMatch(code, /drop table|disable row level security|delete from|truncate|drop function|drop policy/i);
  assert.match(code, /add column if not exists activity jsonb/);
  assert.match(code, /community_post_kind_valid check \([\s\S]*post_kind='transformation'[\s\S]*post_kind='text'[\s\S]*post_kind='achievement'[\s\S]*post_kind='activity'/, 'los tipos de antes siguen valiendo');
  assert.match(code, /check \(kind in \('follow','follow_request','follow_accepted','message','rank_passed','applause','comment'\)\)/);
  assert.match(code, /revoke all on function public\.community_wall_ids\(timestamptz, integer\) from public, anon;/);
  assert.match(code, /revoke all on function public\.community_month_board\(\) from public, anon;/);
  assert.match(code, /f\.status = 'accepted'[\s\S]*community_users_blocked/, 'muro: solo seguimientos aceptados y sin bloqueos');
  assert.match(code, /s\.stats_public[\s\S]*f\.status = 'accepted'/, 'desafíos: solo quien muestra sus estadísticas');
  assert.ok(bundle.includes('2026-11-02_v66_wall_challenges.sql'), 'APLICAR_MIGRACIONES incluye v66');
});

test('actividad compartida: solo números registrados, carreras sin mapa, visible para seguidores', () => {
  assert.match(code, /k not in \('type','title','date','minutes','exercises','sets','volume_kg','distance_km','kcal','challenge','goal','value','month'\)/, 'sin claves de ruta ni datos corporales');
  assert.doesNotMatch(code, /'(route|points|lat|lng|weight|height)'/);
  assert.match(community, /post_kind:'activity',description:[^}]*activity:clean,visibility:'followers'/);
  assert.match(html, /function offerRunShare\(activity\)[\s\S]*?\(sin el mapa\)/);
  assert.doesNotMatch(html.slice(html.indexOf('function offerRunShare'), html.indexOf('function calculateWorkoutSummary')), /points|route|lat/);
  assert.match(html, /data-auth-open="login">Iniciar sesión<\/button><\/div>`\);return;\}/, 'sin cuenta: invita a iniciar sesión, no publica');
  assert.match(html, />Ahora no<\/button>/);
});

test('muro: pestaña propia, solo amigos y aplausos en lugar de «me gusta»', () => {
  const view = html.slice(html.indexOf('id="view-community"'), html.indexOf('id="view-profile"'));
  assert.match(view, /id="communityTabWall"[^>]*data-community-tab="wall"[^>]*>Muro<\/button>/);
  for (const id of ['communityPanelWall', 'communityWall', 'communityWallStatus', 'communityWallMore', 'communityMonth']) assert.match(view, new RegExp(`id="${id}"`), id);
  assert.match(community, /client\.rpc\('community_wall_ids',\{p_before:wallBefore,p_limit:15\}\)/);
  assert.ok(community.includes(`'Aplaudir'}" title="Aplausos">\${ICON.clap}`), 'botón «Aplaudir» con el ícono de aplausos');
  assert.match(community, /applause:'aplaudió tu publicación',comment:'comentó tu publicación'/);
  assert.match(community, /Todavía no hay nada en tu muro/);
});

test('desafíos del mes: metas fijas, avance propio y amigos que muestran sus estadísticas', () => {
  assert.match(community, /const MONTH_GOALS=\[\{key:'workouts',col:'workouts_month',goal:12[\s\S]*?key:'active_days',col:'active_days_month',goal:15[\s\S]*?key:'run_km',col:'run_km_month',goal:30/);
  assert.match(community, /client\.rpc\('community_month_board'\)/);
  assert.match(community, /shareActivity\(\{type:'challenge',challenge:g\.key,goal:g\.goal,value,month:m\}\)/);
  assert.match(code, /a->>'value'\)::numeric between \(a->>'goal'\)::numeric/, 'no se comparte un desafío sin cumplir');
});

test('estadísticas del mes: se calculan desde lo registrado en la app', () => {
  const require = createRequire(import.meta.url);
  globalThis.window = globalThis.window || {};
  require('../athlete-stats.js');
  const S = globalThis.window.FittFormaAthleteStats;
  assert.ok(S?.compute, 'FittFormaAthleteStats.compute');
  const now = new Date(), k = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = k(now), lastMonth = k(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  const st = S.compute({
    sessions: [{ date: today, status: 'completed', exercises: [{ name: 'Sentadilla', entries: [{ reps: '5', weight: '60', done: true }] }] },
      { date: today, status: 'completed', exercises: [{ name: 'Press', entries: [{ reps: '5', weight: '40', done: true }] }] },
      { date: lastMonth, status: 'completed', exercises: [{ name: 'Press', entries: [{ reps: '5', weight: '40', done: true }] }] }],
    activities: [{ date: today, type: 'Correr', distance: 5.5, minutes: 30 }],
  }, now);
  assert.equal(st.active_days_month, 1, 'dos entrenamientos el mismo día cuentan como un día activo');
  assert.ok(st.workouts_month >= 2 && st.workouts_month <= 3, 'el mes pasado no cuenta');
  assert.equal(st.run_km_month, 5.5);
});

test('v66 traducido y con estilos', () => {
  for (const s of ['Muro', 'Aplaudir', '¿Compartir con tus amigos?', 'Compartir con mis amigos', 'Desafíos del mes', 'Todavía no hay nada en tu muro']) assert.ok(i18n.includes(`"${s}"`), s);
  for (const c of ['.cm-activity', '.share-friends', '.cm-month-goal']) assert.ok(css.includes(c), c);
});
