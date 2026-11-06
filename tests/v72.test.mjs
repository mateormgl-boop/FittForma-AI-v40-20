// v72: normas de la comunidad (aceptación antes de publicar) y recordatorios nativos en la app de Android.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const read = p => readFileSync(p, 'utf8');
const root = process.cwd();
await import(path.join(root, 'native-notify.js'));
const N = globalThis.FittFormaNativeNotify;
const html = read('index.html'), community = read('community.js'), server = read('backend/server.mjs'), sw = read('sw.js');

test('v72: puente de notificaciones — en el navegador no hace nada', async () => {
  delete globalThis.Capacitor;
  assert.equal(N.available(), false);
  assert.equal(await N.permission(true), 'unavailable');
  assert.equal(await N.replace('workout', [{ at: new Date(Date.now() + 3600e3), title: 'x' }]), 0);
});

test('v72: puente de notificaciones — prepara solo avisos futuros, ordenados y dentro de su rango', () => {
  const now = Date.now(), at = h => new Date(now + h * 3600e3);
  const list = N.prepare('water', [{ at: at(3), title: 'C' }, { at: at(-1), title: 'pasado' }, { at: at(1), title: 'A', body: 'cuerpo' }, { at: new Date(now + 5000), title: 'muy pronto' }, { at: at(2) }, { at: 'mañana', title: 'sin fecha' }]);
  assert.deepEqual(list.map(n => n.title), ['A', 'C'], 'sin pasados, sin los de menos de 20 s, sin título o sin fecha válida');
  assert.deepEqual(list.map(n => n.id), [72000, 72001]);
  assert.equal(list[0].schedule.allowWhileIdle, true);
  assert.equal(list[0].smallIcon, 'ic_stat_fittforma');
  const many = N.prepare('workout', Array.from({ length: 150 }, (_, i) => ({ at: at(i + 1), title: 'x' })));
  assert.equal(many.length, 100, 'no pasa del rango de entrenamiento (71000–71099)');
  assert.equal(many.at(-1).id, 71099);
  assert.deepEqual(N.prepare('otro', [{ at: at(1), title: 'x' }]), [], 'grupo desconocido');
});

test('v72: puente de notificaciones — en Android reemplaza solo su grupo y respeta el permiso', async () => {
  const calls = [];
  let pending = [{ id: 71003 }, { id: 72001 }, { id: 5 }];
  let display = 'prompt';
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: {
    checkPermissions: async () => ({ display }),
    requestPermissions: async () => { display = 'granted'; return { display }; },
    getPending: async () => ({ notifications: pending }),
    cancel: async ({ notifications }) => { calls.push(['cancel', notifications.map(n => n.id)]); pending = pending.filter(p => !notifications.some(n => n.id === p.id)); },
    schedule: async ({ notifications }) => { calls.push(['schedule', notifications.map(n => n.id)]); pending.push(...notifications); },
  } } };
  try {
    assert.equal(N.available(), true);
    assert.equal(await N.permission(false), 'prompt', 'sin pedir, no cambia el permiso');
    assert.equal(await N.permission(true), 'granted');
    const n = await N.replace('workout', [{ at: new Date(Date.now() + 7200e3), title: 'Hoy toca' }]);
    assert.equal(n, 1);
    assert.deepEqual(calls[0], ['cancel', [71003]], 'solo cancela los avisos de entrenamiento');
    assert.deepEqual(calls[1], ['schedule', [71000]]);
    assert.ok(pending.some(p => p.id === 72001) && pending.some(p => p.id === 5), 'no toca los del agua ni los ajenos');
    assert.equal((await N.pending('workout')).length, 1);
  } finally { delete globalThis.Capacitor; }
});

test('v72: la app de Android programa los recordatorios en el sistema y no duplica con los avisos web', () => {
  assert.match(html, /<script src="\.\/native-gps\.js"><\/script>\n<script src="\.\/native-notify\.js"><\/script>/);
  assert.match(server, /'\/native-notify\.js'/);
  assert.match(sw, /"\.\/native-notify\.js"/);
  assert.match(html, /async function checkWorkoutReminders\(\)\{\n\s+if\(nativeNotify\(\)\)return;/, 'en Android avisa el sistema, no el chequeo con la app abierta');
  assert.match(html, /async function checkWaterReminder\(\)\{\n\s+if\(nativeNotify\(\)\)return;/);
  assert.match(html, /for\(let i=0;i<14;i\+\+\)/, '14 días de entrenamiento');
  assert.match(html, /if\(i===0&&workoutLoggedOn\(today\)\)continue;/, 'si hoy ya entrenaste, no avisa hoy');
  assert.match(html, /if\(i===0&&waterMl\(today\)>=h\.goalMl\)continue;/, 'si llegaste al objetivo de agua, no avisa hoy');
  assert.match(html, /if\(nativeNotifyPerm!=='granted'\)\{renderNativeReminderStatus\(\[\]\)/, 'sin permiso no programa (así no aparece un pedido de permiso sorpresa)');
  assert.match(html, /scheduleCloudBackup\(\);queueNativeReminderSync\(\);return true;/, 'cada cambio vuelve a armar los avisos');
});

test('v72: proyecto de Android con el plugin oficial de notificaciones y su ícono', () => {
  const pkg = JSON.parse(read('mobile/package.json'));
  assert.equal(pkg.dependencies['@capacitor/local-notifications'], '8.3.1');
  assert.equal(pkg.dependencies['@capacitor/core'], '8.5.3');
  const cfg = JSON.parse(read('mobile/capacitor.config.json'));
  assert.equal(cfg.plugins.LocalNotifications.smallIcon, 'ic_stat_fittforma');
  assert.ok(existsSync('mobile/android/app/src/main/res/drawable/ic_stat_fittforma.xml'));
  assert.match(read('mobile/android/app/src/main/res/drawable/ic_stat_fittforma.xml'), /<vector[\s\S]*android:fillColor="#FFFFFFFF"/, 'ícono blanco (Android lo tiñe)');
  assert.match(read('mobile/android/capacitor.settings.gradle'), /include ':capacitor-local-notifications'/);
  assert.match(read('mobile/android/app/capacitor.build.gradle'), /implementation project\(':capacitor-local-notifications'\)/);
});

test('v72: normas de la comunidad antes de cualquier contenido propio', () => {
  for (const fn of ['saveProfile', 'changeAvatar', 'createPost', 'createKindPost', 'addComment', 'sendMessage', 'shareActivity']) {
    const body = community.slice(community.indexOf(`async function ${fn}(`), community.indexOf(`async function ${fn}(`) + 900);
    assert.match(body, /requireRules\(/, `${fn} pide aceptar las normas`);
  }
  assert.match(community, /const RULES_VERSION=1,RULES_KEY='fittforma-community-rules-v1'/);
  assert.match(community, /from\('community_rules_acceptance'\)\.upsert\(\{user_id:user\.id,rules_version:RULES_VERSION\},\{onConflict:'user_id'\}\)/);
  assert.match(community, /if\(error\)\{if\(missingTable\(error\)\)rulesServer=-1;return false;\}/, 'sin la migración, sigue con lo guardado en el teléfono');
  assert.match(html, /<dialog class="auth-sheet rules-sheet" id="communityRulesDialog"/);
  assert.match(html, /id="communityRulesAccept" disabled>Aceptar y seguir/, 'no se puede aceptar sin marcar la casilla');
  assert.match(html, /data-open-community-rules>Normas de la comunidad<\/button>/, 'se pueden leer desde Ajustes');
  assert.match(html, /href="\/normas\.html" target="_blank" rel="noopener" id="communityRulesLink"/);
});

test('v72: migración aditiva con RLS y página pública de normas', () => {
  const sql = read('supabase/migrations/2026-11-05_v72_community_rules.sql');
  assert.match(sql, /create table if not exists public\.community_rules_acceptance/);
  assert.match(sql, /references auth\.users\(id\) on delete cascade/, 'se borra al eliminar la cuenta');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.community_rules_acceptance from public, anon, authenticated;/, 'quita los permisos que Supabase da por defecto');
  assert.match(sql, /grant update \(user_id, rules_version\)/, 'la fecha no se puede tocar');
  assert.match(sql, /new\.accepted_at := now\(\);/, 'la fecha la pone la base');
  assert.doesNotMatch(sql, /drop table|delete from|truncate|disable row level security/i);
  assert.match(read('supabase/APLICAR_MIGRACIONES.sql'), /2026-11-05_v72_community_rules\.sql/);
  assert.match(server, /'\/normas\.html'/);
  const page = read('normas.html');
  for (const part of ['Qué no está permitido', 'Si ves algo que no cumple estas normas', 'Qué pasa si alguien no cumple', 'Edad mínima', 'al menos 13 años', 'Tu contenido', 'Cambios'])
    assert.ok(page.includes(part), `normas.html: «${part}»`);
  assert.match(page, /<script src="\/legal-config\.js"><\/script>/, 'usa el mismo contacto que la política de privacidad, sin inventarlo');
});
