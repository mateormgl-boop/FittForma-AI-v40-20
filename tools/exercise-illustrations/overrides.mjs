// Posiciones de preparación para los ejercicios isométricos o de amplitud muy chica, donde la animación
// apenas cambia: la ilustración inicial muestra cómo se arma la postura y la final, la postura sostenida.
import { FLOOR } from '../exercise-gifs/figure.mjs';
import { CX, pt, stand, front } from '../exercise-gifs/lib.mjs';

const plankHip = (ang, footX, footY = FLOOR - 4) => { const la = (ang - 180) * Math.PI / 180, legLen = 90; return { x: footX - Math.sin(la) * legLen, y: footY - Math.cos(la) * legLen }; };

// Cuatro apoyos: manos (o antebrazos) bajo los hombros y rodillas bajo la cadera, antes de estirar las piernas.
const quad = ({ forearm = false } = {}) => ({ hip: pt(CX - 32, FLOOR - 54), torso: forearm ? 118 : 100, head: 0,
  arms: forearm ? { n: { a: [0, 90] }, f: { a: [-2, 88] } } : { n: { t: pt(CX + 32, FLOOR - 4), bend: -1 }, f: { t: pt(CX + 28, FLOOR - 4), bend: -1 } },
  legs: { n: { a: [0, -90] }, f: { a: [-2, -92] } }, feet: { n: 180, f: 180 } });
// Sentado en la máquina, de frente: rodillas juntas o separadas (la apertura se ve más que en la animación).
const seated = legs => front({ hy: 60, legs, arms: [12, 30] });

export const OVERRIDES = {
  'Plancha alta': { start: () => quad() },
  'Plancha frontal': { start: () => quad({ forearm: true }) },
  'Abducción de cadera en máquina': { start: () => seated([2, -6, 0.38, 1]), end: () => seated([60, -4, 0.38, 1]) },
  'Aductores en máquina': { start: () => seated([60, -4, 0.38, 1]), end: () => seated([2, -6, 0.38, 1]) },
  // Empiezan con la carga en el pecho (o la barra en el suelo) y terminan con la extensión completa.
  ...Object.fromEntries(['Press de banca con barra', 'Press inclinado con mancuernas', 'Press de banca con mancuernas', 'Press de pecho con mancuernas en el suelo',
    'Press de hombros en máquina', 'Peso muerto convencional con barra', 'Peso muerto con trap bar',
    // Aperturas: abiertas al inicio y juntas arriba al final, como «Aperturas con mancuernas en banco».
    'Aperturas con mancuernas en el suelo', 'Aperturas en polea en banco plano'].map(n => [n, { swap: true }])),
  // Manos en la mesa con los pies cerca; después se llevan los pies atrás hasta alinear el cuerpo.
  'Plancha elevada contra una mesa firme': {
    start: spec => { const p = spec.pose(0), hand = pt(CX + 46, FLOOR - 74), ang = 142, h = plankHip(ang, CX - 50); return { ...p, hip: h, torso: ang, legs: { n: { a: [ang - 180, ang - 180] }, f: { a: [ang - 181, ang - 181] } }, arms: { n: { t: hand, bend: -1 }, f: { t: pt(hand.x - 3, hand.y), bend: -1 } } }; },
  },
  // De costado con la cadera apoyada; la final es la cadera elevada en línea.
  'Plancha lateral': { start: () => front({ rot: 84, hy: 40, hx: 10, armL: [86, 168], armR: [24, 150], legs: [2, 0] }) },
  'Plancha lateral con rodillas apoyadas': { start: () => front({ rot: 84, hy: 40, hx: 10, armL: [86, 168], armR: [24, 150], legs: [2, -40, 1, 0.5] }) },
  // Apoyado en los dos pies junto a la silla; la final es sobre una pierna.
  'Equilibrio a una pierna con apoyo cercano': { start: () => stand({ armN: { t: pt(CX + 56, FLOOR - 98), bend: -1 } }) },
  // Brazos abajo; la final, brazos extendidos a la altura de los hombros (donde se hacen los círculos).
  'Círculos de brazos controlados': { start: () => front({ arms: [8, 6] }), end: () => front({ arms: [90, 90, 1, 1] }) },
};
