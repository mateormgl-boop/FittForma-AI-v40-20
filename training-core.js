/* FittForma AI v48 — núcleo de entrenamiento sin dependencias (navegador y Node).
 * Biblioteca única con metadatos para planificar, alias de nombres antiguos, generador de
 * rutinas por objetivo/nivel/equipamiento, reglas del entrenamiento diario (cada 12 h),
 * cálculo de hidratación e insignias destacadas. Todo es función pura: se prueba con node --test.
 */
(function (root) {
  'use strict';

  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const slugify = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'ejercicio';

  // ---------- Biblioteca ----------
  // [nombre, grupo, series base, reps base, slot, tier, nivel mínimo, nivel máximo, carga externa]
  // slot = patrón que ocupa en la rutina; tier: main (compuesto principal), secondary, iso.
  // Nivel 1 principiante · 2 intermedio · 3 avanzado. Las regresiones tienen nivel máximo bajo.
  const S = (name, group, sets, reps, slot, tier, min, max, load = false) => ({ name, group, sets, reps, kind: 'strength', slot, tier, level: [min, max], load });
  const C = (name, reps) => ({ name, group: 'Cardio', sets: 1, reps, kind: 'cardio', slot: 'cardio', tier: 'cardio', level: [1, 3], load: false });
  const M = (name, group, reps) => ({ name, group, sets: 1, reps, kind: 'mobility', slot: 'mobility', tier: 'mobility', level: [1, 3], load: false });

  const LIBRARY = {
    gym: [
      S('Prensa de piernas', 'Piernas', 3, '8–12', 'squat', 'secondary', 1, 3, true),
      S('Sentadilla goblet', 'Piernas', 3, '8–12', 'squat', 'secondary', 1, 2, true),
      S('Sentarse y levantarse de un banco', 'Piernas', 2, '8–12', 'squat', 'secondary', 1, 1, true),
      S('Sentadilla hack en máquina', 'Piernas', 3, '8–12', 'squat', 'main', 2, 3, true),
      S('Sentadilla en multipower', 'Piernas', 3, '8–12', 'squat', 'main', 2, 3, true),
      S('Sentadilla frontal con barra', 'Piernas', 3, '6–10', 'squat', 'main', 3, 3, true),
      S('Sentadilla dividida con mancuernas', 'Piernas', 3, '8–10 por lado', 'lunge', 'secondary', 2, 3, true),
      S('Peso muerto rumano con mancuernas', 'Piernas', 3, '8–10', 'hinge', 'secondary', 1, 3, true),
      S('Peso muerto convencional con barra', 'Piernas', 3, '5–8', 'hinge', 'main', 2, 3, true),
      S('Peso muerto con trap bar', 'Piernas', 3, '6–10', 'hinge', 'main', 2, 3, true),
      S('Buenos días con barra ligera', 'Piernas', 2, '10–12', 'hinge', 'secondary', 3, 3, true),
      S('Hip thrust con barra o máquina', 'Glúteos', 3, '8–12', 'glute', 'secondary', 2, 3, true),
      S('Puente de glúteos', 'Glúteos', 3, '10–15', 'glute', 'secondary', 1, 2),
      S('Pull-through en polea', 'Glúteos', 3, '10–15', 'glute', 'secondary', 1, 3, true),
      S('Patada de glúteo en polea', 'Glúteos', 2, '12–15 por lado', 'glute', 'iso', 1, 3, true),
      S('Extensión de cuádriceps', 'Piernas', 2, '10–15', 'quad_iso', 'iso', 1, 3, true),
      S('Curl femoral sentado', 'Piernas', 3, '10–15', 'ham_iso', 'iso', 1, 3, true),
      S('Curl femoral tumbado', 'Piernas', 3, '10–15', 'ham_iso', 'iso', 1, 3, true),
      S('Elevación de talones de pie en máquina', 'Piernas', 3, '10–15', 'calf', 'iso', 1, 3, true),
      S('Elevación de talones sentado', 'Piernas', 3, '12–20', 'calf', 'iso', 1, 3, true),
      S('Abducción de cadera en máquina', 'Glúteos', 2, '12–20', 'abduct', 'iso', 1, 3, true),
      S('Aductores en máquina', 'Piernas', 2, '12–20', 'adduct', 'iso', 1, 3, true),
      S('Press de pecho en máquina', 'Pecho', 3, '8–12', 'hpush', 'secondary', 1, 3, true),
      S('Press de banca con mancuernas', 'Pecho', 3, '8–12', 'hpush', 'main', 1, 3, true),
      S('Press de banca con barra', 'Pecho', 3, '6–10', 'hpush', 'main', 2, 3, true),
      S('Press inclinado con mancuernas', 'Pecho', 3, '8–12', 'hpush', 'secondary', 1, 3, true),
      S('Press declinado en máquina', 'Pecho', 2, '8–12', 'hpush', 'secondary', 2, 3, true),
      S('Press de pecho en polea de pie', 'Pecho', 2, '10–15', 'hpush', 'secondary', 1, 3, true),
      S('Aperturas en polea en banco plano', 'Pecho', 2, '10–15', 'chest_iso', 'iso', 1, 3, true),
      S('Aperturas con mancuernas en banco', 'Pecho', 2, '10–15', 'chest_iso', 'iso', 1, 3, true),
      S('Cruce de poleas alto a bajo', 'Pecho', 2, '12–15', 'chest_iso', 'iso', 2, 3, true),
      S('Cruce de poleas bajo a alto', 'Pecho', 2, '12–15', 'chest_iso', 'iso', 2, 3, true),
      S('Jalón al pecho', 'Espalda', 3, '8–12', 'vpull', 'main', 1, 3, true),
      S('Jalón al pecho con agarre neutro', 'Espalda', 3, '8–12', 'vpull', 'main', 1, 3, true),
      S('Dominadas asistidas', 'Espalda', 3, '6–10', 'vpull', 'secondary', 1, 2, true),
      S('Dominadas supinas', 'Espalda', 3, '5–10', 'vpull', 'main', 2, 3),
      S('Dominadas', 'Espalda', 3, '5–10', 'vpull', 'main', 3, 3),
      S('Remo sentado en polea', 'Espalda', 3, '10–12', 'hpull', 'secondary', 1, 3, true),
      S('Remo con mancuerna a una mano', 'Espalda', 3, '8–12 por lado', 'hpull', 'main', 1, 3, true),
      S('Remo con mancuernas en banco inclinado', 'Espalda', 3, '8–12', 'hpull', 'secondary', 1, 3, true),
      S('Remo en máquina con pecho apoyado', 'Espalda', 3, '8–12', 'hpull', 'secondary', 1, 3, true),
      S('Remo unilateral en polea', 'Espalda', 2, '10–12 por lado', 'hpull', 'secondary', 1, 3, true),
      S('Remo con barra', 'Espalda', 3, '6–10', 'hpull', 'main', 2, 3, true),
      S('Jalón con brazos rectos en polea', 'Espalda', 2, '12–15', 'pull_iso', 'iso', 2, 3, true),
      S('Extensión lumbar en banco', 'Espalda', 2, '10–15', 'lowback', 'iso', 1, 3),
      S('Press militar con mancuernas', 'Hombros', 3, '8–12', 'vpush', 'main', 2, 3, true),
      S('Press de hombros en máquina', 'Hombros', 3, '8–12', 'vpush', 'secondary', 1, 3, true),
      S('Elevaciones laterales', 'Hombros', 3, '12–20', 'lat_raise', 'iso', 1, 3, true),
      S('Elevación frontal con mancuernas', 'Hombros', 2, '10–15', 'front_raise', 'iso', 1, 3, true),
      S('Face pull en polea', 'Hombros', 2, '12–15', 'rear_delt', 'iso', 1, 3, true),
      S('Pájaros en máquina inversa', 'Hombros', 2, '12–15', 'rear_delt', 'iso', 1, 3, true),
      S('Pájaros con mancuernas inclinado', 'Hombros', 2, '12–15', 'rear_delt', 'iso', 1, 3, true),
      S('Rotación externa de hombro con polea', 'Hombros', 2, '12–15 por lado', 'prehab', 'iso', 1, 3, true),
      S('Encogimientos con mancuernas', 'Trapecio', 2, '10–15', 'shrug', 'iso', 2, 3, true),
      S('Curl de bíceps con mancuernas', 'Brazos', 2, '10–15', 'biceps', 'iso', 1, 3, true),
      S('Curl martillo', 'Brazos', 2, '10–15', 'biceps', 'iso', 1, 3, true),
      S('Curl predicador en máquina', 'Brazos', 2, '10–15', 'biceps', 'iso', 1, 3, true),
      S('Curl de bíceps en polea baja', 'Brazos', 2, '10–15', 'biceps', 'iso', 1, 3, true),
      S('Curl concentrado con mancuerna', 'Brazos', 2, '10–12 por lado', 'biceps', 'iso', 2, 3, true),
      S('Curl inverso con barra', 'Brazos', 2, '10–15', 'biceps', 'iso', 2, 3, true),
      S('Extensión de tríceps en polea', 'Brazos', 2, '10–15', 'triceps', 'iso', 1, 3, true),
      S('Extensión de tríceps con cuerda', 'Brazos', 2, '10–15', 'triceps', 'iso', 1, 3, true),
      S('Extensión de tríceps por encima de la cabeza con cuerda', 'Brazos', 2, '10–15', 'triceps', 'iso', 2, 3, true),
      S('Extensión de tríceps unilateral en polea', 'Brazos', 2, '10–15 por lado', 'triceps', 'iso', 2, 3, true),
      S('Press francés con barra Z', 'Brazos', 2, '10–12', 'triceps', 'iso', 2, 3, true),
      S('Fondos en máquina', 'Brazos', 3, '8–12', 'triceps', 'secondary', 1, 3, true),
      S('Plancha frontal', 'Core', 2, '20–40 seg', 'core_ae', 'iso', 1, 2),
      S('Pallof press en polea', 'Core', 2, '10–12 por lado', 'core_rot', 'iso', 1, 3, true),
      S('Plancha lateral', 'Core', 2, '20–40 seg por lado', 'core_rot', 'iso', 2, 3),
      S('Crunch en máquina', 'Core', 2, '10–15', 'core_flex', 'iso', 1, 3, true),
      S('Crunch en polea', 'Core', 2, '10–15', 'core_flex', 'iso', 2, 3, true),
      S('Elevación de rodillas en silla romana', 'Core', 2, '10–15', 'core_flex', 'iso', 2, 3),
      S('Abdominales en banco declinado', 'Core', 2, '10–15', 'core_flex', 'iso', 3, 3),
      S('Caminata del granjero', 'Core', 3, '20–40 m', 'carry', 'secondary', 2, 3, true),
      C('Bicicleta estática', '8–20 min'),
      C('Cinta con inclinación suave', '8–20 min'),
      C('Elíptica a ritmo moderado', '10–20 min'),
      C('Remo ergómetro suave', '8–15 min'),
      C('Escaladora a ritmo cómodo', '8–15 min')
    ],
    home: [
      S('Sentadilla goblet', 'Piernas', 3, '8–12', 'squat', 'main', 1, 3, true),
      S('Sentadilla a una silla', 'Piernas', 2, '8–12', 'squat', 'secondary', 1, 1),
      S('Sentadilla dividida con apoyo', 'Piernas', 2, '8–10 por lado', 'lunge', 'secondary', 1, 2),
      S('Zancada hacia atrás con mancuernas', 'Piernas', 3, '8–10 por lado', 'lunge', 'main', 2, 3, true),
      S('Subidas a escalón con mancuernas', 'Piernas', 2, '8–10 por lado', 'lunge', 'secondary', 1, 3, true),
      S('Peso muerto rumano con mancuernas', 'Piernas', 3, '8–12', 'hinge', 'main', 1, 3, true),
      S('Peso muerto rumano a una pierna', 'Piernas', 2, '8–10 por lado', 'hinge', 'secondary', 2, 3, true),
      S('Buenos días sin peso', 'Piernas', 2, '10–15', 'hinge', 'secondary', 1, 1),
      S('Pull-through con banda elástica', 'Glúteos', 2, '12–15', 'glute', 'secondary', 1, 3),
      S('Hip thrust con sofá firme', 'Glúteos', 3, '10–15', 'glute', 'secondary', 1, 3),
      S('Puente de glúteos', 'Glúteos', 2, '10–15', 'glute', 'secondary', 1, 2),
      S('Patada de glúteo en cuadrupedia', 'Glúteos', 2, '12–15 por lado', 'glute', 'iso', 1, 2),
      S('Abducción de cadera acostado de lado', 'Glúteos', 2, '12–20 por lado', 'abduct', 'iso', 1, 3),
      S('Paso lateral con banda por encima de rodillas', 'Glúteos', 2, '10–15 pasos por lado', 'abduct', 'iso', 1, 3),
      S('Curl femoral deslizante con toalla', 'Piernas', 2, '8–12', 'ham_iso', 'iso', 2, 3),
      S('Elevación de talones con apoyo', 'Piernas', 2, '10–15', 'calf', 'iso', 1, 2),
      S('Elevación de talones a una pierna con apoyo', 'Piernas', 2, '10–15 por lado', 'calf', 'iso', 2, 3),
      S('Press de pecho con mancuernas en el suelo', 'Pecho', 3, '8–12', 'hpush', 'main', 1, 3, true),
      S('Flexiones inclinadas contra una mesa firme', 'Pecho', 2, '6–12', 'hpush', 'secondary', 1, 2),
      S('Flexiones desde rodillas', 'Pecho', 2, '6–12', 'hpush', 'secondary', 1, 2),
      S('Press de pecho con banda', 'Pecho', 2, '10–15', 'hpush', 'secondary', 1, 2),
      S('Flexiones clásicas', 'Pecho', 3, '6–15', 'hpush', 'main', 2, 3),
      S('Flexiones con pies elevados', 'Pecho', 3, '6–12', 'hpush', 'main', 3, 3),
      S('Aperturas con mancuernas en el suelo', 'Pecho', 2, '10–15', 'chest_iso', 'iso', 1, 3, true),
      S('Remo con mancuerna a una mano', 'Espalda', 3, '8–12 por lado', 'hpull', 'main', 1, 3, true),
      S('Remo con banda elástica sentado', 'Espalda', 2, '10–15', 'hpull', 'secondary', 1, 2),
      S('Remo con mochila cargada con seguridad', 'Espalda', 2, '10–15', 'hpull', 'secondary', 1, 2),
      S('Pullover con mancuerna en el suelo', 'Espalda', 2, '10–15', 'pull_iso', 'iso', 1, 3, true),
      S('Superman alternado', 'Espalda', 2, '8–12 por lado', 'lowback', 'iso', 1, 3),
      S('Press de hombros con mancuernas livianas', 'Hombros', 2, '8–12', 'vpush', 'secondary', 1, 3, true),
      S('Press Arnold sentado con mancuernas', 'Hombros', 3, '8–12', 'vpush', 'main', 2, 3, true),
      S('Elevaciones laterales', 'Hombros', 2, '12–15', 'lat_raise', 'iso', 1, 3, true),
      S('Elevación frontal con mancuernas', 'Hombros', 2, '10–15', 'front_raise', 'iso', 1, 3, true),
      S('Pájaros con mancuernas inclinado', 'Hombros', 2, '12–15', 'rear_delt', 'iso', 1, 3, true),
      S('Pull-apart con banda', 'Hombros', 2, '12–20', 'rear_delt', 'iso', 1, 3),
      S('Curl de bíceps con mancuernas', 'Brazos', 2, '10–15', 'biceps', 'iso', 1, 3, true),
      S('Curl martillo', 'Brazos', 2, '10–15', 'biceps', 'iso', 1, 3, true),
      S('Curl de bíceps alternado sentado', 'Brazos', 2, '10–15 por lado', 'biceps', 'iso', 1, 3, true),
      S('Curl de bíceps con banda', 'Brazos', 2, '10–15', 'biceps', 'iso', 1, 2),
      S('Extensión de tríceps por encima de la cabeza con mancuerna', 'Brazos', 2, '10–15', 'triceps', 'iso', 1, 3, true),
      S('Patada de tríceps con mancuerna', 'Brazos', 2, '10–15 por lado', 'triceps', 'iso', 2, 3, true),
      S('Extensión de tríceps con banda', 'Brazos', 2, '10–15', 'triceps', 'iso', 1, 2),
      S('Flexiones diamante', 'Brazos', 2, '6–12', 'triceps', 'secondary', 3, 3),
      S('Plancha frontal', 'Core', 2, '15–40 seg', 'core_ae', 'iso', 1, 3),
      S('Dead bug', 'Core', 2, '6–10 por lado', 'core_ae', 'iso', 1, 3),
      S('Plancha con rodillas al pecho lenta', 'Core', 2, '8–12 por lado', 'core_ae', 'iso', 2, 3),
      S('Bird-dog controlado', 'Core', 2, '6–10 por lado', 'core_rot', 'iso', 1, 2),
      S('Plancha lateral con rodillas apoyadas', 'Core', 2, '15–25 seg por lado', 'core_rot', 'iso', 1, 1),
      S('Plancha con toque de hombros desde rodillas', 'Core', 2, '8–12 por lado', 'core_rot', 'iso', 1, 2),
      S('Crunch abdominal controlado', 'Core', 2, '10–15', 'core_flex', 'iso', 1, 3),
      S('Elevación de piernas flexionadas', 'Core', 2, '8–12', 'core_flex', 'iso', 1, 3),
      C('Marcha en el lugar', '5–10 min'),
      C('Caminata a ritmo cómodo', '10–20 min'),
      C('Caminata en intervalos dentro de casa', '10–20 min'),
      C('Subir y bajar un escalón estable', '5–12 min'),
      C('Baile o cardio de bajo impacto', '5–15 min'),
      C('Shadow boxing de bajo impacto', '5–12 min'),
      M('Movilidad de cadera en el suelo', 'Piernas', '5–8 min'),
      M('Estiramiento de flexores de cadera', 'Piernas', '20–30 seg por lado'),
      M('Gato-vaca para movilidad de columna', 'Espalda', '6–10 repeticiones')
    ],
    bodyweight: [
      S('Sentadilla al aire', 'Piernas', 3, '8–15', 'squat', 'main', 1, 3),
      S('Sentadilla a una silla', 'Piernas', 2, '8–12', 'squat', 'secondary', 1, 1),
      S('Sentadilla isométrica en pared', 'Piernas', 2, '15–40 seg', 'quad_iso', 'iso', 1, 3),
      S('Sentadilla dividida con apoyo', 'Piernas', 2, '8–10 por lado', 'lunge', 'secondary', 1, 2),
      S('Zancada hacia atrás sin peso', 'Piernas', 3, '8–12 por lado', 'lunge', 'main', 2, 3),
      S('Zancada lateral asistida', 'Piernas', 2, '8–10 por lado', 'lunge', 'secondary', 1, 3),
      S('Puente de glúteos', 'Glúteos', 2, '10–15', 'glute', 'secondary', 1, 2),
      S('Elevación de cadera en marcha', 'Glúteos', 2, '8–12 por lado', 'glute', 'iso', 1, 3),
      S('Puente de glúteos a una pierna asistido', 'Glúteos', 2, '8–12 por lado', 'hinge', 'secondary', 2, 3),
      S('Elevación de talones con apoyo', 'Piernas', 2, '12–20', 'calf', 'iso', 1, 3),
      S('Flexiones contra la pared', 'Pecho', 2, '8–15', 'hpush', 'secondary', 1, 1),
      S('Flexiones inclinadas contra una mesa firme', 'Pecho', 2, '6–12', 'hpush', 'secondary', 1, 2),
      S('Flexiones desde rodillas', 'Pecho', 3, '6–12', 'hpush', 'secondary', 1, 2),
      S('Flexiones clásicas', 'Pecho', 3, '6–15', 'hpush', 'main', 2, 3),
      S('Flexiones con pies elevados', 'Pecho', 3, '6–12', 'hpush', 'main', 3, 3),
      S('Flexiones diamante desde rodillas', 'Brazos', 2, '5–10', 'triceps', 'secondary', 1, 2),
      S('Flexiones diamante', 'Brazos', 2, '6–12', 'triceps', 'secondary', 3, 3),
      S('Fondos de tríceps con silla estable', 'Brazos', 2, '6–10', 'triceps', 'secondary', 2, 3),
      S('Remo isométrico con toalla segura', 'Espalda', 2, '15–25 seg', 'hpull', 'secondary', 1, 3),
      S('Superman estático', 'Espalda', 2, '10–20 seg', 'lowback', 'iso', 1, 3),
      S('Elevación de brazos en Y boca abajo', 'Hombros', 2, '8–12', 'rear_delt', 'iso', 1, 2),
      S('Y-T-W boca abajo', 'Hombros', 2, '6–10 de cada forma', 'rear_delt', 'iso', 2, 3),
      S('Flexiones escapulares contra pared', 'Hombros', 2, '10–15', 'scap', 'iso', 1, 2),
      S('Retracción escapular de pie', 'Espalda', 2, '10–15', 'scap', 'iso', 1, 1),
      S('Plancha elevada contra una mesa firme', 'Core', 2, '15–30 seg', 'core_ae', 'iso', 1, 1),
      S('Plancha alta', 'Core', 2, '15–40 seg', 'core_ae', 'iso', 2, 3),
      S('Dead bug con talones alternos', 'Core', 2, '8–12 por lado', 'core_ae', 'iso', 1, 1),
      S('Dead bug', 'Core', 2, '6–10 por lado', 'core_ae', 'iso', 1, 3),
      S('Escaladores lentos con manos elevadas', 'Core', 2, '8–12 por lado', 'core_ae', 'iso', 1, 2),
      S('Bird-dog controlado', 'Core', 2, '6–10 por lado', 'core_rot', 'iso', 1, 2),
      S('Plancha lateral con rodillas apoyadas', 'Core', 2, '15–25 seg por lado', 'core_rot', 'iso', 1, 1),
      S('Plancha lateral', 'Core', 2, '20–40 seg por lado', 'core_rot', 'iso', 2, 3),
      S('Crunch abdominal controlado', 'Core', 2, '10–15', 'core_flex', 'iso', 1, 3),
      S('Crunch bicicleta lento', 'Core', 2, '8–12 por lado', 'core_flex', 'iso', 2, 3),
      S('Elevación de rodillas de pie', 'Core', 2, '10–15 por lado', 'core_flex', 'iso', 1, 1),
      S('Equilibrio a una pierna con apoyo cercano', 'Piernas', 2, '20–30 seg por lado', 'balance', 'iso', 1, 3),
      C('Marcha en el lugar', '5–10 min'),
      C('Caminata a ritmo cómodo', '10–20 min'),
      C('Marcha elevando rodillas', '5–10 min'),
      C('Paso lateral de bajo impacto', '5–10 min'),
      C('Jumping jacks de bajo impacto', '5–10 min'),
      M('Círculos de brazos controlados', 'Hombros', '30–45 seg'),
      M('Movilidad de tobillo contra pared', 'Piernas', '8–12 por lado')
    ]
  };

  // Nombres de versiones anteriores → nombre actual. Las sesiones guardadas no se reescriben:
  // el alias se resuelve al leer (imagen, ficha, insignias y marcas).
  const ALIASES = {
    'Aperturas en polea': 'Aperturas en polea en banco plano',
    'Remo con pecho apoyado': 'Remo con mancuernas en banco inclinado',
    'Curl femoral en máquina': 'Curl femoral tumbado',
    'Curl inverso con barra Z': 'Curl inverso con barra',
    'Fondos asistidos en máquina': 'Fondos en máquina',
    'Caminata del granjero con mancuernas': 'Caminata del granjero',
    'Extensión de tríceps por encima de la cabeza': 'Extensión de tríceps por encima de la cabeza con cuerda',
    'Curl martillo con mancuernas': 'Curl martillo',
    'Elevaciones laterales con botellas': 'Elevaciones laterales',
    'Elevación frontal con botellas': 'Elevación frontal con mancuernas',
    'Pájaros con mancuernas livianas': 'Pájaros con mancuernas inclinado',
    'Remo con mancuerna apoyado en silla firme': 'Remo con mancuerna a una mano',
    'Sentadilla goblet con mancuerna': 'Sentadilla goblet',
    'Plancha con apoyo de antebrazos': 'Plancha frontal',
    'Flexiones con manos elevadas': 'Flexiones inclinadas contra una mesa firme',
    'Flexiones inclinadas sobre una superficie firme': 'Flexiones inclinadas contra una mesa firme',
    'Flexiones contra una pared': 'Flexiones contra la pared',
    'Flexiones con rodillas apoyadas': 'Flexiones desde rodillas',
    'Bird-dog': 'Bird-dog controlado',
    'Bird-dog con pausa': 'Bird-dog controlado',
    'Abdominales cortos': 'Crunch abdominal controlado',
    'Plancha lateral con piernas flexionadas': 'Plancha lateral con rodillas apoyadas',
    'Zancada estática asistida': 'Sentadilla dividida con apoyo',
    'Estocada estática con apoyo': 'Sentadilla dividida con apoyo',
    'Sentadilla parcial a una silla': 'Sentadilla a una silla',
    'Elevación de talones bilateral': 'Elevación de talones con apoyo',
    'Marcha rápida en el lugar': 'Marcha en el lugar',
    'Paso lateral rápido sin salto': 'Paso lateral de bajo impacto',
    'Marcha de puente de glúteos': 'Elevación de cadera en marcha',
    'Curl de bíceps con banda o mancuernas': 'Curl de bíceps con mancuernas',
    'Bicicleta suave': 'Bicicleta estática',
    'Remo con banda elástica': 'Remo con banda elástica sentado',
    'Zancada hacia atrás': 'Zancada hacia atrás sin peso',
    'Subidas a escalón bajo y estable': 'Subidas a escalón con mancuernas',
    'Peso muerto rumano a una pierna con apoyo': 'Peso muerto rumano a una pierna'
  };
  // Ejercicios que se reemplazaron por otro distinto: no son alias (no es el mismo movimiento).
  const RETIRED = ['Prensa de piernas unilateral', 'Extensión de cadera en polea', 'Pullover en polea', 'Dominadas asistidas con agarre neutro'];

  const ALIAS_MAP = new Map(Object.entries(ALIASES).map(([a, b]) => [norm(a), b]));
  const BY_NAME = new Map();
  for (const [mode, list] of Object.entries(LIBRARY)) for (const e of list) { const k = norm(e.name); if (!BY_NAME.has(k)) BY_NAME.set(k, { ...e, modes: [mode] }); else BY_NAME.get(k).modes.push(mode); }

  function canonicalName(name) { const n = norm(name); return ALIAS_MAP.get(n) || (BY_NAME.get(n)?.name) || String(name || '').trim(); }
  function libraryEntry(name) { return BY_NAME.get(norm(canonicalName(name))) || null; }
  function allExercises() { return [...BY_NAME.values()]; }

  // ---------- Generador de rutinas ----------
  const LEVEL = { beginner: 1, intermediate: 2, advanced: 3 };
  const SCHEMES = {
    strength: { reps: { main: '4–6', secondary: '6–8', iso: '8–12' }, sets: { main: 4, secondary: 3, iso: 2 }, rest: { main: 150, secondary: 120, iso: 75 } },
    muscle: { reps: { main: '6–10', secondary: '8–12', iso: '10–15' }, sets: { main: 3, secondary: 3, iso: 3 }, rest: { main: 120, secondary: 90, iso: 60 } },
    fitness: { reps: { main: '8–12', secondary: '10–12', iso: '12–15' }, sets: { main: 3, secondary: 2, iso: 2 }, rest: { main: 90, secondary: 75, iso: 60 } },
    habit: { reps: { main: '8–12', secondary: '10–12', iso: '12–15' }, sets: { main: 2, secondary: 2, iso: 2 }, rest: { main: 90, secondary: 75, iso: 60 } }
  };
  const CORE_SLOTS = ['core_ae', 'core_rot', 'core_flex'];
  // Plantillas ordenadas: compuestos primero, accesorios después y core al final.
  const T = {
    fullA: { title: 'Cuerpo completo A', focus: 'Sentadilla, empuje y tracción horizontal', slots: [['squat'], ['hpush'], ['hpull'], ['hinge'], ['vpush', 'lat_raise'], ['biceps', 'triceps'], ['core_ae', 'core_rot', 'core_flex']] },
    fullB: { title: 'Cuerpo completo B', focus: 'Bisagra de cadera, tracción vertical y zancada', slots: [['hinge'], ['vpull', 'hpull'], ['hpush'], ['lunge', 'squat'], ['rear_delt', 'lat_raise'], ['triceps', 'biceps'], ['core_flex', 'core_ae', 'core_rot']] },
    fullC: { title: 'Cuerpo completo C', focus: 'Trabajo unilateral, glúteos y hombros', slots: [['lunge', 'squat'], ['hpush'], ['hpull', 'vpull'], ['glute', 'hinge'], ['lat_raise', 'vpush'], ['biceps', 'triceps'], ['core_rot', 'core_ae', 'core_flex']] },
    upperA: { title: 'Tren superior A', focus: 'Empuje y tracción, con énfasis horizontal', slots: [['hpush'], ['hpull'], ['vpush'], ['vpull', 'hpull'], ['lat_raise'], ['triceps'], ['biceps']] },
    upperB: { title: 'Tren superior B', focus: 'Tracción vertical primero y hombro posterior', slots: [['vpull', 'hpull'], ['hpush'], ['hpull'], ['chest_iso', 'vpush'], ['rear_delt'], ['biceps'], ['triceps']] },
    lowerA: { title: 'Tren inferior A', focus: 'Cuádriceps y cadena posterior', slots: [['squat'], ['hinge'], ['lunge'], ['ham_iso', 'glute'], ['calf'], ['quad_iso', 'abduct'], ['core_ae', 'core_rot']] },
    lowerB: { title: 'Tren inferior B', focus: 'Cadena posterior y glúteos', slots: [['hinge'], ['squat', 'lunge'], ['glute'], ['quad_iso', 'lunge'], ['ham_iso'], ['calf'], ['core_flex', 'core_rot']] },
    push: { title: 'Empuje', focus: 'Pecho, hombros y tríceps', slots: [['hpush'], ['vpush'], ['hpush', 'chest_iso'], ['lat_raise'], ['triceps'], ['chest_iso', 'triceps'], ['core_ae']] },
    pull: { title: 'Tracción', focus: 'Espalda, hombro posterior y bíceps', slots: [['vpull', 'hpull'], ['hpull'], ['hpull', 'pull_iso'], ['rear_delt'], ['biceps'], ['biceps', 'shrug'], ['core_flex']] },
    legs: { title: 'Piernas', focus: 'Cuádriceps, isquiotibiales, glúteos y gemelos', slots: [['squat'], ['hinge'], ['lunge'], ['quad_iso'], ['ham_iso', 'glute'], ['calf'], ['core_rot']] }
  };
  const SPLITS = { 2: ['fullA', 'fullB'], 3: ['fullA', 'fullB', 'fullC'], 4: ['upperA', 'lowerA', 'upperB', 'lowerB'], 5: ['push', 'pull', 'legs', 'upperA', 'lowerB'] };
  const SPLIT_NOTES = {
    2: 'Dejá al menos un día de descanso entre las dos sesiones.',
    3: 'Ideal en días alternos (por ejemplo, lunes, miércoles y viernes).',
    4: 'Dos días de tren superior y dos de tren inferior; cada grupo descansa al menos un día.',
    5: 'Empuje, tracción y piernas, y después tren superior e inferior: cada grupo vuelve a trabajarse 2–3 días después.'
  };
  // Si el equipamiento no tiene un patrón, se usa el más parecido (nunca otro grupo muscular sin relación).
  const FALLBACK = {
    vpull: ['hpull', 'pull_iso', 'rear_delt'], hpull: ['vpull', 'rear_delt', 'scap'], pull_iso: ['hpull', 'vpull'],
    vpush: ['lat_raise', 'front_raise'], chest_iso: ['hpush'], lat_raise: ['vpush', 'front_raise'], rear_delt: ['scap', 'hpull'],
    quad_iso: ['lunge', 'squat'], ham_iso: ['hinge', 'glute'], glute: ['hinge'], lunge: ['squat'], squat: ['lunge'], hinge: ['glute', 'ham_iso'],
    calf: ['glute'], biceps: ['hpull'], triceps: ['hpush'], shrug: ['rear_delt'], abduct: ['glute'],
    core_ae: ['core_rot', 'core_flex'], core_rot: ['core_ae', 'core_flex'], core_flex: ['core_ae', 'core_rot']
  };
  const LOADED_TERMS = /seg|min|\bm\b|pasos/;

  function exerciseCountFor(profile) {
    const minutes = Number(profile.duration) || 30;
    let count = minutes <= 20 ? 4 : minutes <= 30 ? 5 : minutes <= 45 ? 6 : 7;
    if (profile.level === 'beginner') count = Math.min(count, 5);
    if (profile.goal === 'habit') count = Math.max(3, count - 1);
    return count;
  }
  function prescription(entry, goal, levelNum) {
    const scheme = SCHEMES[goal] || SCHEMES.fitness;
    const tier = entry.tier === 'main' || entry.tier === 'secondary' ? entry.tier : 'iso';
    let sets = scheme.sets[tier];
    if (levelNum === 1) sets = Math.min(sets, tier === 'main' && goal === 'strength' ? 3 : 2);
    if (levelNum === 3 && tier === 'main' && (goal === 'strength' || goal === 'muscle')) sets = Math.min(5, sets + 1);
    let reps = entry.reps;
    const timed = LOADED_TERMS.test(entry.reps);
    if (entry.load && !timed) {
      let r = scheme.reps[tier];
      if (goal === 'strength' && levelNum === 1 && tier === 'main') r = '6–8';
      reps = r + (/por lado/.test(entry.reps) ? ' por lado' : '');
    }
    if (!entry.load) {
      // Sin carga externa la dificultad la da la variante elegida, no el rango de repeticiones.
      sets = Math.max(1, Math.min(levelNum === 1 ? 2 : 4, (Number(entry.sets) || 2) + (levelNum === 3 && tier !== 'iso' ? 1 : 0) - (goal === 'habit' ? 1 : 0)));
      return { sets: Math.max(sets, goal === 'habit' ? 2 : 1), reps, rest: timed ? 45 : tier === 'iso' ? 45 : 75 };
    }
    const rest = timed ? 45 : scheme.rest[tier];
    return { sets, reps, rest };
  }
  function pickFor(slot, pool, ctx) {
    const lv = ctx.levelNum;
    const fits = e => e.kind === 'strength' && e.slot === slot && !ctx.dayNames.has(norm(e.name));
    let candidates = pool.filter(e => fits(e) && e.level[0] <= lv && lv <= e.level[1]);
    if (!candidates.length) {
      // Sin opción del nivel exacto: la más cercana por debajo (más segura) y, si no hay, la más cercana por encima.
      const any = pool.filter(fits);
      const below = any.filter(e => e.level[0] <= lv).sort((a, b) => b.level[1] - a.level[1]);
      const above = any.filter(e => e.level[0] > lv).sort((a, b) => a.level[0] - b.level[0]);
      candidates = below.length ? [below[0]] : above.length && lv >= 2 ? [above[0]] : [];
    }
    if (!candidates.length) return null;
    const preferMain = ctx.firstOfPattern && lv >= 2 && (ctx.goal === 'strength' || ctx.goal === 'muscle');
    const score = e => (ctx.usage.get(norm(e.name)) || 0) * 10 + (preferMain && e.tier !== 'main' ? 3 : 0) + (lv === 1 && e.tier === 'main' && e.load && /barra/.test(norm(e.name)) ? 5 : 0) + (ctx.firstOfDay && e.tier === 'iso' ? 25 : 0);
    candidates.sort((a, b) => score(a) - score(b) || pool.indexOf(a) - pool.indexOf(b));
    return candidates[0];
  }
  function buildPlan(profileInput = {}) {
    const profile = { goal: 'fitness', level: 'beginner', days: '3', equipment: 'gym', duration: '30', ...profileInput };
    const dayCount = Math.max(2, Math.min(5, Number(profile.days) || 3));
    const levelNum = LEVEL[profile.level] || 1;
    const pool = LIBRARY[profile.equipment] || LIBRARY.gym;
    if (profile.goal === 'endurance') return buildEndurancePlan(profile, dayCount, levelNum);
    const count = exerciseCountFor(profile);
    const usage = new Map();
    const days = SPLITS[dayCount].map(key => {
      const tpl = T[key], dayNames = new Set(), exercises = [];
      const coreSlot = tpl.slots.find(s => s.some(x => CORE_SLOTS.includes(x)));
      const mainSlots = tpl.slots.filter(s => s !== coreSlot);
      const wantCore = coreSlot && count >= 4;
      const limit = wantCore ? count - 1 : count;
      const seenPatterns = new Set();
      const tryAdd = slots => {
        for (const slot of slots) {
          for (const s of [slot, ...(FALLBACK[slot] || [])]) {
            const ctx = { levelNum, goal: profile.goal, usage, dayNames, firstOfPattern: !seenPatterns.has(s), firstOfDay: exercises.length === 0 };
            const e = pickFor(s, pool, ctx);
            if (e) { dayNames.add(norm(e.name)); seenPatterns.add(s); usage.set(norm(e.name), (usage.get(norm(e.name)) || 0) + 1); exercises.push({ name: e.name, group: e.group, kind: 'strength', slot: e.slot, ...prescription(e, profile.goal, levelNum) }); return true; }
          }
        }
        return false;
      };
      for (const slots of mainSlots) { if (exercises.length >= limit) break; tryAdd(slots); }
      if (wantCore) tryAdd(coreSlot);
      return { title: tpl.title, focus: tpl.focus, template: key, exercises };
    });
    return { createdAt: new Date().toISOString(), version: 48, goal: profile.goal, level: profile.level, equipment: profile.equipment, note: SPLIT_NOTES[dayCount], days };
  }
  function buildEndurancePlan(profile, dayCount, levelNum) {
    const mins = Math.max(10, Number(profile.duration) || 30);
    const easy = Math.max(10, mins - 5);
    const cardio = (name, reps) => ({ name, group: 'Cardio', sets: 1, reps, kind: 'cardio', slot: 'cardio', rest: 0 });
    const sequence = levelNum === 1
      ? [['Alternancia de trote suave y caminata', `${mins} min`], ['Caminata rápida de recuperación', `${easy}–${mins} min`], ['Trote suave o alternancia trote-caminata', `${mins} min`], ['Caminata a ritmo cómodo', `${mins} min`], ['Alternancia de trote suave y caminata', `${mins} min`]]
      : [['Carrera continua a ritmo cómodo', `${mins} min`], ['Caminata rápida de recuperación', `${easy}–${mins} min`], ['Intervalos de trote controlado', `${mins} min incluyendo entrada en calor`], ['Carrera suave de recuperación', `${easy}–${mins} min`], ['Caminata a ritmo cómodo', `${mins} min`]];
    // Un día de fuerza general por semana ayuda a sostener el volumen de carrera.
    const pool = LIBRARY[profile.equipment] || LIBRARY.gym;
    const days = Array.from({ length: dayCount }, (_, i) => ({ title: `Resistencia · Día ${i + 1}`, focus: 'Cardio aeróbico a ritmo controlado', template: 'endurance', exercises: [cardio(...sequence[i % sequence.length])] }));
    if (dayCount >= 3) {
      const ctx = slot => ({ levelNum, goal: 'fitness', usage: new Map(), dayNames: new Set(), firstOfPattern: true });
      const strength = ['squat', 'hinge', 'core_ae'].map(s => pickFor(s, pool, ctx(s))).filter(Boolean).map(e => ({ name: e.name, group: e.group, kind: 'strength', slot: e.slot, ...prescription(e, 'fitness', Math.min(levelNum, 2)) }));
      days[dayCount - 1] = { title: `Resistencia · Día ${dayCount}`, focus: 'Fuerza de apoyo para correr: piernas y core', template: 'endurance-strength', exercises: strength };
    }
    return { createdAt: new Date().toISOString(), version: 48, goal: 'endurance', level: profile.level, equipment: profile.equipment, note: 'Dejá un día suave entre salidas exigentes; si algo duele, reemplazá la sesión por una caminata.', days };
  }

  // ---------- Entrenamiento diario (cada 12 h) ----------
  const DAILY_COOLDOWN_MS = 12 * 60 * 60 * 1000;
  const DAILY_MIN_SET_RATIO = 0.7;
  // Criterio de sesión diaria completa: al menos el 70 % de las series planificadas hechas y
  // todos los ejercicios con al menos una serie completada (cardio: actividad marcada).
  function evaluateDailyCompletion(session) {
    const exercises = Array.isArray(session && session.exercises) ? session.exercises : [];
    let planned = 0, done = 0, exercisesDone = 0;
    for (const e of exercises) {
      const entries = Array.isArray(e.entries) ? e.entries : [];
      const plannedSets = Math.max(1, Number(e.plannedSets) || entries.length || 1);
      const doneSets = entries.filter(x => x && x.done).length;
      planned += plannedSets; done += Math.min(doneSets, plannedSets);
      if (doneSets > 0) exercisesDone++;
    }
    const ratio = planned ? done / planned : 0;
    const complete = exercises.length > 0 && ratio >= DAILY_MIN_SET_RATIO && exercisesDone === exercises.length;
    return { complete, ratio, plannedSets: planned, completedSets: done, exercisesDone, exercises: exercises.length };
  }
  function dailyStatus(daily, planDays, serverNowMs) {
    const days = Number(planDays) || 0;
    if (!days) return { state: 'no-plan' };
    const seq = Math.max(0, Number(daily && daily.seq) || 0);
    const nextIndex = seq % days;
    const nextAt = daily && daily.nextAvailableAt ? Date.parse(daily.nextAvailableAt) : NaN;
    if (Number.isFinite(nextAt) && seq > 0) {
      if (!Number.isFinite(serverNowMs)) return { state: 'needs-time', nextIndex, seq, availableAt: daily.nextAvailableAt };
      if (serverNowMs < nextAt) return { state: 'cooldown', nextIndex, seq, availableAt: daily.nextAvailableAt, remainingMs: nextAt - serverNowMs };
    }
    return { state: 'available', nextIndex, seq };
  }
  function formatRemaining(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return h ? `${h} h ${String(m).padStart(2, '0')} min` : m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
  }

  // ---------- XP (recompensas) ----------
  // La sesión diaria completa da 50 XP una sola vez por período. Las demás sesiones completas dan
  // 20 XP, con un máximo de 2 por día. Las sesiones parciales no dan XP.
  function sessionXp(sessions) {
    let xp = 0; const extraPerDay = new Map();
    for (const s of Array.isArray(sessions) ? sessions : []) {
      if (!s || s.status === 'partial') continue;
      if (s.type === 'daily') { xp += 50; continue; }
      if (!s.type) { xp += 50; continue; } // sesiones de versiones anteriores conservan su valor original
      const day = String(s.date || '').slice(0, 10), used = extraPerDay.get(day) || 0;
      if (used < 2) { xp += s.type === 'manual' ? 10 : 20; extraPerDay.set(day, used + 1); }
    }
    return xp;
  }

  // ---------- Hidratación ----------
  function hydrationDay(entries, dateKey) { return (Array.isArray(entries) ? entries : []).filter(e => e && e.date === dateKey).reduce((n, e) => n + Math.max(0, Number(e.ml) || 0), 0); }
  function hydrationRecommendation(weightKg) {
    const w = Number(weightKg);
    if (!Number.isFinite(w) || w < 25 || w > 350) return null;
    // Referencia orientativa de 30–35 ml por kg para adultos; no es una indicación médica.
    const low = Math.round(w * 30 / 50) * 50, high = Math.round(w * 35 / 50) * 50;
    return { low: Math.min(4000, low), high: Math.min(4500, high) };
  }
  // v51: cuánto «se esperaría» llevar a esta hora si el objetivo se reparte parejo en la ventana del día (desde–hasta).
  // Es una guía de ritmo, no una indicación: antes de «desde» es 0 y después de «hasta» es el objetivo completo.
  function hydrationPace(goalMl, from = '09:00', to = '21:00', minutesNow = 0) {
    const goal = Number(goalMl), toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    let a = toMin(from), b = toMin(to); if (a == null || b == null || b <= a) { a = 540; b = 1260; }
    if (!Number.isFinite(goal) || goal <= 0) return 0;
    const now = Number(minutesNow) || 0;
    if (now <= a) return 0; if (now >= b) return Math.round(goal);
    return Math.round(goal * (now - a) / (b - a) / 10) * 10;
  }
  // v51: días seguidos con el objetivo cumplido. Si hoy todavía no se cumplió, la racha cuenta desde ayer (no se corta a mitad del día).
  function hydrationStreak(entries, goalMl, todayKey) {
    const goal = Number(goalMl); if (!Number.isFinite(goal) || goal <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(todayKey))) return 0;
    const totals = new Map(); for (const e of Array.isArray(entries) ? entries : []) if (e && e.date) totals.set(e.date, (totals.get(e.date) || 0) + Math.max(0, Number(e.ml) || 0));
    const d = new Date(todayKey + 'T12:00:00Z'), key = () => d.toISOString().slice(0, 10);
    if ((totals.get(key()) || 0) < goal) d.setUTCDate(d.getUTCDate() - 1);
    let n = 0; while (n < 3660 && (totals.get(key()) || 0) >= goal) { n++; d.setUTCDate(d.getUTCDate() - 1); }
    return n;
  }
  function validWaterMl(ml) { const n = Number(ml); return Number.isFinite(n) && n >= 10 && n <= 2000 ? Math.round(n) : null; }

  // ---------- Insignias destacadas ----------
  // Mejor nivel por desafío (nunca mezcla desafíos distintos) y hasta 3 destacadas.
  function highestPerChallenge(unlocks) {
    const best = new Map();
    for (const u of Object.values(unlocks || {})) {
      if (!u || !u.exerciseId) continue;
      const prev = best.get(u.exerciseId);
      if (!prev || Number(u.level) > Number(prev.level)) best.set(u.exerciseId, u);
    }
    return [...best.values()];
  }
  function featuredBadges(unlocks, selection = []) {
    const top = highestPerChallenge(unlocks);
    const byChallenge = new Map(top.map(u => [u.exerciseId, u]));
    const out = [], used = new Set();
    for (const id of Array.isArray(selection) ? selection : []) {
      const challenge = String(id || '').split(':')[0];
      const u = byChallenge.get(challenge);
      if (u && !used.has(challenge)) { out.push(u); used.add(challenge); }
      if (out.length === 3) return out;
    }
    const rest = top.filter(u => !used.has(u.exerciseId)).sort((a, b) => Number(b.level) - Number(a.level) || String(b.earnedAt || '').localeCompare(String(a.earnedAt || '')));
    for (const u of rest) { if (out.length === 3) break; out.push(u); }
    return out;
  }

  const api = { norm, slugify, LIBRARY, ALIASES, RETIRED, canonicalName, libraryEntry, allExercises, buildPlan, prescription, exerciseCountFor, SPLITS, DAILY_COOLDOWN_MS, DAILY_MIN_SET_RATIO, evaluateDailyCompletion, dailyStatus, formatRemaining, sessionXp, hydrationDay, hydrationRecommendation, hydrationPace, hydrationStreak, validWaterMl, highestPerChallenge, featuredBadges };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FittFormaTraining = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
