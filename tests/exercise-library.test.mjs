import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');

test('v40.7: favoritos de ejercicios se guardan localmente y se pueden filtrar',async()=>{
 const html=await read('index.html');
 assert.match(html,/fittforma-exercise-favorites-v1/);
 assert.match(html,/function readExerciseFavorites\(\)/);
 assert.match(html,/function toggleExerciseFavorite\(name,mode\)/);
 assert.match(html,/data-exercise-favorite=/);
 assert.match(html,/id="exerciseFavoritesOnly"/);
 assert.match(html,/exerciseFavoritesOnly\|\|favorites\.has\(exerciseFavoriteKey\(e\.name,libraryMode\)\)/);
});

test('v40.7: la sustitución prioriza el mismo patrón de movimiento, modalidad y tipo y conserva la dosis',async()=>{
 const html=await read('index.html');
 assert.match(html,/function replacePlanExercise\(dayIndex,exerciseIndex\)/);
 assert.match(html,/function inferExercisePattern\(name,group='',kind='strength'\)/);
 assert.match(html,/inferExercisePattern\(item\.name,item\.group,item\.kind\)===currentPattern/);
 assert.match(html,/currentPattern!=='unclassified'/);
 assert.match(html,/day\.exercises\[exerciseIndex\]=\{\.\.\.next,sets:oldSets\|\|next\.sets,reps:oldReps\|\|next\.reps\}/);
 assert.match(html,/No tengo una equivalencia suficientemente clara/);
 assert.match(html,/data-replace-exercise="\$\{i\}:\$\{ei\}"/);
 assert.match(html,/replacePlanExercise\(dayIndex,exerciseIndex\)/);
});

test('v40.7: el primer lote de guías ofrece técnica y músculos específicos para ejercicios frecuentes',async()=>{
 const html=await read('index.html');
 const block=html.slice(html.indexOf('const EXERCISE_GUIDE_CATALOG = ['),html.indexOf('function exerciseGuide(name)'));
 const names=[...block.matchAll(/name:'([^']+)'/g)].map(m=>m[1]);
 assert.ok(names.length>=25,`Se esperaban al menos 25 fichas específicas; se encontraron ${names.length}`);
 for(const key of ['primary:','secondary:','equipment:','level:','steps:','tips:','breathing:','errors:','alternatives:'])assert.ok(block.includes(key),`Falta campo estructurado ${key}`);
 for(const name of ['Press de banca con barra','Prensa de piernas','Jalón al pecho','Remo sentado en polea','Peso muerto rumano con mancuernas','Curl femoral sentado','Plancha frontal','Dead bug'])assert.ok(names.includes(name),`Falta guía para ${name}`);
 assert.match(html,/exerciseModalAlternatives/);
 assert.match(html,/mismo patrón general de movimiento/);
});

test('v40.7: las alternativas del modal se filtran por modalidad seleccionada',async()=>{
 const html=await read('index.html');
 const block=html.slice(html.indexOf('function exerciseAlternatives'),html.indexOf('function replacePlanExercise'));
 assert.match(block,/library\[selectedMode\]/);
 assert.match(block,/guide\?\.alternatives/);
 assert.match(block,/equivalencia no verificada/);
});


test('v40.18 elimina el duplicado visual de zancadas y etiqueta la imagen familiar como referencia',async()=>{
 const html=await read('index.html'),sw=await read('sw.js');
 assert.doesNotMatch(html,/reverse-lunge-reference\.webp/);
 assert.doesNotMatch(sw,/reverse-lunge-reference\.webp/);
 const rules=html.slice(html.indexOf('const photoReferenceRules'),html.indexOf('const photoReference=photoReferenceRules'));
 assert.match(rules,/zancada\|estocada\|lunge.*lunge\.webp/);
 assert.match(html,/generic-reference/);
 assert.match(html,/Imagen de referencia asociada a esta variante/);
 assert.match(html,/Imagen de referencia de la familia de movimientos/);
 assert.match(html,/Imagen de referencia de la familia de movimientos; no es una demostración exacta de esta variante/);
});

test('v40.18 las variantes de bici y flexión/curl de piernas no heredan una imagen incorrecta',async()=>{
 const html=await read('index.html');
 const normStart=html.indexOf('  function normalizeExerciseName('),normEnd=html.indexOf('\n',normStart);
 const assetStart=html.indexOf('  function exerciseReferenceAsset('),assetEnd=html.indexOf('  function exerciseAssetSlug(',assetStart);
 const metaStart=html.indexOf('  function exerciseIllustrationMeta(',assetStart),metaEnd=html.indexOf('  function exerciseIllustrationUrl(',metaStart);
 assert.ok(normStart>=0&&assetStart>=0&&metaStart>=0&&assetEnd>assetStart&&metaEnd>metaStart);
 const vmContext={};
 vm.runInNewContext(`${html.slice(normStart,normEnd)}\n${html.slice(assetStart,assetEnd)}\n${html.slice(metaStart,metaEnd)}\nglobalThis.meta=exerciseIllustrationMeta;`,vmContext);
 const outdoor=vmContext.meta('Bicicleta suave','Cardio','cardio');
 const indoor=vmContext.meta('Ciclismo indoor','Cardio','cardio');
 const kneeFlex=vmContext.meta('Flexión de rodilla','Piernas','strength');
 const hamstringCurl=vmContext.meta('Curl femoral sentado','Piernas','strength');
 const classicPushup=vmContext.meta('Flexiones clásicas','Pecho','strength');
 assert.match(outdoor.src,/cycling-outdoor\.webp$/);
 assert.match(indoor.src,/cycling\.webp$/);
 assert.match(kneeFlex.src,/reference-legs\.svg$/);
 assert.match(hamstringCurl.src,/reference-legs\.svg$/);
 assert.match(classicPushup.src,/push-up\.webp$/);
 assert.equal(outdoor.specific,false);
 assert.equal(indoor.specific,false);
 assert.equal(classicPushup.specific,true);
});

test('v40.7: fotografías específicas coinciden con la variante descrita',async()=>{
 const html=await read('index.html');
 const helper=html.slice(html.indexOf('const exactRules=['),html.indexOf('const matched=exactRules.find'));
 assert.match(helper,/\^press militar con mancuernas\$.*shoulder-press\.webp/);
 assert.doesNotMatch(helper,/press de hombros en maquina.*shoulder-press\.webp/);
 assert.doesNotMatch(helper,/\^zancada estatica asistida\$/,'Una estocada asistida no debe figurar como foto específica si la imagen no muestra el apoyo');
 assert.doesNotMatch(helper,/zancada hacia atras.*lunge\.webp/);
 const references=html.slice(html.indexOf('const photoReferenceRules'),html.indexOf('const photoReference=photoReferenceRules'));
 assert.match(references,/zancada\|estocada\|lunge.*lunge\.webp/,'Las zancadas sin foto exacta usan una referencia genérica claramente etiquetada');
 assert.match(references,/bicicleta suave\|ciclismo al aire libre\|bicicleta al aire libre\|bicicleta de ruta\|ciclismo de ruta.*cycling-outdoor\.webp/,'La bicicleta suave usa una referencia de ciclismo al aire libre y no la foto de una bici estática');
 assert.match(html,/No sustituye una revisión profesional de la técnica/);
});


test('v48: el catálogo depurado tiene datos válidos y cada ejercicio tiene un patrón de movimiento',async()=>{
 await import(path.join(root,'training-core.js'));const T=globalThis.FittFormaTraining;
 const entries=Object.values(T.LIBRARY).flat();
 assert.ok(entries.length>=180,`El catálogo debe conservar las tres modalidades (${entries.length} entradas)`);
 const unique=T.allExercises();assert.ok(unique.length>=150,`Se esperaban al menos 150 nombres únicos; hay ${unique.length}`);
 for(const e of entries){
  assert.ok(e.name&&e.group&&['strength','cardio','mobility'].includes(e.kind),`Datos incompletos: ${e.name}`);
  assert.ok(Number(e.sets)>=1&&String(e.reps).trim(),`Dosis vacía o inválida: ${e.name}`);
  assert.ok(e.slot,`Sin patrón de movimiento: ${e.name}`);
 }
});

test('v40.7: las fichas restantes generan técnica orientativa estructurada y la interfaz avisa que no equivale a validación profesional',async()=>{
 const html=await read('index.html');
 const start=html.indexOf('function generatedExerciseGuide(name)');
 const end=html.indexOf('function exerciseGuide(name)',start);
 const generator=html.slice(start,end);
 assert.ok(start>=0&&end>start,'No se encontró el generador de fichas restantes');
 for(const field of ['pattern','primary','secondary','equipment','level','steps','tips','breathing','errors','rest','alternatives','source'])assert.ok(generator.includes(field),`La guía automática no incluye ${field}`);
 assert.match(html,/return specific\|\|generatedExerciseGuide\(name\)/);
 assert.match(html,/Guía orientativa por familia de movimiento: confirmá que coincida con esta variante concreta/);
 assert.match(html,/equivalencia individual no certificada/);
});


test('v48: cada ejercicio de la biblioteca tiene una ficha propia completa (no genérica)',async()=>{
 const html=await read('index.html');
 await import(path.join(root,'training-core.js'));const T=globalThis.FittFormaTraining;
 globalThis.window=globalThis;await import(path.join(root,'exercise-guides.js'));
 const block=html.slice(html.indexOf('  const EXERCISE_GUIDE_CATALOG = ['),html.indexOf('\n  ];',html.indexOf('  const EXERCISE_GUIDE_CATALOG = ['))+5);
 const ctx={};vm.runInNewContext(block+'\nglobalThis.G=EXERCISE_GUIDE_CATALOG;',ctx);
 const guides=[...ctx.G,...globalThis.FittFormaExerciseGuides];
 const problems=[];
 for(const e of T.allExercises()){
  const g=guides.find(x=>T.norm(x.name)===T.norm(e.name));
  if(!g||!g.primary||!g.secondary||!g.equipment||!g.level||!Array.isArray(g.steps)||g.steps.length<3||g.steps.length>5||!g.breathing||!Array.isArray(g.errors)||!g.errors.length||!g.rest||!g.pattern||g.pattern==='unclassified')problems.push(e.name);
 }
 assert.deepEqual(problems,[],'Ejercicios sin ficha propia completa: '+problems.join(', '));
 assert.match(html,/<script src="\.\/exercise-guides\.js"><\/script>/);
});


test('v40.10 amplía las referencias fotográficas sin presentarlas como técnica exacta y muestra una progresión visible en tarjetas', async () => {
  const html = await read('index.html');
  assert.match(html, /photoReferenceRules/);
  assert.match(html, /specific:false,personalized:false,fallback/);
  assert.match(html, /exercise-progress-cue/);
  assert.match(html, /<span>Técnica<\/span><span>Control<\/span><span>Progresión<\/span>/);
  assert.match(html, /Analizá mi progreso reciente y sugerime el próximo paso seguro/);
});


test('las referencias fotográficas distinguen ciclismo interior de exterior y no confunden curls femorales con bíceps', async()=>{
 const html=await read('index.html');
 const start=html.indexOf('function exerciseIllustrationMeta('),end=html.indexOf('function exerciseIllustrationUrl(',start);
 const fn=html.slice(start,end);
 assert.match(fn,/ciclismo al aire libre\|bicicleta al aire libre\|bicicleta de ruta\|ciclismo de ruta.*cycling-outdoor\.webp/);
 assert.match(fn,/ciclismo indoor\|spinning\|bicicleta indoor.*cycling\.webp/);
 assert.match(fn,/curl\.\*\*?\(\?:femoral\|isquiotibiales\|nordico/);
 assert.match(fn,/flexiones\?\|lagartijas\?\|push\.\?ups\?/);
});
