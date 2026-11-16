// Prueba contra el servidor local y MySQL con un laboratorio temporal.
require('dotenv/config');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { ReportesPrismaRepository } = require('../dist/modules/reportes/infra/reportes-prisma.repository');
const p = new PrismaClient();
let tenant;
let passed = 0;
let failed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, e.message); }
}
const rule = { type:'numeric', gender:null, ageUnit:'years', minAge:0, maxAge:null, condition:'', minWeeks:null, maxWeeks:null, low:3.5, high:5, criticalLow:2, criticalHigh:7, expected:null, display:'3.5 - 5 mg/dL', unit:'mg/dL', method:'QA A' };
async function call(path, method='GET', body, role='admin', tenantId=tenant.id) {
  const r = await fetch('http://localhost:4000/api'+path, {
    method, headers:{'Content-Type':'application/json','x-tenant-id':String(tenantId),'x-user-name':'QA referencias','x-user-role':role},
    body:body===undefined?undefined:JSON.stringify(body), signal:AbortSignal.timeout(10000),
  });
  return { status:r.status, body:await r.json() };
}
async function main() {
 tenant=await p.tenant.create({data:{name:'QA referencias temporal',subdomain:'qa-ref-'+Date.now()}});
 const test=await p.testCatalog.create({data:{tenantId:tenant.id,code:'QA',name:'QA referencia',price:0,sampleType:'Suero'}});
 let parameter;
 await check('crear parametro por API',async()=>{const r=await call('/referencias/parametros/crear','POST',{testId:test.id,name:'QA analito'});assert.equal(r.status,201);parameter=r.body;});
 if(!parameter) throw new Error('No se puede continuar sin parametro');
 const path='/referencias/'+parameter.id;
 const payload=(offset=0)=>({effectiveFrom:new Date(Date.now()+offset).toISOString(),rules:[rule]});
 for(const role of ['receptionist','doctor','']) await check('bloquear rol '+(role||'ausente'),async()=>assert.equal((await call(path,'POST',payload(),role)).status,403));
 await check('bloquear laboratorio ajeno',async()=>assert.equal((await call(path,'POST',payload(),'admin',1)).status,404));
 for(const [label,rules] of [
   ['traslape',[{...rule,maxAge:20},{...rule,minAge:18}]],
   ['hueco',[{...rule,maxAge:17},{...rule,minAge:18}]],
   ['critico dentro del rango',[{...rule,criticalLow:4}]],
   ['unidad vacia',[{...rule,unit:''}]],
   ['metodo vacio',[{...rule,method:''}]],
 ]) await check('rechazar '+label,async()=>assert.equal((await call(path,'POST',{...payload(),rules})).status,400));
 await check('rechazar retroactividad',async()=>assert.equal((await call(path,'POST',payload(-120000))).status,400));
 await check('crear version vigente como quimico',async()=>assert.equal((await call(path,'POST',payload(),'chemist')).status,201));
 await check('crear version futura como admin',async()=>assert.equal((await call(path,'POST',{...payload(3600000),rules:[{...rule,high:6,method:'QA B'}]})).status,201));
 await check('bitacora contiene usuario, antes y despues',async()=>{
  const {body}=await call('/referencias'); const a=body.audits.find(a=>a.before?.rules);
  assert.equal(a.userName,'QA referencias');assert.equal(a.before.rules[0].method,'QA A');assert.equal(a.after.rules[0].method,'QA B');
  assert.equal(body.versions.length,2);
 });
 await check('laboratorio ajeno no ve versiones',async()=>{
  const r=await call('/referencias','GET',undefined,'admin',1);assert.equal(r.status,200);assert.ok(!r.body.versions.some(v=>v.parameterId===parameter.id));
 });
 await check('repositorio selecciona version vigente e interpreta limites',async()=>{
  const {WorklistPrismaRepository}=require('../dist/modules/worklist/infra/worklist-prisma.repository');
  const {buildRule,interpretValue}=require('../dist/modules/worklist/dominio/worklist.rules');
  const row={tenantId:tenant.id,id:123,folio:'QA',patient:{id:1,firstName:'QA',lastName:'QA',gender:'F',birthDate:new Date('2000-01-01'),specialCondition:null,pregnancyWeeks:null},samples:[],items:[{id:1,test:{name:'QA',externalLab:null,parameters:[{id:parameter.id,name:'QA',unit:null,qualitativeExpected:null,previousValue:null,previousDate:null,ranges:[]}]},testResults:[]}]};
  const repo=new WorklistPrismaRepository({referenceVersion:p.referenceVersion});
  const result=await repo.withReferences(row);const range=result.items[0].parameters[0].ranges[0];
  assert.equal(range.high,5);assert.equal(range.unit,'mg/dL');
  const r=buildRule(range,null);
  for(const [v,flag] of [['3.5','Normal'],['5','Normal'],['3','L'],['6','H'],['1','LL'],['8','HH']]) assert.equal(interpretValue(v,r),flag);
 });
 await check('informe incluye todos los parametros del estudio',async()=>{
  const order={id:1,folio:'QA',createdAt:new Date(),tenant:{name:'QA',subdomain:'qa'},patient:{id:1,firstName:'QA',lastName:'QA',gender:'F',birthDate:new Date('2000-01-01')},doctor:null,items:[{test:{name:'Panel',referenceRange:'antiguo'},profile:null,testResults:[{resultValue:'4',isAlert:false,referenceSnapshot:JSON.stringify({display:'3.5 - 5'})},{resultValue:'9',isAlert:true,referenceSnapshot:JSON.stringify({display:'1 - 8'})}]}]};
  const tx={$queryRaw:async()=>[],order:{findFirst:async()=>order}};
  const repo=new ReportesPrismaRepository({$transaction:async fn=>fn(tx)});
  const report=await repo.transaction(tenant.id,1,u=>u.findReportOrder());
  assert.equal(report.items.length,2,'Se esperaban 2 parametros; el informe omite uno');
 });
}
main().catch(e=>{failed++;console.error(e.message);}).finally(async()=>{
 if(tenant){await p.referenceVersion.deleteMany({where:{tenantId:tenant.id}});await p.catalogAudit.deleteMany({where:{tenantId:tenant.id}});await p.tenant.delete({where:{id:tenant.id}});console.log('Datos temporales eliminados');}
 await p.$disconnect();console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
});
