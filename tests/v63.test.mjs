// v63: crear cuenta e iniciar sesión fácil — una sola pantalla para toda la app (bienvenida, Inicio, Más, Perfil y
// Comunidad), errores en palabras simples, recuperar la contraseña y aviso «¡Listo! Ya iniciaste sesión».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8'), community = readFileSync('community.js', 'utf8'), css = readFileSync('design.css', 'utf8');
const i18n = readdirSync('.').filter(f => /^i18n.*\.js$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');

test('una sola pantalla de cuenta, abierta desde toda la app', () => {
  assert.match(html, /<dialog class="auth-sheet" id="authSheet"/);
  for (const where of ['welcomeSignup', 'welcomeLogin', 'moreSignup', 'moreLogin', 'cloudLogin', 'cloudRegister'])
    assert.match(html, new RegExp(`id="${where}"[^>]*data-auth-open="(signup|login)"|data-auth-open="(signup|login)"[^>]*id="${where}"`), where);
  assert.match(html, /id="homeAccountCard" hidden/);
  assert.match(html, /id="communityAuthBanner" hidden/);
  assert.match(html, /document\.addEventListener\('click',e=>\{const b=e\.target\.closest\?\.\('\[data-auth-open\]'\)/);
  assert.match(html, /window\.FittFormaAuth=\{open:/);
});

test('sin formularios escondidos: Perfil y Comunidad ya no tienen su propio formulario', () => {
  for (const id of ['cloudEmail', 'cloudPassword', 'communityEmail', 'communityPassword', 'communityEmailAuthForm', 'communityGoogleLogin', 'welcomeHaveAccount'])
    assert.doesNotMatch(html, new RegExp(`id="${id}"`), id);
  assert.doesNotMatch(community, /async function emailLogin|async function emailRegister|async function googleLogin/);
  assert.doesNotMatch(html, /configurá SUPABASE_URL y SUPABASE_ANON_KEY en Render/, 'nada de instrucciones técnicas para quien usa la app');
});

test('errores claros, recuperar contraseña, reenviar confirmación y Google solo si está activado', () => {
  for (const s of ['El correo o la contraseña no coinciden', 'Tu cuenta todavía no está confirmada', 'Ya hay una cuenta con ese correo', 'Probaste muchas veces seguidas', 'No hay conexión'])
    assert.ok(html.includes(s), s);
  assert.match(html, /supabaseClient\.auth\.resetPasswordForEmail\(email,\{redirectTo:/);
  assert.match(html, /if\(_event==='PASSWORD_RECOVERY'\)setTimeout\(\(\)=>openAuth\('reset'\),200\)/);
  assert.match(html, /supabaseClient\.auth\.resend\(\{type:'signup',email/);
  assert.match(html, /\/auth\/v1\/settings'.*authGoogle=Boolean\(j\?\.external\?\.google\)/);
  assert.match(html, /!data\.user\.identities\.length/, 'correo ya registrado detectado aunque Supabase no lo informe como error');
});

test('al entrar, un aviso claro y nada más', () => {
  assert.match(html, /'¡Listo! Creaste tu cuenta y ya iniciaste sesión\.':'¡Listo! Ya iniciaste sesión\.'/);
  assert.match(html, /<div class="auth-done" id="authDone" role="status" aria-live="polite" hidden><\/div>/);
  assert.match(css, /\.auth-done\{position:fixed/);
});

test('el celular ayuda: autocompletar, teclado de correo, ver la contraseña y recordar el correo', () => {
  assert.match(html, /id="authEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="none"/);
  assert.match(html, /id="authShowPassword" aria-label="Mostrar la contraseña" aria-pressed="false"/);
  assert.match(html, /AUTH_EMAIL_KEY='fittforma-last-email'/);
  assert.match(css, /\.auth-body input\{min-height:48px;font-size:16px\}/, '16 px: el iPhone no hace zoom al escribir');
});

test('textos nuevos traducidos', () => {
  for (const s of ['Seguir sin cuenta', 'Creá tu cuenta', '¿Olvidaste tu contraseña?', '¡Listo! Ya iniciaste sesión.', 'Entrá a Comunidad', 'Guardá tu progreso', 'El correo o la contraseña no coinciden. Revisalos, o tocá «¿Olvidaste tu contraseña?».'])
    assert.ok(i18n.includes(JSON.stringify(s) + ','), s);
});
