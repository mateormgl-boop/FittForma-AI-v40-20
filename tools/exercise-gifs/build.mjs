// Genera assets/exercises/gif/<slug>.gif para cada ejercicio (16 cuadros, ciclo completo) y el índice JS.
// Uso: node tools/exercise-gifs/build.mjs [filtro]
import { createRequire } from 'module';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SPECS } from './specs.mjs';
import { frameSvg } from './lib.mjs';
import { fitSpec } from './fit.mjs';
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const N = 16, filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
const outDir = join(root, 'assets', 'exercises', 'gif'), tmp = process.env.GIF_TMP || join(root, '.gif-frames');
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 360, height: 360 } });
const index = {};
for (const spec of SPECS) {
  const s = slug(spec.name); index[spec.name] = { file: `gif/${s}.gif`, muscles: spec.m || [], secondary: spec.s || [], view: spec.view };
  if (filter && !filter.test(spec.name)) continue;
  const dir = join(tmp, s); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  await fitSpec(spec, page, 16);
  // Ida y vuelta: pausa en la posición inicial y en la final para que se entienda el movimiento.
  const durations = Array.from({ length: N }, (_, i) => spec.pose.kind === 'rep' ? (i === 0 ? 520 : i === N / 2 ? 420 : 90) : 95);
  for (let i = 0; i < N; i++) { await page.setContent(`<html><body style="margin:0">${frameSvg(spec, (2 * Math.PI * i) / N)}</body></html>`); await page.screenshot({ path: join(dir, `${String(i).padStart(2, '0')}.png`), clip: { x: 0, y: 0, width: 360, height: 360 } }); }
  execFileSync('python3', ['-I', join(here, 'assemble.py'), dir, join(outDir, `${s}.gif`), JSON.stringify(durations)]);
  process.stdout.write('.');
}
await b.close(); rmSync(tmp, { recursive: true, force: true });
writeFileSync(join(root, 'exercise-gifs.js'), `/* FittForma AI v50 — animaciones propias de cada ejercicio (generadas con tools/exercise-gifs). */\nwindow.FittFormaExerciseGifs=${JSON.stringify(index)};\n`);
console.log(`\n${Object.keys(index).length} ejercicios`);
