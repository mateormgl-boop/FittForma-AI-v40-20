// Movimiento de cada ejercicio de la biblioteca: pose inicial → pose final (o ciclo), equipamiento y músculos.
// Las poses describen el movimiento real indicado en la ficha del ejercicio (exercise-guides.js).
import { FLOOR, lerpPose } from './figure.mjs';
import * as E from './equipment.mjs';
import { CX, pt, rep, hold, alt, seq, ease, stand, front } from './lib.mjs';

export const SPECS = [];
const X = (name, spec) => SPECS.push({ name, view: 'side', ...spec });
const sh0 = pt(CX, FLOOR - 94.5 - 64);
const mid = (a, b, off = 0, ang = 0) => { const r = ang * Math.PI / 180; return pt((a.x + b.x) / 2 + Math.sin(r) * off, (a.y + b.y) / 2 + Math.cos(r) * off); }; // hombro de pie (vista lateral)
const both = fn => J => ({ back: fn(J.limbs.f.hand, 'f'), front: fn(J.limbs.n.hand, 'n') });
const db = both(h => E.dumbbell(h));
const dbHammer = both(h => E.dumbbell(h, 90));

// Sentado en banco (vista lateral). seatY = altura del asiento.
function sit(o = {}) {
  const seatY = o.seatY ?? FLOOR - 46, hx = o.hx ?? -10;
  const hip = pt(CX + hx, seatY - 10);
  const foot = o.foot ?? 44;
  return {
    hip, torso: o.torso ?? 180, head: o.head ?? 0,
    arms: { n: o.armN ?? { a: [2, 4] }, f: o.armF ?? o.armN ?? { a: [-4, -2] } },
    legs: { n: o.legN ?? { t: pt(hip.x + foot, FLOOR - 6), bend: 1 }, f: o.legF ?? { t: pt(hip.x + foot - 6, FLOOR - 6), bend: 1 } },
    feet: o.feet,
  };
}
const benchUnder = (x1 = -50, x2 = 30, y = FLOOR - 46) => () => ({ back: E.bench(CX + x1, CX + x2, y) });

// Acostado boca arriba (cabeza a la izquierda). y = altura de la espalda.
function supine(o = {}) {
  const y = o.y ?? FLOOR - 14, hx = o.hx ?? 22;
  const hip = pt(CX + hx, y - 12);
  return {
    hip, torso: o.torso ?? -90, head: o.head ?? 0,
    arms: { n: o.armN ?? { a: [-100, -100] }, f: o.armF ?? o.armN ?? { a: [-100, -100] } },
    legs: { n: o.legN ?? { t: pt(hip.x + 52, FLOOR - 6), bend: -1 }, f: o.legF ?? o.legN ?? { t: pt(hip.x + 48, FLOOR - 6), bend: -1 } },
    feet: o.feet,
  };
}
// Boca abajo (cabeza a la derecha) apoyado en el piso.
function prone(o = {}) {
  const hip = pt(CX + (o.hx ?? -30), FLOOR - (o.hy ?? 15));
  return {
    hip, torso: o.torso ?? 90, head: o.head ?? -6,
    arms: { n: o.armN ?? { a: [92, 92] }, f: o.armF ?? o.armN ?? { a: [90, 90] } },
    legs: { n: o.legN ?? { a: [-90, -90] }, f: o.legF ?? o.legN ?? { a: [-92, -92] } },
    feet: o.feet ?? { n: 180, f: 180 },
  };
}
// Plancha / flexión: cuerpo recto apoyado en manos (o antebrazos) y pies (o rodillas).
function plankPose({ ang = 100, hipY = 58, hipX = -40, hand = pt(CX + 42, FLOOR - 4), knees = false, forearm = false, legAng } = {}) {
  const la = legAng ?? ang - 180;
  const armSpec = forearm ? { a: [0, 90] } : { t: hand, bend: -1 };
  return {
    hip: pt(CX + hipX, FLOOR - hipY), torso: ang, head: -4,
    arms: { n: armSpec, f: forearm ? { a: [-2, 88] } : { t: pt(hand.x - 3, hand.y), bend: -1 } },
    legs: knees ? { n: { a: [la, -88] }, f: { a: [la - 2, -90] } } : { n: { a: [la, la] }, f: { a: [la - 1, la - 1] } },
    feet: knees ? { n: 175, f: 175 } : undefined,
  };
}
const plankHip = (ang, footX, footY = FLOOR - 4) => { // cadera para que el pie quede en el piso con el cuerpo recto
  const la = (ang - 180) * Math.PI / 180, legLen = 90; return { x: footX - Math.sin(la) * legLen, y: footY - Math.cos(la) * legLen };
};
function pushup({ startAng = 104, endAng = 97, foot = CX - 120, handX = CX + 40, handY = FLOOR - 4, knees = false, m = ['pectorales', 'triceps'], s = ['deltoides_anterior', 'abdominales'], env, scale = 1.25 } = {}) {
  const mk = ang => {
    if (knees) { const kneeP = pt(foot + 40, FLOOR - 7), la = (ang - 180) * Math.PI / 180; const hip = { x: kneeP.x - Math.sin(la) * 46, y: kneeP.y - Math.cos(la) * 46 }; return { ...plankPose({ ang, hand: pt(handX, handY), knees: true }), hip }; }
    const h = plankHip(ang, foot); return { ...plankPose({ ang, hand: pt(handX, handY) }), hip: h };
  };
  return { pose: rep(mk(startAng), mk(endAng)), m, s, env, scale, cx: CX - 20, shadowX: CX - 20, shadowW: 100 };
}

// ======================= BRAZOS =======================
X('Curl de bíceps con mancuernas', { pose: rep(stand({ armN: { a: [3, 6] } }), stand({ armN: { a: [-4, 150] } })), env: db, m: ['biceps'], s: ['antebrazos'] });
X('Curl martillo', { pose: rep(stand({ armN: { a: [3, 6] } }), stand({ armN: { a: [-4, 145] } })), env: dbHammer, m: ['biceps', 'antebrazos'] });
X('Curl de bíceps alternado sentado', {
  pose: alt(sit({ armN: { a: [2, 6] }, armF: { a: [-3, 2] } }), sit({ armN: { a: [-4, 150] }, armF: { a: [-3, 2] } }), sit({ armN: { a: [2, 6] }, armF: { a: [-8, 145] } })),
  env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46) + E.dumbbell(J.limbs.f.hand), front: E.dumbbell(J.limbs.n.hand) }), m: ['biceps'], s: ['antebrazos'],
});
X('Curl de bíceps con banda', { pose: rep(stand({ armN: { a: [3, 6] } }), stand({ armN: { a: [-4, 150] } })), env: J => ({ back: E.band(J.limbs.f.ankle, J.limbs.f.hand), front: E.band(pt(J.limbs.n.ankle.x + 6, FLOOR - 2), J.limbs.n.hand) + E.handle(J.limbs.n.hand) }), m: ['biceps'], s: ['antebrazos'] });
X('Curl de bíceps en polea baja', { pose: rep(stand({ hx: -8, armN: { a: [6, 14] } }), stand({ hx: -8, armN: { a: [-2, 150] } })), env: J => ({ back: E.column(CX + 92, 70) + E.pulley(pt(CX + 84, FLOOR - 16)) + E.cable(pt(CX + 84, FLOOR - 16), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['biceps'], s: ['antebrazos'] });
X('Curl inverso con barra', { pose: rep(stand({ armN: { a: [3, 8] } }), stand({ armN: { a: [-4, 140] } })), env: J => ({ front: E.plate(J.limbs.n.hand, 20) }), m: ['antebrazos', 'biceps'] });
X('Curl concentrado con mancuerna', {
  pose: rep(sit({ torso: 150, head: 20, hx: -14, armN: { a: [8, 12] }, armF: { a: [40, 95] }, foot: 50 }), sit({ torso: 150, head: 20, hx: -14, armN: { a: [8, 165] }, armF: { a: [40, 95] }, foot: 50 })),
  env: J => ({ back: E.bench(CX - 60, CX + 20, FLOOR - 46), front: E.dumbbell(J.limbs.n.hand) }), m: ['biceps'], s: ['antebrazos'],
});
X('Curl predicador en máquina', {
  pose: rep(sit({ torso: 172, armN: { a: [45, 60] } }), sit({ torso: 172, armN: { a: [45, 168] } })),
  env: J => ({ back: E.bench(CX - 50, CX + 22, FLOOR - 46) + E.frame(CX + 44, FLOOR - 160), front: E.padC(mid(J.limbs.n.shoulder, J.limbs.n.elbow, 9, -45), 46, 10, 45) + E.handle(J.limbs.n.hand) }), m: ['biceps'], s: ['antebrazos'],
});
const pushdown = (uni) => ({
  pose: rep(stand({ torso: 174, armN: { a: [-6, 150] }, armF: uni ? { a: [-2, 4] } : { a: [-10, 146] } }), stand({ torso: 174, armN: { a: [-4, 4] }, armF: uni ? { a: [-2, 4] } : { a: [-8, 0] } })),
  env: J => ({ back: E.column(CX + 70, 50) + E.pulley(pt(CX + 62, 122)) + E.cable(pt(CX + 62, 122), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['triceps'], s: ['antebrazos'],
});
X('Extensión de tríceps en polea', pushdown(false));
X('Extensión de tríceps con cuerda', pushdown(false));
X('Extensión de tríceps unilateral en polea', pushdown(true));
X('Extensión de tríceps con banda', { ...pushdown(false), env: J => ({ back: E.wall(CX + 70) + E.band(pt(CX + 70, 124), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }) });
X('Extensión de tríceps por encima de la cabeza con cuerda', {
  pose: rep(stand({ torso: 168, footN: 26, footF: -26, armN: { a: [170, -150] } }), stand({ torso: 168, footN: 26, footF: -26, armN: { a: [170, 172] } })),
  env: J => ({ back: E.column(CX - 92, 60) + E.pulley(pt(CX - 84, FLOOR - 20)) + E.cable(pt(CX - 84, FLOOR - 20), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['triceps'], scale: 1.3,
});
X('Extensión de tríceps por encima de la cabeza con mancuerna', {
  pose: rep(sit({ armN: { a: [172, -145] } }), sit({ armN: { a: [172, 176] } })), env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46), front: E.dumbbell(J.limbs.n.hand, 90) }), m: ['triceps'], scale: 1.35,
});
X('Patada de tríceps con mancuerna', {
  pose: rep(stand({ hx: -16, hy: 84, torso: 118, head: 30, footN: 10, armN: { a: [-80, 2] } }), stand({ hx: -16, hy: 84, torso: 118, head: 30, footN: 10, armN: { a: [-80, -84] } })), env: db, m: ['triceps'],
});
X('Press francés con barra Z', {
  pose: rep(supine({ y: FLOOR - 46, armN: { a: [-172, -172] } }), supine({ y: FLOOR - 46, armN: { a: [-172, -98] } })),
  env: J => ({ back: E.bench(CX - 80, CX + 40, FLOOR - 46), front: E.plate(J.limbs.n.hand, 18) }), m: ['triceps'], scale: 1.3,
});
X('Fondos en máquina', {
  pose: rep(sit({ armN: { a: [-60, 20] } }), sit({ armN: { a: [-10, 2] } })), env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46) + E.frame(CX - 62, FLOOR - 200), front: E.handle(J.limbs.n.hand) }), m: ['triceps'], s: ['pectorales', 'deltoides_anterior'],
});
X('Fondos de tríceps con silla estable', (() => {
  const hand = pt(CX - 46, FLOOR - 52);
  const p = hy => ({ hip: pt(CX - 38, FLOOR - hy), torso: 182, head: 0, arms: { n: { t: hand, bend: 1 }, f: { t: pt(hand.x - 3, hand.y), bend: 1 } }, legs: { n: { t: pt(CX + 46, FLOOR - 6), bend: 1 }, f: { t: pt(CX + 40, FLOOR - 6), bend: 1 } } });
  return { pose: rep(p(60), p(28)), env: () => ({ back: E.chair(CX - 62, FLOOR - 50, -1) }), m: ['triceps'], s: ['pectorales', 'deltoides_anterior'] };
})());
X('Flexiones diamante', pushup({ handX: CX + 30, m: ['triceps', 'pectorales'], s: ['deltoides_anterior'] }));
X('Flexiones diamante desde rodillas', pushup({ knees: true, foot: CX - 70, handX: CX + 30, startAng: 112, endAng: 100, m: ['triceps', 'pectorales'], s: ['deltoides_anterior'] }));

// ======================= HOMBROS =======================
const dbF = J => ({ front: E.dumbbellFront(J.world.l.hand) + E.dumbbellFront(J.world.r.hand) });
X('Press militar con mancuernas', { view: 'front', pose: rep(front({ arms: [100, 178] }), front({ arms: [168, 176] })), env: dbF, m: ['deltoides_anterior', 'deltoides_lateral'], s: ['triceps', 'trapecio'], scale: 1.35 });
X('Press de hombros con mancuernas livianas', { view: 'front', pose: rep(front({ arms: [100, 178] }), front({ arms: [168, 176] })), env: dbF, m: ['deltoides_anterior', 'deltoides_lateral'], s: ['triceps'], scale: 1.35 });
X('Press de hombros en máquina', {
  pose: rep(sit({ armN: { a: [-150, 178] } }), sit({ armN: { a: [178, 178] } })),
  env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46) + E.pad(CX - 42, FLOOR - 150, 10, 96) + E.frame(CX - 58, FLOOR - 250), front: E.handle(J.limbs.n.hand) }), m: ['deltoides_anterior', 'deltoides_lateral'], s: ['triceps'], scale: 1.35,
});
X('Press Arnold sentado con mancuernas', {
  view: 'front', pose: rep(front({ hy: 60, legs: [8, 0, 0.35, 1], arms: [12, 172, 0.55, 1] }), front({ hy: 60, legs: [8, 0, 0.35, 1], arms: [166, 176] })),
  env: J => ({ back: E.box(CX - 34, FLOOR - 52, 68), front: E.dumbbellFront(J.world.l.hand) + E.dumbbellFront(J.world.r.hand) }), m: ['deltoides_anterior', 'deltoides_lateral'], s: ['triceps'], scale: 1.4,
});
X('Elevaciones laterales', { view: 'front', pose: rep(front({ arms: [10, 8] }), front({ arms: [86, 82] })), env: J => ({ front: E.dumbbellFront(J.world.l.hand, 90) + E.dumbbellFront(J.world.r.hand, 90) }), m: ['deltoides_lateral'], s: ['trapecio'] });
X('Elevación frontal con mancuernas', { pose: rep(stand({ armN: { a: [6, 8] } }), stand({ armN: { a: [92, 94] }, armF: { a: [86, 88] } })), env: db, m: ['deltoides_anterior'], s: ['pectorales'] });
X('Face pull en polea', {
  pose: rep(stand({ hx: -10, torso: 176, armN: { t: pt(CX + 68, FLOOR - 186), bend: -1 } }), stand({ hx: -10, torso: 176, armN: { t: pt(CX + 16, FLOOR - 190), bend: 1 } })),
  env: J => ({ back: E.column(CX + 100, 70) + E.pulley(pt(CX + 92, FLOOR - 190)) + E.cable(pt(CX + 92, FLOOR - 190), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['deltoides_posterior', 'espalda_media'], s: ['trapecio'],
});
X('Pájaros en máquina inversa', {
  view: 'front', pose: rep(front({ back: true, hy: 60, legs: [8, 0, 0.35, 1], arms: [88, 88, 0.22, 0.22] }), front({ back: true, hy: 60, legs: [8, 0, 0.35, 1], arms: [90, 90] })),
  env: J => ({ back: E.box(CX - 34, FLOOR - 52, 68), front: E.handle(J.world.l.hand) + E.handle(J.world.r.hand) }), m: ['deltoides_posterior', 'espalda_media'], s: ['trapecio'], scale: 1.4,
});
X('Pájaros con mancuernas inclinado', { pose: rep(stand({ hx: -16, hy: 86, torso: 112, head: 28, armN: { a: [4, 4] } }), stand({ hx: -16, hy: 86, torso: 112, head: 28, armN: { a: [70, 72], s: [0.35, 0.35] }, armF: { a: [66, 68], s: [0.35, 0.35] } })), env: db, m: ['deltoides_posterior', 'espalda_media'], s: ['trapecio'] });
X('Pull-apart con banda', {
  view: 'front', pose: rep(front({ back: true, arms: [92, 92, 0.25, 0.25] }), front({ back: true, arms: [90, 90] })),
  env: J => ({ front: E.band(J.world.l.hand, J.world.r.hand) }), m: ['deltoides_posterior', 'espalda_media'], s: ['trapecio'], scale: 1.35,
});
X('Rotación externa de hombro con polea', {
  view: 'front', pose: rep(front({ back: true, armR: [6, -70, 1, 0.55], armL: [8, 6] }), front({ back: true, armR: [6, 84], armL: [8, 6] })),
  env: J => ({ back: E.column(CX - 120, 70) + E.pulley(pt(CX - 112, FLOOR - 128)), front: E.cable(pt(CX - 112, FLOOR - 128), J.world.r.hand) + E.handle(J.world.r.hand) }), m: ['deltoides_posterior'], s: ['espalda_media'], scale: 1.35,
});
X('Encogimientos con mancuernas', { view: 'front', pose: rep(front({ back: true, arms: [6, 4] }), front({ back: true, arms: [6, 4], shrug: 10 })), env: J => ({ front: E.dumbbellFront(J.world.l.hand, 90) + E.dumbbellFront(J.world.r.hand, 90) }), m: ['trapecio'], s: ['antebrazos'] });
X('Elevación de brazos en Y boca abajo', { pose: rep(prone({ armN: { a: [118, 118] }, armF: { a: [116, 116] } }), prone({ armN: { a: [106, 106] }, armF: { a: [104, 104] }, torso: 92 })), m: ['deltoides_posterior', 'espalda_media', 'trapecio'], s: ['lumbares'], scale: 1.25, cx: CX - 10, shadowW: 110, env: () => ({ back: E.mat(CX - 140, CX + 140) }) });
X('Y-T-W boca abajo', {
  view: 'front', shadow: false, scale: 1.3,
  pose: seq(front({ back: true, rot: 90, hy: 150, arms: [150, 150], legs: [3, 0] }), front({ back: true, rot: 90, hy: 150, arms: [92, 92], legs: [3, 0] }), front({ back: true, rot: 90, hy: 150, arms: [55, 150], legs: [3, 0] })),
  env: () => ({ back: `<rect class="mat" x="${CX - 150}" y="${FLOOR - 182}" width="300" height="64" rx="6"/>` }),
  m: ['deltoides_posterior', 'espalda_media', 'trapecio'],
});
X('Flexiones escapulares contra pared', (() => {
  const hand = pt(CX + 58, FLOOR - 150);
  const p = d => ({ ...stand({ hx: -14 + d, torso: 166, footN: -20, footF: -24, armN: { t: hand, bend: -1 }, armF: { t: pt(hand.x - 2, hand.y + 2), bend: -1 } }) });
  return { pose: rep(p(0), p(5)), env: () => ({ back: E.wall(CX + 62) }), m: ['espalda_media'], s: ['pectorales', 'deltoides_anterior'] };
})());
X('Retracción escapular de pie', { view: 'front', pose: rep(front({ back: true, arms: [14, 10] }), front({ back: true, arms: [6, 4], retract: 4, shrug: -2 })), m: ['espalda_media', 'trapecio'], s: ['deltoides_posterior'] });
X('Círculos de brazos controlados', { view: 'front', pose: phi => front({ arms: [90 + 10 * Math.sin(phi), 90 + 10 * Math.sin(phi), 1, 1], armR: [90 + 10 * Math.sin(phi), 90 + 10 * Math.sin(phi)], armL: [90 + 10 * Math.sin(phi), 90 + 10 * Math.sin(phi)] }), m: ['deltoides_lateral', 'deltoides_anterior'], s: ['trapecio'] });

// ======================= PECHO =======================
const benchPress = (o = {}) => {
  const y = o.y ?? FLOOR - 46, sh = pt(CX + 22 - 64, y - 12);
  const mk = (dy, dx = 0) => supine({ y, armN: { t: pt(sh.x + 4 + dx, sh.y - dy), bend: o.bend ?? 1 }, armF: { t: pt(sh.x + dx, sh.y - dy + 1), bend: o.bend ?? 1 } });
  return { pose: rep(mk(64), mk(o.depth ?? 10, 6)), scale: 1.3, m: ['pectorales'], s: ['triceps', 'deltoides_anterior'], ...o.extra };
};
X('Press de banca con barra', benchPress({ extra: { env: J => ({ back: E.bench(CX - 80, CX + 40, FLOOR - 46), front: E.plate(J.limbs.n.hand, 22) }) } }));
X('Press de banca con mancuernas', benchPress({ extra: { env: J => ({ back: E.bench(CX - 80, CX + 40, FLOOR - 46), front: E.dumbbell(J.limbs.n.hand, 90) }) } }));
X('Press de pecho con mancuernas en el suelo', benchPress({ y: FLOOR - 4, depth: 6, extra: { env: J => ({ back: E.mat(CX - 110, CX + 110), front: E.dumbbell(J.limbs.n.hand, 90) }) } }));
X('Press inclinado con mancuernas', (() => {
  const hip = pt(CX + 24, FLOOR - 62), ang = -126, sh = pt(hip.x + Math.sin(ang * Math.PI / 180) * 64, hip.y + Math.cos(ang * Math.PI / 180) * 64);
  const mk = (d, k) => ({ hip, torso: ang, head: 20, arms: { n: { t: pt(sh.x + 10 + k, sh.y - d), bend: 1 }, f: { t: pt(sh.x + 6 + k, sh.y - d + 1), bend: 1 } }, legs: { n: { t: pt(hip.x + 58, FLOOR - 6), bend: -1 }, f: { t: pt(hip.x + 52, FLOOR - 6), bend: -1 } } });
  return { pose: rep(mk(66, 8), mk(12, 0)), env: J => ({ back: E.inclineBench(pt(CX + 30, FLOOR - 52), 36, 96), front: E.dumbbell(J.limbs.n.hand, 90) }), m: ['pectorales'], s: ['deltoides_anterior', 'triceps'], scale: 1.3 };
})());
X('Press de pecho en máquina', { pose: rep(sit({ armN: { t: pt(CX + 10, FLOOR - 136), bend: -1 } }), sit({ armN: { t: pt(CX + 62, FLOOR - 136), bend: -1 } })), env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46) + E.pad(CX - 42, FLOOR - 150, 10, 96) + E.frame(CX + 76, FLOOR - 240), front: E.handle(J.limbs.n.hand) }), m: ['pectorales'], s: ['triceps', 'deltoides_anterior'] });
X('Press declinado en máquina', { pose: rep(sit({ torso: 186, armN: { t: pt(CX + 6, FLOOR - 122), bend: -1 } }), sit({ torso: 186, armN: { t: pt(CX + 56, FLOOR - 108), bend: -1 } })), env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46) + E.pad(CX - 46, FLOOR - 150, 10, 96, -8) + E.frame(CX + 76, FLOOR - 240), front: E.handle(J.limbs.n.hand) }), m: ['pectorales'], s: ['triceps'] });
X('Press de pecho en polea de pie', { pose: rep(stand({ footN: 24, footF: -26, torso: 172, armN: { t: pt(CX + 22, FLOOR - 152), bend: -1 } }), stand({ footN: 24, footF: -26, torso: 172, armN: { t: pt(CX + 74, FLOOR - 154), bend: -1 } })), env: J => ({ back: E.column(CX - 100, 70) + E.pulley(pt(CX - 92, FLOOR - 160)) + E.cable(pt(CX - 92, FLOOR - 160), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['pectorales'], s: ['triceps', 'deltoides_anterior'] });
X('Press de pecho con banda', { pose: rep(stand({ footN: 24, footF: -26, torso: 174, armN: { t: pt(CX + 22, FLOOR - 154), bend: -1 } }), stand({ footN: 24, footF: -26, torso: 174, armN: { t: pt(CX + 74, FLOOR - 156), bend: -1 } })), env: J => ({ back: E.wallL(CX - 96) + E.band(pt(CX - 96, FLOOR - 160), J.limbs.f.hand), front: E.band(pt(CX - 96, FLOOR - 160), J.limbs.n.hand) + E.handle(J.limbs.n.hand) }), m: ['pectorales'], s: ['triceps'] });
const fly = (cables, floor) => ({
  view: 'front', shadow: false, scale: 1.25,
  pose: rep(front({ rot: 90, hy: 150, arms: [78, 78, 0.2, 0.2], legs: [4, 2] }), front({ rot: 90, hy: 150, arms: [96, 92], legs: [4, 2] })),
  env: J => ({ back: (floor ? `<rect class="mat" x="${CX - 150}" y="${FLOOR - 182}" width="300" height="64" rx="6"/>` : `<rect class="pad" x="${CX - 112}" y="${FLOOR - 166}" width="124" height="32" rx="8"/>`) + (cables ? E.cable(pt(J.world.l.hand.x, 100), J.world.l.hand) + E.cable(pt(J.world.r.hand.x, FLOOR), J.world.r.hand) : ''), front: cables ? E.handle(J.world.l.hand) + E.handle(J.world.r.hand) : E.dumbbellFront(J.world.l.hand, 90) + E.dumbbellFront(J.world.r.hand, 90) }),
  m: ['pectorales'], s: ['deltoides_anterior'],
});
X('Aperturas con mancuernas en banco', fly(false, false));
X('Aperturas con mancuernas en el suelo', fly(false, true));
X('Aperturas en polea en banco plano', fly(true, false));
const crossover = high => ({
  view: 'front', scale: 1.3,
  pose: rep(front({ arms: high ? [128, 118] : [42, 36] }), front({ arms: high ? [28, -10, 0.85, 0.8] : [64, -40, 0.8, 0.8] })),
  env: J => { const y = high ? 110 : FLOOR - 24; return { back: E.column(CX - 130, 60) + E.column(CX + 130, 60) + E.pulley(pt(CX - 122, y)) + E.pulley(pt(CX + 122, y)), front: E.cable(pt(CX - 122, y), J.world.l.hand) + E.cable(pt(CX + 122, y), J.world.r.hand) + E.handle(J.world.l.hand) + E.handle(J.world.r.hand) }; },
  m: ['pectorales'], s: ['deltoides_anterior'],
});
X('Cruce de poleas alto a bajo', crossover(true));
X('Cruce de poleas bajo a alto', crossover(false));
X('Flexiones clásicas', pushup({}));
X('Flexiones con pies elevados', (() => { const sp = pushup({ foot: CX - 116 }); const lift = p => ({ ...p }); void lift; return { ...pushup({}), pose: rep(...[100, 92].map(ang => { const box = pt(CX - 118, FLOOR - 40); const h = plankHip(ang, box.x, box.y); return { ...plankPose({ ang, hand: pt(CX + 40, FLOOR - 4) }), hip: h }; })), env: () => ({ back: E.box(CX - 140, FLOOR - 40, 40) }) }; })());
X('Flexiones desde rodillas', pushup({ knees: true, foot: CX - 70, startAng: 112, endAng: 100 }));
X('Flexiones inclinadas contra una mesa firme', (() => { const hand = pt(CX + 46, FLOOR - 74); const mk = ang => { const h = plankHip(ang, CX - 92); return { ...plankPose({ ang, hand }), hip: h }; }; return { pose: rep(mk(122), mk(108)), env: () => ({ back: E.table(CX + 26, CX + 110, FLOOR - 70) }), m: ['pectorales', 'triceps'], s: ['deltoides_anterior', 'abdominales'], scale: 1.3, cx: CX - 10 }; })());
X('Flexiones contra la pared', (() => { const hand = pt(CX + 52, FLOOR - 150); const mk = d => stand({ hx: -24 + d, torso: 160 + d * .6, footN: -28, footF: -32, armN: { t: hand, bend: -1 }, armF: { t: pt(hand.x - 2, hand.y + 2), bend: -1 } }); return { pose: rep(mk(0), mk(22)), env: () => ({ back: E.wall(CX + 58) }), m: ['pectorales', 'triceps'], s: ['deltoides_anterior'] }; })());

// ======================= ESPALDA =======================
const hang = (assist, m, s) => {
  const barY = 68, hand = pt(CX + 6, barY + 2);
  const mk = hipY => ({ hip: pt(CX - 4, hipY), torso: 182, head: 0, arms: { n: { t: hand, bend: -1 }, f: { t: pt(hand.x - 4, hand.y), bend: -1 } }, legs: assist ? { n: { a: [6, -88] }, f: { a: [2, -90] } } : { n: { a: [14, -40] }, f: { a: [6, -50] } }, feet: assist ? { n: 180, f: 180 } : undefined });
  return { trailPoint: 'cabeza', pose: rep(mk(196), mk(150)), scale: 1.2, shadow: false, env: J => ({ back: E.bar(CX - 70, CX + 80, barY) + (assist ? E.padC(pt(J.limbs.n.knee.x - 16, J.limbs.n.knee.y + 10), 44, 10) + E.frame(CX - 52, J.limbs.n.knee.y + 14) : '') }), m, s };
};
X('Dominadas', hang(false, ['dorsales', 'biceps'], ['espalda_media', 'antebrazos']));
X('Dominadas supinas', hang(false, ['dorsales', 'biceps'], ['espalda_media']));
X('Dominadas asistidas', hang(true, ['dorsales', 'biceps'], ['espalda_media']));
const pulldown = {
  pose: rep(sit({ torso: 188, armN: { t: pt(CX + 6, FLOOR - 196), bend: -1 } }), sit({ torso: 190, armN: { t: pt(CX + 14, FLOOR - 128), bend: -1 } })),
  env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46) + E.frame(CX - 70, 60, CX + 40) + E.cable(pt(J.limbs.n.hand.x, 64), J.limbs.n.hand), front: E.padC(pt(CX + 34, FLOOR - 68), 22, 12) + `<circle class="eq" cx="${J.limbs.n.hand.x}" cy="${J.limbs.n.hand.y}" r="5"/>` }),
  m: ['dorsales'], s: ['biceps', 'espalda_media'], scale: 1.3,
};
X('Jalón al pecho', pulldown);
X('Jalón al pecho con agarre neutro', pulldown);
X('Remo sentado en polea', {
  pose: rep({ hip: pt(CX - 50, FLOOR - 40), torso: 166, head: 0, arms: { n: { t: pt(CX + 40, FLOOR - 96), bend: -1 }, f: { t: pt(CX + 36, FLOOR - 96), bend: -1 } }, legs: { n: { t: pt(CX + 40, FLOOR - 28), bend: 1 }, f: { t: pt(CX + 36, FLOOR - 28), bend: 1 } }, feet: { n: 160, f: 160 } },
    { hip: pt(CX - 50, FLOOR - 40), torso: 184, head: 0, arms: { n: { t: pt(CX - 24, FLOOR - 82), bend: -1 }, f: { t: pt(CX - 28, FLOOR - 82), bend: -1 } }, legs: { n: { t: pt(CX + 40, FLOOR - 28), bend: 1 }, f: { t: pt(CX + 36, FLOOR - 28), bend: 1 } }, feet: { n: 160, f: 160 } }),
  env: J => ({ back: E.box(CX - 90, FLOOR - 30, 80) + E.pad(CX + 54, FLOOR - 52, 8, 52) + E.column(CX + 100, 100) + E.pulley(pt(CX + 92, FLOOR - 70)) + E.cable(pt(CX + 92, FLOOR - 70), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }),
  m: ['dorsales', 'espalda_media'], s: ['biceps', 'deltoides_posterior'], scale: 1.4, cx: CX - 10,
});
const oneArmRow = (load, env) => {
  const mk = arm => ({ hip: pt(CX - 30, FLOOR - 100), torso: 96, head: -10, arms: { n: arm, f: { t: pt(CX + 40, FLOOR - 55), bend: -1 } }, legs: { n: { t: pt(CX - 46, FLOOR - 6), bend: 1 }, f: { a: [2, -90] } }, feet: { f: 180 } });
  return { pose: rep(mk({ a: [2, 2] }), mk({ a: [-155, 4] })), env: J => ({ back: E.bench(CX - 50, CX + 60, FLOOR - 46), front: load(J.limbs.n.hand) }), m: ['dorsales', 'espalda_media'], s: ['biceps', 'deltoides_posterior'], ...env };
};
X('Remo con mancuerna a una mano', oneArmRow(h => E.dumbbell(h)));
X('Remo con mochila cargada con seguridad', oneArmRow(h => E.backpack(h)));
X('Remo con barra', { pose: rep(stand({ hx: -18, hy: 86, torso: 116, head: 26, armN: { a: [2, 2] } }), stand({ hx: -18, hy: 86, torso: 116, head: 26, armN: { a: [-140, 8] } })), env: J => ({ front: E.plate(J.limbs.n.hand, 22) }), m: ['dorsales', 'espalda_media'], s: ['biceps', 'lumbares'] });
X('Remo con mancuernas en banco inclinado', (() => {
  const hip = pt(CX - 24, FLOOR - 86), ang = 130;
  const mk = arm => ({ hip, torso: ang, head: 0, arms: { n: arm, f: arm.t ? arm : { a: arm.a.map(v => v - 4) } }, legs: { n: { t: pt(CX - 66, FLOOR - 6), bend: 1 }, f: { t: pt(CX - 72, FLOOR - 6), bend: 1 } } });
  return { pose: rep(mk({ a: [2, 2] }), mk({ a: [-150, 6] })), env: J => ({ back: E.padC(mid(J.hip, J.sh, 19, 40), 92, 12, -40) + `<line x1="${CX + 4}" y1="${FLOOR - 104}" x2="${CX + 24}" y2="${FLOOR}" stroke="#7d858e" stroke-width="5"/>`, front: E.dumbbell(J.limbs.n.hand) }), m: ['dorsales', 'espalda_media'], s: ['deltoides_posterior', 'biceps'] };
})());
X('Remo en máquina con pecho apoyado', { pose: rep(sit({ torso: 172, armN: { t: pt(CX + 62, FLOOR - 120), bend: -1 } }), sit({ torso: 174, armN: { t: pt(CX + 10, FLOOR - 112), bend: -1 } })), env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46) + E.frame(CX + 78, FLOOR - 220), front: E.padC(pt(CX + 30, FLOOR - 98), 12, 40) + E.handle(J.limbs.n.hand) }), m: ['dorsales', 'espalda_media'], s: ['biceps', 'deltoides_posterior'] });
X('Remo unilateral en polea', { pose: rep(stand({ footN: 26, footF: -24, torso: 168, armN: { t: pt(CX + 76, FLOOR - 150), bend: -1 }, armF: { a: [-20, 60] } }), stand({ footN: 26, footF: -24, torso: 172, armN: { t: pt(CX + 6, FLOOR - 140), bend: -1 }, armF: { a: [-20, 60] } })), env: J => ({ back: E.column(CX + 106, 70) + E.pulley(pt(CX + 98, FLOOR - 150)) + E.cable(pt(CX + 98, FLOOR - 150), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['dorsales', 'espalda_media'], s: ['biceps'] });
X('Remo con banda elástica sentado', (() => {
  const mk = (hand, t) => ({ hip: pt(CX - 50, FLOOR - 14), torso: t, head: 0, arms: { n: { t: hand, bend: -1 }, f: { t: pt(hand.x - 4, hand.y), bend: -1 } }, legs: { n: { a: [88, 88] }, f: { a: [90, 90] } }, feet: { n: 180, f: 180 } });
  return { pose: rep(mk(pt(CX + 22, FLOOR - 64), 170), mk(pt(CX - 30, FLOOR - 58), 182)), env: J => ({ back: E.mat(CX - 110, CX + 110), front: E.band(pt(J.limbs.n.ankle.x + 12, J.limbs.n.ankle.y - 6), J.limbs.n.hand) + E.handle(J.limbs.n.hand) }), m: ['dorsales', 'espalda_media'], s: ['biceps'], scale: 1.4, cx: CX - 10 };
})());
X('Remo isométrico con toalla segura', { pose: hold(stand({ hx: -8, torso: 174, armN: { t: pt(CX + 38, FLOOR - 140), bend: -1 } }), stand({ hx: -10, torso: 176, armN: { t: pt(CX + 26, FLOOR - 140), bend: -1 } }), 1), env: J => ({ back: `<rect class="met" x="${CX + 86}" y="60" width="10" height="${FLOOR - 60}"/>`, front: E.towel(J.limbs.n.hand, pt(CX + 86, FLOOR - 140)) }), m: ['espalda_media', 'dorsales'], s: ['biceps', 'deltoides_posterior'] });
X('Jalón con brazos rectos en polea', { pose: rep(stand({ hx: -14, torso: 162, head: 10, armN: { a: [148, 150] } }), stand({ hx: -14, torso: 164, head: 10, armN: { a: [14, 14] } })), env: J => ({ back: E.column(CX + 110, 70) + E.pulley(pt(CX + 102, 122)) + E.cable(pt(CX + 102, 122), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['dorsales'], s: ['triceps', 'abdominales'], scale: 1.4 });
X('Pullover con mancuerna en el suelo', { pose: rep(supine({ armN: { a: [178, 178] } }), supine({ armN: { a: [-102, -100] } })), env: J => ({ back: E.mat(CX - 120, CX + 110), front: E.dumbbell(J.limbs.n.hand, 90) }), m: ['dorsales', 'pectorales'], s: ['triceps', 'abdominales'], scale: 1.35 });
X('Extensión lumbar en banco', (() => {
  const hip = pt(CX - 6, FLOOR - 104);
  const mk = t => ({ hip, torso: t, head: 0, arms: { n: { a: [t - 168, t - 40] }, f: { a: [t - 172, t - 44] } }, legs: { n: { a: [-48, -48] }, f: { a: [-50, -50] } }, feet: { n: 40, f: 40 } });
  return { pose: rep(mk(42), mk(128)), env: J => ({ back: E.padC(pt(hip.x + 10, hip.y + 16), 40, 14, -40) + E.padC(pt(J.limbs.n.ankle.x + 4, J.limbs.n.ankle.y + 9), 18, 10, -40) + `<line x1="${hip.x + 10}" y1="${hip.y + 20}" x2="${hip.x - 30}" y2="${FLOOR}" stroke="#7d858e" stroke-width="5"/><line x1="${J.limbs.n.ankle.x}" y1="${J.limbs.n.ankle.y + 12}" x2="${J.limbs.n.ankle.x}" y2="${FLOOR}" stroke="#7d858e" stroke-width="5"/>` }), m: ['lumbares', 'gluteos'], s: ['isquiotibiales'], scale: 1.35 };
})());
X('Superman alternado', { pose: alt(prone({}), prone({ armN: { a: [104, 104] }, legF: { a: [-102, -102] }, torso: 94 }), prone({ armF: { a: [102, 102] }, legN: { a: [-102, -102] }, torso: 94 })), env: () => ({ back: E.mat(CX - 140, CX + 140) }), m: ['lumbares', 'gluteos'], s: ['espalda_media', 'isquiotibiales'], scale: 1.25, cx: CX - 10, shadowW: 110 });
X('Superman estático', { pose: rep(prone({}), prone({ armN: { a: [104, 104] }, armF: { a: [102, 102] }, legN: { a: [-102, -102] }, legF: { a: [-104, -104] }, torso: 95 })), env: () => ({ back: E.mat(CX - 140, CX + 140) }), m: ['lumbares', 'gluteos'], s: ['espalda_media', 'isquiotibiales'], scale: 1.25, cx: CX - 10, shadowW: 110 });
const quad = (o = {}) => ({ hip: pt(CX - 32 + (o.dx || 0), FLOOR - 54 - (o.dy || 0)), torso: o.torso ?? 100, head: o.head ?? 0, arms: { n: o.armN ?? { t: pt(CX + 32, FLOOR - 4), bend: -1 }, f: o.armF ?? { t: pt(CX + 28, FLOOR - 4), bend: -1 } }, legs: { n: o.legN ?? { a: [0, -90] }, f: o.legF ?? { a: [-2, -92] } }, feet: { n: 180, f: 180 } });
X('Gato-vaca para movilidad de columna', { pose: rep(quad({ torso: 94, head: 30, dy: 2 }), quad({ torso: 106, head: -40, dy: -2 })), env: () => ({ back: E.mat(CX - 120, CX + 100) }), m: ['lumbares', 'abdominales'], s: ['espalda_media'], scale: 1.4, shadowW: 80 });

// ======================= PIERNAS Y GLÚTEOS =======================
const angTo = (a, b) => Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI;
const squat = (o = {}) => rep(stand({ armN: o.armTop ?? { a: [2, 4] }, ...(o.top || {}) }), stand({ hx: -26, hy: 54, torso: 150, head: 24, armN: o.armBot ?? { a: [2, 4] }, ...(o.bot || {}) }));
X('Sentadilla goblet', { pose: squat({ armTop: { t: pt(CX + 24, FLOOR - 150) }, armBot: { t: pt(CX + 20, FLOOR - 118) } }), env: J => ({ front: E.kettlebell(pt(J.limbs.n.hand.x + 2, J.limbs.n.hand.y - 6)) }), m: ['cuadriceps', 'gluteos'], s: ['aductores', 'abdominales'] });
X('Sentadilla al aire', { pose: squat({ armBot: { a: [92, 92] } }), m: ['cuadriceps', 'gluteos'], s: ['aductores', 'abdominales'] });
X('Sentadilla a una silla', { pose: rep(stand({ armN: { a: [2, 4] } }), stand({ hx: -30, hy: 60, torso: 148, head: 24, armN: { a: [90, 90] } })), env: () => ({ back: E.chair(CX - 46, FLOOR - 50, -1) }), m: ['cuadriceps', 'gluteos'], s: ['aductores'] });
X('Sentarse y levantarse de un banco', { pose: rep(stand({}), stand({ hx: -30, hy: 60, torso: 150, head: 24 })), env: J => ({ back: E.bench(CX - 90, CX - 14, FLOOR - 50) + E.dumbbell(J.limbs.f.hand), front: E.dumbbell(J.limbs.n.hand) }), m: ['cuadriceps', 'gluteos'], s: ['aductores'] });
X('Sentadilla hack en máquina', (() => {
  const mk = (hx, hy, t) => ({ hip: pt(CX + hx, FLOOR - hy), torso: t, head: -8, arms: { n: { a: [t - 170, t + 30] }, f: { a: [t - 174, t + 26] } }, legs: { n: { t: pt(CX + 40, FLOOR - 26), bend: 1 }, f: { t: pt(CX + 36, FLOOR - 26), bend: 1 } }, feet: { n: 110, f: 110 } });
  return { scale: 1.3, pose: rep(mk(-6, 98, 196), mk(-34, 64, 200)), env: J => ({ back: `<line x1="${CX - 120}" y1="${FLOOR}" x2="${CX + 30}" y2="${FLOOR - 250}" stroke="#4b545e" stroke-width="8"/>` + E.padC(mid(J.hip, J.sh, 15, -110), 70, 12, 70) + E.padC(pt(CX + 46, FLOOR - 18), 40, 8, -20) }), m: ['cuadriceps', 'gluteos'], s: ['aductores'] };
})());
X('Sentadilla en multipower', { pose: squat({ top: { armN: { a: [-40, 175] } }, bot: { armN: { a: [-70, 120] } } }), env: J => ({ back: `<rect class="met" x="${CX - 30}" y="80" width="5" height="${FLOOR - 80}"/>`, front: E.plate(pt(J.sh.x - 8, J.sh.y - 2), 22) }), m: ['cuadriceps', 'gluteos'], s: ['aductores', 'lumbares'] });
X('Sentadilla frontal con barra', { pose: rep(stand({ armN: { a: [92, -140] } }), stand({ hx: -22, hy: 54, torso: 162, head: 14, armN: { a: [88, -140] } })), env: J => ({ front: E.plate(J.limbs.n.hand, 22) }), m: ['cuadriceps', 'gluteos'], s: ['abdominales', 'espalda_media'] });
X('Prensa de piernas', (() => {
  const hip = pt(CX - 36, FLOOR - 58), ang = -128;
  const mk = foot => ({ hip, torso: ang, head: 30, arms: { n: { a: [-20, 20] }, f: { a: [-24, 16] } }, legs: { n: { t: foot, bend: -1 }, f: { t: pt(foot.x - 4, foot.y + 2), bend: -1 } }, feet: { n: 140, f: 140 } });
  return { pose: rep(mk(pt(CX + 46, FLOOR - 140)), mk(pt(CX + 10, FLOOR - 104))), env: J => ({ back: E.padC(mid(J.hip, J.sh, 13, 128), 74, 12, 38) + E.box(CX - 70, FLOOR - 46, 60) + E.padC(pt(J.limbs.n.ankle.x + 10, J.limbs.n.ankle.y - 6), 64, 9, -45) + `<line x1="${CX - 10}" y1="${FLOOR}" x2="${CX + 110}" y2="${FLOOR - 200}" stroke="#4b545e" stroke-width="6"/>` }), m: ['cuadriceps', 'gluteos'], s: ['isquiotibiales', 'aductores'], scale: 1.35 };
})());
const split = (o = {}) => rep(
  stand({ footN: 34, footF: -44, hy: 86, hx: -4, armN: o.armN ?? { a: [2, 4] }, armF: o.armF, feet: { f: 55 }, legF: { t: pt(CX - 44, FLOOR - 9), bend: 1 } }),
  stand({ footN: 34, footF: -44, hy: 54, hx: -6, armN: o.armN ?? { a: [2, 4] }, armF: o.armF, feet: { f: 40 }, legF: { t: pt(CX - 44, FLOOR - 9), bend: 1 } }));
X('Sentadilla dividida con mancuernas', { pose: split(), env: db, m: ['cuadriceps', 'gluteos'], s: ['isquiotibiales', 'aductores'] });
X('Sentadilla dividida con apoyo', { pose: split({ armF: { t: pt(CX + 70, FLOOR - 96), bend: -1 } }), env: () => ({ back: E.chair(CX + 92, FLOOR - 50, 1) }), m: ['cuadriceps', 'gluteos'], s: ['isquiotibiales'] });
const revLunge = load => ({ pose: rep(stand({}), stand({ footN: 10, footF: -50, hy: 54, hx: -10, feet: { f: 40 }, legF: { t: pt(CX - 50, FLOOR - 9), bend: 1 } })), env: load ? db : undefined, m: ['cuadriceps', 'gluteos'], s: ['isquiotibiales'] });
X('Zancada hacia atrás con mancuernas', revLunge(true));
X('Zancada hacia atrás sin peso', revLunge(false));
const stepUp = load => ({
  pose: rep(stand({ hx: -10, hy: 92, footN: 30, footF: -24, legN: { t: pt(CX + 30, FLOOR - 46), bend: 1 } }), stand({ hx: 24, hy: 134, footN: 30, footF: 22, legN: { t: pt(CX + 30, FLOOR - 46), bend: 1 }, legF: { t: pt(CX + 20, FLOOR - 52), bend: 1 } })),
  env: J => ({ back: E.box(CX + 2, FLOOR - 40, 70) + (load ? E.dumbbell(J.limbs.f.hand) : ''), front: load ? E.dumbbell(J.limbs.n.hand) : '' }), m: ['cuadriceps', 'gluteos'], s: ['isquiotibiales', 'gemelos'], scale: 1.35,
});
X('Subidas a escalón con mancuernas', stepUp(true));
X('Subir y bajar un escalón estable', { ...stepUp(false), m: ['cuadriceps', 'gluteos'], s: ['gemelos'] });
X('Zancada lateral asistida', { view: 'front', pose: rep(front({ legs: [4, 2] }), front({ hx: 22, hy: 78, legL: [36, 36], legR: [12, -4, 0.62, 1], arms: [20, 40] })), m: ['cuadriceps', 'gluteos', 'aductores'], s: ['gluteo_medio'], shadowW: 70 });
const hinge = (o = {}) => rep(stand({ armN: o.arm ?? { a: [2, 2] }, ...(o.top || {}) }), stand({ hx: -28, hy: 88, torso: 100, head: 34, armN: o.arm ?? { a: [2, 2] }, ...(o.bot || {}) }));
X('Peso muerto rumano con mancuernas', { pose: hinge(), env: db, m: ['isquiotibiales', 'gluteos'], s: ['lumbares', 'antebrazos'] });
X('Peso muerto convencional con barra', { pose: rep(stand({ armN: { a: [2, 2] } }), stand({ hx: -22, hy: 62, torso: 128, head: 26, armN: { a: [2, 2] } })), env: J => ({ front: E.plate(J.limbs.n.hand, 23) }), m: ['gluteos', 'isquiotibiales', 'lumbares'], s: ['cuadriceps', 'trapecio', 'antebrazos'] });
X('Peso muerto con trap bar', { pose: rep(stand({ armN: { a: [2, 2] } }), stand({ hx: -16, hy: 60, torso: 140, head: 20, armN: { a: [2, 2] } })), env: J => ({ back: `<rect class="met" x="${J.limbs.n.hand.x - 30}" y="${J.limbs.n.hand.y - 3}" width="60" height="6" rx="3"/>`, front: E.plate(pt(J.limbs.n.hand.x + 34, J.limbs.n.hand.y), 23) }), m: ['cuadriceps', 'gluteos'], s: ['isquiotibiales', 'lumbares', 'trapecio'] });
X('Buenos días con barra ligera', { pose: hinge({ arm: { a: [-60, 170] } }), env: J => ({ front: E.plate(pt(J.sh.x - 9, J.sh.y - 2), 20) }), m: ['isquiotibiales', 'lumbares'], s: ['gluteos'] });
X('Buenos días sin peso', { pose: hinge({ arm: { a: [-30, 178] } }), m: ['isquiotibiales', 'lumbares'], s: ['gluteos'] });
X('Peso muerto rumano a una pierna', { pose: rep(stand({ armN: { a: [2, 2] } }), stand({ hx: -16, hy: 90, torso: 96, head: 30, armN: { a: [2, 2] }, legF: { a: [-84, -84] }, feet: { f: 0 } })), env: J => ({ front: E.dumbbell(J.limbs.n.hand) }), m: ['isquiotibiales', 'gluteos'], s: ['gluteo_medio', 'lumbares'] });
const bridgePose = (shoulder, hipY, hipX, o = {}) => { const hip = pt(hipX, hipY); return { hip, torso: angTo(hip, shoulder), head: o.head ?? 0, arms: { n: o.armN ?? { a: [angTo(hip, shoulder) - 160, angTo(hip, shoulder) - 160] }, f: o.armF ?? { a: [angTo(hip, shoulder) - 164, angTo(hip, shoulder) - 164] } }, legs: { n: o.legN ?? { t: pt(o.footX ?? hipX + 50, FLOOR - 6), bend: 1 }, f: o.legF ?? { t: pt((o.footX ?? hipX + 50) - 4, FLOOR - 6), bend: 1 } }, feet: o.feet }; };
const thrust = (env, m = ['gluteos'], s = ['isquiotibiales', 'cuadriceps']) => { const sh = pt(CX - 46, FLOOR - 54); return { pose: rep(bridgePose(sh, FLOOR - 24, CX + 6, { footX: CX + 60, head: 30 }), bridgePose(sh, FLOOR - 62, CX + 16, { footX: CX + 60, head: 0 })), env, m, s, scale: 1.4 }; };
X('Hip thrust con barra o máquina', thrust(J => ({ back: E.bench(CX - 100, CX - 40, FLOOR - 46), front: E.plate(pt(J.hip.x + 4, J.hip.y - 20), 22) })));
X('Hip thrust con sofá firme', thrust(() => ({ back: E.sofa(CX - 130, CX - 40, FLOOR - 44) })));
const floorBridge = (top, bottom, extra = {}) => ({ pose: rep(bottom, top), env: () => ({ back: E.mat(CX - 120, CX + 110) }), m: ['gluteos'], s: ['isquiotibiales', 'lumbares'], scale: 1.45, ...extra });
const shF = pt(CX - 50, FLOOR - 12);
X('Puente de glúteos', floorBridge(bridgePose(shF, FLOOR - 52, CX + 8), bridgePose(shF, FLOOR - 16, CX + 6)));
X('Puente de glúteos a una pierna asistido', floorBridge(bridgePose(shF, FLOOR - 50, CX + 8, { legF: { a: [118, 118] } }), bridgePose(shF, FLOOR - 16, CX + 6, { legF: { a: [100, 100] } }), { m: ['gluteos', 'isquiotibiales'], s: ['gluteo_medio'] }));
X('Elevación de cadera en marcha', { pose: alt(bridgePose(shF, FLOOR - 52, CX + 8), bridgePose(shF, FLOOR - 52, CX + 8, { legN: { t: pt(CX + 54, FLOOR - 34), bend: 1 } }), bridgePose(shF, FLOOR - 52, CX + 8, { legF: { t: pt(CX + 50, FLOOR - 34), bend: 1 } })), env: () => ({ back: E.mat(CX - 120, CX + 110) }), m: ['gluteos'], s: ['isquiotibiales', 'abdominales'], scale: 1.45 });
X('Curl femoral deslizante con toalla', { pose: rep(bridgePose(shF, FLOOR - 48, CX + 8, { footX: CX + 56 }), bridgePose(shF, FLOOR - 34, CX + 8, { footX: CX + 92, legN: { t: pt(CX + 92, FLOOR - 6), bend: 1 }, legF: { t: pt(CX + 88, FLOOR - 6), bend: 1 } })), env: J => ({ back: E.mat(CX - 120, CX + 120), front: `<rect x="${J.limbs.n.ankle.x - 12}" y="${FLOOR - 4}" width="30" height="5" rx="2" fill="#d8c7a0"/>` }), m: ['isquiotibiales'], s: ['gluteos'], scale: 1.4 });
X('Pull-through en polea', { pose: rep(stand({ footN: 12, footF: 6, armN: { a: [-6, -6] } }), stand({ footN: 12, footF: 6, hx: -24, hy: 86, torso: 100, head: 30, armN: { a: [-16, -24] } })), env: J => ({ back: E.column(CX - 110, 80) + E.pulley(pt(CX - 102, FLOOR - 16)) + E.cable(pt(CX - 102, FLOOR - 16), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['gluteos', 'isquiotibiales'], s: ['lumbares'] });
X('Pull-through con banda elástica', { pose: rep(stand({ footN: 12, footF: 6, armN: { a: [-6, -6] } }), stand({ footN: 12, footF: 6, hx: -24, hy: 86, torso: 100, head: 30, armN: { a: [-16, -24] } })), env: J => ({ back: `<rect class="met" x="${CX - 110}" y="${FLOOR - 30}" width="8" height="30"/>` + E.band(pt(CX - 104, FLOOR - 20), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['gluteos', 'isquiotibiales'], s: ['lumbares'] });
X('Patada de glúteo en polea', { pose: rep(stand({ torso: 168, armN: { t: pt(CX + 54, FLOOR - 140), bend: -1 }, footF: 4 }), stand({ torso: 164, armN: { t: pt(CX + 54, FLOOR - 140), bend: -1 }, legN: { a: [-38, -30] }, footF: 4 })), env: J => ({ back: E.column(CX + 64, 70) + E.pulley(pt(CX + 56, FLOOR - 14)) + E.cable(pt(CX + 56, FLOOR - 14), J.limbs.n.ankle) }), m: ['gluteos'], s: ['isquiotibiales'] });
X('Patada de glúteo en cuadrupedia', { pose: rep(quad(), quad({ legN: { a: [-100, -96] } })), env: () => ({ back: E.mat(CX - 140, CX + 100) }), m: ['gluteos'], s: ['isquiotibiales', 'lumbares'], scale: 1.35 });
X('Extensión de cuádriceps', { pose: rep(sit({ seatY: FLOOR - 56, legN: { a: [90, 2] }, legF: { a: [90, -2] }, armN: { a: [10, 40] } }), sit({ seatY: FLOOR - 56, legN: { a: [90, 86] }, legF: { a: [90, 82] }, armN: { a: [10, 40] } })), env: J => ({ back: E.bench(CX - 50, CX + 36, FLOOR - 56) + E.pad(CX - 44, FLOOR - 150, 10, 90), front: E.padC(pt(J.limbs.n.ankle.x + 3, J.limbs.n.ankle.y + 2), 12, 12) }), m: ['cuadriceps'] });
X('Curl femoral sentado', { pose: rep(sit({ seatY: FLOOR - 56, legN: { a: [90, 88] }, legF: { a: [90, 86] }, armN: { a: [10, 40] } }), sit({ seatY: FLOOR - 56, legN: { a: [90, 4] }, legF: { a: [90, 2] }, armN: { a: [10, 40] } })), env: J => ({ back: E.bench(CX - 50, CX + 36, FLOOR - 56) + E.pad(CX - 44, FLOOR - 150, 10, 90), front: E.padC(pt(J.limbs.n.ankle.x - 3, J.limbs.n.ankle.y - 4), 12, 12) + E.padC(pt(J.limbs.n.knee.x - 18, J.limbs.n.knee.y - 14), 30, 9) }), m: ['isquiotibiales'], s: ['gemelos'] });
X('Curl femoral tumbado', { pose: rep(prone({ hy: 58, hx: -20, armN: { a: [30, 10] }, armF: { a: [26, 6] } }), prone({ hy: 58, hx: -20, armN: { a: [30, 10] }, armF: { a: [26, 6] }, legN: { a: [-90, 178] }, legF: { a: [-92, 176] }, feet: { n: 90, f: 90 } })), env: J => ({ back: E.bench(CX - 110, CX + 70, FLOOR - 46), front: E.padC(pt(J.limbs.n.ankle.x + 2, J.limbs.n.ankle.y - 8), 12, 12) }), m: ['isquiotibiales'], s: ['gemelos', 'gluteos'], scale: 1.35 });
const calf = (extra, oneLeg) => ({ pose: rep(stand({ ...extra, legF: oneLeg ? { a: [12, -60] } : undefined }), stand({ ...extra, hy: 106, feet: { n: 52, f: oneLeg ? undefined : 52 }, legN: { t: pt(CX + 6, FLOOR - 16), bend: 1 }, legF: oneLeg ? { a: [12, -60] } : { t: pt(CX - 1, FLOOR - 16), bend: 1 } })), m: ['gemelos'], s: ['tibiales'] });
X('Elevación de talones de pie en máquina', { ...calf({ armN: { a: [-30, 170] } }), env: J => ({ back: E.frame(CX - 50, 80, CX + 40) + E.padC(pt(J.sh.x, J.sh.y - 8), 26, 10) }) });
X('Elevación de talones con apoyo', { ...calf({ armN: { t: pt(CX + 52, FLOOR - 140), bend: -1 } }), env: () => ({ back: E.wall(CX + 58) }) });
X('Elevación de talones a una pierna con apoyo', { ...calf({ armN: { t: pt(CX + 52, FLOOR - 140), bend: -1 } }, true), env: () => ({ back: E.wall(CX + 58) }) });
X('Elevación de talones sentado', { pose: rep(sit({ seatY: FLOOR - 56, armN: { a: [20, 80] } }), sit({ seatY: FLOOR - 56, armN: { a: [20, 80] }, feet: { n: 55, f: 55 }, legN: { t: pt(CX + 34, FLOOR - 16), bend: 1 }, legF: { t: pt(CX + 28, FLOOR - 16), bend: 1 } })), env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 56), front: E.padC(pt(J.limbs.n.knee.x - 6, J.limbs.n.knee.y - 10), 34, 10) }), m: ['gemelos'] });
const seatedFront = (a, b, m) => ({ view: 'front', pose: rep(front({ hy: 60, legs: a, arms: [12, 30] }), front({ hy: 60, legs: b, arms: [12, 30] })), env: J => ({ back: E.box(CX - 36, FLOOR - 52, 72) + E.pad(CX - 34, FLOOR - 190, 68, 120), front: E.padC(J.world.l.knee, 10, 18) + E.padC(J.world.r.knee, 10, 18) }), m, scale: 1.4 });
X('Abducción de cadera en máquina', seatedFront([6, -6, 0.38, 1], [38, -4, 0.38, 1], ['gluteo_medio', 'gluteos']));
X('Aductores en máquina', seatedFront([40, -4, 0.38, 1], [6, -6, 0.38, 1], ['aductores']));
X('Abducción de cadera acostado de lado', { view: 'front', shadow: false, scale: 1.3, pose: rep(front({ rot: 90, hy: 46, legL: [2, 0], legR: [2, 0], armL: [176, 176], armR: [20, 10] }), front({ rot: 90, hy: 46, legL: [2, 0], legR: [40, 40], armL: [176, 176], armR: [20, 10] })), env: () => ({ back: E.mat(CX - 160, CX + 160) }), m: ['gluteo_medio'], s: ['gluteos'] });
X('Paso lateral con banda por encima de rodillas', { view: 'front', pose: rep(front({ hy: 88, legs: [6, -2] }), front({ hy: 88, hx: 12, legL: [6, -2], legR: [24, 18] })), env: J => ({ front: E.band(J.world.l.knee, J.world.r.knee) }), m: ['gluteo_medio'], s: ['gluteos'] });
X('Equilibrio a una pierna con apoyo cercano', { pose: hold(stand({ armN: { t: pt(CX + 56, FLOOR - 98), bend: -1 }, legF: { a: [30, -40] } }), stand({ hx: 2, armN: { t: pt(CX + 56, FLOOR - 98), bend: -1 }, legF: { a: [36, -36] } }), 1), env: () => ({ back: E.chair(CX + 74, FLOOR - 50, 1) }), m: ['gluteo_medio', 'gemelos'], s: ['abdominales', 'cuadriceps'] });
X('Sentadilla isométrica en pared', { pose: rep(stand({ hx: -24, footN: 10, footF: 4 }), { hip: pt(CX - 26, FLOOR - 50), torso: 180, head: 0, arms: { n: { a: [6, 6] }, f: { a: [2, 2] } }, legs: { n: { t: pt(CX + 22, FLOOR - 6), bend: 1 }, f: { t: pt(CX + 16, FLOOR - 6), bend: 1 } } }), env: () => ({ back: E.wallL(CX - 40) }), m: ['cuadriceps'], s: ['gluteos'] });
X('Movilidad de tobillo contra pared', { pose: rep(stand({ footN: 34, footF: -40, hy: 88, hx: -2, armN: { t: pt(CX + 74, FLOOR - 130), bend: -1 }, feet: { f: 55 } }), stand({ footN: 34, footF: -40, hy: 80, hx: 12, armN: { t: pt(CX + 74, FLOOR - 130), bend: -1 }, feet: { f: 50 } })), env: () => ({ back: E.wall(CX + 78) }), m: ['gemelos'], s: ['tibiales'] });
X('Estiramiento de flexores de cadera', { pose: rep({ hip: pt(CX - 14, FLOOR - 52), torso: 180, head: 0, arms: { n: { a: [10, 40] }, f: { a: [6, 36] } }, legs: { n: { t: pt(CX + 38, FLOOR - 6), bend: 1 }, f: { a: [-10, -90] } }, feet: { f: 180 } }, { hip: pt(CX - 2, FLOOR - 48), torso: 184, head: 0, arms: { n: { a: [10, 40] }, f: { a: [6, 36] } }, legs: { n: { t: pt(CX + 38, FLOOR - 6), bend: 1 }, f: { a: [-30, -92] } }, feet: { f: 180 } }), env: () => ({ back: E.mat(CX - 100, CX + 100) }), m: ['cuadriceps'], s: ['gluteos', 'abdominales'], scale: 1.4 });
X('Movilidad de cadera en el suelo', { view: 'front', pose: phi => { const w = 34 * Math.sin(phi); return front({ legsFront: true, hy: 12, armL: [34, 20], armR: [34, 20], legL: [150 + w, 20 + w * .6, 0.9, 0.9], legR: [150 - w, 20 - w * .6, 0.9, 0.9] }); }, env: () => ({ back: E.mat(CX - 140, CX + 140) }), m: ['gluteos', 'gluteo_medio'], s: ['oblicuos'], scale: 1.4 });

// ======================= CORE =======================
const plankHold = (o, extra = {}) => { const h = plankHip(o.ang, o.foot ?? CX - 110); const base = { ...plankPose({ ang: o.ang, hand: o.hand ?? pt(CX + 40, FLOOR - 4), forearm: o.forearm }), hip: h }; return { base, spec: { pose: hold(base, { ...base, hip: pt(h.x, h.y - 2) }, 1), m: ['abdominales'], s: ['oblicuos', 'gluteos', 'deltoides_anterior'], scale: 1.25, cx: CX - 20, shadowX: CX - 20, shadowW: 100, ...extra } }; };
X('Plancha frontal', plankHold({ ang: 103.5, forearm: true }).spec);
X('Plancha alta', plankHold({ ang: 105 }).spec);
X('Plancha elevada contra una mesa firme', (() => { const hand = pt(CX + 46, FLOOR - 74), h = plankHip(122, CX - 92); const base = { ...plankPose({ ang: 122, hand }), hip: h }; return { pose: hold(base, { ...base, hip: pt(h.x, h.y - 2) }, 1), env: () => ({ back: E.table(CX + 26, CX + 110, FLOOR - 70) }), m: ['abdominales'], s: ['oblicuos', 'gluteos'], scale: 1.3, cx: CX - 10 }; })());
const kneeDrive = (ang, hand, env) => { const h = plankHip(ang, CX - 110); const base = { ...plankPose({ ang, hand }), hip: h }; const la = ang - 180; return { pose: alt(base, { ...base, legs: { n: { a: [la + 110, la + 10] }, f: base.legs.f } }, { ...base, legs: { n: base.legs.n, f: { a: [la + 108, la + 8] } } }), env, m: ['abdominales'], s: ['cuadriceps', 'deltoides_anterior', 'oblicuos'], scale: 1.25, cx: CX - 20, shadowX: CX - 20, shadowW: 100 }; };
X('Plancha con rodillas al pecho lenta', kneeDrive(105, pt(CX + 40, FLOOR - 4)));
X('Escaladores lentos con manos elevadas', (() => { const hand = pt(CX + 46, FLOOR - 50), ang = 116, h = plankHip(ang, CX - 100); const base = { ...plankPose({ ang, hand }), hip: h }; const la = ang - 180; return { pose: alt(base, { ...base, legs: { n: { a: [la + 104, la + 10] }, f: base.legs.f } }, { ...base, legs: { n: base.legs.n, f: { a: [la + 102, la + 8] } } }), env: () => ({ back: E.box(CX + 24, FLOOR - 46, 70) }), m: ['abdominales'], s: ['cuadriceps', 'deltoides_anterior'], scale: 1.3, cx: CX - 10 }; })());
X('Plancha con toque de hombros desde rodillas', (() => {
  const ang = 112, kneeP = pt(CX - 40, FLOOR - 7), la = (ang - 180) * Math.PI / 180, hip = pt(kneeP.x - Math.sin(la) * 46, kneeP.y - Math.cos(la) * 46);
  const sh = pt(hip.x + Math.sin(ang * Math.PI / 180) * 64, hip.y + Math.cos(ang * Math.PI / 180) * 64);
  const base = { ...plankPose({ ang, hand: pt(sh.x + 4, FLOOR - 4), knees: true }), hip };
  return { pose: alt(base, { ...base, arms: { n: { t: pt(sh.x - 2, sh.y + 10), bend: -1 }, f: base.arms.f } }, { ...base, arms: { n: base.arms.n, f: { t: pt(sh.x - 4, sh.y + 10), bend: -1 } } }), env: () => ({ back: E.mat(CX - 120, CX + 100) }), m: ['abdominales', 'oblicuos'], s: ['deltoides_anterior', 'pectorales'], scale: 1.35, cx: CX - 10 };
})());
const sup = (o = {}) => supine({ y: FLOOR - 4, ...o });
const db0 = sup({ armN: { a: [178, 178] }, armF: { a: [176, 176] }, legN: { a: [178, 92] }, legF: { a: [176, 90] }, feet: { n: 180, f: 180 } });
X('Dead bug', { pose: alt(db0, { ...db0, arms: { n: { a: [-100, -100] }, f: db0.arms.f }, legs: { n: db0.legs.n, f: { a: [100, 100] } } }, { ...db0, arms: { n: db0.arms.n, f: { a: [-102, -102] } }, legs: { n: { a: [102, 102] }, f: db0.legs.f } }), env: () => ({ back: E.mat(CX - 130, CX + 130) }), m: ['abdominales'], s: ['oblicuos'], scale: 1.4, cx: CX - 4 });
X('Dead bug con talones alternos', { pose: alt(db0, { ...db0, legs: { n: db0.legs.n, f: { a: [148, 30] } } }, { ...db0, legs: { n: { a: [150, 32] }, f: db0.legs.f } }), env: () => ({ back: E.mat(CX - 130, CX + 130) }), m: ['abdominales'], s: ['oblicuos'], scale: 1.4, cx: CX - 4 });
X('Bird-dog controlado', { pose: alt(quad(), quad({ armN: { a: [92, 92] }, legF: { a: [-92, -92] } }), quad({ armF: { a: [90, 90] }, legN: { a: [-90, -90] } })), env: () => ({ back: E.mat(CX - 140, CX + 110) }), m: ['abdominales', 'lumbares', 'gluteos'], s: ['deltoides_anterior'], scale: 1.35 });
const sidePlank = knees => ({ view: 'front', shadow: false, scale: 1.3, pose: hold(front({ rot: 72, hy: 72, hx: 10, armL: [86, 168], armR: [24, 150], legs: knees ? [2, -40, 1, 0.5] : [2, 0] }), front({ rot: 74, hy: 74, hx: 10, armL: [86, 168], armR: [24, 150], legs: knees ? [2, -40, 1, 0.5] : [2, 0] }), 1), env: () => ({ back: E.mat(CX - 150, CX + 150) }), m: ['oblicuos', 'abdominales'], s: ['gluteo_medio', 'deltoides_lateral'] });
X('Plancha lateral', sidePlank(false));
X('Plancha lateral con rodillas apoyadas', sidePlank(true));
X('Pallof press en polea', { pose: rep(stand({ footN: 10, footF: -10, armN: { t: pt(CX + 22, FLOOR - 140), bend: -1 } }), stand({ footN: 10, footF: -10, armN: { t: pt(CX + 70, FLOOR - 142), bend: -1 } })), env: J => ({ back: E.column(CX - 40, 70) + E.pulley(pt(CX - 32, FLOOR - 142)) + E.cable(pt(CX - 32, FLOOR - 142), J.limbs.n.hand), front: E.handle(J.limbs.n.hand) }), m: ['abdominales', 'oblicuos'], s: ['deltoides_anterior'] });
X('Crunch en máquina', { pose: rep(sit({ torso: 180, armN: { a: [150, 20] } }), sit({ torso: 138, head: 20, armN: { a: [108, -22] } })), env: J => ({ back: E.bench(CX - 50, CX + 30, FLOOR - 46) + E.frame(CX - 66, FLOOR - 220), front: E.handle(J.limbs.n.hand) }), m: ['abdominales'], s: ['oblicuos'] });
X('Crunch en polea', (() => { const mk = (t, h) => ({ hip: pt(CX - 20, FLOOR - 58), torso: t, head: h, arms: { n: { a: [t - 12, t + 150] }, f: { a: [t - 16, t + 146] } }, legs: { n: { a: [2, -90] }, f: { a: [0, -92] } }, feet: { n: 180, f: 180 } }); return { pose: rep(mk(172, 0), mk(112, 30)), env: J => ({ back: E.column(CX + 40, 70) + E.pulley(pt(CX + 32, 120)) + E.cable(pt(CX + 32, 120), J.limbs.n.hand) + E.mat(CX - 90, CX + 60), front: E.handle(J.limbs.n.hand) }), m: ['abdominales'], s: ['oblicuos'], scale: 1.4 }; })());
X('Elevación de rodillas en silla romana', (() => { const mk = (th, sh) => ({ hip: pt(CX - 6, FLOOR - 128), torso: 182, head: 0, arms: { n: { a: [6, 92] }, f: { a: [2, 88] } }, legs: { n: { a: [th, sh] }, f: { a: [th - 4, sh - 4] } } }); return { pose: rep(mk(4, 2), mk(104, 10)), env: J => ({ back: E.padC(pt(CX - 18, FLOOR - 162), 10, 70) + E.frame(CX - 30, FLOOR - 230) + E.padC(pt(J.limbs.n.elbow.x + 14, J.limbs.n.elbow.y + 6), 36, 8) }), m: ['abdominales'], s: ['oblicuos', 'cuadriceps'], scale: 1.3, shadow: false }; })());
X('Abdominales en banco declinado', (() => { const hip = pt(CX + 6, FLOOR - 74); const mk = (t, h) => ({ hip, torso: t, head: h, arms: { n: { a: [t - 160, t + 160] }, f: { a: [t - 164, t + 156] } }, legs: { n: { t: pt(CX + 72, FLOOR - 104), bend: 1 }, f: { t: pt(CX + 68, FLOOR - 104), bend: 1 } } }); return { pose: rep(mk(246, 0), mk(162, 20)), env: () => ({ back: `<line x1="${CX - 90}" y1="${FLOOR - 40}" x2="${CX + 40}" y2="${FLOOR - 84}" stroke="#20262c" stroke-width="12" stroke-linecap="round"/><rect class="met" x="${CX - 20}" y="${FLOOR - 64}" width="6" height="64"/>` + E.padC(pt(CX + 76, FLOOR - 96), 12, 12) }), m: ['abdominales'], s: ['oblicuos'], scale: 1.35 }; })());
const crunchP = t => sup({ torso: t, head: (t + 90) * -0.6, armN: { a: [t + 150, t - 20] }, armF: { a: [t + 146, t - 24] } });
X('Crunch abdominal controlado', { pose: rep(crunchP(-88), crunchP(-120)), env: () => ({ back: E.mat(CX - 120, CX + 120) }), m: ['abdominales'], s: ['oblicuos'], scale: 1.45 });
X('Crunch bicicleta lento', { pose: alt(sup({ torso: -116, head: 16, armN: { a: [-20, -160] }, armF: { a: [-24, -164] }, legN: { a: [150, 96] }, legF: { a: [150, 96] }, feet: { n: 180, f: 180 } }), sup({ torso: -120, head: 16, armN: { a: [-20, -160] }, armF: { a: [-24, -164] }, legN: { a: [172, 60] }, legF: { a: [106, 106] }, feet: { n: 180, f: 180 } }), sup({ torso: -120, head: 16, armN: { a: [-20, -160] }, armF: { a: [-24, -164] }, legN: { a: [108, 108] }, legF: { a: [170, 58] }, feet: { n: 180, f: 180 } })), env: () => ({ back: E.mat(CX - 120, CX + 120) }), m: ['abdominales', 'oblicuos'], scale: 1.4 });
X('Elevación de piernas flexionadas', { pose: rep(sup({ armN: { a: [-20, -20] }, armF: { a: [-24, -24] }, legN: { a: [108, 40] }, legF: { a: [106, 38] } }), sup({ armN: { a: [-20, -20] }, armF: { a: [-24, -24] }, legN: { a: [178, 92] }, legF: { a: [176, 90] }, feet: { n: 180, f: 180 } })), env: () => ({ back: E.mat(CX - 120, CX + 120) }), m: ['abdominales'], s: ['cuadriceps'], scale: 1.45 });
X('Elevación de rodillas de pie', { pose: alt(stand({ armN: { a: [10, 60] } }), stand({ armN: { a: [10, 60] }, legN: { a: [92, 0] }, feet: { n: 80 } }), stand({ armN: { a: [10, 60] }, legF: { a: [90, -2] }, feet: { f: 80 } })), m: ['abdominales'], s: ['cuadriceps'] });

// ======================= CARDIO =======================
function gait(phi, { stride = 24, knee = 34, arm = 18, fore = 14, lean = 180, run = false, hipY = 94.5, fx = 0 } = {}) {
  const leg = p => { const th = stride * Math.sin(p); const swing = Math.max(0, Math.cos(p)); const sh = th - knee * swing - (run ? 18 : 4); return [th, Math.min(th, sh)]; };
  const ln = leg(phi), lf = leg(phi + Math.PI);
  const ext = l => 46 * Math.cos(l[0] * Math.PI / 180) + 44 * Math.cos(l[1] * Math.PI / 180);
  const hy = Math.max(ext(ln), ext(lf)) + 5.5 + (run ? 5 * Math.abs(Math.sin(phi)) : 0);
  void hipY;
  const a = p => [-arm * Math.sin(p), -arm * Math.sin(p) + fore];
  return { hip: pt(CX + fx, FLOOR - hy), torso: lean, head: run ? 6 : 0, arms: { n: { a: a(phi) }, f: { a: a(phi + Math.PI) } }, legs: { n: { a: ln }, f: { a: lf } }, feet: { n: ln[1] + 90 + (Math.cos(phi) > 0.3 ? -10 : 0), f: lf[1] + 90 + (Math.cos(phi + Math.PI) > 0.3 ? -10 : 0) } };
}
const walk = (o = {}) => ({ pose: phi => gait(phi, o), m: ['cuadriceps', 'gemelos'], s: ['gluteos', 'isquiotibiales'], ...o.extra });
const runSpec = { pose: phi => gait(phi, { stride: 36, knee: 80, arm: 28, fore: 80, lean: 172, run: true }), m: ['cuadriceps', 'isquiotibiales', 'gemelos'], s: ['gluteos'] };
X('Caminata a ritmo cómodo', walk());
X('Caminata en intervalos dentro de casa', walk({ stride: 28, knee: 40, arm: 24, fore: 30 }));
X('Caminata rápida de recuperación', walk({ stride: 28, knee: 40, arm: 26, fore: 40, lean: 176 }));
X('Caminata del granjero', { pose: phi => { const g = gait(phi, { stride: 20, knee: 30, arm: 0 }); return { ...g, arms: { n: { a: [2, 2] }, f: { a: [-2, -2] } } }; }, env: db, m: ['antebrazos', 'trapecio', 'abdominales'], s: ['gluteos', 'cuadriceps'] });
X('Cinta con inclinación suave', { pose: phi => gait(phi, { stride: 24, knee: 34, fx: -6 }), env: () => ({ back: `<path d="M${CX - 110},${FLOOR - 2} L${CX + 90},${FLOOR - 14} L${CX + 92},${FLOOR - 2} L${CX - 110},${FLOOR + 8} Z" class="pad"/><rect class="met" x="${CX + 78}" y="${FLOOR - 140}" width="6" height="${130}" transform="rotate(10 ${CX + 81} ${FLOOR - 10})"/><rect class="eq2" x="${CX + 64}" y="${FLOOR - 160}" width="44" height="18" rx="4"/>` }), m: ['cuadriceps', 'gemelos'], s: ['gluteos', 'isquiotibiales'] });
for (const n of ['Carrera continua a ritmo cómodo', 'Carrera suave de recuperación', 'Trote suave o alternancia trote-caminata', 'Intervalos de trote controlado', 'Alternancia de trote suave y caminata']) X(n, runSpec);
const march = (k, arms = 20) => ({ pose: phi => { const a = Math.max(0, Math.sin(phi)) * k, b = Math.max(0, Math.sin(phi + Math.PI)) * k; return stand({ armN: { a: [-arms * Math.sin(phi), -arms * Math.sin(phi) + 60] }, armF: { a: [arms * Math.sin(phi), arms * Math.sin(phi) + 60] }, legN: a > 2 ? { a: [a, a - a * 1.1] } : undefined, legF: b > 2 ? { a: [b, b - b * 1.1] } : undefined }); }, m: ['cuadriceps'], s: ['abdominales', 'gemelos'] });
X('Marcha en el lugar', march(42));
X('Marcha elevando rodillas', march(86, 30));
X('Bicicleta estática', (() => {
  const crank = pt(CX + 6, FLOOR - 52), r = 17;
  const pose = phi => { const fn = pt(crank.x + r * Math.cos(phi), crank.y + r * Math.sin(phi)), ff = pt(crank.x + r * Math.cos(phi + Math.PI), crank.y + r * Math.sin(phi + Math.PI)); return { hip: pt(CX - 26, FLOOR - 128), torso: 154, head: 24, arms: { n: { t: pt(CX + 54, FLOOR - 152), bend: -1 }, f: { t: pt(CX + 50, FLOOR - 151), bend: -1 } }, legs: { n: { t: fn, bend: 1 }, f: { t: ff, bend: 1 } }, feet: { n: 96, f: 96 } }; };
  return { pose, env: () => ({ back: `<circle class="eq" cx="${CX + 60}" cy="${FLOOR - 40}" r="30"/><circle class="eq2" cx="${CX + 60}" cy="${FLOOR - 40}" r="10"/><path d="M${CX - 30},${FLOOR - 116} L${CX + 6},${FLOOR - 52} L${CX + 56},${FLOOR - 150} M${CX - 50},${FLOOR} L${CX + 90},${FLOOR}" stroke="#4b545e" stroke-width="7" fill="none" stroke-linecap="round"/>` + E.padC(pt(CX - 30, FLOOR - 118), 32, 8) + `<circle class="met" cx="${crank.x}" cy="${crank.y}" r="${r + 3}" fill="none"/>` + E.padC(pt(CX + 60, FLOOR - 154), 18, 7) }), m: ['cuadriceps', 'gluteos'], s: ['isquiotibiales', 'gemelos'], scale: 1.35 };
})());
X('Elíptica a ritmo moderado', (() => {
  const c = pt(CX - 4, FLOOR - 34);
  const pose = phi => { const fn = pt(c.x + 26 * Math.cos(phi), c.y + 8 * Math.sin(phi)), ff = pt(c.x + 26 * Math.cos(phi + Math.PI), c.y + 8 * Math.sin(phi + Math.PI)); return { hip: pt(CX - 6, FLOOR - 120 - 2 * Math.sin(2 * phi)), torso: 176, head: 0, arms: { n: { t: pt(CX + 40 - 14 * Math.cos(phi), FLOOR - 148), bend: -1 }, f: { t: pt(CX + 40 + 14 * Math.cos(phi), FLOOR - 148), bend: -1 } }, legs: { n: { t: fn, bend: 1 }, f: { t: ff, bend: 1 } } }; };
  return { pose, env: J => ({ back: `<rect class="pad" x="${CX - 80}" y="${FLOOR - 14}" width="190" height="14" rx="5"/><rect class="met" x="${CX + 80}" y="${FLOOR - 190}" width="8" height="180"/>` + E.cable(pt(CX + 84, FLOOR - 60), J.limbs.f.hand), front: E.padC(pt(J.limbs.n.ankle.x + 6, J.limbs.n.ankle.y + 7), 34, 6) + `<line x1="${J.limbs.n.hand.x}" y1="${J.limbs.n.hand.y}" x2="${CX + 84}" y2="${FLOOR - 60}" stroke="#7d858e" stroke-width="4"/>` }), m: ['cuadriceps', 'gluteos'], s: ['isquiotibiales', 'gemelos', 'dorsales'], scale: 1.3 };
})());
X('Remo ergómetro suave', (() => {
  const foot = pt(CX + 58, FLOOR - 30);
  const mk = (hx, t, hand, bend) => ({ hip: pt(CX + hx, FLOOR - 40), torso: t, head: 0, arms: { n: { t: hand, bend }, f: { t: pt(hand.x - 4, hand.y), bend } }, legs: { n: { t: foot, bend: 1 }, f: { t: pt(foot.x - 4, foot.y), bend: 1 } }, feet: { n: 150, f: 150 } });
  return { pose: rep(mk(-6, 154, pt(CX + 64, FLOOR - 70), -1), mk(-56, 196, pt(CX - 20, FLOOR - 100), -1)), env: J => ({ back: `<rect class="pad" x="${CX - 100}" y="${FLOOR - 26}" width="190" height="10" rx="4"/><rect class="met" x="${CX - 96}" y="${FLOOR - 16}" width="6" height="16"/><circle class="eq" cx="${CX + 92}" cy="${FLOOR - 54}" r="26"/>` + E.padC(pt(J.hip.x, FLOOR - 32), 30, 8) + E.padC(pt(CX + 64, FLOOR - 26), 10, 30, -20), front: E.cable(pt(CX + 86, FLOOR - 64), J.limbs.n.hand) + E.handle(J.limbs.n.hand) }), m: ['dorsales', 'cuadriceps'], s: ['espalda_media', 'biceps', 'gluteos'], scale: 1.35, cx: CX - 10 };
})());
X('Escaladora a ritmo cómodo', { pose: phi => { const k = 56; const a = Math.max(0, Math.sin(phi)) * k, b = Math.max(0, Math.sin(phi + Math.PI)) * k; return stand({ hy: 98, armN: { t: pt(CX + 44, FLOOR - 140), bend: -1 }, legN: a > 2 ? { a: [a, a - a * 1.15] } : undefined, legF: b > 2 ? { a: [b, b - b * 1.15] } : undefined }); }, env: () => ({ back: `<path d="M${CX - 40},${FLOOR} L${CX + 60},${FLOOR} L${CX + 60},${FLOOR - 60} Z" class="pad"/><rect class="met" x="${CX + 54}" y="${FLOOR - 160}" width="6" height="100"/>` }), m: ['cuadriceps', 'gluteos'], s: ['gemelos', 'isquiotibiales'] });
X('Shadow boxing de bajo impacto', { pose: alt(stand({ footN: 18, footF: -18, torso: 176, armN: { a: [40, 150] }, armF: { a: [30, 156] } }), stand({ footN: 18, footF: -18, torso: 174, armN: { a: [92, 92] }, armF: { a: [30, 156] } }), stand({ footN: 18, footF: -18, torso: 174, armN: { a: [40, 150] }, armF: { a: [90, 90] } })), m: ['deltoides_anterior', 'abdominales'], s: ['triceps', 'oblicuos'] });
X('Paso lateral de bajo impacto', { view: 'front', pose: phi => { const s = Math.sin(phi); return front({ hx: 10 * s, hy: 96, legL: [6 + Math.max(0, -s) * 16, 2], legR: [6 + Math.max(0, s) * 16, 2], arms: [20 + 30 * Math.abs(s), 40] }); }, m: ['gluteo_medio', 'cuadriceps'], s: ['gemelos'] });
X('Baile o cardio de bajo impacto', { view: 'front', pose: phi => { const s = Math.sin(phi); return front({ hx: 12 * s, hy: 95, legL: [6 + Math.max(0, -s) * 18, 0], legR: [6 + Math.max(0, s) * 18, 0], armL: [60 + 70 * Math.max(0, -s), 120], armR: [60 + 70 * Math.max(0, s), 120] }); }, m: ['cuadriceps', 'deltoides_lateral'], s: ['gemelos', 'abdominales'] });
X('Jumping jacks de bajo impacto', { view: 'front', pose: alt(front({ legs: [4, 2], arms: [10, 8] }), front({ legL: [4, 2], legR: [24, 18], arms: [160, 168] }), front({ legL: [24, 18], legR: [4, 2], arms: [160, 168] })), m: ['deltoides_lateral', 'gluteo_medio'], s: ['gemelos', 'cuadriceps'] });
