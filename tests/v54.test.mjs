// v54: semana actual, reto entre amigos, evolución semanal, avisos e historial privado de «Mi físico».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = file => { const ctx = { window: {} }; ctx.globalThis = ctx; vm.runInNewContext(readFileSync(file, 'utf8'), ctx); return ctx; };
const sctx = load('athlete-stats.js'), S = sctx.FittFormaAthleteStats || sctx.window.FittFormaAthleteStats;
const html = readFileSync('index.html', 'utf8'), community = readFileSync('community.js', 'utf8');
const sql = readFileSync('supabase/migrations/2026-10-29_v54_weekly_alerts.sql', 'utf8'), code = sql.replace(/--[^\n]*/g, '');

test('semana: de lunes a hoy, coherente con 30 días y con los topes del servidor', () => {
  assert.equal(S.weekStart('2026-10-26'), '2026-10-26'); assert.equal(S.weekStart('2026-10-29'), '2026-10-26'); assert.equal(S.weekStart('2026-11-01'), '2026-10-26');
  const r = S.compute({ today: '2026-10-29',
    sessions: [{ date: '2026-10-27', exercises: [] }, { date: '2026-10-27', exercises: [] }, { date: '2026-10-25', exercises: [] }, { date: '2026-10-28', exercises: [], status: 'partial' }],
    activities: [{ date: '2026-10-28', type: 'Correr', distance: 5, minutes: 30 }, { date: '2026-10-24', type: 'Correr', distance: 3, minutes: 20 }] });
  assert.equal(r.workouts_week, 3, 'dos sesiones del martes + la carrera del miércoles; la del domingo anterior y la parcial no');
  assert.equal(r.active_days_week, 2); assert.equal(r.run_km_week, 5);
  assert.ok(r.active_days_week <= r.workouts_week && r.active_days_week <= r.active_days_30d && r.workouts_week <= r.workouts_30d && r.run_km_week <= r.run_km_30d);
  assert.match(code, /active_days_week between 0 and 7 and workouts_week between 0 and 60 and run_km_week between 0 and 500/);
  assert.match(code, /new\.week_start := date_trunc\('week', new\.stats_date\)::date/, 'la semana la fija el servidor');
});

test('migración v54 aditiva; avisos creados solo por el servidor y privados', () => {
  assert.doesNotMatch(code, /drop table|disable row level security|delete from|drop function/i);
  assert.match(code, /revoke all on public\.community_notifications from anon, authenticated;\ngrant select, delete on public\.community_notifications to authenticated;\ngrant update \(read_at\)/);
  for (const k of ['follow', 'follow_request', 'follow_accepted', 'message', 'rank_passed']) assert.match(code, new RegExp(`'${k}'`));
  assert.match(code, /community_users_blocked\(p_user, p_actor\)/, 'sin avisos entre cuentas bloqueadas');
  assert.match(code, /revoke all on public\.community_athlete_weekly from anon, authenticated/, 'el historial semanal solo se lee por funciones');
  assert.match(code, /physique_history_select_own[\s\S]*user_id = auth\.uid\(\)/, 'el historial de «Mi físico» es privado');
});

test('interfaz v54: campanita, «Esta semana», reto, evolución e historial', () => {
  for (const id of ['communityTabAlerts', 'communityAlertsBadge', 'communityPanelAlerts', 'rankingPeriod', 'communityChallenge', 'communityPhysiqueHistory']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(community, /client\.rpc\('community_week_board',\{p_category:'active',p_scope:'friends',p_limit:10\}\)/);
  assert.match(community, /client\.rpc\('community_week_winners'\)/);
  assert.match(community, /client\.rpc\('community_weekly_history',\{p_user:meId,p_weeks:8\}\)/);
  assert.match(community, /client\.rpc\('community_notifications_list',\{p_limit:40\}\)/);
  assert.match(community, /Sin datos disponibles/);
  assert.match(community, /if\(oldPaths\.length&&v54Enabled===false\)/, 'con v54 las fotos anteriores van al historial');
  assert.match(community, /function upsertStats\(payload\)/, 'si falta una columna nueva, se publica el resto');
  const i18n = readFileSync('i18n-v53.js', 'utf8');
  for (const s of ['Avisos', 'Esta semana', 'Reto de la semana', 'Evolución semanal', 'Historial privado', 'empezó a seguirte']) assert.ok(i18n.includes(`["${s}"`), s);
});
