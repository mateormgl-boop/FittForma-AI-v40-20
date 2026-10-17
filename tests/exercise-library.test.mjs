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
 for(const name of ['Press de banca con barra','Prensa de piernas','Jalón al pecho','Remo sentado en polea','Peso muerto rumano con mancuernas','Curl femoral sentado','Plancha con apoyo de antebrazos','Dead bug'])assert.ok(names.includes(name),`Falta guía para ${name}`);
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


test('v40.7: los 190 registros del catálogo tienen datos válidos y los 180 nombres únicos reciben una familia de movimiento',async()=>{
 const html=await read('index.html');
 const libraryStart=html.indexOf('  const library = {');
 const libraryEnd=html.indexOf('\n  };',libraryStart)+5;
 assert.ok(libraryStart>=0&&libraryEnd>libraryStart,'No se pudo extraer el catálogo');
 const normalizeStart=html.indexOf('  function normalizeExerciseName(');
 const normalizeEnd=html.indexOf('\n',normalizeStart);
 const classifierStart=html.indexOf('  function classifyCatalogMovement(');
 const classifierEnd=html.indexOf('\n  function catalogMuscles(',classifierStart);
 assert.ok(normalizeStart>=0&&classifierStart>=0&&classifierEnd>classifierStart,'No se encontró el clasificador de catálogo');
 const context={};
 vm.runInNewContext(`${html.slice(libraryStart,libraryEnd)}\n${html.slice(normalizeStart,normalizeEnd)}\n${html.slice(classifierStart,classifierEnd)}\nglobalThis.catalogUnderTest=library; globalThis.classifierUnderTest=classifyCatalogMovement;`,context);
 const entries=Object.values(context.catalogUnderTest).flat();
 const norm=x=>String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
 assert.equal(entries.length,190,'El catálogo debe conservar las 190 entradas de las tres modalidades');
 assert.equal(new Set(entries.map(e=>norm(e.name))).size,180,'Se esperaban 180 nombres únicos, con repeticiones entre modalidades');
 for(const e of entries){
  assert.ok(e.name&&e.group&&['strength','cardio'].includes(e.kind),`Datos incompletos: ${e.name}`);
  assert.ok(Number(e.sets)>=1&&String(e.reps).trim(),`Dosis vacía o inválida: ${e.name}`);
 }
 const unique=new Map();
 for(const e of entries) if(!unique.has(norm(e.name)))unique.set(norm(e.name),e);
 const uncategorized=[...unique.values()].filter(e=>context.classifierUnderTest(e.name,e.group,e.kind)==='unclassified').map(e=>e.name);
 assert.deepEqual(uncategorized,[],'Hay ejercicios del catálogo sin patrón general identificado');
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


test('v40.7: las guías en ejecución cubren todas las variantes únicas con campos completos, pasos y patrón identificado',async()=>{
 const html=await read('index.html');
 const section=(startMarker,endMarker)=>{const start=html.indexOf(startMarker),end=html.indexOf(endMarker,start);assert.ok(start>=0&&end>start,`No se pudo extraer ${startMarker}`);return html.slice(start,end);};
 const lib=section('  const library = {','\n  };')+'\n  };';
 const normalize=section('  function normalizeExerciseName(','\n  // Guías estructuradas')+'\n';
 const guides=section('  const EXERCISE_GUIDE_CATALOG = [','\nfunction findCatalogExercise');
 const helperStart=html.indexOf('function findCatalogExercise('),helperEnd=html.indexOf('  function inferExercisePattern(',helperStart);
 assert.ok(helperStart>=0&&helperEnd>helperStart,'No se encontró la implementación de guías');
 const helper=html.slice(helperStart,helperEnd);
 const ctx={};
 vm.runInNewContext(`${lib}\n${normalize}\n${guides}\n${helper}\nglobalThis.catalogUnderTest=library; globalThis.guideUnderTest=exerciseGuide; globalThis.classifierUnderTest=classifyCatalogMovement;`,ctx);
 const norm=x=>String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
 const items=Object.values(ctx.catalogUnderTest).flat();
 const unique=new Map(items.map(e=>[norm(e.name),e]));
 assert.equal(unique.size,180);
 const problems=[];
 for(const e of unique.values()){
  const g=ctx.guideUnderTest(e.name);
  if(!g||!g.primary||!g.secondary||!g.equipment||!g.level||!Array.isArray(g.steps)||g.steps.length!==3||!g.breathing||!Array.isArray(g.errors)||!g.errors.length||!g.rest||!g.pattern||g.pattern==='unclassified')problems.push(e.name);
 }
 assert.deepEqual(problems,[],'Las fichas incompletas o sin clasificación son: '+problems.join(', '));
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
