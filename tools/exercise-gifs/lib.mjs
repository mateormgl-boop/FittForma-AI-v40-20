// Ayudas para describir poses y armar la escena de cada ejercicio.
import { FLOOR, lerpPose, renderSide, renderFront, scene } from './figure.mjs';

export const CX = 180;
export const pt = (x, y) => ({ x, y });
export const ease = phi => (1 - Math.cos(phi)) / 2; // 0 → 1 → 0 en un ciclo
export const rep = (a, b) => Object.assign(phi => lerpPose(a, b, ease(phi)), { kind: 'rep' });
export const hold = (a, b, amt = 0.15) => phi => lerpPose(a, b, ease(phi) * amt); // isométricos: respiración leve
// Ciclo alternado: primera mitad lado A, segunda mitad lado B.
export const alt = (base, a, b) => phi => { const t = phi % (2 * Math.PI); const h = t < Math.PI ? a : b; const k = Math.sin(t < Math.PI ? t : t - Math.PI); return lerpPose(base, h, k); };
// Ciclo de varias poses (Y-T-W, etc.).
export const seq = (...poses) => phi => { const n = poses.length, x = (phi / (2 * Math.PI)) * n, i = Math.floor(x) % n, t = x - Math.floor(x); const k = t < 0.25 ? 0 : t > 0.75 ? 1 : (1 - Math.cos((t - 0.25) / 0.5 * Math.PI)) / 2; return lerpPose(poses[i], poses[(i + 1) % n], k); };

const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) && !('x' in v) && !('a' in v) && !('t' in v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v; return o; };

// Pose de pie en vista lateral (mira a la derecha). hy = altura de la cadera sobre el piso.
export function stand(o = {}) {
  const hx = o.hx ?? 0, hy = o.hy ?? 94.5, fn = o.footN ?? 6, ff = o.footF ?? -1, fy = o.fy ?? 6;
  const armN = o.armN ?? { a: [2, 4] };
  const armF = o.armF ?? (armN.t ? { ...armN, t: pt(armN.t.x - 4, armN.t.y + 1) } : { ...armN, a: armN.a.map(v => v - 6) });
  return {
    hip: pt(CX + hx, FLOOR - hy), torso: o.torso ?? 180, head: o.head ?? 0,
    arms: { n: armN, f: armF },
    legs: { n: o.legN ?? { t: pt(CX + fn, FLOOR - fy), bend: 1 }, f: o.legF ?? { t: pt(CX + ff, FLOOR - fy), bend: 1 } },
    feet: o.feet,
  };
}
export const with_ = merge;

// Pose frontal/dorsal: brazos y piernas como [sup, inf, escalaSup, escalaInf] (0 abajo, 90 al costado).
export function front(o = {}) {
  return {
    hip: pt(CX + (o.hx ?? 0), FLOOR - (o.hy ?? 98)), rot: o.rot ?? 0, legsFront: !!o.legsFront, back: !!o.back, shrug: o.shrug ?? 0, retract: o.retract ?? 0,
    arms: { l: o.armL ?? o.arms ?? [8, 6], r: o.armR ?? o.arms ?? [8, 6] },
    legs: { l: o.legL ?? o.legs ?? [4, 2], r: o.legR ?? o.legs ?? [4, 2] },
  };
}

// Punto que más se mueve (mano, pie, cadera o cabeza): su recorrido se dibuja como guía del movimiento.
function keyPoints(J, view) {
  if (view === 'front') return { manoI: J.world.l.hand, manoD: J.world.r.hand, pieI: J.world.l.ankle, pieD: J.world.r.ankle, cadera: J.hip, cabeza: J.headC };
  return { mano: J.limbs.n.hand, manoLejana: J.limbs.f.hand, pie: J.limbs.n.ankle, pieLejano: J.limbs.f.ankle, cadera: J.hip, cabeza: J.headC };
}
const render = (spec, pose) => (spec.view === 'front' ? renderFront : renderSide)(pose, spec.m || [], spec.s || []);
export function trailOf(spec) {
  if (spec._trail !== undefined) return spec._trail;
  if (spec.trail === false || spec.pose.kind !== 'rep') return (spec._trail = null);
  const N = 36, paths = {};
  for (let i = 0; i <= N; i++) { const J = render(spec, spec.pose(2 * Math.PI * i / N)).J; for (const [k, p] of Object.entries(keyPoints(J, spec.view))) (paths[k] ||= []).push(p); }
  let best = null, bestLen = 0;
  if (spec.trailPoint && paths[spec.trailPoint]) { best = spec.trailPoint; bestLen = 99; }
  else for (const [k, pts] of Object.entries(paths)) { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (d > bestLen) { bestLen = d; best = k; } }
  if (!best || bestLen < 30) return (spec._trail = null);
  const pts = paths[best], half = spec.cyclic ? pts : pts.slice(0, N / 2 + 1);
  const r = n => Math.round(n * 10) / 10;
  const d = 'M' + half.map(p => `${r(p.x)},${r(p.y)}`).join(' L');
  const a = half[0], b = half[half.length - 1];
  return (spec._trail = `<path class="trail" d="${d}"/>` + (spec.cyclic ? '' : `<circle class="trail-start" cx="${r(a.x)}" cy="${r(a.y)}" r="4"/><circle class="trail-dot" cx="${r(b.x)}" cy="${r(b.y)}" r="3.2"/>`));
}

// Renderiza un cuadro: spec = { view, pose(phi), env(J, phi, pose) → {back, front}, m, s, shadow }
// spec._fit (calculado por fit.mjs) = { scale, cx, floorY } para que la figura entre entera en el cuadro.
export function frameSvg(spec, phi, { fitting = false } = {}) {
  const pose = spec.pose(phi);
  const out = render(spec, pose);
  const env = spec.env ? spec.env(out.J, phi, pose) : {};
  const sh = spec.shadow === false ? null : { x: spec.shadowX ?? pose.hip.x, y: FLOOR + 3, w: spec.shadowW ?? 48 };
  const fit = fitting ? { scale: 1, cx: CX, floorY: FLOOR } : (spec._fit || { scale: spec.scale ?? 1.5, cx: spec.cx ?? CX, floorY: FLOOR });
  return scene({ back: env.back || '', fit: (trailOf(spec) || '') + `<g filter="url(#vol)">${out.svg}</g>` + (env.front || '') }, sh, fit.scale, fit.cx, fit.floorY);
}
