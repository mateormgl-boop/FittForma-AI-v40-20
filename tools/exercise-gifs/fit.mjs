// Encuadre automático: mide la figura (y lo que sostiene) en varios cuadros y elige escala, centro y altura del piso
// para que el ejercicio completo se vea entero, grande y centrado. Necesita una página de Playwright.
import { FLOOR, W, H } from './figure.mjs';
import { frameSvg } from './lib.mjs';
export async function fitSpec(spec, page, samples = 16) {
  let box = null;
  for (let i = 0; i < samples; i++) {
    await page.setContent(frameSvg(spec, (2 * Math.PI * i) / samples, { fitting: true }));
    const b = await page.evaluate(() => { const g = document.querySelector('g.fit'); const r = g.getBBox(); return [r.x, r.y, r.x + r.width, r.y + r.height]; });
    box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
  }
  const [x0, y0, x1, y1] = box, bw = x1 - x0, bh = y1 - y0, margin = 18;
  let scale = Math.min(spec.maxScale ?? 2.2, (W - 2 * margin) / bw, (H - 2 * margin) / bh);
  const cx = (x0 + x1) / 2;
  // Centro vertical cerca de 190 px; el piso del mundo queda dentro de la zona de piso del fondo (≥ 262 px).
  let floorY = 190 + (FLOOR - (y0 + y1) / 2) * scale;
  floorY = Math.max(262, Math.min(346, floorY));
  const top = floorY + (y0 - FLOOR) * scale, bottom = floorY + (y1 - FLOOR) * scale;
  if (top < margin) floorY += margin - top;
  if (bottom > H - margin) floorY -= bottom - (H - margin);
  spec._fit = { scale: Math.round(scale * 1000) / 1000, cx: Math.round(cx * 10) / 10, floorY: Math.round(floorY * 10) / 10 };
  return spec._fit;
}
