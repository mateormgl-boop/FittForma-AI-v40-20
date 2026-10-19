// Ayudas para describir poses y armar la escena de cada ejercicio.
import { FLOOR, lerpPose, renderSide, renderFront, scene } from './figure.mjs';

export const CX = 180;
export const pt = (x, y) => ({ x, y });
export const ease = phi => (1 - Math.cos(phi)) / 2; // 0 → 1 → 0 en un ciclo
export const rep = (a, b) => phi => lerpPose(a, b, ease(phi));
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

// Renderiza un cuadro: spec = { view, pose(phi), env(J, phi, pose) → {back, front}, m, s, shadow }
export function frameSvg(spec, phi) {
  const pose = spec.pose(phi);
  const out = (spec.view === 'front' ? renderFront : renderSide)(pose, spec.m || [], spec.s || []);
  const env = spec.env ? spec.env(out.J, phi, pose) : {};
  const sh = spec.shadow === false ? null : { x: spec.shadowX ?? pose.hip.x, y: FLOOR + 3, w: spec.shadowW ?? 48 };
  return scene(`${env.back || ''}${out.svg}${env.front || ''}`, sh, spec.scale ?? 1.5, spec.cx ?? CX);
}
