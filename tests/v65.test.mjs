// v65: recordatorios de agua visibles (también en el calendario, que avisa con la app cerrada) y «Enviar una sugerencia».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8'), css = readFileSync('design.css', 'utf8');
const mig = readFileSync('supabase/migrations/2026-11-01_v65_feedback.sql', 'utf8'), bundle = readFileSync('supabase/APLICAR_MIGRACIONES.sql', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');

test('agua: tarjeta visible con 2, 3 o 4 avisos por día y calendario que avisa con la app cerrada', () => {
  assert.match(html, /<div class="hydro-remind" id="hydroRemind">/);
  for (const n of [2, 3, 4]) assert.match(html, new RegExp(`data-water-count="${n}">${n} por día`));
  assert.match(html, /const WATER_TIMES=\{2:\['11:00','16:00'\],3:\['11:00','15:00','19:00'\],4:\['10:30','13:30','16:30','19:30'\]\}/);
  assert.match(html, /'RRULE:FREQ=DAILY'/); assert.match(html, /a\.download='fittforma-agua\.ics'/);
  assert.match(html, /const count=r\.countDate===today\?Number\(r\.count\)\|\|0:0,perDay=waterPerDay\(\);if\(count>=perDay\)return;/);
  assert.doesNotMatch(html, /if\(document\.visibilityState==='visible'\)checkWaterReminder\(\)/, 'ya no exige tener la app en pantalla');
  assert.match(css, /\.hydro-remind\{/);
});

test('sugerencias: en Perfil y en «Más», solo con cuenta, sin datos de salud', () => {
  assert.match(html, /id="feedbackCard"[^]*data-feedback-open/);
  assert.match(html, /id="moreFeedback"/);
  assert.match(html, /<dialog class="auth-sheet feedback-sheet" id="feedbackSheet"/);
  assert.match(html, /supabaseClient\.from\('app_feedback'\)\.insert\(\{user_id:cloudUser\.id,category:feedbackKind,message:text\.slice\(0,1000\)/);
  assert.match(html, /if\(!cloudUser\)\{\$\('feedbackSheet'\)\.close\(\);openAuth\('login'/);
  assert.match(html, /No pongas datos de salud ni contraseñas/);
});

test('migración v65: aditiva, RLS, solo escritura propia y límite diario', () => {
  assert.doesNotMatch(mig, /\bdrop\s+(table|column|function)\b/i);
  assert.match(mig, /alter table public\.app_feedback enable row level security;/);
  assert.match(mig, /for insert to authenticated with check \(user_id = auth\.uid\(\)\)/);
  assert.match(mig, /revoke all on public\.app_feedback from anon, authenticated;/);
  assert.doesNotMatch(mig, /for select/i, 'nadie la lee desde la app');
  assert.match(mig, />= 5 then/);
  assert.ok(bundle.includes('2026-11-01_v65_feedback.sql'));
});

test('textos nuevos traducidos', () => {
  for (const s of ['Recordatorios para tomar agua', 'Agregar a mi calendario', 'Enviar una sugerencia', '¡Gracias! Recibimos tu mensaje.', 'Llegaste al máximo de 5 sugerencias por día. ¡Gracias! Probá mañana.'])
    assert.ok(i18n.includes(JSON.stringify(s) + ','), s);
});
