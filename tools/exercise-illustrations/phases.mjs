// Elige, para cada ejercicio, la fase de la posición inicial y la de la posición final.
// Inicial = comienzo del ciclo (fase 0). Final = la fase cuya pose está más lejos de la inicial
// (fin de la fase concéntrica en los ejercicios de repeticiones; en los alternados, el lado cercano a la cámara).
import { renderSide, renderFront } from '../exercise-gifs/figure.mjs';
const render = (spec, phi) => (spec.view === 'front' ? renderFront : renderSide)(spec.pose(phi), spec.m || [], spec.s || []).J;
function points(J, view) {
  const p = view === 'front'
    ? [J.world.l.hand, J.world.r.hand, J.world.l.ankle, J.world.r.ankle, J.world.l.elbow, J.world.r.elbow, J.world.l.knee, J.world.r.knee, J.hip, J.headC]
    : [J.limbs.n.hand, J.limbs.f.hand, J.limbs.n.ankle, J.limbs.f.ankle, J.limbs.n.elbow, J.limbs.f.elbow, J.limbs.n.knee, J.limbs.f.knee, J.hip, J.headC];
  return p.filter(Boolean);
}
const dist = (a, b) => a.reduce((s, p, i) => s + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / a.length;
export function pickPhases(spec, samples = 48) {
  const base = points(render(spec, 0), spec.view);
  let best = 0, bestD = -1;
  // En vista lateral, la primera mitad del ciclo mueve el lado cercano a la cámara (el que se ve completo).
  const last = spec.view === 'side' ? samples / 2 : samples - 1;
  for (let i = 1; i <= last; i++) { const phi = 2 * Math.PI * i / samples, d = dist(base, points(render(spec, phi), spec.view)); if (d > bestD + 0.01) { bestD = d; best = phi; } }
  return { start: 0, end: best, diff: Math.round(bestD * 10) / 10 };
}
