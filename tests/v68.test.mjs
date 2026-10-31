// v68: «Cómo usar la app» (Más, Perfil e Inicio) y recorrido inicial después de la bienvenida.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8'), css = readFileSync('design.css', 'utf8'), i18n = readFileSync('i18n-v53.js', 'utf8');

test('guía: hoja con 10 secciones (v69 suma Ajustes), cada una con pasos y «Ir a…»', () => {
  const sheet = html.slice(html.indexOf('<dialog class="auth-sheet guide-sheet" id="guideSheet"'), html.indexOf('<div class="tour" id="tour"'));
  assert.equal((sheet.match(/<details class="guide-item">/g) || []).length, 10);
  for (const v of ['plan', 'train', 'routines', 'nutrition', 'running', 'progress', 'community', 'coach', 'profile', 'settings']) assert.match(sheet, new RegExp(`data-guide-go="${v}"`), v);
  assert.match(sheet, /data-tour-start>Ver el recorrido por la app</);
  assert.match(sheet, /no reemplazan a un profesional de la salud/);
});

test('se abre desde «Más», Perfil e Inicio', () => {
  assert.match(html, /id="moreGuide"><svg[^]*?<span>Cómo usar la app<small class="more-desc">/);
  assert.match(html, /id="guideCard"><h3>Cómo usar la app<\/h3>/);
  assert.match(html, /id="guideHint" hidden>[^]*?data-guide-open>Cómo usar la app</);
  assert.ok(html.includes('c.hidden=off||(state.sessions||[]).length>=3;'), 'solo para quien recién empieza, y se puede ocultar');
  assert.match(html, /initFeedbackUi\(\);initGuideUi\(\);/);
});

test('recorrido: 7 pasos (v69 suma Ajustes) sobre los botones reales, una sola vez, después de la bienvenida', () => {
  const tour = html.slice(html.indexOf('const TOUR=['), html.indexOf('];', html.indexOf('const TOUR=[')));
  assert.equal((tour.match(/\{sel:/g) || []).length, 7);
  for (const sel of ['.mobile-nav-item[data-mobile-view="plan"]', '.mobile-nav-item[data-mobile-view="train"]', '#settingsToggle', '#mobileMoreToggle']) {
    assert.ok(tour.includes(sel), sel);
    const target = sel.startsWith('#') ? `id="${sel.slice(1)}"` : sel.match(/\[(.+)\]/)[1];
    assert.ok(html.includes(target), `existe ${target}`);
  }
  assert.match(html, /const TOUR_KEY='fittforma-tour-v68'/);
  assert.match(html, /if\(welcomeShown\)\{welcomeShown=false;maybeStartTour\(\);\}/);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="tourTitle"/);
  assert.match(html, /if\(e\.key==='Escape'\)\{e\.preventDefault\(\);endTour\(\);\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.tour-ring\{transition:none\}\}/);
});

test('v68 traducido', () => {
  for (const s of ['Cómo usar la app', '¿Primera vez en FittForma?', 'Ver el recorrido por la app', 'Saltar', 'Siguiente', 'Entrená con amigos.', 'Ir a Entrenar']) assert.ok(i18n.includes(`["${s}"`), s);
  assert.match(i18n, /\^Paso \(\\d\+\) de \(\\d\+\)\$/);
});
