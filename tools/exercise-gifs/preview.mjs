// Vista previa: inicio y punto medio de cada animación en una grilla PNG.
// Uso: node tools/exercise-gifs/preview.mjs salida.png [filtro]
import { createRequire } from 'module';
import { SPECS } from './specs.mjs';
import { frameSvg } from './lib.mjs';
import { fitSpec } from './fit.mjs';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const out = process.argv[2] || 'preview.png', filter = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
const [ra, rb] = (process.env.RANGE || '0-999').split('-').map(Number);
const list = SPECS.filter(s => !filter || filter.test(s.name)).slice(ra, rb);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 800 } });
for (const s of list) await fitSpec(s, p, 12);
const PH = (process.env.PH || "0,3.1416").split(",").map(Number);
const cells = list.map(s => `<div class="c"><div class="r">${PH.map(ph => frameSvg(s, ph)).join("")}</div><p>${s.name}</p></div>`).join('');
const html = `<html><body style="margin:0;background:#000;color:#fff;font:12px sans-serif"><style>.g{display:grid;grid-template-columns:repeat(${process.env.COLS||3},1fr);gap:6px;width:1500px}.r{display:flex}.r svg{width:${process.env.SIZE||240}px;height:${process.env.SIZE||240}px}p{margin:2px}</style><div class="g">${cells}</div></body></html>`;
await p.setContent(html); await p.screenshot({ path: out, fullPage: true }); await b.close();
console.log(list.length, 'ejercicios →', out);
