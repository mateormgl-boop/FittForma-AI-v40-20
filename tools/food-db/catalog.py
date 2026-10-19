# Catálogo curado de alimentos (español rioplatense) → alimento exacto de USDA SR28 (dominio público).
# Cada fila: (nombre, categoría, grupo/base, variante, consulta). La consulta es una expresión regular sobre la
# descripción larga de SR28 o "#NNNNN" para un número NDB exacto. build.py resuelve cada fila y genera food-db.js.
C = []
def add(cat, base, rows):
    for r in rows:
        name, variant, q = r if len(r) == 3 else (r[0], '', r[1])
        C.append((name, cat, base or name, variant, q))

# ---------- Frutas ----------
for n, q in [('Manzana', r'^Apples, raw, with skin'), ('Banana', r'^Bananas, raw$'), ('Naranja', r'^Oranges, raw, all commercial varieties'),
             ('Mandarina', r'^Tangerines, \(mandarin oranges\), raw'), ('Pera', r'^Pears, raw$'), ('Durazno', r'^Peaches, yellow, raw'),
             ('Frutilla', r'^Strawberries, raw'), ('Uva', r'^Grapes, red or green \(European type, such as Thompson seedless\), raw'),
             ('Kiwi', r'^Kiwifruit, green, raw'), ('Ananá', r'^Pineapple, raw, all varieties'), ('Sandía', r'^Watermelon, raw'),
             ('Melón', r'^Melons, cantaloupe, raw'), ('Ciruela', r'^Plums, raw'), ('Limón', r'^Lemons, raw, without peel'),
             ('Pomelo', r'^Grapefruit, raw, pink and red, all areas'), ('Mango', r'^Mangos, raw'), ('Palta', r'^Avocados, raw, all commercial varieties'),
             ('Arándanos', r'^Blueberries, raw'), ('Frambuesas', r'^Raspberries, raw'), ('Cereza', r'^Cherries, sweet, raw'),
             ('Membrillo (fruta)', r'^Quinces, raw'), ('Higo', r'^Figs, raw'), ('Coco rallado', r'^Nuts, coconut meat, dried \(desiccated\), not sweetened'),
             ('Pasas de uva', r'^Raisins, seedless'), ('Ciruelas pasas', r'^Plums, dried \(prunes\), uncooked'), ('Dátiles', r'^Dates, medjool'),
             ('Damascos secos', r'^Apricots, dried, sulfured, uncooked'), ('Durazno en almíbar', r'^Peaches, canned, heavy syrup pack, solids and liquids'),
             ('Ensalada de frutas en almíbar', r'^Fruit cocktail, \(peach and pineapple and pear and grape and cherry\), canned, heavy syrup, solids and liquids'),
             ('Maracuyá', r'^Passion-fruit, \(granadilla\), purple, raw'), ('Papaya', r'^Papayas, raw'), ('Granada', r'^Pomegranates, raw')]:
    add('frutas', None, [(n, q)])

# ---------- Verduras ----------
add('verduras', 'Papa', [('Papa', 'Cruda', r'^Potatoes, flesh and skin, raw'), ('Papa', 'Hervida', r'^Potatoes, boiled, cooked without skin, flesh, without salt'),
     ('Papa', 'Al horno con cáscara', r'^Potatoes, baked, flesh and skin, without salt'), ('Papa', 'Puré con leche y manteca', r'^Potatoes, mashed, home-prepared, whole milk and butter added'),
     ('Papa', 'Fritas congeladas, al horno', r'^Potatoes, french fried, all types, salt not added in processing, frozen, oven-heated')])
add('verduras', 'Boniato', [('Boniato', 'Al horno', r'^Sweet potato, cooked, baked in skin, flesh, without salt'), ('Boniato', 'Hervido', r'^Sweet potato, cooked, boiled, without skin$')])
for n, v, q in [('Zapallo (tipo calabacín butternut)', 'Al horno', r'^Squash, winter, butternut, cooked, baked, without salt'), ('Zapallito', 'Hervido', r'^Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt'),
                ('Zanahoria', 'Cruda', r'^Carrots, raw'), ('Zanahoria', 'Hervida', r'^Carrots, cooked, boiled, drained, without salt'),
                ('Tomate', 'Crudo', r'^Tomatoes, red, ripe, raw, year round average'), ('Lechuga', 'Cruda', r'^Lettuce, green leaf, raw'),
                ('Cebolla', 'Cruda', r'^Onions, raw'), ('Morrón rojo', 'Crudo', r'^Peppers, sweet, red, raw'), ('Morrón verde', 'Crudo', r'^Peppers, sweet, green, raw'),
                ('Pepino', 'Crudo', r'^Cucumber, with peel, raw'), ('Brócoli', 'Hervido', r'^Broccoli, cooked, boiled, drained, without salt'),
                ('Coliflor', 'Hervida', r'^Cauliflower, cooked, boiled, drained, without salt'), ('Espinaca', 'Cruda', r'^Spinach, raw'),
                ('Espinaca', 'Hervida', r'^Spinach, cooked, boiled, drained, without salt'), ('Acelga', 'Hervida', r'^Chard, swiss, cooked, boiled, drained, without salt'),
                ('Remolacha', 'Hervida', r'^Beets, cooked, boiled, drained'), ('Choclo', 'Hervido', r'^Corn, sweet, yellow, cooked, boiled, drained, without salt'),
                ('Choclo', 'En lata (granos)', r'^Corn, sweet, yellow, canned, whole kernel, drained solids'), ('Arvejas', 'Hervidas', r'^Peas, green, cooked, boiled, drained, without salt'),
                ('Arvejas', 'En lata, escurridas', r'^Peas, green, canned, drained solids, rinsed in tap water'), ('Chauchas', 'Hervidas', r'^Beans, snap, green, cooked, boiled, drained, without salt'),
                ('Berenjena', 'Cocida', r'^Eggplant, cooked, boiled, drained, without salt'), ('Repollo', 'Crudo', r'^Cabbage, raw'),
                ('Champiñones', 'Crudos', r'^Mushrooms, white, raw'), ('Ajo', 'Crudo', r'^Garlic, raw'), ('Puerro', 'Crudo', r'^Leeks, \(bulb and lower leaf-portion\), raw'),
                ('Apio', 'Crudo', r'^Celery, raw'), ('Rúcula', 'Cruda', r'^Arugula, raw'), ('Radicheta', 'Cruda', r'^Chicory greens, raw'),
                ('Calabaza', 'Hervida', r'^Pumpkin, cooked, boiled, drained, without salt'), ('Mandioca', 'Cruda', r'^Cassava, raw'),
                ('Kale', 'Crudo', r'^Kale, raw'), ('Espárragos', 'Hervidos', r'^Asparagus, cooked, boiled, drained$')]:
    add('verduras', n, [(n, v, q)])

# ---------- Carnes ----------
add('carnes', 'Asado de tira', [('Asado de tira', 'Cocido, sin hueso', r'^Beef, chuck, short ribs, boneless, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised')])
add('carnes', 'Vacío', [('Vacío', 'A la parrilla', r'^Beef, flank, steak, separable lean and fat, trimmed to 0" fat, choice, cooked, broiled')])
add('carnes', 'Bife de lomo', [('Bife de lomo', 'A la plancha', r'^Beef, tenderloin, steak, separable lean and fat, trimmed to 1/8" fat, all grades, cooked, broiled')])
add('carnes', 'Entrecot', [('Entrecot', 'A la plancha', r'^Beef, rib eye steak, boneless, lip off, separable lean and fat, trimmed to 0" fat, all grades, cooked, grilled')])
add('carnes', 'Colita de cuadril', [('Colita de cuadril', 'Al horno', r'^Beef, bottom sirloin, tri-tip roast, separable lean and fat, trimmed to 0" fat, all grades, cooked, roasted')])
add('carnes', 'Carne picada', [('Carne picada', 'Común (80/20), cocida', r'^Beef, ground, 80% lean meat / 20% fat, patty, cooked, broiled'),
     ('Carne picada', 'Magra (90/10), cocida', r'^Beef, ground, 90% lean meat / 10% fat, patty, cooked, broiled'), ('Carne picada', 'Cruda (80/20)', r'^Beef, ground, 80% lean meat / 20% fat, raw')])
add('carnes', 'Peceto', [('Peceto', 'Al horno', r'^Beef, round, eye of round roast, boneless, separable lean only, trimmed to 0" fat, all grades, cooked, roasted')])
add('carnes', 'Hígado vacuno', [('Hígado vacuno', 'Salteado', r'^Beef, variety meats and by-products, liver, cooked, pan-fried')])
add('carnes', 'Pollo', [('Pechuga de pollo', 'Asada, sin piel', r'^Chicken, broilers or fryers, breast, meat only, cooked, roasted'),
     ('Pechuga de pollo', 'Cruda, sin piel', r'^Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw'),
     ('Pechuga de pollo', 'Frita con rebozado', r'^Chicken, broilers or fryers, breast, meat and skin, cooked, fried, batter'),
     ('Muslo de pollo', 'Al horno, con piel', r'^Chicken, broilers or fryers, thigh, meat and skin, cooked, roasted'),
     ('Muslo de pollo', 'Al horno, sin piel', r'^Chicken, broilers or fryers, thigh, meat only, cooked, roasted'),
     ('Pata de pollo', 'Al horno, con piel', r'^Chicken, broilers or fryers, drumstick, meat and skin, cooked, roasted'),
     ('Alitas de pollo', 'Al horno', r'^Chicken, broilers or fryers, wing, meat and skin, cooked, roasted'),
     ('Pollo entero', 'Al horno, con piel', r'^Chicken, broilers or fryers, meat and skin, cooked, roasted')])
add('carnes', 'Cerdo', [('Bondiola de cerdo', 'Cocida (braseada)', r'^Pork, fresh, shoulder, \(Boston butt\), blade \(steaks\), separable lean and fat, cooked, braised'),
     ('Lomo de cerdo', 'Asado', r'^Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted'),
     ('Costilla de cerdo', 'Cocida (braseada)', r'^Pork, fresh, spareribs, separable lean and fat, cooked, braised'),
     ('Panceta', 'Cruda', r'^Pork, cured, bacon, unprepared$')])
add('carnes', 'Fiambres y embutidos', [('Chorizo', 'Cocido', r'^Chorizo, pork and beef'), ('Morcilla', '', r'^Blood sausage'),
     ('Jamón cocido', 'Fiambre', r'^Ham, sliced, regular \(approximately 11% fat\)'), ('Mortadela', '', r'^Mortadella, beef, pork'),
     ('Salame', '', r'^Salami, dry or hard, pork$'), ('Salchichas (panchos)', 'Sin grasa', r'^Frankfurter, beef, pork, and turkey, fat free'),
     ('Salchichas (panchos)', 'Vacunas, calientes', r'^Frankfurter, beef, heated'), ('Paleta de cerdo cocida (fiambre)', '', r'^Pork, cured, shoulder, blade roll, separable lean and fat, roasted'),
     ('Pechuga de pavo (fiambre)', '', r'^Turkey breast, sliced, prepackaged'), ('Hamburguesa vacuna', 'A la plancha', r'^Beef, ground, 75% lean meat / 25% fat, patty, cooked, pan-broiled')])
add('carnes', 'Cordero', [('Cordero', 'Al horno', r'^Lamb, domestic, leg, whole \(shank and sirloin\), separable lean and fat, trimmed to 1/4" fat, choice, cooked, roasted')])

# ---------- Pescados y mariscos ----------
for n, v, q in [('Pescado blanco tipo merluza (eglefino)', 'Al horno', r'^Fish, haddock, cooked, dry heat'), ('Bastoncitos de pescado', 'Rebozados, al horno', r'^Fish, fish sticks, frozen, prepared'),
                ('Salmón', 'Al horno', r'^Fish, salmon, Atlantic, farmed, cooked, dry heat'), ('Atún en lata', 'Al natural', r'^Fish, tuna, light, canned in water, drained solids'),
                ('Atún en lata', 'En aceite', r'^Fish, tuna, light, canned in oil, drained solids'), ('Sardinas en lata', 'En aceite', r'^Fish, sardine, Atlantic, canned in oil, drained solids with bone'),
                ('Camarones', 'Cocidos', r'^Crustaceans, shrimp, cooked'), ('Calamar', 'Frito (rabas)', r'^Mollusks, squid, mixed species, cooked, fried'),
                ('Mejillones', 'Cocidos', r'^Mollusks, mussel, blue, cooked, moist heat'), ('Corvina', 'Rebozada y frita', r'^Fish, croaker, Atlantic, cooked, breaded and fried'),
                ('Tilapia', 'Al horno', r'^Fish, tilapia, cooked, dry heat'), ('Bacalao fresco', 'Al horno', r'^Fish, cod, Atlantic, cooked, dry heat')]:
    add('pescados', n, [(n, v, q)])

# ---------- Huevos ----------
add('huevos', 'Huevo', [('Huevo', 'Crudo', r'^Egg, whole, raw, fresh'), ('Huevo', 'Duro', r'^Egg, whole, cooked, hard-boiled'),
     ('Huevo', 'Frito', r'^Egg, whole, cooked, fried'), ('Huevo', 'Revuelto', r'^Egg, whole, cooked, scrambled'), ('Huevo', 'Poché', r'^Egg, whole, cooked, poached'),
     ('Clara de huevo', 'Cruda', r'^Egg, white, raw, fresh'), ('Yema de huevo', 'Cruda', r'^Egg, yolk, raw, fresh')])

# ---------- Lácteos ----------
for n, v, q in [('Leche', 'Entera', r'^Milk, whole, 3.25% milkfat, with added vitamin D'), ('Leche', 'Semidescremada (2 %)', r'^Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D'),
                ('Leche', 'Descremada', r'^Milk, nonfat, fluid, with added vitamin A and vitamin D \(fat free or skim\)'), ('Leche en polvo', 'Entera', r'^Milk, dry, whole, with added vitamin D'),
                ('Leche chocolatada', '', r'^Milk, chocolate, fluid, commercial, whole, with added vitamin A and vitamin D'),
                ('Yogur', 'Natural entero', r'^Yogurt, plain, whole milk'), ('Yogur', 'Natural descremado', r'^Yogurt, plain, skim milk'),
                ('Yogur', 'Con frutas', r'^Yogurt, fruit, low fat, 9 grams protein per 8 ounce'), ('Yogur griego', 'Natural', r'^Yogurt, Greek, plain, whole milk'),
                ('Yogur griego', 'Descremado', r'^Yogurt, Greek, plain, nonfat'), ('Queso muzzarella', '', r'^Cheese, mozzarella, whole milk$'),
                ('Ricota', 'Semidescremada', r'^Cheese, ricotta, part skim milk'), ('Ricota', 'Entera', r'^Cheese, ricotta, whole milk'),
                ('Queso tipo gouda (dambo)', '', r'^Cheese, gouda'), ('Queso tipo suizo (colonia)', '', r'^Cheese, swiss$'), ('Queso parmesano', 'Rallado', r'^Cheese, parmesan, grated$'),
                ('Queso provolone', '', r'^Cheese, provolone$'), ('Queso cheddar', '', r'^Cheese, cheddar$'), ('Queso crema', '', r'^Cheese, cream$'),
                ('Queso cottage', '', r'^Cheese, cottage, lowfat, 2% milkfat'), ('Queso fundido (en fetas)', '', r'^Cheese, pasteurized process, American, fortified with vitamin D'),
                ('Manteca', 'Con sal', r'^Butter, salted'), ('Crema de leche', 'Doble', r'^Cream, fluid, heavy whipping'), ('Dulce de leche', '', r'^Dulce de Leche'),
                ('Helado', 'De crema (vainilla)', r'^Ice creams, vanilla$'), ('Helado', 'De chocolate', r'^Ice creams, chocolate$')]:
    add('lacteos', n, [(n, v, q)])

# ---------- Cereales, panes y pastas ----------
for n, v, q in [('Arroz blanco', 'Cocido', r'^Rice, white, long-grain, regular, enriched, cooked'), ('Arroz blanco', 'Crudo', r'^Rice, white, long-grain, regular, raw, enriched'),
                ('Arroz integral', 'Cocido', r'^Rice, brown, long-grain, cooked'), ('Fideos', 'Cocidos', r'^Pasta, cooked, enriched, without added salt'),
                ('Fideos', 'Secos (crudos)', r'^Pasta, dry, enriched'), ('Fideos integrales', 'Cocidos', r'^Pasta, whole-wheat, cooked'),
                ('Avena', 'Arrollada, seca', r'^Cereals, oats, regular and quick, not fortified, dry'),
                ('Avena', 'Cocida con agua', r'^Cereals, oats, regular and quick, unenriched, cooked with water'), ('Polenta', 'Cocida con agua (sémola de maíz)', r'^Cereals, corn grits, white, regular and quick, enriched, cooked with water, without salt'), ('Harina de maíz integral', 'Seca', r'^Cornmeal, whole-grain, yellow'),
                ('Pan', 'Flauta / felipe (blanco)', r'^Bread, french or vienna \(includes sourdough\)'), ('Pan', 'Molde blanco', r'^Bread, white, commercially prepared \(includes soft bread crumbs\)'),
                ('Pan', 'Integral', r'^Bread, whole-wheat, commercially prepared'), ('Pan', 'De centeno', r'^Bread, rye$'), ('Pan rallado', '', r'^Bread crumbs, dry, grated, plain'),
                ('Galletas de agua', '', r'^Crackers, saltines \(includes oyster, soda, soup\)'), ('Galletas', 'Integrales (tipo cracker)', r'^Crackers, whole-wheat$'),
                ('Galletitas dulces', 'De vainilla', r'^Cookies, vanilla wafers, higher fat'), ('Galletitas', 'Rellenas de chocolate', r'^Cookies, chocolate sandwich, with creme filling, regular$'),
                ('Tortilla de trigo', '', r'^Tortillas, ready-to-bake or -fry, flour, refrigerated'), ('Tortilla de maíz', '', r'^Tortillas, ready-to-bake or -fry, corn$'),
                ('Copos de maíz', '', r'^Cereals ready-to-eat, KELLOGG, KELLOGG\'S CORN FLAKES'), ('Granola', '', r'^Cereals ready-to-eat, granola, homemade'),
                ('Quinoa', 'Cocida', r'^Quinoa, cooked'), ('Cuscús', 'Cocido', r'^Couscous, cooked'), ('Harina de trigo', 'Común', r'^Wheat flour, white, all-purpose, enriched, bleached'),
                ('Harina de maíz', '', r'^Cornmeal, degermed, enriched, yellow'), ('Medialuna', 'De manteca', r'^Croissants, butter'), ('Masa de hojaldre', 'Horneada', r'^Puff pastry, frozen, ready-to-bake, baked'),
                ('Muffin', 'Común', r'^Muffins, plain, prepared from recipe, made with low fat \(2%\) milk'),
                ('Pan de hamburguesa', '', r'^Rolls, hamburger or hotdog, plain'), ('Barrita de cereal', '', r'^Snacks, granola bars, soft, uncoated, plain')]:
    add('cereales', n, [(n, v, q)])

# ---------- Legumbres ----------
for n, v, q in [('Lentejas', 'Cocidas', r'^Lentils, mature seeds, cooked, boiled, without salt'), ('Garbanzos', 'Cocidos', r'^Chickpeas \(garbanzo beans, bengal gram\), mature seeds, cooked, boiled, without salt'),
                ('Porotos negros', 'Cocidos', r'^Beans, black, mature seeds, cooked, boiled, without salt'), ('Porotos rojos', 'Cocidos', r'^Beans, kidney, red, mature seeds, cooked, boiled, without salt'),
                ('Porotos blancos', 'Cocidos', r'^Beans, white, mature seeds, cooked, boiled, without salt'), ('Soja', 'Cocida', r'^Soybeans, mature cooked, boiled, without salt'),
                ('Arvejas partidas', 'Cocidas', r'^Peas, split, mature seeds, cooked, boiled, without salt'), ('Hummus', '', r'^Hummus, commercial'),
                ('Tofu', 'Firme', r'^Tofu, raw, firm, prepared with calcium sulfate'), ('Lentejas', 'Secas (crudas)', r'^Lentils, raw')]:
    add('legumbres', n, [(n, v, q)])

# ---------- Frutos secos y semillas ----------
for n, q in [('Maní', r'^Peanuts, all types, dry-roasted, without salt'), ('Maní salado', r'^Peanuts, all types, oil-roasted, with salt'),
             ('Mantequilla de maní', r'^Peanut butter, smooth style, without salt'), ('Nueces', r'^Nuts, walnuts, english'), ('Almendras', r'^Nuts, almonds$'),
             ('Castañas de cajú', r'^Nuts, cashew nuts, raw'), ('Avellanas', r'^Nuts, hazelnuts or filberts$'), ('Pistachos', r'^Nuts, pistachio nuts, raw'),
             ('Semillas de girasol', r'^Seeds, sunflower seed kernels, dried'), ('Semillas de chía', r'^Seeds, chia seeds, dried'), ('Semillas de lino', r'^Seeds, flaxseed'),
             ('Harina de garbanzo', r'^Chickpea flour \(besan\)'), ('Semillas de zapallo', r'^Seeds, pumpkin and squash seed kernels, dried'), ('Sésamo', r'^Seeds, sesame seeds, whole, dried')]:
    add('frutossecos', n, [(n, q)])

# ---------- Aceites y grasas ----------
for n, q in [('Aceite de girasol', r'^Oil, sunflower, linoleic \(less than 60%\)'), ('Aceite de oliva', r'^Oil, olive, salad or cooking'),
             ('Aceite de canola', r'^Oil, canola$'), ('Aceite de maíz', r'^Oil, corn, industrial and retail, all purpose salad or cooking'),
             ('Margarina', r'^Margarine, regular, 80% fat, composite, stick, with salt$'), ('Mayonesa', r'^Salad dressing, mayonnaise, regular'),
             ('Mayonesa light', r'^Salad dressing, mayonnaise, light'), ('Grasa vacuna', r'^Fat, beef tallow')]:
    add('aceites', n, [(n, q)])

# ---------- Bebidas ----------
for n, v, q in [('Refresco cola', 'Común', r'^Beverages, carbonated, cola, regular'), 
                ('Refresco lima-limón', '', r'^Beverages, carbonated, lemon-lime soda, no caffeine'), ('Jugo de naranja', 'Natural', r'^Orange juice, raw'),
                ('Jugo de naranja', 'Envasado', r'^Orange juice, chilled, includes from concentrate'), ('Jugo de manzana', 'Envasado', r'^Apple juice, canned or bottled, unsweetened, without added ascorbic acid'),
                ('Cerveza', 'Común', r'^Alcoholic beverage, beer, regular, all'), ('Cerveza', 'Light', r'^Alcoholic beverage, beer, light$'),
                ('Vino tinto', '', r'^Alcoholic beverage, wine, table, red'), ('Vino blanco', '', r'^Alcoholic beverage, wine, table, white$'),
                ('Whisky', '', r'^Alcoholic beverage, distilled, all \(gin, rum, vodka, whiskey\) 80 proof'),
                ('Café', 'Negro, sin azúcar', r'^Beverages, coffee, brewed, prepared with tap water$'), ('Té', 'Sin azúcar', r'^Beverages, tea, black, brewed, prepared with tap water$'),
                ('Bebida isotónica', '', r'^Beverages, COCA-COLA, POWERADE, lemon-lime flavored, ready-to-drink'), ('Bebida energizante', '', r'^Beverages, Energy drink, RED BULL'),
                ('Agua tónica', '', r'^Beverages, carbonated, tonic water'), ('Leche de almendras', 'Sin azúcar', r'^Beverages, almond milk, unsweetened, shelf stable'),
                ('Bebida de soja', '', r'^Soymilk, original and vanilla, unfortified'), ('Chocolate caliente', '', r'^Beverages, Cocoa mix, powder, prepared with water')]:
    add('bebidas', n, [(n, v, q)])

# ---------- Dulces y snacks ----------
for n, q in [('Azúcar', r'^Sugars, granulated'), ('Miel', r'^Honey$'), ('Mermelada', r'^Jams and preserves$'), ('Chocolate con leche', r'^Candies, milk chocolate$'),
             ('Chocolate amargo (70-85 %)', r'^Chocolate, dark, 70-85% cacao solids'), ('Cacao en polvo', r'^Cocoa, dry powder, unsweetened$'),
             ('Papas chips', r'^Snacks, potato chips, plain, salted'), ('Pop', r'^Snacks, popcorn, air-popped$'), ('Palitos salados', r'^Snacks, pretzels, hard, plain, salted'),
             ('Bizcochuelo', r'^Cake, sponge, commercially prepared'), ('Torta de chocolate', r'^Cake, chocolate, commercially prepared with chocolate frosting'),
             ('Budín', r'^Cake, pound, commercially prepared, butter'), ('Donas', r'^Doughnuts, cake-type, plain'), ('Gelatina preparada', r'^Gelatin desserts, dry mix, prepared with water'),
             ('Flan', r'^Desserts, flan, caramel custard, prepared-from-recipe'), ('Arroz con leche', r'^Restaurant, Latino, arroz con leche'),
             ('Caramelos duros', r'^Candies, hard$'), ('Maní con caramelo (tipo turrón)', r'^Candies, peanut brittle, prepared-from-recipe')]:
    add('dulces', n, [(n, q)])

# ---------- Comidas preparadas (datos USDA de platos) ----------
for n, q in [('Empanada de carne', r'^Restaurant, Latino, empanadas, beef, prepared'), ('Pizza de muzzarella (congelada)', r'^Pizza, cheese topping, regular crust, frozen, cooked'),
             ('Hamburguesa completa (comida rápida)', r'^Fast foods, hamburger; single, regular patty; with condiments'), ('Pancho (comida rápida)', r'^Fast foods, hotdog, plain'),
             ('Papas fritas (comida rápida)', r'^McDONALD\'S, French Fries'), ('Lasaña de verduras (congelada)', r'^Lasagna, Vegetable, frozen, baked'),
             ('Ensalada rusa', r'^Potato salad with egg'), ('Sopa de verduras', r'^Soup, vegetable soup, condensed, low sodium, prepared with equal volume water'),
             ('Pollo con arroz', r'^Restaurant, Latino, chicken and rice, entree, prepared'), ('Fideos con salsa de tomate (en lata)', r'^Pasta with tomato sauce, no meat, canned'),
             ('Tiritas de pollo rebozadas (comida rápida)', r'^Fast foods, chicken tenders'), ('Sándwich de jamón con lechuga y tomate', r'^Fast foods, submarine sandwich, ham on white bread with lettuce and tomato'),
             ('Pasta fresca sin relleno', r'^Pasta, fresh-refrigerated, plain, cooked'), ('Ravioles de queso (en lata)', r'^Ravioli, cheese-filled, canned'), ('Salsa de tomate', r'^Sauce, pasta, spaghetti/marinara, ready-to-serve'),
             ('Ketchup', r'^Catsup$'), ('Mostaza', r'^Mustard, prepared, yellow')]:
    add('preparadas', n, [(n, q)])

# ---------- Recetas típicas: ESTIMACIÓN calculada con ingredientes USDA (no es un dato de laboratorio) ----------
# (nombre, categoría, peso final cocido en g, [(nombre del ingrediente, variante, gramos crudos/usados)], nota)
RECIPES = [
  ('Milanesa de carne', 'preparadas', 160, [('Peceto', 'Al horno', 110), ('Huevo', 'Crudo', 15), ('Pan rallado', '', 25), ('Aceite de girasol', '', 12)], 'Frita: incluye el aceite que absorbe (≈ 12 g por unidad).'),
  ('Milanesa de pollo', 'preparadas', 150, [('Pechuga de pollo', 'Asada, sin piel', 100), ('Huevo', 'Crudo', 15), ('Pan rallado', '', 25), ('Aceite de girasol', '', 12)], 'Frita: incluye el aceite que absorbe.'),
  ('Milanesa napolitana', 'preparadas', 230, [('Peceto', 'Al horno', 110), ('Huevo', 'Crudo', 15), ('Pan rallado', '', 25), ('Aceite de girasol', '', 12), ('Salsa de tomate', '', 30), ('Queso muzzarella', '', 40), ('Jamón cocido', 'Fiambre', 20)], 'Con salsa, jamón y muzzarella gratinada.'),
  ('Chivito al pan', 'preparadas', 330, [('Bife de lomo', 'A la plancha', 100), ('Pan de hamburguesa', '', 75), ('Jamón cocido', 'Fiambre', 20), ('Queso muzzarella', '', 30), ('Huevo', 'Frito', 46), ('Panceta', 'Cruda', 15), ('Lechuga', 'Cruda', 15), ('Tomate', 'Crudo', 25), ('Mayonesa', '', 12)], 'Chivito común al pan, sin papas fritas.'),
  ('Choripán', 'preparadas', 190, [('Chorizo', 'Cocido', 110), ('Pan', 'Flauta / felipe (blanco)', 80)], 'Chorizo de cerdo y vaca en pan.'),
  ('Pancho completo', 'preparadas', 120, [('Salchichas (panchos)', 'Vacunas, calientes', 45), ('Pan de hamburguesa', '', 50), ('Ketchup', '', 10), ('Mostaza', '', 5), ('Mayonesa', '', 10)], 'Con ketchup, mostaza y mayonesa.'),
  ('Tortilla de papas', 'preparadas', 600, [('Papa', 'Hervida', 500), ('Huevo', 'Crudo', 200), ('Cebolla', 'Cruda', 80), ('Aceite de girasol', '', 30)], 'Rinde una tortilla mediana; el peso final descuenta el agua evaporada.'),
  ('Pascualina', 'preparadas', 900, [('Acelga', 'Hervida', 500), ('Huevo', 'Duro', 150), ('Huevo', 'Crudo', 100), ('Harina de trigo', 'Común', 180), ('Aceite de girasol', '', 40), ('Queso parmesano', 'Rallado', 30)], 'Tarta de acelga con huevo y dos tapas de masa casera.'),
  ('Fainá', 'preparadas', 560, [('Harina de garbanzo', '', 250), ('Aceite de oliva', '', 40)], 'Harina de garbanzo, agua y aceite; el peso final incluye el agua que queda tras hornear.'),
  ('Torta frita', 'preparadas', 60, [('Harina de trigo', 'Común', 40), ('Grasa vacuna', '', 4), ('Aceite de girasol', '', 8)], 'Frita: incluye el aceite que absorbe.'),
  ('Guiso de lentejas', 'preparadas', 1500, [('Lentejas', 'Secas (crudas)', 300), ('Chorizo', 'Cocido', 120), ('Panceta', 'Cruda', 60), ('Papa', 'Cruda', 300), ('Zanahoria', 'Cruda', 150), ('Cebolla', 'Cruda', 150), ('Morrón rojo', 'Crudo', 80), ('Salsa de tomate', '', 200), ('Aceite de girasol', '', 20)], 'Olla para unas 5 porciones.'),
  ('Ñoquis de papa con salsa de tomate', 'preparadas', 700, [('Papa', 'Hervida', 500), ('Harina de trigo', 'Común', 150), ('Huevo', 'Crudo', 50), ('Salsa de tomate', '', 250), ('Queso parmesano', 'Rallado', 20)], 'Ñoquis caseros; el peso final incluye el agua que absorben al hervir.'),
  ('Refuerzo de jamón y queso', 'preparadas', 90, [('Pan', 'Molde blanco', 50), ('Jamón cocido', 'Fiambre', 20), ('Queso tipo gouda (dambo)', '', 20)], 'Sándwich simple en pan de molde.'),
  ('Puchero', 'preparadas', 2000, [('Asado de tira', 'Cocido, sin hueso', 400), ('Papa', 'Hervida', 400), ('Boniato', 'Hervido', 300), ('Zapallo (tipo calabacín butternut)', 'Al horno', 300), ('Choclo', 'Hervido', 200), ('Zanahoria', 'Hervida', 200), ('Repollo', 'Crudo', 200)], 'Sin el caldo; carne y verduras hervidas.'),
]
