# Resuelve el catálogo contra USDA SR28 (ABBREV.txt + FOOD_DES.txt) y escribe food-db.js.
# Uso: python3 -I tools/food-db/build.py <carpeta con ABBREV.txt y FOOD_DES.txt> [--check]
import sys, re, json, os
sys.path.insert(0, os.path.dirname(__file__))
from catalog import C, RECIPES
src = sys.argv[1]
def rows(p):
    for line in open(os.path.join(src, p), encoding='latin-1'):
        yield [f.strip('~') for f in line.rstrip('\r\n').split('^')]
desc = {r[0]: r[2] for r in rows('FOOD_DES.txt')}
abbr = {r[0]: r for r in rows('ABBREV.txt')}
num = lambda x: float(x) if x not in ('', None) else None
PORTION = [(r'^1 cup', '1 taza'), (r'^1 medium', '1 unidad mediana'), (r'^1 large', '1 unidad grande'), (r'^1 small', '1 unidad chica'), (r'^1 slice', '1 rebanada'),
           (r'^1 tbsp', '1 cucharada'), (r'^1 tsp', '1 cucharadita'), (r'^1 fl oz', None), (r'^1 oz', None), (r'^1 piece', '1 unidad'), (r'^1 fruit', '1 unidad'),
           (r'^1 egg', '1 unidad'), (r'^1 patty', '1 unidad'), (r'^1 sandwich', '1 unidad'), (r'^1 serving', '1 porción'), (r'^1 NLEA serving', '1 porción'),
           (r'^1 can', '1 lata'), (r'^1 bottle', '1 botella'), (r'^1 stalk', '1 tallo'), (r'^1 clove', '1 diente'), (r'^1 thigh', '1 unidad'), (r'^1 drumstick', '1 unidad'),
           (r'^1 wing', '1 unidad'), (r'^1 breast', '1 unidad'), (r'^1 frank', '1 unidad'), (r'^1 link', '1 unidad'), (r'^1 cookie', '1 unidad'), (r'^1 cracker', '1 unidad'),
           (r'^1 muffin', '1 unidad'), (r'^1 roll', '1 unidad'), (r'^1 tortilla', '1 unidad'), (r'^1 bar', '1 unidad'), (r'^1 croissant', '1 unidad'), (r'^1 empanada', '1 unidad'),
           (r'^1 doughnut', '1 unidad'), (r'^1 pat', '1 porción chica (5 g)'), (r'^1 date', '1 unidad'), (r'^1 fig', '1 unidad'), (r'^1 kiwi', '1 unidad'), (r'^1 banana', '1 unidad'),
           (r'^1 potato', '1 unidad'), (r'^1 lemon', '1 unidad'), (r'^1 plum', '1 unidad'), (r'^1 peach', '1 unidad'), (r'^1 pear', '1 unidad'), (r'^1 orange', '1 unidad'),
           (r'^1 cookie', '1 unidad'), (r'^1 hot dog', '1 unidad'), (r'^1 package', None), (r'^1 container', '1 pote')]
def portion(desc_txt, grams):
    if not desc_txt or not grams: return None
    d = desc_txt.strip().lower()
    for pat, label in PORTION:
        if re.match(pat, d):
            if label is None: return None
            return {'label': label, 'g': round(float(grams), 1)}
    return None
out, problems, seen = [], [], set()
for name, cat, base, variant, q in C:
    if q.startswith('#'): ndb = q[1:]
    else:
        rx = re.compile(q, re.I); cand = [k for k, v in desc.items() if rx.search(v)]
        if not cand: problems.append(f'SIN COINCIDENCIA: {name} {variant} ← {q}'); continue
        ndb = sorted(cand, key=lambda k: (len(desc[k]), k))[0]
    r = abbr.get(ndb)
    if not r: problems.append(f'SIN DATOS: {name} {ndb}'); continue
    kcal, prot, fat, carb, fib, sug = num(r[3]), num(r[4]), num(r[5]), num(r[7]), num(r[8]), num(r[9])
    if kcal is None or prot is None: problems.append(f'INCOMPLETO: {name} {ndb}'); continue
    key = (name, variant)
    if key in seen: problems.append(f'DUPLICADO: {name} {variant}'); continue
    seen.add(key)
    portions = [p for p in (portion(r[49] if len(r) > 49 else '', num(r[48]) if len(r) > 48 else None), portion(r[51] if len(r) > 51 else '', num(r[50]) if len(r) > 50 else None)) if p]
    # Densidad (g/ml) para bebidas y lácteos líquidos a partir del peso de 1 taza (236,6 ml).
    density = None
    for gw, gd in ((r[48] if len(r) > 48 else '', r[49] if len(r) > 49 else ''), (r[50] if len(r) > 50 else '', r[51] if len(r) > 51 else '')):
        if gd.lower().startswith('1 cup') and gw and cat in ('bebidas', 'lacteos') and re.search(r'(milk|juice|beverage|beer|wine|soda|cola|drink|water|cream, fluid|soymilk)', desc[ndb], re.I):
            density = round(float(gw) / 236.6, 3)
    item = {'id': f'sr{ndb}', 'name': name, 'variant': variant, 'base': base, 'cat': cat, 'kcal': round(kcal), 'p': prot, 'c': carb or 0, 'f': fat or 0,
            'fib': fib, 'src': {'db': 'USDA SR28', 'ndb': ndb, 'desc': desc[ndb]}}
    portions = [p for k, p in enumerate(portions) if p['label'] not in [q['label'] for q in portions[:k]]]
    if portions: item['portions'] = portions
    if density: item['ml'] = density
    out.append(item)
# Sinónimos regionales para la búsqueda (no cambian los datos).
ALIASES = {'Banana': 'plátano', 'Palta': 'aguacate', 'Frutilla': 'fresa', 'Durazno': 'melocotón', 'Ananá': 'piña anana', 'Choclo': 'maíz elote',
  'Porotos negros': 'frijoles judías', 'Porotos rojos': 'frijoles judías', 'Porotos blancos': 'frijoles judías alubias', 'Maní': 'cacahuete cacahuate', 'Maní salado': 'cacahuete',
  'Zapallito': 'zucchini calabacín', 'Morrón rojo': 'pimiento ají', 'Morrón verde': 'pimiento ají', 'Chauchas': 'judías verdes ejotes', 'Arvejas': 'guisantes chícharos',
  'Manteca': 'mantequilla', 'Crema de leche': 'nata', 'Panceta': 'tocino bacon', 'Refresco cola': 'gaseosa soda coca', 'Refresco lima-limón': 'gaseosa soda',
  'Papa': 'patata', 'Boniato': 'batata camote', 'Fideos': 'pasta spaghetti tallarines', 'Fideos integrales': 'pasta', 'Queso muzzarella': 'mozzarella', 'Zapallo': 'calabaza auyama',
  'Mandioca': 'yuca', 'Salchichas (panchos)': 'hot dog frankfurt', 'Pechuga de pollo': 'pollo', 'Muslo de pollo': 'pollo', 'Pata de pollo': 'pollo', 'Alitas de pollo': 'pollo',
  'Pollo entero': 'pollo', 'Carne picada': 'carne molida', 'Pan': 'pan', 'Pop': 'pochoclo palomitas', 'Mantequilla de maní': 'pasta de maní', 'Jugo de naranja': 'zumo',
  'Remolacha': 'betarraga', 'Frambuesas': 'berries', 'Arándanos': 'berries', 'Queso crema': 'philadelphia', 'Dulce de leche': 'arequipe cajeta', 'Copos de maíz': 'cereal corn flakes'}
byname = {(i['name'], i['variant']): i for i in out}
for i in out:
    if i['name'] in ALIASES: i['alias'] = ALIASES[i['name']]
    if i['name'] == 'Harina de garbanzo': i['cat'] = 'legumbres'
# Recetas: suma de nutrientes de los ingredientes / peso final. Se marcan como estimación.
for name, cat, final_g, ings, note in RECIPES:
    tot = {'kcal': 0, 'p': 0, 'c': 0, 'f': 0, 'fib': 0}; parts = []; ok = True
    for iname, ivar, g in ings:
        it = byname.get((iname, ivar))
        if not it: problems.append(f'RECETA {name}: falta {iname} {ivar}'); ok = False; continue
        for k in tot: tot[k] += (it.get(k) or 0) * g / 100
        parts.append({'id': it['id'], 'g': g})
    if not ok or not final_g: continue
    k = 100 / final_g
    out.append({'id': 'rc-' + re.sub(r'[^a-z0-9]+', '-', name.lower().encode('ascii', 'ignore').decode()).strip('-'), 'name': name, 'variant': 'Receta casera', 'base': name, 'cat': cat,
                'kcal': round(tot['kcal'] * k), 'p': round(tot['p'] * k, 1), 'c': round(tot['c'] * k, 1), 'f': round(tot['f'] * k, 1), 'fib': round(tot['fib'] * k, 1),
                'src': {'type': 'receta', 'yield': final_g, 'ingredients': parts, 'note': note}, 'portions': [{'label': '1 porción', 'g': round(min(final_g, 300 if final_g > 600 else final_g), 0)}]})
if '--check' in sys.argv:
    for i in out: print(f"{i['cat']:11} {i['name'][:30]:30} {i['variant'][:26]:26} #{i['src'].get('ndb','receta')} {i['kcal']:4} kcal  P{i['p']} C{i['c']} G{i['f']}  {i['src'].get('desc', i['src'].get('note',''))[:70]}")
for p in problems: print('PROBLEMA', p, file=sys.stderr)
print(len(out), 'alimentos', file=sys.stderr)
if '--check' not in sys.argv:
    root = os.path.join(os.path.dirname(__file__), '..', '..')
    header = ('/* FittForma AI v50 — base de alimentos local (funciona sin conexión).\n'
              ' * Datos por 100 g de USDA National Nutrient Database for Standard Reference, Release 28 (2015, dominio público),\n'
              ' * vinculados por número NDB (src.ndb) para poder verificarlos. Las filas con src.type="receta" son ESTIMACIONES\n'
              ' * calculadas con esos ingredientes. Generado con tools/food-db/build.py; no editar a mano. */\n')
    with open(os.path.join(root, 'food-db.js'), 'w', encoding='utf-8') as fh: fh.write(header + 'window.FittFormaFoodDb=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
