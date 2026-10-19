# Calorías gastadas (estimadas) — v50

Todas las cifras son **estimaciones**, nunca mediciones. Código: `activity-core.js` (probado en `tests/v50.test.mjs`).

| Actividad | Método | Fórmula |
|---|---|---|
| Caminar | Ecuación metabólica de la ACSM para caminar | VO₂ = 3,5 + 0,1·v + 1,8·v·pendiente |
| Correr | Ecuación metabólica de la ACSM para correr | VO₂ = 3,5 + 0,2·v + 0,9·v·pendiente |
| Bicicleta | MET por velocidad media, Compendio de Actividades Físicas 2011 (códigos 01010–01060) | kcal = MET × kg × h |
| Fuerza | MET 3,5, Compendio 2011 (código 02054) | kcal = MET × kg × h |

`v` = velocidad en m/min con el **tiempo en movimiento** (si no existe, el tiempo total y el resultado se marca
como aproximado). kcal = VO₂ (ml/kg/min) × kg × min ÷ 1000 × 5. Si «Correr» fue a paso de caminata (o al revés) se
usa la ecuación que corresponde a la velocidad, y se avisa.

Referencias: American College of Sports Medicine, *ACSM's Guidelines for Exercise Testing and Prescription*
(ecuaciones metabólicas); Ainsworth BE et al., *2011 Compendium of Physical Activities*, Med Sci Sports Exerc 43(8).

## Reglas
- **Peso**: se usa el peso actual del perfil. Sin peso no se calcula (no se usa un peso inventado).
- **Pendiente**: solo si hay desnivel medido con altitud precisa (±10 m o mejor); si no, terreno plano y se avisa.
- **Frecuencia cardíaca**: no se usa porque la app no recibe datos de ningún sensor.
- **Historial**: cada registro guarda las kcal, el método y el peso con que se calcularon. Si cambiás tu peso,
  solo cambian los cálculos nuevos.
- **Doble conteo**: las kcal incluyen el gasto en reposo de ese rato; también se guarda el valor neto (sin reposo).
  Las calorías gastadas **no** se suman automáticamente al objetivo de comida, y se muestran separadas de las
  consumidas (Progreso → «Calorías gastadas por actividad»).
