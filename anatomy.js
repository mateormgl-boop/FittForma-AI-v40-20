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

  // v57: dibujo nuevo, más anatómico. Silueta atlética (mitad izquierda; se refleja). Figura de frente, centro x = 60.
  const SILHOUETTE = [[60, 27], [55.5, 28], [53.5, 32.5], [46, 35.5], [38, 38], [31.5, 40.5], [27, 45], [24.6, 52], [23.8, 61], [23, 71], [22, 81], [21, 88],
    [19.4, 98], [17.6, 108], [15.6, 118], [14.4, 124], [12.4, 129.5], [12.8, 137], [16.4, 140.5], [19.6, 135], [20.6, 128], [21.6, 123], [24, 112], [26.8, 100], [29, 90],
    [31, 80], [32.2, 69], [34, 63], [36, 70], [37.2, 82], [39, 93], [39.8, 100], [39, 108], [37.4, 116], [36.2, 126], [36, 140], [37, 152], [38.8, 164], [40, 172],
    [40, 178], [38.4, 188], [38.2, 198], [40, 210], [42, 220], [40, 226], [43.6, 229.2], [54, 228.4], [55.2, 222], [54, 215.5], [53.2, 204], [54, 190], [55, 178],
    [55.2, 170], [56.2, 156], [57.2, 142], [58.2, 131], [60, 125]];

  // Regiones musculares: puntos de la mitad izquierda (se reflejan). side: 'front' | 'back'.
  // Un músculo puede tener varias partes (abdominales en bloques, cuádriceps en tres cabezas, gemelo en dos).
  const SHAPES = [
    // ---------- Frente ----------
    { id: 'trapecio', side: 'front', pts: [[53.6, 31.4], [57.4, 30.8], [55.2, 36], [45.4, 38.6]] },
    { id: 'deltoides_lateral', side: 'front', pts: [[26.6, 46.5], [32, 41.6], [32.6, 49.5], [32.4, 56.8], [28, 59.2], [25.2, 53.4]] },
    { id: 'deltoides_anterior', side: 'front', pts: [[33.4, 41.2], [40.6, 39.2], [44, 43.4], [40.4, 51.6], [34.4, 57.4], [33, 49.6]] },
    { id: 'pectorales', side: 'front', pts: [[44.6, 41], [58.6, 41.6], [59.2, 49.2], [58.4, 56.6], [52, 60.6], [45, 59.2], [40.6, 53]] },
    { id: 'biceps', side: 'front', pts: [[27.4, 61], [32.2, 61.6], [33.8, 68], [32.2, 78.6], [28.6, 83.4], [25.6, 76.6], [25.4, 67.2]] },
    { id: 'antebrazos', side: 'front', pts: [[22.2, 88.4], [28.2, 89], [29, 95.6], [26.4, 107.6], [21.2, 119.6], [18.6, 114], [19.4, 100.4]] },
    { id: 'abdominales', side: 'front', pts: [[52.4, 62.2], [59.2, 62.2], [59.2, 70.6], [52.6, 71.2]] },
    { id: 'abdominales', side: 'front', pts: [[52.4, 73.2], [59.2, 72.8], [59.2, 81.6], [52.6, 82.2]] },
    { id: 'abdominales', side: 'front', pts: [[52.6, 84.2], [59.2, 83.8], [59.2, 92.6], [53.2, 93.2]] },
    { id: 'abdominales', side: 'front', pts: [[53.4, 95.2], [59.2, 94.8], [59.2, 106.4], [55.4, 104.6]] },
    { id: 'oblicuos', side: 'front', pts: [[42.4, 63], [50.2, 66.2], [50.6, 80], [50.2, 94.2], [46.4, 100.4], [41.2, 96], [40, 80]] },
    { id: 'cuadriceps', side: 'front', pts: [[38.6, 121.6], [45.2, 124], [46, 146], [43.4, 163], [39.4, 158], [37.4, 138]] },
    { id: 'cuadriceps', side: 'front', pts: [[46.4, 124.2], [53, 127.4], [53.2, 148], [49.4, 162], [45.6, 160.4], [46.4, 142]] },
    { id: 'cuadriceps', side: 'front', pts: [[50.6, 155.6], [54.8, 151.6], [56.4, 160], [53.4, 168.2], [49, 166.4]] },
    { id: 'aductores', side: 'front', pts: [[54.2, 126.6], [59, 126.4], [58.2, 138.2], [55.6, 146.4], [53.6, 138]] },
    { id: 'tibiales', side: 'front', pts: [[41.2, 178.4], [46, 180.2], [46.2, 196.2], [44.2, 212], [41.2, 198.4]] },
    { id: 'gemelos', side: 'front', pts: [[47.4, 182.4], [53.2, 180.2], [54.2, 192.2], [51.4, 204.4], [48, 198.2]] },
    // ---------- Espalda (figura desplazada +120 en x) ----------
    { id: 'trapecio', side: 'back', pts: [[180, 28.4], [173.4, 31], [162, 38.2], [168.4, 44.2], [176, 56.6], [180, 72.4]] },
    { id: 'deltoides_lateral', side: 'back', pts: [[145, 48.2], [150.2, 43], [151, 56], [147, 58.4], [144, 53.2]] },
    { id: 'deltoides_posterior', side: 'back', pts: [[150.4, 43.6], [158.2, 40.2], [162, 46.2], [157.2, 55], [151, 57.2]] },
    { id: 'espalda_media', side: 'back', pts: [[164.2, 44.6], [175.4, 47], [176, 58.4], [169, 62.4], [162, 55.4]] },
    { id: 'dorsales', side: 'back', pts: [[158, 58.4], [168, 63.4], [176, 72], [175.4, 86], [170, 96.4], [163, 98], [159, 84], [157, 68.4]] },
    { id: 'triceps', side: 'back', pts: [[146.2, 59], [152.2, 58.2], [153.2, 70], [151.2, 82], [147.2, 84.2], [144.2, 74], [144.2, 64]] },
    { id: 'antebrazos', side: 'back', pts: [[142.2, 88.4], [148.2, 89], [149, 95.6], [146.4, 107.6], [141.2, 119.6], [138.6, 114], [139.4, 100.4]] },
    { id: 'lumbares', side: 'back', pts: [[174.2, 86.4], [179.2, 86.2], [179.2, 106.4], [174, 106.4], [172.2, 96]] },
    { id: 'gluteo_medio', side: 'back', pts: [[158.2, 104.2], [166.4, 101.2], [170.4, 108.2], [162.2, 114.2], [157.4, 112]] },
    { id: 'gluteos', side: 'back', pts: [[161.2, 112.2], [172.2, 108.4], [179.2, 110.2], [179.2, 128.2], [172, 134.2], [163.2, 131.2], [158.4, 122]] },
    { id: 'isquiotibiales', side: 'back', pts: [[159.2, 134.4], [167.2, 136.2], [167.4, 158], [164.2, 168.2], [160.2, 160], [158.4, 146]] },
    { id: 'isquiotibiales', side: 'back', pts: [[168.2, 136.4], [176.2, 136.2], [176.2, 152.4], [172.2, 168.2], [168.2, 164]] },
    { id: 'gemelos', side: 'back', pts: [[160.4, 174.4], [167.2, 176.2], [167.4, 192.2], [164.2, 202.2], [160.4, 194.2]] },
    { id: 'gemelos', side: 'back', pts: [[168.2, 175.2], [174.2, 174.2], [175.2, 188.2], [172.2, 200.2], [169.2, 194.2]] }
  ];
  // Líneas de detalle (separaciones musculares) para dar volumen. Mitad izquierda; se reflejan.
  const DETAILS = {
    front: ['M60 62 L60 108', 'M45 59.5 Q52 63 58.6 57.4', 'M33 57.6 Q30.5 60 27.6 60.8', 'M40.4 172 Q44 170.6 47.6 172.4', 'M44 41 Q51 39.4 58.6 40.4', 'M24 86.6 Q26.8 88.4 29.2 88.6'],
    back: ['M180 28 L180 108', 'M171 100 Q176 104 179.4 108', 'M163.6 98.4 Q168 104 172.6 108.6', 'M159.6 170.6 Q166 168 174.8 171']
  };

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
  const mirror = (d, cx) => `<path d="${d}"/><path d="${d}" transform="translate(${cx * 2},0) scale(-1,1)"/>`;
  // Cuerpo: cabeza, cuello y silueta con sombreado suave (gradiente propio de cada mapa).
  function bodyOf(side, cx, id) {
    const dx = side === 'back' ? 120 : 0, d = smooth(SILHOUETTE.map(([x, y]) => [x + dx, y]));
    return `<g class="am-body" fill="url(#${id}b)"><ellipse cx="${cx}" cy="15.5" rx="9.6" ry="11.6"/><rect x="${cx - 4.4}" y="24" width="8.8" height="8" rx="3"/><path d="${d}"/><path d="${d}" transform="translate(${cx * 2},0) scale(-1,1)"/></g>`;
  }
  function detailsOf(side, cx) { return `<g class="am-detail">${(DETAILS[side] || []).map(d => mirror(d, cx)).join('')}</g>`; }
  const defsOf = id => `<defs><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="am-b0"/><stop offset=".5" class="am-b1"/><stop offset="1" class="am-b0"/></linearGradient><radialGradient id="${id}g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>`;
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
      const muscles = SHAPES.filter(m => m.side === side).map(m => shape(m.pts, `am-m${p.has(m.id) ? ' is-primary' : s.has(m.id) ? ' is-secondary' : ''}`, cx) + (p.has(m.id) || s.has(m.id) ? `<g class="am-gloss" fill="url(#${id}g)">${mirror(smooth(m.pts), cx)}</g>` : '')).join('');
      return `<g class="am-fig am-${side}">${bodyOf(side, cx, id)}${muscles}${detailsOf(side, cx)}<text class="am-cap" x="${cx}" y="242" text-anchor="middle">${side === 'front' ? 'Frente' : 'Espalda'}</text></g>`;
    };
    const vb = sides === 'front' ? '0 0 120 248' : sides === 'back' ? '120 0 120 248' : '0 0 240 248';
    const names = [...p].map(k => MUSCLES[k]).join(', ');
    const label = opts.label || (names ? `Músculos trabajados: ${names}` : 'Mapa muscular');
    const content = (sides !== 'back' ? fig('front', 60) : '') + (sides !== 'front' ? fig('back', 180) : '');
    return `<svg class="anatomy-map anatomy-${opts.size || 'md'}" viewBox="${vb}" role="img" aria-labelledby="${id}"><title id="${id}">${label.replace(/[<&>"]/g, '')}</title>${defsOf(id)}${content}</svg>`;
  }

  /**
   * v52: mapa con un color por músculo (rangos del «Mapa de avances»). fills = { idMúsculo: '#color' };
   * los que no figuran quedan en gris. opts: { label, sides: 'both'|'front'|'back', className }
   */
  function muscleFillSvg(fills, opts = {}) {
    const sides = opts.sides || 'both', id = 'af' + (++uid);
    const shape = (pts, attrs, mirrorX) => `<path ${attrs} d="${smooth(pts)}"/><path ${attrs} d="${smooth(pts)}" transform="translate(${mirrorX * 2},0) scale(-1,1)"/>`;
    const fig = (side, cx) => {
      const muscles = SHAPES.filter(m => m.side === side).map(m => {
        // fills[id] = '#color' o { color, edge } (por ejemplo Leyenda: negro con borde dorado).
        const f = fills && fills[m.id], c = f && typeof f === 'object' ? f.color : f, edge = f && typeof f === 'object' && f.edge ? `;stroke:${f.edge};stroke-width:1.1` : '';
        return shape(m.pts, c ? `class="am-m is-ranked" data-muscle="${m.id}" style="fill:${c}${edge}"` : `class="am-m" data-muscle="${m.id}"`, cx)
          + (c ? shape(m.pts, `class="am-gloss" fill="url(#${id}g)"`, cx) : '');
      }).join('');
      return `<g class="am-fig am-${side}">${bodyOf(side, cx, id)}${muscles}${detailsOf(side, cx)}<text class="am-cap" x="${cx}" y="242" text-anchor="middle">${side === 'front' ? 'Frente' : 'Espalda'}</text></g>`;
    };
    const vb = sides === 'front' ? '0 0 120 248' : sides === 'back' ? '120 0 120 248' : '0 0 240 248';
    const content = (sides !== 'back' ? fig('front', 60) : '') + (sides !== 'front' ? fig('back', 180) : '');
    return `<svg class="anatomy-map ${opts.className || ''}" viewBox="${vb}" role="img" aria-labelledby="${id}"><title id="${id}">${String(opts.label || 'Mapa muscular').replace(/[<&>"]/g, '')}</title>${defsOf(id)}${content}</svg>`;
  }

  root.FittFormaAnatomy = Object.freeze({ MUSCLES, SHAPES, SILHOUETTE, musclesFromText, muscleMapSvg, muscleFillSvg });
})(typeof window !== 'undefined' ? window : globalThis);
