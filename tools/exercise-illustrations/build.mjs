// Ilustraciones individuales de cada ejercicio: posición inicial y posición final (1080×1080 PNG).
// Misma figura anatómica, misma cámara y mismo gimnasio en las dos; el texto se compone con tipografía real.
// Uso: node tools/exercise-illustrations/build.mjs <manifiesto.json> <carpeta-salida> [filtro]
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SPECS } from '../exercise-gifs/specs.mjs';
import { scene, background, renderSide, renderFront, FLOOR } from '../exercise-gifs/figure.mjs';
import { fitSpec } from '../exercise-gifs/fit.mjs';
import { pickPhases } from './phases.mjs';
import { OVERRIDES } from './overrides.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const [, , manifestPath, outRoot, filterArg] = process.argv;
const filter = filterArg ? new RegExp(filterArg, 'i') : null;
globalThis.window = globalThis;
await import(join(root, 'exercise-guides.js')); await import(join(root, 'anatomy.js')); await import(join(root, 'training-core.js'));
const GUIDES = new Map(window.FittFormaExerciseGuides.map(g => [g.name, g]));
const A = window.FittFormaAnatomy, T = window.FittFormaTraining;
const LIB = new Map(); for (const l of Object.values(T.LIBRARY)) for (const e of l) if (!LIB.has(e.name)) LIB.set(e.name, e);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const byName = new Map(SPECS.map(s => [s.name, s]));
const font = readFileSync(join(root, 'assets', 'fonts', 'inter-latin-wght.woff2')).toString('base64');
const logo = readFileSync(join(root, 'assets', 'brand', 'logo-mark.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Escena de la figura sin el fondo propio del GIF (el gimnasio lo dibuja la lámina).
function figureSvg(spec, phi) {
  const pose = spec.pose(phi), out = (spec.view === 'front' ? renderFront : renderSide)(pose, spec.m || [], spec.s || []);
  const env = spec.env ? spec.env(out.J, phi, pose) : {};
  const sh = spec.shadow === false ? null : { x: spec.shadowX ?? pose.hip.x, y: FLOOR + 3, w: spec.shadowW ?? 48 };
  const f = spec._fit;
  return scene({ back: env.back || '', fit: `<g filter="url(#vol)">${out.svg}</g>` + (env.front || '') }, sh, f.scale, f.cx, f.floorY)
    .replace(background(), '').replace('width="360" height="360"', 'width="100%" height="100%"');
}
// Spec de dos posturas fijas: fase < π = inicial, fase ≥ π = final (así el encuadre es común a las dos).
function stillSpec(spec) {
  const o = OVERRIDES[spec.name] || {}, ph = pickPhases(spec);
  if (o.swap) [ph.start, ph.end] = [ph.end, ph.start]; // el ejercicio se enseña empezando desde la otra punta
  const p0 = o.start ? o.start(spec) : spec.pose(ph.start), p1 = o.end ? o.end(spec) : spec.pose(ph.end);
  const pick = phi => phi < Math.PI;
  return { ...spec, pose: Object.assign(phi => pick(phi) ? p0 : p1, {}), env: spec.env ? (J, phi, pose) => spec.env(J, pick(phi) ? ph.start : ph.end, pose) : undefined, trail: false, _trail: null, _fit: undefined };
}

const BACK_ONLY = new Set(['dorsales', 'espalda_media', 'lumbares', 'gluteos', 'gluteo_medio', 'isquiotibiales', 'gemelos', 'trapecio', 'triceps', 'deltoides_posterior']);
function sides(m) { const back = m.filter(x => BACK_ONLY.has(x)).length, fr = m.length - back; return back && fr ? 'both' : back ? 'back' : 'front'; }
const LEVEL = ['', 'Principiante', 'Intermedio', 'Avanzado'];
function infoPanel(row, which) {
  const g = GUIDES.get(row.nombre), lib = LIB.get(row.nombre);
  if (g) return which === 'inicial'
    ? [['Cómo empezar', g.start], ['Evitá', g.errors?.[0]]]
    : [['Consejo', g.tips?.[0]], ['Respiración', g.breathing]];
  const items = [['Equipamiento', row.equipamiento]];
  if (lib) items.push(['Series y repeticiones', `${lib.sets} × ${lib.reps}`], ['Nivel', `${LEVEL[lib.level?.[0]] || ''}${lib.level?.[1] && lib.level[1] !== lib.level[0] ? ' a ' + LEVEL[lib.level[1]].toLowerCase() : ''}`]);
  else items.push(['Tipo', 'Cardio continuo o por intervalos según tu plan']);
  return items;
}

function cardHtml(row, spec, which, svg) {
  const m = spec.m || [], s = (spec.s || []).filter(x => !m.includes(x));
  const map = A.muscleMapSvg(m, s, { sides: sides([...m, ...s]), size: 'md' });
  const list = (ids, cls) => ids.map(id => `<li><i class="${cls}"></i>${esc(A.MUSCLES[id] || id)}</li>`).join('');
  const n = which === 'inicial' ? 1 : 2, label = which === 'inicial' ? 'Posición inicial' : 'Posición final';
  const info = infoPanel(row, which).filter(([, v]) => v).map(([k, v]) => `<div class="it"><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1080px;overflow:hidden;font-family:Inter,sans-serif;color:#eaf2ff;background:#060b14}
.bg{position:absolute;inset:0;background:
  radial-gradient(ellipse 60% 42% at 50% 46%,rgba(46,110,200,.28),transparent 70%),
  linear-gradient(180deg,#0a1424 0%,#0b1626 52%,#070d18 62%,#04070d 100%)}
.wall{position:absolute;left:0;right:0;top:120px;height:${668 - 120}px;background:
  repeating-linear-gradient(90deg,transparent 0 118px,rgba(8,14,24,.9) 118px 132px,transparent 132px 150px),
  repeating-linear-gradient(90deg,rgba(255,255,255,.018) 0 2px,transparent 2px 24px);opacity:.9;filter:blur(1.2px)}
.lights{position:absolute;left:0;right:0;top:34px;height:60px}
.lights i{position:absolute;top:0;height:5px;border-radius:4px;background:#7cc4ff;box-shadow:0 0 18px 6px rgba(70,160,255,.55),0 0 60px 18px rgba(40,120,255,.25)}
.rack{position:absolute;left:0;right:0;top:${668 - 120}px;height:120px;filter:blur(2.4px);opacity:.55}
.mark{position:absolute;right:70px;top:250px;width:230px;opacity:.07;filter:blur(.6px)}
.floor{position:absolute;left:0;right:0;top:668px;bottom:0;background:linear-gradient(180deg,#0e1828 0%,#070c15 60%,#04070c 100%);overflow:hidden}
.floor svg{position:absolute;inset:0}
.edge{position:absolute;left:0;right:0;top:666px;height:3px;background:linear-gradient(90deg,transparent,rgba(90,170,255,.55),transparent)}
.fig{position:absolute;left:170px;top:150px;width:740px;height:740px;filter:drop-shadow(-3px -2px 5px rgba(90,170,255,.45)) drop-shadow(0 16px 18px rgba(0,0,0,.55))}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse 80% 75% at 50% 45%,transparent 55%,rgba(0,0,0,.55) 100%)}
.top{position:absolute;left:0;right:0;top:0;height:230px;background:linear-gradient(180deg,rgba(4,8,15,.92),rgba(4,8,15,.55) 60%,transparent)}
.brand{position:absolute;left:44px;top:42px;display:flex;align-items:center;gap:12px;font-size:30px;font-weight:800;letter-spacing:-.01em}
.brand svg{width:54px;height:54px}.brand span{color:#2f8dff}
.step{position:absolute;left:44px;top:118px;display:flex;align-items:center;gap:12px;padding:8px 22px 8px 8px;border-radius:999px;border:2px solid #2f8dff;background:rgba(9,22,44,.85);box-shadow:0 0 24px rgba(47,141,255,.35);font-size:24px;font-weight:700}
.step b{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1f7bff,#39b6ff);font-size:22px}
.title{position:absolute;right:44px;top:40px;max-width:560px;text-align:right}
.title h1{font-size:44px;line-height:1.05;font-weight:800;letter-spacing:-.015em}
.title .rule{height:3px;width:220px;margin:12px 0 12px auto;background:linear-gradient(90deg,transparent,#2f8dff)}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:999px;border:2px solid #2f8dff;background:rgba(9,22,44,.8);font-size:20px;font-weight:700}
.pill i{width:10px;height:10px;border-radius:50%;background:#ff5a3c;box-shadow:0 0 8px #ff5a3c}
.panel{position:absolute;bottom:24px;height:188px;border-radius:22px;border:1.5px solid rgba(64,150,255,.55);background:linear-gradient(160deg,rgba(12,26,48,.92),rgba(6,13,26,.94));box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 0 30px rgba(40,120,255,.08)}
.mus{left:28px;width:470px;display:flex;gap:14px;padding:14px 18px}
.mus .map{width:${'${MAPW}'}px;flex:none;display:flex;align-items:center}
.anatomy-map{width:100%;height:150px}
.am-body{fill:#2a3a52}.am-m{fill:#3a4d68;stroke:#14202f;stroke-width:.6}.am-m.is-primary{fill:#ff4a2e}.am-m.is-secondary{fill:#ffa04d}.am-cap{display:none}
.mus h3,.inf h3{font-size:19px;font-weight:800;color:#4aa6ff;margin-bottom:8px}
.mus ul{list-style:none;font-size:18px;line-height:1.45;font-weight:600}
.mus li i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:9px;vertical-align:1px}
.mus li i.p{background:#ff4a2e}.mus li i.s{background:#ffa04d}
.inf{left:516px;right:28px;padding:13px 20px;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.it b{display:block;font-size:15px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#4aa6ff;margin-bottom:2px}
.it p{font-size:var(--fs,18px);line-height:1.32;font-weight:500;color:#dbe7f7}
</style></head><body>
<div class="bg"></div><div class="wall"></div>
<div class="lights">${[90, 300, 520, 740, 950].map((x, i) => `<i style="left:${x - 70}px;width:${140 - (i % 2) * 30}px"></i>`).join('')}</div>
<svg class="rack" viewBox="0 0 1080 120" preserveAspectRatio="none">${Array.from({ length: 22 }, (_, i) => `<circle cx="${30 + i * 50}" cy="62" r="${15 + (i % 3) * 3}" fill="#152338" stroke="#24395a" stroke-width="3"/>`).join('')}<rect x="0" y="86" width="1080" height="8" fill="#0f1a2b"/><rect x="0" y="30" width="1080" height="6" fill="#0f1a2b"/></svg>
<div class="mark">${logo}</div>
<div class="floor"><svg viewBox="0 0 1080 412" preserveAspectRatio="none">${Array.from({ length: 15 }, (_, i) => { const x = 540 + (i - 7) * 70; return `<line x1="${x}" y1="0" x2="${540 + (i - 7) * 330}" y2="412" stroke="#13233a" stroke-width="2"/>`; }).join('')}${[18, 50, 98, 166, 260, 390].map(y => `<line x1="0" y1="${y}" x2="1080" y2="${y}" stroke="#13233a" stroke-width="2"/>`).join('')}<ellipse cx="540" cy="40" rx="420" ry="60" fill="rgba(60,140,255,.07)"/></svg></div>
<div class="edge"></div>
<div class="fig">${svg}</div>
<div class="vig"></div><div class="top"></div>
<div class="brand">${logo}<div>FittForma <span>AI</span></div></div>
<div class="step"><b>${n}</b>${label}</div>
<div class="title"><h1>${esc(row.nombre)}</h1><div class="rule"></div><span class="pill"><i></i>${esc(row.grupo_muscular)}</span></div>
<div class="panel mus"><div class="map">${map}</div><div><h3>Músculos principales</h3><ul>${list(m, 'p')}${list(s.slice(0, 3), 's')}</ul></div></div>
<div class="panel inf">${info}</div>
<script>
// Ajusta el tamaño del texto para que entre completo, sin cortar palabras. Se llama cuando la tipografía ya cargó.
window.fitText=()=>{
const box=document.querySelector('.inf');let fs=19;box.style.setProperty('--fs',fs+'px');while(box.scrollHeight>box.clientHeight&&fs>12){fs-=.5;box.style.setProperty('--fs',fs+'px');}
const t=document.querySelector('.title h1');let ts=44;while(t.offsetHeight>100&&ts>28){ts-=2;t.style.fontSize=ts+'px';}
const ul=document.querySelector('.mus ul');let us=18;while(ul.parentElement.scrollHeight>150&&us>13){us-=1;ul.style.fontSize=us+'px';}};
</script></body></html>`.replace("${'${MAPW}'}", sides([...m, ...s]) === 'both' ? '150' : '86');
}

const b = await chromium.launch();
const fitPage = await b.newPage({ viewport: { width: 360, height: 360 } });
const page = await b.newPage({ viewport: { width: 1080, height: 1080 } });
const report = [];
for (const row of manifest.ejercicios) {
  if (filter && !filter.test(row.nombre)) continue;
  const base = byName.get(row.nombre); if (!base) { report.push({ id: row.id, error: 'sin pose' }); continue; }
  const spec = stillSpec(base);
  await fitSpec(spec, fitPage, 4);
  const dir = join(outRoot, `${row.id}_${row.slug.replace(/-/g, '_')}`); mkdirSync(dir, { recursive: true });
  const checks = {};
  for (const [which, phi] of [['inicial', 0], ['final', Math.PI * 1.5]]) {
    await page.setContent(cardHtml(row, spec, which, figureSvg(spec, phi)), { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; window.fitText(); });
    checks[which] = await page.evaluate(() => { const i = document.querySelector('.inf'), m = document.querySelector('.mus'); return { textoCabe: i.scrollHeight <= i.clientHeight + 1, musculosCaben: m.scrollHeight <= m.clientHeight + 1 }; });
    const raw = join(dir, `${which}.raw.png`);
    await page.screenshot({ path: raw, clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    if (!process.env.KEEP_RAW) execFileSync('python3', ['-I', join(here, 'compress.py'), raw, join(dir, `${which}.png`)]);
  }
  report.push({ id: row.id, nombre: row.nombre, ...checks });
  process.stdout.write('.');
}
await b.close();
writeFileSync(join(outRoot, '..', 'render-report.json'), JSON.stringify(report, null, 1));
console.log(`\n${report.length} ejercicios`);
