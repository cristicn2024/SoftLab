import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRules,selectReference,type ReferenceRule} from './referencias.rules';
const base:ReferenceRule={type:'numeric',gender:null,ageUnit:'years',minAge:0,maxAge:null,condition:'',minWeeks:null,maxWeeks:null,low:3.5,high:5,criticalLow:2,criticalHigh:7,expected:null,display:'3.5 - 5.0',unit:'mg/dL',method:'Reactivo A'};
test('permite segmentos contiguos y elige el que comienza en el cumpleaños',()=>{
 const rules=validateRules([{...base,maxAge:18},{...base,minAge:18,low:4}]);
 assert.equal(selectReference(rules,new Date('2008-11-16'),new Date('2026-11-16'),'F')?.low,4);
});
test('rechaza huecos, traslapes, edades incompletas y límites críticos internos',()=>{
 for(const ranges of [[{...base,maxAge:17},{...base,minAge:18}],[{...base,maxAge:19},{...base,minAge:18}],[{...base,minAge:1}],[{...base,criticalLow:4}]]) assert.throws(()=>validateRules(ranges));
});
test('días y meses respetan sus fronteras',()=>{
 const rules=validateRules([{...base,ageUnit:'days',maxAge:30},{...base,ageUnit:'days',minAge:30,low:4}]);
 assert.equal(selectReference(rules,new Date('2026-10-17'),new Date('2026-11-16'),'M')?.low,4);
});
test('condiciones y semanas no aplican a pacientes sin ese contexto',()=>{
 const rules=validateRules([{...base,condition:'Embarazo',gender:'F',minWeeks:0,maxWeeks:20},{...base,condition:'embarazo',gender:'F',minWeeks:20,maxWeeks:43,low:4}]);
 assert.equal(selectReference(rules,new Date('2000-01-01'),new Date('2026-11-16'),'F'),undefined);
 assert.equal(selectReference(rules,new Date('2000-01-01'),new Date('2026-11-16'),'F','embarazo',20)?.low,4);
});
test('admite cualitativos y texto sin límites numéricos',()=>{
 for(const type of ['qualitative','text']) assert.equal(validateRules([{...base,type,low:null,high:null,criticalLow:null,criticalHigh:null,expected:type==='qualitative'?'Negativo':null}]).length,1);
 assert.throws(()=>validateRules([{...base,type:'qualitative',expected:'Negativo'}]));
});
