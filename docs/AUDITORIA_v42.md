# Auditoría FittForma AI v42.0 — inventario y estado

Estados: **C** completa y funcional · **P** parcial · **D** defectuosa/desconectada · **A** ausente · **NV** no verificable en este entorno.
"Inicial" es v40.21 (ZIP) / v41.0; "Final" es v42.0. Verificación: `npm test` (175), `tests/e2e/integration.e2e.mjs` (55 comprobaciones en móvil y escritorio), `npm run test:sql` (44), `tests/e2e/community.e2e.mjs` (22), barrido visual de 12 vistas en 5 anchos.

## Matriz

| Sección | Función | Inicial | Final | Cómo se verificó / notas |
|---|---|---|---|---|
| Navegación | 6 secciones (Inicio, Entrenar, Nutrición, Progreso, Comunidad, Perfil) | C (v40.21) → 5 en v41 | **C** | Pruebas de estructura; Nutrición vuelve a la barra. FittAI y Correr en «Más», Entrenar y barra lateral |
| Inicio | Saludo y avatar | P (sin hora del día; nombre duplicado) | **C** | Saludo por franja horaria local; un solo nombre visible |
| Inicio | Objetivo semanal, semana, entrenamiento de hoy, resumen kcal/proteína/agua, hábitos, constancia | C | **C** | E2E: Inicio refleja sesión, kcal y agua |
| Inicio | Accesos rápidos | P (solo navegaban) | **C** | Entrenar (siguiente sesión o retomar), comida, +1 agua, correr, insignias, FittAI — E2E |
| Inicio | Próxima insignia | C (v41) | C | |
| Inicio | Notificaciones internas | A | **A** | No existe un sistema de notificaciones; no se muestra campana falsa |
| Entrenar | Plan generado, biblioteca, fichas, favoritos, sustitución de ejercicios | C | C | Sin cambios funcionales |
| Entrenar | Rutinas propias (crear/editar/duplicar/eliminar/reordenar, series/reps/kg/descanso/notas) | **A** | **C** | E2E; validación y confirmación de cambios sin guardar |
| Entrenar | Plantilla desde un día del plan | A | **C** | Copia editable; el plan no cambia |
| Entrenar | Sesión activa (series, pausa, borrador, recuperación) | C | C | E2E: se recupera tras recargar sin duplicar |
| Entrenar | Agregar/quitar series y ejercicios en curso | A | **C** | E2E |
| Entrenar | Entrenamiento libre | **A** (requería plan) | **C** | E2E; no crea rutina; sin datos no guarda |
| Entrenar | Descanso | P (manual) | **C** | Arranca solo con el descanso configurado al marcar una serie |
| Entrenar | Doble clic en «Finalizar» | C | C | E2E: una sola sesión |
| Entrenar | Running GPS, mapa, parciales, GPX, borrador | C | NV | Requiere teléfono con GPS en exterior |
| Entrenar | Running manual, ritmo, historial | C | C | E2E: 5 km/25 min, no figura como GPS |
| Entrenar | FittAI (chat, propuestas con aprobación) | C (requiere clave) | NV | Sin `GEMINI_API_KEY` responde con error claro |
| Nutrición | Organización | P (una página larga) | **C** | Hoy · Registrar · Objetivos · Historial |
| Nutrición | Registrar comida, estimación por texto, base de alimentos, código de barras, foto IA, favoritas, ideas, menú | C | C | Foto IA y código de barras: NV (servicios externos/cámara) |
| Nutrición | Editar comida | **A** (solo quitar) | **C** | E2E: no duplica; Inicio se actualiza |
| Nutrición | Hidratación (+/−, objetivo) | C | C | E2E: persiste tras recargar |
| Nutrición | Tendencia semanal (días sin registro ≠ 0) | C | C | |
| Progreso | Resumen, insignias, historial, peso | C (v41) | C | |
| Progreso | Corregir/eliminar sesiones | **A** | **C** | E2E: eliminar revoca insignias dependientes |
| Progreso | Medidas corporales (más allá del peso) y fotos de progreso privadas | A | **A** | Pendiente; requiere modelo de datos y almacenamiento privado |
| Comunidad | Feed, explorar, publicar (texto/logro/transformación), likes, comentarios, edición, mensajes, no leídos, bloqueo, denuncia | C (v41) | C | E2E 22/22 + RLS 44/44 (local) |
| Comunidad | Moderación administrativa de denuncias | A | A | Pendiente |
| Perfil | Organización | P (lista larga) | **C** | Cabecera con estadísticas reales + 6 grupos plegables |
| Perfil | Datos, objetivo, datos físicos, recordatorios, cuenta, privacidad, Pro, versión | C | C | |
| Perfil | Eliminar cuenta en la nube | A | A | Pendiente |
| Transversal | Exportar/importar copia | C | C | `routines` se incluye automáticamente en el estado |
| Transversal | PWA / service worker | C | C | Caché `fittforma-ai-static-v42-0` |
| Transversal | Sincronización Supabase manual | C | NV | Requiere proyecto real |

## Errores corregidos en v42
- Inicio y Perfil usaban nombres distintos (`name` vs `displayName`).
- Tras guardar una sesión, Entrenar no permitía empezar otra.
- No se podía entrenar sin plan generado.
- Las grillas antiguas de escritorio desordenaban Nutrición/Perfil/Entrenar (neutralizadas).

## Pendientes / no verificados
- Notificaciones internas, medidas corporales y fotos de progreso privadas, moderación de denuncias, borrado de cuenta.
- No verificable aquí: Supabase real, Gemini, Render, GPS y cámara en teléfono físico, PWA instalada.
- Los mensajes dinámicos nuevos están solo en español (las etiquetas sí en 6 idiomas).
