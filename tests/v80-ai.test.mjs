import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTrainingInsights } from '../backend/ai-insights.mjs';

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
  a.exercises[0].entries[0].done=false;
  assert.equal(deriveTrainingInsights([a,b]).length,1);
  assert.equal(deriveTrainingInsights([b])[0].highEffort,false);
});
