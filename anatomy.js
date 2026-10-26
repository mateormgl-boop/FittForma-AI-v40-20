/* FittForma AI v49 — mapa muscular propio (SVG vectorial, sin imágenes externas).
 * Figura de frente y de espalda con regiones musculares de identificador estable. Cada ejercicio resalta
 * su músculo principal (rojo) y los secundarios (ámbar) a partir del texto de su ficha técnica.
 * window.FittFormaAnatomy = { MUSCLES, musclesFromText, muscleMapSvg }
 */
(function (root) {
  'use strict';

  // Curva suave cerrada (Catmull-Rom → Bézier) a partir de puntos [x, y].
  function smooth(points, closed = true) {
    const p = points, n = p.length;
    if (n < 3) return '';
    const at = i => p[(i + n) % n];
    let d = `M${p[0][0]},${p[0][1]}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = closed ? at(i - 1) : p[Math.max(0, i - 1)], p1 = at(i), p2 = closed ? at(i + 1) : p[Math.min(n - 1, i + 1)], p3 = closed ? at(i + 2) : p[Math.min(n - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d + (closed ? 'Z' : '');
  }

  // Silueta (mitad izquierda; se refleja). Coordenadas de la figura de frente, centro x = 60.
  const SILHOUETTE = [[60, 28], [54, 30], [47, 34], [38, 38], [30, 42], [25, 52], [23, 66], [21, 84], [18, 100], [16, 116], [13, 126], [16, 132], [21, 128], [23, 118], [27, 100], [31, 84], [34, 70], [37, 78], [40, 96], [37, 112], [36, 136], [39, 160], [41, 168], [39, 186], [42, 206], [39, 220], [46, 224], [54, 222], [54, 210], [55, 188], [55, 168], [57, 146], [58, 128], [60, 122]];

  // Regiones musculares: puntos de la mitad izquierda. side: 'front' | 'back'.
  const SHAPES = [
    // Frente
    { id: 'trapecio', side: 'front', pts: [[47, 33], [55, 31], [56, 36], [42, 40]] },
    { id: 'deltoides_lateral', side: 'front', pts: [[27, 46], [32, 41], [33, 55], [28, 58], [25, 52]] },
    { id: 'deltoides_anterior', side: 'front', pts: [[33, 41], [40, 38], [43, 44], [39, 53], [34, 57]] },
    { id: 'pectorales', side: 'front', pts: [[44, 41], [58, 42], [59, 55], [52, 61], [43, 59], [40, 51]] },
    { id: 'biceps', side: 'front', pts: [[29, 59], [34, 61], [34, 75], [30, 82], [26, 76], [26, 65]] },
    { id: 'antebrazos', side: 'front', pts: [[24, 86], [30, 86], [28, 103], [23, 115], [19, 108], [20, 95]] },
    { id: 'abdominales', side: 'front', pts: [[52, 63], [59, 63], [59, 99], [55, 106], [51, 97]] },
    { id: 'oblicuos', side: 'front', pts: [[41, 63], [49, 66], [49, 96], [43, 101], [39, 84]] },
    { id: 'cuadriceps', side: 'front', pts: [[39, 118], [54, 125], [54, 150], [50, 163], [43, 163], [38, 141]] },
    { id: 'aductores', side: 'front', pts: [[55, 124], [59, 124], [58, 140], [55, 150]] },
    { id: 'tibiales', side: 'front', pts: [[42, 172], [48, 171], [47, 196], [44, 207], [41, 192]] },
    { id: 'gemelos', side: 'front', pts: [[49, 172], [54, 174], [54, 190], [51, 200], [48, 192]] },
    // Espalda (figura desplazada +120 en x)
    { id: 'trapecio', side: 'back', pts: [[173, 29], [180, 29], [180, 76], [173, 62], [162, 43], [151, 39]] },
    { id: 'deltoides_posterior', side: 'back', pts: [[150, 42], [159, 40], [161, 50], [155, 57], [148, 51]] },
    { id: 'deltoides_lateral', side: 'back', pts: [[146, 45], [150, 42], [149, 55], [146, 57], [144, 51]] },
    { id: 'triceps', side: 'back', pts: [[147, 58], [153, 58], [154, 74], [150, 82], [146, 76], [145, 64]] },
    { id: 'antebrazos', side: 'back', pts: [[144, 86], [150, 86], [148, 103], [143, 115], [139, 108], [140, 95]] },
    { id: 'espalda_media', side: 'back', pts: [[167, 45], [179, 46], [179, 63], [171, 60]] },
    { id: 'dorsales', side: 'back', pts: [[158, 55], [170, 62], [176, 78], [171, 93], [162, 97], [158, 80]] },
    { id: 'lumbares', side: 'back', pts: [[172, 81], [179, 81], [179, 104], [172, 104]] },
    { id: 'gluteo_medio', side: 'back', pts: [[157, 103], [164, 100], [167, 107], [160, 113]] },
    { id: 'gluteos', side: 'back', pts: [[160, 108], [179, 108], [179, 125], [170, 132], [160, 126], [157, 116]] },
    { id: 'isquiotibiales', side: 'back', pts: [[159, 131], [175, 133], [175, 154], [171, 164], [163, 164], [158, 146]] },
    { id: 'gemelos', side: 'back', pts: [[160, 170], [169, 170], [171, 184], [167, 201], [163, 201], [159, 184]] }
  ];

  const MUSCLES = {
    pectorales: 'Pectorales', deltoides_anterior: 'Deltoides anterior', deltoides_lateral: 'Deltoides lateral', deltoides_posterior: 'Deltoides posterior',
    biceps: 'Bíceps', triceps: 'Tríceps', antebrazos: 'Antebrazos', abdominales: 'Abdominales', oblicuos: 'Oblicuos', trapecio: 'Trapecio',
    espalda_media: 'Espalda media', dorsales: 'Dorsales', lumbares: 'Zona lumbar', gluteos: 'Glúteos', gluteo_medio: 'Glúteo medio',
    cuadriceps: 'Cuádriceps', aductores: 'Aductores', isquiotibiales: 'Isquiotibiales', gemelos: 'Gemelos', tibiales: 'Tibial anterior'
  };

  // Texto de la ficha → identificadores. El orden importa: lo específico antes que lo general.
  const RULES = [
    [/biceps femoral|isquio|femoral posterior/, ['isquiotibiales']],
    [/gluteo medio|gluteo menor|abductor|tensor de la fascia|externos de la cadera/, ['gluteo_medio']],
    [/gluteo/, ['gluteos']],
    [/pectoral|pecho/, ['pectorales']],
    [/deltoides anterior|hombro anterior|porcion clavicular del deltoides/, ['deltoides_anterior']],
    [/deltoides lateral|deltoides medio|porcion lateral/, ['deltoides_lateral']],
    [/deltoides posterior|manguito|infraespinoso|redondo menor|rotadores externos/, ['deltoides_posterior']],
    [/deltoides|hombro/, ['deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior']],
    [/triceps|anconeo/, ['triceps']],
    [/biceps|braquial(?!.*radial)/, ['biceps']],
    [/antebrazo|braquiorradial|agarre|flexores del antebrazo|extensores del antebrazo/, ['antebrazos']],
    [/oblicu|serrato|cuadrado lumbar/, ['oblicuos']],
    [/recto abdominal|abdomin|transverso|core|tronco/, ['abdominales']],
    [/trapecio|elevador de la escapula|cuello/, ['trapecio']],
    [/romboide|espalda media|parte alta de la espalda|espalda alta|estabilizadores escapulares|redondo mayor/, ['espalda_media']],
    [/dorsal/, ['dorsales']],
    [/lumbar|erector|columna|espalda baja/, ['lumbares']],
    [/recto femoral|cuadriceps/, ['cuadriceps']],
    [/aductor|gracil|pectineo/, ['aductores']],
    [/flexores de cadera|psoas/, ['cuadriceps']],
    [/gemelo|gastrocnemio|pantorrilla|soleo/, ['gemelos']],
    [/tibial/, ['tibiales']],
    [/espalda/, ['dorsales', 'espalda_media']],
    [/brazos/, ['biceps', 'triceps']],
    [/piernas/, ['cuadriceps', 'isquiotibiales', 'gluteos', 'gemelos']],
    [/cadera/, ['gluteos']]
  ];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function musclesFromText(text) {
    const out = new Set();
    // Cada fragmento separado por comas, «y», punto y coma o paréntesis se evalúa por separado.
    for (const part of norm(text).split(/[,;()]| y | e /)) {
      const p = part.trim(); if (!p) continue;
      for (const [re, ids] of RULES) { if (re.test(p)) { ids.forEach(id => out.add(id)); break; } }
    }
    return [...out];
  }

  let uid = 0;
  /**
   * SVG con frente y espalda. primary/secondary: texto de la ficha o listas de ids.
   * opts: { size: 'sm'|'md'|'lg', label: texto accesible, sides: 'both'|'front'|'back' }
   */
  function muscleMapSvg(primary, secondary, opts = {}) {
    const p = new Set(Array.isArray(primary) ? primary : musclesFromText(primary));
    const s = new Set((Array.isArray(secondary) ? secondary : musclesFromText(secondary)).filter(id => !p.has(id)));
    const sides = opts.sides || 'both';
    const id = 'am' + (++uid);
    const shape = (pts, cls, mirrorX) => `<path class="${cls}" d="${smooth(pts)}"/>` + `<path class="${cls}" d="${smooth(pts)}" transform="translate(${mirrorX * 2},0) scale(-1,1)"/>`;
    const fig = (side, cx) => {
      const dx = side === 'back' ? 120 : 0;
      const sil = SILHOUETTE.map(([x, y]) => [x + dx, y]);
      const body = `<ellipse class="am-body" cx="${cx}" cy="16" rx="10" ry="12"/>` + shape(sil, 'am-body', cx);
      const muscles = SHAPES.filter(m => m.side === side).map(m => shape(m.pts, `am-m${p.has(m.id) ? ' is-primary' : s.has(m.id) ? ' is-secondary' : ''}`, cx)).join('');
      return `<g class="am-fig am-${side}">${body}${muscles}<text class="am-cap" x="${cx}" y="242" text-anchor="middle">${side === 'front' ? 'Frente' : 'Espalda'}</text></g>`;
    };
    const vb = sides === 'front' ? '0 0 120 248' : sides === 'back' ? '120 0 120 248' : '0 0 240 248';
    const names = [...p].map(k => MUSCLES[k]).join(', ');
    const label = opts.label || (names ? `Músculos trabajados: ${names}` : 'Mapa muscular');
    const content = (sides !== 'back' ? fig('front', 60) : '') + (sides !== 'front' ? fig('back', 180) : '');
    return `<svg class="anatomy-map anatomy-${opts.size || 'md'}" viewBox="${vb}" role="img" aria-labelledby="${id}"><title id="${id}">${label.replace(/[<&>"]/g, '')}</title>${content}</svg>`;
  }

  /**
   * v52: mapa con un color por músculo (rangos del «Mapa de avances»). fills = { idMúsculo: '#color' };
   * los que no figuran quedan en gris. opts: { label, sides: 'both'|'front'|'back', className }
   */
  function muscleFillSvg(fills, opts = {}) {
    const sides = opts.sides || 'both', id = 'af' + (++uid);
    const shape = (pts, attrs, mirrorX) => `<path ${attrs} d="${smooth(pts)}"/><path ${attrs} d="${smooth(pts)}" transform="translate(${mirrorX * 2},0) scale(-1,1)"/>`;
    const fig = (side, cx) => {
      const dx = side === 'back' ? 120 : 0;
      const body = `<ellipse class="am-body" cx="${cx}" cy="16" rx="10" ry="12"/>` + shape(SILHOUETTE.map(([x, y]) => [x + dx, y]), 'class="am-body"', cx);
      const muscles = SHAPES.filter(m => m.side === side).map(m => {
        const c = fills && fills[m.id];
        return shape(m.pts, c ? `class="am-m is-ranked" data-muscle="${m.id}" style="fill:${c}"` : `class="am-m" data-muscle="${m.id}"`, cx);
      }).join('');
      return `<g class="am-fig am-${side}">${body}${muscles}<text class="am-cap" x="${cx}" y="242" text-anchor="middle">${side === 'front' ? 'Frente' : 'Espalda'}</text></g>`;
    };
    const vb = sides === 'front' ? '0 0 120 248' : sides === 'back' ? '120 0 120 248' : '0 0 240 248';
    const content = (sides !== 'back' ? fig('front', 60) : '') + (sides !== 'front' ? fig('back', 180) : '');
    return `<svg class="anatomy-map ${opts.className || ''}" viewBox="${vb}" role="img" aria-labelledby="${id}"><title id="${id}">${String(opts.label || 'Mapa muscular').replace(/[<&>"]/g, '')}</title>${content}</svg>`;
  }

  root.FittFormaAnatomy = Object.freeze({ MUSCLES, SHAPES, musclesFromText, muscleMapSvg, muscleFillSvg });
})(typeof window !== 'undefined' ? window : globalThis);
