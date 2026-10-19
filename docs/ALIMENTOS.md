# Base de alimentos (v50)

- **281 alimentos** en `food-db.js`, en español rioplatense, con sinónimos (plátano, aguacate, frijoles…).
  Funcionan **sin conexión**.
- **Datos verificados**: valores por 100 g de *USDA National Nutrient Database for Standard Reference, Release 28*
  (dominio público). Cada alimento muestra su número **NDB** para comprobarlo en FoodData Central.
  Ejemplo: «Papa · Hervida» → NDB 11367.
- **Variantes y preparación**: crudo / hervido / al horno / frito, entero / descremado, etc., agrupados.
- **Porciones**: gramos; mililitros solo cuando hay densidad conocida (calculada con el peso USDA de una taza);
  porciones caseras con su peso USDA (taza, unidad, rebanada, cucharada…).
- **Recetas uruguayas (estimaciones)**: milanesa, napolitana, chivito, choripán, pancho, tortilla de papas, pascualina,
  fainá, torta frita, guiso de lentejas, ñoquis, refuerzo y puchero. Se calculan sumando ingredientes USDA y
  dividiendo por el peso final. Se muestran con la etiqueta **«Estimación por receta»**, nunca como dato de laboratorio.
- **Productos envasados**: búsqueda en línea en Open Food Facts. Solo se aceptan productos con calorías y proteínas por
  100 g, y los vendidos en Uruguay aparecen primero. Se marcan como **«Etiqueta (Open Food Facts)»**. Si la API no
  responde, se avisa y la base local sigue funcionando. El escaneo por código de barras ya existía.
- **Registro**: desayuno, almuerzo, merienda, cena y colación. También favoritos (★), frecuentes (según tus
  registros), edición y eliminación.
- **Sin inventar**: no se incluyó la yerba mate porque no hay un dato confiable en las fuentes usadas. Las
  equivalencias aproximadas se nombran como tales, por ejemplo «Pescado blanco tipo merluza (eglefino)» o
  «Queso tipo gouda (dambo)».

Regenerar: `python3 -I tools/food-db/build.py <carpeta con ABBREV.txt y FOOD_DES.txt de SR28>`. Los datos de SR28 se
obtienen del paquete npm `fda-nutrient-database@1.0.2`, que es una copia de la publicación USDA.
