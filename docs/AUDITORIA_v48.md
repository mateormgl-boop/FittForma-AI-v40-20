# Auditoría v48 — rutinas, biblioteca, progresión diaria, insignias, perfil, hidratación, anuncios y membresías

Etapa 1. Revisión del código real en `main` (v47.0). Cada punto indica qué se comprobó y cómo.

## Cómo está conectado el proyecto

- **Frontend:** `index.html` (JS sin compilación). Los datos de cada persona viven en `localStorage` (`fittforma-ai-v4`).
- **Copia en la nube (opcional):** con Supabase (`user_app_data`, RLS por usuario). La comunidad usa `community_*`.
- **Backend:** `backend/server.mjs`, Node sin dependencias. Sirve la app, la CSP, `/api/coach` (Gemini) y `/api/public-config`. No tiene base de datos propia ni clave `service_role`.
- **Membresías:** `community_memberships` existe en Supabase, pero solo puede escribirla un proceso de confianza (webhook de pagos). No hay ningún proveedor de pagos conectado.
- **Anuncios:** `ads.js` + `ads-config.js` (Google Ad Manager). Están desactivados y sin identificadores.

## 1. Rutinas

Generé el plan con las 720 combinaciones del formulario (objetivo × nivel × días × equipamiento × duración) en el navegador y analicé cada resultado.

| Problema | Evidencia |
|---|---|
| El objetivo no cambia nada | En las 144 combinaciones sin «resistencia», «masa muscular», «fuerza», «forma» y «hábito» producen exactamente el mismo plan. |
| El nivel casi no cambia nada | «Avanzado» genera lo mismo que «intermedio». Un avanzado con peso corporal recibe flexiones contra la pared, sentadilla a una silla y círculos de brazos. Un principiante de «hábito» recibe peso muerto convencional con barra. |
| Orden incorrecto | El aislamiento y el core aparecen antes que los compuestos: «Tren superior B» empieza con aperturas en polea y termina con press de banca, y hay planchas a mitad del día de piernas. |
| Desequilibrio | «Tren superior A» tiene 3 ejercicios de pecho y 1 de espalda. «Tren superior B» usa la extensión lumbar como único trabajo de espalda (no hay remo ni jalón). |
| Series y repeticiones iguales para todo | La fuerza usa 8–12 igual que la hipertrofia. No hay rangos según el objetivo. |
| Movilidad tratada como fuerza | «Movilidad de cadera», «Estiramiento de flexores» y «Movilidad de tobillo» figuran como `strength` y pueden ocupar el lugar de un ejercicio de piernas. |
| Duplicados con otro nombre | «Flexiones contra la pared» y «Flexiones contra una pared»; tres nombres para la flexión inclinada; tres para el bird-dog; «Zancada estática asistida», «Estocada estática con apoyo» y «Sentadilla dividida con apoyo»; «Curl femoral en máquina» y «Curl femoral tumbado»; «Pullover en polea» y «Jalón con brazos rectos». |
| Grupo mal asignado | «Flexiones escapulares contra pared» figura como Pecho (es un trabajo escapular). |

Los planes de running (3 planes de 4 semanas) son coherentes: progresión gradual con notas de precaución. No requieren cambios.

## 2. Biblioteca e imágenes

- **Ejercicios:** 180 únicos (gimnasio 80, casa 61, peso corporal 49).
- **Fichas técnicas:** solo 36 tienen ficha propia. Los otros 144 usan una ficha genérica armada por patrón de movimiento.
- **Fotos:** solo 18 coinciden con el ejercicio exacto. El resto reutiliza una foto de otro movimiento como «referencia de familia», por ejemplo:
  - la sentadilla hack, la prensa y la extensión de cuádriceps muestran una sentadilla al aire;
  - todos los remos muestran el remo sentado en polea;
  - todos los curls muestran el curl con mancuernas.
- **Ilustraciones genéricas:** hay 8 SVG por grupo muscular («reference-legs.svg», etc.) que no muestran el ejercicio.
- No hay enlaces externos de imágenes: todo es local. Eso está bien y se mantiene.

## 3. Entrenamiento diario

- No existe ningún control de tiempo. El «siguiente día del plan» avanza apenas se guarda una sesión cuyo título coincide, aunque se repita diez veces en el mismo día.
- Las sesiones guardadas no registran su tipo (plan, rutina propia, libre). Una rutina extra con el mismo título que un día del plan mueve la progresión.
- No hay registro de hora de inicio y de finalización con fuente confiable, ni próxima habilitación, ni control en el servidor.
- **Sesión incompleta:** se puede guardar con una sola serie anotada y cuenta igual que una completa para el XP y la constancia.

## 4. Rutinas propias y registro manual

- **Ya funciona** (se conserva): crear, editar, duplicar y eliminar, con nombre, ejercicios de la biblioteca, series, repeticiones, kg y descanso.
- **Falta:**
  - Reordenar ejercicios.
  - Campos de tiempo o distancia para cardio.
  - Registrar después un entrenamiento ya hecho (registro manual).
  - Distinguir cada tipo de sesión en el historial.

## 5. Insignias

- El desafío «Flexiones» solo cuenta ejercicios llamados exactamente «Flexiones». Si entrenás «Flexiones clásicas», la marca va a un desafío aparte y el principal no avanza. Pasa igual con Sentadillas y Sentadilla al aire, Abdominales y Crunch, y otros.
- No hay una pantalla de logro: solo una notificación en la lista.
- No existe el concepto de «mejor nivel por desafío» ni las insignias destacadas en el perfil.
- **Ya está bien** (se conserva):
  - Una insignia se otorga una sola vez por ID.
  - La notificación tiene un ID estable y no se repite al recargar.
  - El historial nunca se borra al subir de nivel.

## 6. Perfil

- **Ya está:** edad, altura (cm), peso actual, peso objetivo y actividad, con validación de rango.
- **Problemas:**
  - Guardar el peso desde Perfil no lo agrega al historial de peso; solo lo hace el formulario de Progreso.
  - Si se escribe la altura en metros (1,75), aparece un error en lugar de interpretarla.
  - El nivel, el objetivo y el equipamiento solo se editan en «Mi plan».
  - El objetivo no se usa en el plan (ver punto 1).

## 7. Hidratación

- Solo cuenta vasos enteros por día: no acepta cantidades en ml, no se puede corregir un registro puntual y no hay historial diario.
- El objetivo está en vasos, sin tamaño de vaso configurable.
- No hay una visualización del progreso más allá del número (en Nutrición).
- El día se calcula con la fecha local; eso está bien y se conserva.
- No hay recordatorios de agua implementados.

## 8. Anuncios

- No hay proveedor configurado (`enabled:false`, sin `networkCode` ni unidades). No se muestran anuncios ficticios, y eso es correcto.
- **Fallo real:** la CSP del servidor no permite `securepubads.g.doubleclick.net` y tiene `frame-src 'none'`. Aunque se configuraran los identificadores, los anuncios nunca cargarían.
- No distingue usuarios con membresía: si se activaran, un Pro vería anuncios igual.
- La configuración solo se cambia editando código; no hay variables de entorno.
- No hay gestión de consentimiento (CMP), que Google exige en el Espacio Económico Europeo, el Reino Unido y Suiza.
- Los créditos de los anuncios recompensados viven solo en el navegador.
- **Ubicación correcta:** Inicio y Nutrición, nunca durante una sesión.

## 9. Membresías

- **Planes:** Gratis y una propuesta Pro (US$ 5,99, «no definitivo»). El precio está repetido a mano en el HTML en lugar de leerse de la configuración.
- **Pagos:** no hay proveedor (`paymentsEnabled:false`). Nadie puede ser Pro. La interfaz lo dice honestamente.
- **El botón «Consultar estado de Pro»** muestra un texto fijo y no consulta el estado real de la cuenta.
- **El backend no verifica membresía:** la cuota de IA es por IP para todos.

## Plan de trabajo

- **Etapa 2:** generador de rutinas, progresión diaria cada 12 h con control en Supabase, tipos de sesión, rutinas propias, registro manual, insignias, perfil e hidratación.
- **Etapa 3:** una imagen exacta por ejercicio y fichas completas; rediseño de insignias y pantalla de logro.
- **Etapa 4:** CSP condicionada a la configuración de anuncios, estado de membresía verificado en el servidor, anuncios que respetan Pro, configuración por variables de entorno.
- **Etapa 5:** pruebas de los 15 escenarios pedidos.
