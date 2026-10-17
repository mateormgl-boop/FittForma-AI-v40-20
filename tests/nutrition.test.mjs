import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const rules = html.match(/  const textFoodRules=(\[[\s\S]*?\n  \]);/);
const foods = html.match(/  const foods=(\[[\s\S]*?\n  \]);/);
const estimateFunction = html.match(/  function estimateMealText\(text\)\{[\s\S]*?\n  \}/);
assert.ok(rules && foods && estimateFunction, 'La base y el estimador nutricional deben existir');
const context = {};
vm.runInNewContext(`const textFoodRules=${rules[1]}; const foods=${foods[1]}; ${estimateFunction[0]}; globalThis.estimateMealText=estimateMealText;`, context);

 test('el estimador respeta gramos explícitos escritos como “100 g de arroz”', () => {
  const result = context.estimateMealText('100 g de arroz y 2 huevos');
  assert.equal(result.hits, 2);
  assert.equal(result.kcal, 273);
  assert.equal(result.protein, 15.3);
});

test('el estimador respeta mililitros y gramos explícitos en una descripción natural', () => {
  const result = context.estimateMealText('250 ml de leche y 30 g de proteína');
  assert.equal(result.hits, 2);
  assert.equal(result.kcal, 273);
  assert.equal(result.protein, 32);
});

test('las cantidades sin unidad conservan las porciones de referencia', () => {
  const result = context.estimateMealText('2 huevos y 1 banana');
  assert.equal(result.hits, 2);
  assert.ok(result.kcal >= 240 && result.kcal <= 280);
  assert.ok(result.protein > 12 && result.protein < 16);
});
