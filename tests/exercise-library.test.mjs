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

