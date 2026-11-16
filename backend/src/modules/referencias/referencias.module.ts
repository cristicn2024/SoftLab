import { BadRequestException, Body, Controller, ConflictException, Get, Module, NotFoundException, Param, Post } from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaModule } from '../../prisma/prisma.module';

import { PrismaService } from '../../prisma/prisma.service';

import { Roles } from '../../auth/decoradores/roles.decorator';

import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';

import type { Sesion } from '../../auth/dominio/sesion';

import { validateRules } from './referencias.rules';

@Controller('referencias')

@Roles('admin','chemist')

export class ReferenciasController {

 constructor(private readonly prisma: PrismaService) {}

 @Get()

 async list(@UsuarioActual() s: Sesion) {

  const [studies,versions,audits]=await Promise.all([

   this.prisma.testCatalog.findMany({where:{tenantId:s.tenantId},include:{parameters:true},orderBy:{name:'asc'}}),

   this.prisma.referenceVersion.findMany({where:{tenantId:s.tenantId},orderBy:{effectiveFrom:'desc'}}),

   this.prisma.catalogAudit.findMany({where:{tenantId:s.tenantId,kind:'references'},orderBy:{id:'desc'},take:200})]);

  return {studies,versions,audits};

 }

 @Post('ordenes/:orderId/contexto')
 async context(@UsuarioActual() s: Sesion, @Param('orderId') raw: string, @Body() body: {processedAt:string;condition:string;weeks:number|null}) {
  const orderId=Number(raw);
  if(!Number.isSafeInteger(orderId)||orderId<=0||!body||typeof body.processedAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(body.processedAt)) throw new BadRequestException('Fecha de procesamiento inválida');
  const processedAt=new Date(body.processedAt);
  if(!Number.isFinite(processedAt.getTime())||processedAt.getTime()>Date.now()+1000) throw new BadRequestException('El procesamiento no puede estar en el futuro');
  if(typeof body.condition!=='string'||body.condition.trim().length>100||(body.weeks!==null&&(!Number.isInteger(body.weeks)||body.weeks<0||body.weeks>45))||(body.weeks!==null&&!body.condition.trim())) throw new BadRequestException('Revisa condición y semanas (0 a 45)');
  return this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND tenant_id = ${s.tenantId} FOR UPDATE`;
   const before=await tx.order.findFirst({where:{id:orderId,tenantId:s.tenantId},include:{patient:true}});
   if(!before) throw new NotFoundException('Orden inexistente');
   if(before.status==='cancelled'||before.resultsDeliveredAt||await tx.testResult.count({where:{tenantId:s.tenantId,orderItem:{orderId}}})||await tx.orderReport.count({where:{tenantId:s.tenantId,orderId}})) throw new ConflictException('El contexto queda bloqueado al capturar resultados o emitir un informe');
   if(processedAt<before.patient.birthDate) throw new BadRequestException('La fecha es anterior al nacimiento');
   const after=await tx.order.update({where:{id:orderId},data:{processedAt,referenceCondition:body.condition.trim().toLowerCase(),referenceWeeks:body.weeks}});
   const snapshot=(o:typeof after)=>({processedAt:o.processedAt,condition:o.referenceCondition,weeks:o.referenceWeeks});
   await tx.catalogAudit.create({data:{tenantId:s.tenantId,kind:'reference_context',itemId:orderId,userName:s.nombre,before:JSON.parse(JSON.stringify(snapshot(before))),after:JSON.parse(JSON.stringify(snapshot(after)))}});
   return snapshot(after);
  });
 }
 @Post('parametros/crear')
 async createParameter(@UsuarioActual() s: Sesion,@Body() body:{testId:number;name:string}) {
  if(!body || !Number.isSafeInteger(body.testId) || typeof body.name!=='string' || !body.name.trim() || body.name.trim().length>150) throw new BadRequestException('Indica estudio y nombre del parámetro');
  return this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${s.tenantId} FOR UPDATE`;
   if(!await tx.testCatalog.findFirst({where:{id:body.testId,tenantId:s.tenantId}})) throw new NotFoundException('Estudio inexistente');
   if(await tx.testParameter.findFirst({where:{testId:body.testId,name:body.name.trim()}})) throw new BadRequestException('El parámetro ya existe');
   const after=await tx.testParameter.create({data:{tenantId:s.tenantId,testId:body.testId,name:body.name.trim()}});
   await tx.catalogAudit.create({data:{tenantId:s.tenantId,kind:'references',itemId:after.id,userName:s.nombre,before:Prisma.DbNull,after:JSON.parse(JSON.stringify(after))}});
   return after;
  });
 }
 @Post(':parameterId')

 async save(@UsuarioActual() s: Sesion,@Param('parameterId') raw: string,@Body() body: {effectiveFrom:string;rules:unknown}) {

  const parameterId=Number(raw);

  if(!Number.isSafeInteger(parameterId)||parameterId<=0||!body) throw new BadRequestException('Parámetro inválido');

  let rules;

  try {rules=validateRules(body.rules);} catch(e) {throw new BadRequestException((e as Error).message);}

  const effectiveFrom=new Date(body.effectiveFrom);

  if(!Number.isFinite(effectiveFrom.getTime()) || effectiveFrom.getTime()<Date.now()-60000) throw new BadRequestException('La nueva versión debe comenzar ahora o en el futuro');

  return this.prisma.$transaction(async tx=>{

   await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${s.tenantId} FOR UPDATE`;

   const parameter=await tx.testParameter.findFirst({where:{id:parameterId,tenantId:s.tenantId}});

   if(!parameter) throw new NotFoundException('Parámetro inexistente');

   const before=await tx.referenceVersion.findFirst({where:{tenantId:s.tenantId,parameterId},orderBy:{effectiveFrom:'desc'}});

   if(before && effectiveFrom<=before.effectiveFrom) throw new BadRequestException('La vigencia debe ser posterior a la última versión');

   const after=await tx.referenceVersion.create({data:{tenantId:s.tenantId,testId:parameter.testId,parameterId,effectiveFrom,rules:rules as unknown as Prisma.InputJsonValue,userName:s.nombre}});

   await tx.catalogAudit.create({data:{tenantId:s.tenantId,kind:'references',itemId:parameterId,userName:s.nombre,before:before?JSON.parse(JSON.stringify(before)):Prisma.DbNull,after:JSON.parse(JSON.stringify(after))}});

   return after;

  });

 }

}

@Module({imports:[PrismaModule],controllers:[ReferenciasController]})

export class ReferenciasModule {}

