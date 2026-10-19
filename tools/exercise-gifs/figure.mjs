// FittForma AI v50 — figura anatómica propia (SVG) para las animaciones de ejercicios.
// Vista lateral (side) o frontal/dorsal (front). Todo es geometría propia: no copia imágenes de terceros.
// Ángulos absolutos en grados: 0 = hacia abajo, 90 = hacia adelante (derecha), 180 = hacia arriba.

export const W = 360, H = 360, FLOOR = 330;
const rad = a => a * Math.PI / 180;
export const dir = a => ({ x: Math.sin(rad(a)), y: Math.cos(rad(a)) });
const angOf = v => Math.atan2(v.x, v.y) * 180 / Math.PI;
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const len = v => Math.hypot(v.x, v.y);
const unit = v => { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; };
const lerp = (a, b, t) => a + (b - a) * t;
const f = n => Math.round(n * 10) / 10;
const P = p => `${f(p.x)},${f(p.y)}`;

export const L = { thigh: 46, shin: 44, upper: 34, fore: 30, torso: 64, neck: 7, head: 12.5, foot: 17 };

// ---------- interpolación de poses ----------
export function lerpPose(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerpPose(v, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (('t' in a || 'a' in a || 'mix' in a) && ('t' in b || 'a' in b || 'mix' in b) && (('t' in a) !== ('t' in b) || 'mix' in a || 'mix' in b)) return { mix: [a, b, t], s: a.s || b.s };
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = k in a && k in b ? lerpPose(a[k], b[k], t) : (k in a ? a[k] : b[k]);
    return out;
  }
  return t < 0.5 ? a : b;
}

// Cinemática inversa de 2 segmentos: devuelve [ángulo proximal, ángulo distal].
export function ik(root, target, l1, l2, bend = 1) {
  const v = sub(target, root);
  const d = Math.min(Math.max(len(v), Math.abs(l1 - l2) + 0.5), l1 + l2 - 0.01);
  const base = angOf(v);
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) * 180 / Math.PI;
  const a1 = base + bend * alpha;
  const joint = add(root, mul(dir(a1), l1));
  return [a1, angOf(sub(target, joint))];
}

// ---------- primitivas ----------
function capsule(a, b, wa, wb) {
  const u = unit(sub(b, a)), n = { x: -u.y, y: u.x };
  const pa1 = add(a, mul(n, wa / 2)), pa2 = sub(a, mul(n, wa / 2)), pb1 = add(b, mul(n, wb / 2)), pb2 = sub(b, mul(n, wb / 2));
  return `M${P(pa1)} L${P(pb1)} A${f(wb / 2)},${f(wb / 2)} 0 0 0 ${P(pb2)} L${P(pa2)} A${f(wa / 2)},${f(wa / 2)} 0 0 0 ${P(pa1)}Z`;
}
// Curva suave cerrada (Catmull-Rom → Bézier).
function smooth(pts, closed = true) {
  const n = pts.length; let d = `M${P(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
// Músculo: lente a lo largo de un segmento a→b, desplazada hacia la normal n (px) con media anchura w.
function lens(a, b, n, t0, t1, off, w) {
  const top = [], bot = [], K = 12;
  for (let k = 0; k <= K; k++) {
    const t = lerp(t0, t1, k / K), c = add(add(a, mul(sub(b, a), t)), mul(n, off)), hw = w * Math.pow(Math.sin(Math.PI * k / K), 0.75);
    top.push(add(c, mul(n, hw))); bot.unshift(sub(c, mul(n, hw)));
  }
  const fiberA = add(add(a, mul(sub(b, a), lerp(t0, t1, 0.15))), mul(n, off)), fiberB = add(add(a, mul(sub(b, a), lerp(t0, t1, 0.85))), mul(n, off));
  return `<path class="m" d="${smooth([...top, ...bot])}"/><path class="mf" d="M${P(add(fiberA, mul(n, w * .3)))} L${P(add(fiberB, mul(n, w * .3)))} M${P(sub(fiberA, mul(n, w * .3)))} L${P(sub(fiberB, mul(n, w * .3)))}"/>`;
}
const ellipse = (c, rx, ry, rot = 0) => `<ellipse class="m" cx="${f(c.x)}" cy="${f(c.y)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(rot)} ${f(c.x)} ${f(c.y)})"/>`;

// ---------- vista lateral ----------
// pose: { hip:{x,y} (mundo), torso, head (inclinación relativa), arms:{n,f}, legs:{n,f}, feet:{n,f} }
// brazo/pierna: { a:[proximal, distal] } o { t:{x,y}, bend }
function limbAngles(root, spec, l1, l2, defBend) {
  if (spec.mix) { const [A, B, k] = spec.mix, x = limbAngles(root, A, l1, l2, defBend), y = limbAngles(root, B, l1, l2, defBend); const la = (p, q) => { let d = q - p; while (d > 180) d -= 360; while (d < -180) d += 360; return p + d * k; }; return [la(x[0], y[0]), la(x[1], y[1])]; }
  if (spec.t) return ik(root, spec.t, l1, l2, spec.bend ?? defBend);
  return spec.a;
}
export function sideJoints(p) {
  const hip = p.hip, tu = dir(p.torso);
  const sh = add(hip, mul(tu, L.torso));
  const neckA = p.torso + (p.head || 0);
  const headC = add(sh, mul(dir(neckA), L.neck + L.head));
  const J = { hip, sh, headC, neckA, torso: p.torso, limbs: {} };
  for (const side of ['f', 'n']) {
    const shoulder = add(sh, mul(dir(p.torso + 180), 2));
    const sc = p.arms[side].s || [1, 1];
    const [ua, fa] = limbAngles(shoulder, p.arms[side], L.upper * sc[0], L.fore * sc[1], -1);
    const elbow = add(shoulder, mul(dir(ua), L.upper * sc[0])), wrist = add(elbow, mul(dir(fa), L.fore * sc[1]));
    const [ta, sa] = limbAngles(hip, p.legs[side], L.thigh, L.shin, 1);
    const knee = add(hip, mul(dir(ta), L.thigh)), ankle = add(knee, mul(dir(sa), L.shin));
    const footA = p.feet?.[side] ?? (sa + 90);
    J.limbs[side] = { shoulder, elbow, wrist, ua, fa, knee, ankle, ta, sa, footA, hand: add(wrist, mul(dir(fa), 5)) };
  }
  return J;
}
const ANT = (a, b) => { const u = unit(sub(b, a)); return { x: u.y, y: -u.x }; }; // cara anterior de un miembro
function sideMuscles(J, side, ids, part) {
  const l = J.limbs[side]; let s = '';
  const has = id => ids.includes(id);
  if (part === 'arm') {
    const n = ANT(l.shoulder, l.elbow), nf = ANT(l.elbow, l.wrist);
    if (has('deltoides_anterior')) s += lens(l.shoulder, l.elbow, n, -0.12, 0.38, 3, 6);
    if (has('deltoides_lateral')) s += lens(l.shoulder, l.elbow, n, -0.18, 0.36, 0, 7);
    if (has('deltoides_posterior')) s += lens(l.shoulder, l.elbow, n, -0.12, 0.38, -3, 6);
    if (has('biceps')) s += lens(l.shoulder, l.elbow, n, 0.3, 0.92, 2.6, 4.6);
    if (has('triceps')) s += lens(l.shoulder, l.elbow, n, 0.22, 0.92, -2.8, 4.8);
    if (has('antebrazos')) s += lens(l.elbow, l.wrist, nf, 0.04, 0.7, 0.6, 4);
  } else if (part === 'leg') {
    const n = ANT(J.hip, l.knee), ns = ANT(l.knee, l.ankle);
    if (has('cuadriceps')) s += lens(J.hip, l.knee, n, 0.1, 0.92, 3.6, 7);
    if (has('isquiotibiales')) s += lens(J.hip, l.knee, n, 0.18, 0.92, -4, 6);
    if (has('aductores')) s += lens(J.hip, l.knee, n, 0.08, 0.6, 0, 4.5);
    if (has('gemelos')) s += lens(l.knee, l.ankle, ns, 0.06, 0.58, -2.6, 5);
    if (has('tibiales')) s += lens(l.knee, l.ankle, ns, 0.08, 0.7, 2.6, 2.8);
  } else {
    const a = J.hip, b = J.sh, u = unit(sub(b, a)), nfr = { x: -u.y, y: u.x };
    if (has('pectorales')) s += lens(a, b, nfr, 0.6, 0.96, 10.5, 7);
    if (has('abdominales')) s += lens(a, b, nfr, 0.1, 0.6, 8.5, 5);
    if (has('oblicuos')) s += lens(a, b, nfr, 0.14, 0.58, 2.5, 6);
    if (has('dorsales')) s += lens(a, b, nfr, 0.42, 0.88, -7, 7);
    if (has('espalda_media')) s += lens(a, b, nfr, 0.62, 0.95, -10, 4.5);
    if (has('trapecio')) s += lens(a, b, nfr, 0.84, 1.1, -7, 6);
    if (has('lumbares')) s += lens(a, b, nfr, 0.06, 0.46, -9, 4);
    if (has('gluteos')) s += lens(a, b, nfr, -0.16, 0.16, -11, 8);
    if (has('gluteo_medio')) s += lens(a, b, nfr, -0.02, 0.16, -3, 5.5);
  }
  return s;
}
function sideTorsoPath(J) {
  const a = J.hip, b = J.sh, u = unit(sub(b, a)), n = { x: -u.y, y: u.x };
  const at = (t, o) => add(add(a, mul(sub(b, a), t)), mul(n, o));
  const front = [at(-0.12, 12), at(0.08, 13), at(0.35, 11.5), at(0.62, 15), at(0.82, 16.5), at(0.98, 10), at(1.08, 4)];
  const back = [at(1.08, -6), at(0.98, -11), at(0.75, -13), at(0.45, -10.5), at(0.2, -12), at(0.02, -16), at(-0.14, -13)];
  return smooth([...front, ...back]);
}
function headSide(J) {
  const c = J.headC, d = dir(J.neckA), face = { x: d.y, y: -d.x };
  const at = (fw, up) => add(c, add(mul(face, fw), mul(d, up)));
  const skull = smooth([at(0, 13.5), at(8, 11), at(12, 3), at(13.5, -2), at(11.5, -7), at(8, -11.5), at(2, -12.5), at(-6, -9), at(-11, -3), at(-12, 5), at(-8, 11.5)]);
  const hair = smooth([at(-3, 14.2), at(7, 12.6), at(11.5, 6.5), at(6, 8.5), at(-2, 7), at(-9, 3), at(-12.6, 5.5), at(-9.5, 12)]);
  return `<path d="${skull}"/><path class="hair" d="${hair}"/>`;
}
function sideLimbs(J, side, part) {
  const l = J.limbs[side];
  if (part === 'arm') return `<path d="${capsule(l.shoulder, l.elbow, 15, 11)}"/><path d="${capsule(l.elbow, l.wrist, 11, 8)}"/><circle cx="${f(l.hand.x)}" cy="${f(l.hand.y)}" r="5"/>`;
  const fd = dir(l.footA), toe = add(l.ankle, mul(fd, L.foot)), heel = sub(l.ankle, mul(fd, 4));
  return `<path d="${capsule(J.hip, l.knee, 22, 14)}"/><path d="${capsule(l.knee, l.ankle, 14, 8.5)}"/><path d="${capsule(heel, toe, 8, 6)}"/>`;
}
function sideShorts(J, side) {
  const l = J.limbs[side], a = J.hip, b = J.sh, u = unit(sub(b, a)), n = { x: -u.y, y: u.x };
  const at = (t, o) => add(add(a, mul(sub(b, a), t)), mul(n, o));
  const kneeDir = unit(sub(l.knee, a)), kn = { x: -kneeDir.y, y: kneeDir.x };
  const legEnd = add(a, mul(kneeDir, L.thigh * 0.42));
  return `<path d="${smooth([at(0.2, 12.5), at(0.2, -12.6), at(0.02, -17), at(-0.14, -14), add(legEnd, mul(kn, 12)), add(legEnd, mul(kn, -12)), at(-0.1, 13)])}"/>`;
}

export const ALL = ['pectorales','deltoides_anterior','deltoides_lateral','deltoides_posterior','biceps','triceps','antebrazos','abdominales','oblicuos','trapecio','espalda_media','dorsales','lumbares','gluteos','gluteo_medio','cuadriceps','aductores','isquiotibiales','gemelos','tibiales'];
export function renderSide(pose, muscles = [], secondary = []) {
  const J = sideJoints(pose);
  const G = ALL.filter(m => !muscles.includes(m) && !secondary.includes(m));
  const all = muscles, sec = secondary;
  const layer = (shapes, cls) => `<g class="${cls}-o">${shapes}</g><g class="${cls}">${shapes}</g>`;
  let s = '';
  // miembros lejanos (más oscuros)
  s += layer(sideLimbs(J, 'f', 'leg'), 'far') + `<g class="far-sh">${sideShorts(J, 'f')}</g>` + `<g class="mus far-m">${sideMuscles(J, 'f', all, 'leg')}</g><g class="mus2 far-m">${sideMuscles(J, 'f', sec, 'leg')}</g>`;
  s += layer(sideLimbs(J, 'f', 'arm'), 'far') + `<g class="mus far-m">${sideMuscles(J, 'f', all, 'arm')}</g><g class="mus2 far-m">${sideMuscles(J, 'f', sec, 'arm')}</g>`;
  // cuerpo cercano
  const neckA = add(J.sh, mul(dir(J.torso), -2)), neckB = add(J.sh, mul(dir(J.neckA), L.neck + 3));
  const body = `<path d="${capsule(neckA, neckB, 11, 10)}"/><path d="${sideTorsoPath(J)}"/>${sideLimbs(J, 'n', 'leg')}${headSide(J)}`;
  s += layer(body, 'near');
  s += `<g class="ghost">${sideMuscles(J, 'n', G, 'torso')}${sideMuscles(J, 'n', G, 'leg')}</g>`;
  s += `<g class="mus">${sideMuscles(J, 'n', all, 'torso')}${sideMuscles(J, 'n', all, 'leg')}</g><g class="mus2">${sideMuscles(J, 'n', sec, 'torso')}${sideMuscles(J, 'n', sec, 'leg')}</g>`;
  s += `<g class="shorts">${sideShorts(J, 'n')}</g>`;
  s += layer(sideLimbs(J, 'n', 'arm'), 'near') + `<g class="ghost">${sideMuscles(J, 'n', G, 'arm')}</g><g class="mus">${sideMuscles(J, 'n', all, 'arm')}</g><g class="mus2">${sideMuscles(J, 'n', sec, 'arm')}</g>`;
  return { svg: s, J };
}

// ---------- vista frontal / dorsal ----------
// pose: { hip:{x,y}, rot, arms:{l:[sup,inf], r:[sup,inf]}, legs:{l:[mus,pier], r:[...]}, back:bool, lean }
export function frontJoints(p) {
  const rot = p.rot || 0, c = Math.cos(rad(-rot)), s = Math.sin(rad(-rot));
  const T = v => ({ x: p.hip.x + v.x * c - v.y * s, y: p.hip.y + v.x * s + v.y * c });
  const sideJ = (sign, arm, leg) => {
    const d = a => ({ x: sign * Math.sin(rad(a)), y: Math.cos(rad(a)) });
    const shoulder = { x: sign * (25 - (p.retract || 0)), y: -62 - (p.shrug || 0) }, elbow = add(shoulder, mul(d(arm[0]), L.upper * (arm[2] ?? 1))), wrist = add(elbow, mul(d(arm[1]), L.fore * (arm[3] ?? 1)));
    const hipJ = { x: sign * 11, y: 2 }, knee = add(hipJ, mul(d(leg[0]), L.thigh * (leg[2] ?? 1))), ankle = add(knee, mul(d(leg[1]), L.shin * (leg[3] ?? 1)));
    return { shoulder, elbow, wrist, hand: add(wrist, mul(d(arm[1]), 5)), hipJ, knee, ankle };
  };
  const local = { l: sideJ(-1, p.arms.l, p.legs.l), r: sideJ(1, p.arms.r, p.legs.r) };
  const world = {};
  for (const k of ['l', 'r']) { world[k] = {}; for (const [n, v] of Object.entries(local[k])) world[k][n] = T(v); }
  return { T, local, world, rot, headC: T({ x: 0, y: -62 - L.neck - L.head + 2 }), hip: p.hip };
}
function frontMuscles(J, ids, back) {
  const has = id => ids.includes(id), T = J.T; let s = '';
  const E = (x, y, rx, ry, r = 0) => ellipse(T({ x, y }), rx, ry, r - J.rot);
  const limb = (a, b, t0, t1, w) => { const A = T(a), B = T(b), u = unit(sub(B, A)); return lens(A, B, { x: -u.y, y: u.x }, t0, t1, 0, w); };
  for (const sg of [-1, 1]) {
    const k = sg < 0 ? 'l' : 'r', l = J.local[k];
    if (!back) {
      if (has('pectorales')) s += E(sg * 12, -49, 11.5, 8.5, sg * -8);
      if (has('oblicuos')) s += E(sg * 15, -27, 4.5, 11, sg * 8);
      if (has('deltoides_anterior') || has('deltoides_lateral')) s += E(sg * 27, -58, 7, 9, sg * 20);
      if (has('biceps')) s += limb(l.shoulder, l.elbow, 0.3, 0.92, 5);
      if (has('cuadriceps')) s += limb(l.hipJ, l.knee, 0.12, 0.92, 7.5);
      if (has('aductores')) s += limb({ x: sg * 5, y: 4 }, { x: l.knee.x - sg * 3, y: l.knee.y }, 0.05, 0.62, 4.5);
      if (has('tibiales')) s += limb(l.knee, l.ankle, 0.1, 0.7, 3);
      if (has('trapecio')) s += E(sg * 12, -64, 8, 3.5, sg * 22);
      if (has('gluteo_medio')) s += E(sg * 17, -4, 5, 7, sg * 15);
    } else {
      if (has('trapecio')) s += E(sg * 9, -58, 9, 11, sg * 30);
      if (has('deltoides_posterior') || has('deltoides_lateral')) s += E(sg * 27, -57, 7, 9, sg * 20);
      if (has('dorsales')) s += E(sg * 15, -36, 8, 16, sg * -14);
      if (has('espalda_media')) s += E(sg * 8, -48, 5.5, 8);
      if (has('lumbares')) s += E(sg * 5, -18, 3.8, 11);
      if (has('triceps')) s += limb(l.shoulder, l.elbow, 0.22, 0.92, 5);
      if (has('gluteos')) s += E(sg * 10, 9, 10, 9);
      if (has('gluteo_medio')) s += E(sg * 16, -2, 6, 5, sg * 20);
      if (has('isquiotibiales')) s += limb(l.hipJ, l.knee, 0.22, 0.95, 6.5);
    }
    if (has('gemelos')) s += limb(l.knee, l.ankle, 0.06, 0.55, back ? 6 : 3.5);
    if (has('antebrazos')) s += limb(l.elbow, l.wrist, 0.05, 0.7, 4);
  }
  if (!back && has('abdominales')) {
    for (let r = 0; r < 3; r++) for (const sg of [-1, 1]) s += E(sg * 4.6, -38 + r * 9.5, 4, 4.3);
  }
  return s;
}
export function renderFront(pose, muscles = [], secondary = []) {
  const J = frontJoints(pose), T = J.T, back = !!pose.back;
  const tor = smooth([{ x: -24, y: -66 }, { x: -29, y: -58 }, { x: -22, y: -40 }, { x: -16, y: -18 }, { x: -18, y: 0 }, { x: -14, y: 10 }, { x: 14, y: 10 }, { x: 18, y: 0 }, { x: 16, y: -18 }, { x: 22, y: -40 }, { x: 29, y: -58 }, { x: 24, y: -66 }, { x: 0, y: -69 }].map(T));
  const limbs = k => { const w = J.world[k]; return `<path d="${capsule(w.shoulder, w.elbow, 14, 11)}"/><path d="${capsule(w.elbow, w.wrist, 11, 8)}"/><circle cx="${f(w.hand.x)}" cy="${f(w.hand.y)}" r="5"/>`; };
  const legs = k => { const w = J.world[k], sg = k === 'l' ? -1 : 1, foot = T(add(J.local[k].ankle, { x: sg * 4, y: 3 })); return `<path d="${capsule(w.hipJ, w.knee, 21, 14)}"/><path d="${capsule(w.knee, w.ankle, 14, 8.5)}"/><path d="${capsule(w.ankle, foot, 8, 7)}"/>`; };
  const neck = capsule(T({ x: 0, y: -60 }), T({ x: 0, y: -72 }), 13, 12);
  const hc = J.headC;
  const head = `<ellipse cx="${f(hc.x)}" cy="${f(hc.y)}" rx="${L.head - 1.5}" ry="${L.head + 0.5}" transform="rotate(${f(-J.rot)} ${f(hc.x)} ${f(hc.y)})"/>`;
  const hair = back
    ? `<path class="hair" d="${smooth([{ x: -10.5, y: -86 }, { x: 0, y: -97 }, { x: 10.5, y: -86 }, { x: 9, y: -76 }, { x: 0, y: -74 }, { x: -9, y: -76 }].map(T))}"/>`
    : `<path class="hair" d="${smooth([{ x: -10.5, y: -86 }, { x: 0, y: -97 }, { x: 10.5, y: -86 }, { x: 6, y: -90 }, { x: -6, y: -90 }].map(T))}"/>`;
  const shorts = `<path d="${smooth([{ x: -18, y: -6 }, { x: 18, y: -6 }, { x: 21, y: 8 }, { x: J.local.r.hipJ.x + 13, y: 24 }, { x: 2, y: 22 }, { x: 0, y: 14 }, { x: -2, y: 22 }, { x: J.local.l.hipJ.x - 13, y: 24 }, { x: -21, y: 8 }].map(T))}"/>`;
  const layer = (shapes, cls) => `<g class="${cls}-o">${shapes}</g><g class="${cls}">${shapes}</g>`;
  const body = `${pose.legsFront ? '' : legs('l') + legs('r')}<path d="${neck}"/><path d="${tor}"/>${head}`;
  const G = ALL.filter(m => !muscles.includes(m) && !secondary.includes(m));
  let s = layer(body, 'near') + `<g class="hairg">${hair}</g>`;
  s += `<g class="ghost">${frontMuscles(J, G.filter(m => !['biceps', 'triceps', 'antebrazos'].includes(m)), back)}</g>`;
  s += `<g class="mus">${frontMuscles(J, muscles.filter(m => !['biceps', 'triceps', 'antebrazos'].includes(m)), back)}</g><g class="mus2">${frontMuscles(J, secondary.filter(m => !['biceps', 'triceps', 'antebrazos'].includes(m)), back)}</g>`;
  s += `<g class="shorts">${shorts}</g>`;
  if (pose.legsFront) s += layer(legs('l') + legs('r'), 'near');
  s += layer(limbs('l') + limbs('r'), 'near');
  s += `<g class="ghost">${frontMuscles(J, G.filter(m => ['biceps', 'triceps', 'antebrazos'].includes(m)), back)}</g>`;
  s += `<g class="mus">${frontMuscles(J, muscles.filter(m => ['biceps', 'triceps', 'antebrazos', 'deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior'].includes(m)), back)}</g><g class="mus2">${frontMuscles(J, secondary.filter(m => ['biceps', 'triceps', 'antebrazos'].includes(m)), back)}</g>`;
  return { svg: s, J };
}

// ---------- escena ----------
export const DEFS = `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2b36"/><stop offset=".68" stop-color="#16202a"/><stop offset=".69" stop-color="#28323c"/><stop offset="1" stop-color="#121920"/></linearGradient>
<radialGradient id="spot" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#3b4b5a" stop-opacity=".75"/><stop offset="1" stop-color="#3b4b5a" stop-opacity="0"/></radialGradient>
<linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".55" stop-color="#d4d9de"/><stop offset="1" stop-color="#a9b0b8"/></linearGradient>
<linearGradient id="skinFar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9c0c7"/><stop offset="1" stop-color="#848c95"/></linearGradient>
<linearGradient id="mus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a4d"/><stop offset=".6" stop-color="#e63b22"/><stop offset="1" stop-color="#b8240f"/></linearGradient>
<linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ced4"/><stop offset="1" stop-color="#7d858e"/></linearGradient>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>
</defs>
<style>
.near-o path,.near-o circle,.near-o ellipse{fill:none;stroke:#59616a;stroke-width:3.2;stroke-linejoin:round}
.near path,.near circle,.near ellipse{fill:url(#skin)}
.far-o path,.far-o circle{fill:none;stroke:#4a5158;stroke-width:3}
.far path,.far circle{fill:url(#skinFar)}
.ghost .m{fill:#e9edf0;stroke:#8d959e;stroke-width:.7;opacity:.55}
.ghost .mf{fill:none;stroke:#9aa2ab;stroke-width:.5;opacity:.35}
.mus .m{fill:url(#mus);stroke:#9c1e0c;stroke-width:.6}
.mus2 .m{fill:#ff8a5c;opacity:.55}
.mf{fill:none;stroke:#8f1a08;stroke-width:.7;opacity:.55}
.mus2 .mf{opacity:.25}
.far-m{opacity:.72}
.shorts path,.far-sh path{fill:#16191d;stroke:#0b0d10;stroke-width:1}
.far-sh path{fill:#101216}
.hair,.hairg path{fill:#3a3530}
.eq{fill:#2b3138;stroke:#0f1215;stroke-width:1.2}
.eq2{fill:#4b545e;stroke:#1a1f24;stroke-width:1}
.met{fill:url(#metal);stroke:#4d555e;stroke-width:1}
.pad{fill:#20262c;stroke:#0c0f12;stroke-width:1.2}
.band{fill:none;stroke:#2bd96b;stroke-width:3.2;stroke-linecap:round}
.cable{fill:none;stroke:#aeb6be;stroke-width:1.3}
.wall{fill:#2a3540;stroke:#11171d;stroke-width:1}
.mat{fill:#1c4a33;opacity:.9}
</style>`;

export function background() {
  let slats = '';
  for (let x = 0; x <= W; x += 9) slats += `<rect x="${x}" y="0" width="4" height="252" fill="#0d151c" opacity="${x % 18 ? .22 : .35}"/>`;
  let floor = '';
  for (let i = 0; i < 6; i++) { const y = 252 + Math.pow(i / 5, 1.6) * 108; floor += `<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}" stroke="#0c1217" stroke-width="1.4" opacity=".7"/>`; }
  for (let i = -6; i <= 6; i++) floor += `<line x1="${180 + i * 22}" y1="252" x2="${180 + i * 95}" y2="${H}" stroke="#0c1217" stroke-width="1.4" opacity=".6"/>`;
  return `<rect width="${W}" height="${H}" fill="url(#bg)"/>${slats}<rect y="248" width="${W}" height="6" fill="#0e151b"/>${floor}<ellipse cx="180" cy="210" rx="190" ry="170" fill="url(#spot)"/>`;
}

export function scene(content, groundShadow, scale = 1.5, cx = 180) {
  const sh = groundShadow ? `<ellipse cx="${f(groundShadow.x)}" cy="${f(groundShadow.y)}" rx="${f(groundShadow.w)}" ry="7" fill="#05080b" opacity=".45"/>` : '';
  const tf = `translate(${f(180 - cx * scale)} ${f(FLOOR - FLOOR * scale)}) scale(${scale})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${background()}<g transform="${tf}">${sh}<g filter="url(#shadow)">${content}</g></g></svg>`;
}
