import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTrainingInsights } from '../backend/ai-insights.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const session = (date, reps='10', weight='50', rir='2') => ({
  date,
  exercises:[{name:'Press de banca',kind:'strength',entries:[{reps,weight,rir,done:true}]}]
});

test('FittAI solo marca una meseta con cuatro exposiciones durante al menos tres semanas',()=>{
  const data=['2026-10-01','2026-10-08','2026-10-15','2026-10-22'].map(d=>session(d));
  const [result]=deriveTrainingInsights(data);
  assert.equal(result.plateau,true);
  assert.equal(result.exposures,4);
  assert.equal(result.trend,'stable');
});

test('dos registros no alcanzan para diagnosticar estancamiento',()=>{
  const [result]=deriveTrainingInsights([session('2026-10-01'),session('2026-10-08')]);
  assert.equal(result.plateau,false);
});

test('la progresión reciente aparece como tendencia positiva, no como meseta',()=>{
  const [result]=deriveTrainingInsights([
    session('2026-10-01','8','40'),session('2026-10-08','10','45')
  ]);
  assert.equal(result.trend,'improving');
  assert.equal(result.plateau,false);
});

test('el esfuerzo alto se detecta sin inventar RIR y se omiten actividades que no son fuerza',()=>{
  const high=[session('2026-10-01','10','50','1'),session('2026-10-08','10','50','0')];
  high[0].exercises.push({name:'Cinta',kind:'cardio',entries:[{reps:'20',weight:'0',done:true}]});
  const [result]=deriveTrainingInsights(high);
  assert.equal(result.highEffort,true);
  assert.equal(result.exercise,'Press de banca');
});

test('sin RIR se conserva el análisis de progreso y los registros incompletos se ignoran',()=>{
  const a=session('2026-10-01','8','40','');
  const b=session('2026-10-08','10','45','');
  const c=session('2026-10-15','11','45','');
  a.exercises[0].entries[0].done=false;
  assert.equal(deriveTrainingInsights([a,b,c]).length,1);
  assert.equal(deriveTrainingInsights([b,c])[0].highEffort,false);
});

test('v80: FittAI recibe señales de progreso calculadas y cuotas por cuenta validada', async()=>{
  const server=await readFile(path.join(root,'backend/server.mjs'),'utf8');
  assert.match(server,/trainingInsights:deriveTrainingInsights/);
  assert.match(server,/async function aiAccountId\(req\)/);
  assert.match(server,/\/auth\/v1\/user/);
  assert.match(server,/GEMINI_DAILY_PER_ACCOUNT/);
  assert.match(server,/rateLimitedKey\('account:'\+accountId/);
  assert.match(server,/overDailyBudget\(req,accountId\)/);
});

test('v80: las fotos muestran porción asumida y confianza visual sin prometer precisión', async()=>{
  const server=await readFile(path.join(root,'backend/server.mjs'),'utf8');
  const html=await readFile(path.join(root,'index.html'),'utf8');
  assert.match(server,/confidence:\['low','medium','high'\]/);
  assert.match(server,/portionAssumption/);
  assert.match(html,/Confianza visual baja/);
  assert.match(html,/Porción estimada:/);
  assert.match(html,/Revisá y corregí porciones antes de guardar/);
});

test('v80: la política CSP limita scripts inline por hash y mantiene los estilos heredados', async()=>{
  const server=await readFile(path.join(root,'backend/server.mjs'),'utf8');
  assert.match(server,/inlineScriptHashes/);
  assert.match(server,/inlineEventHandlerHashes/);
  assert.match(server,/unsafe-hashes/);
  assert.doesNotMatch(server,/script-src[^\\n]*unsafe-inline/);
  assert.match(server,/style-src 'self' 'unsafe-inline'/);
});
