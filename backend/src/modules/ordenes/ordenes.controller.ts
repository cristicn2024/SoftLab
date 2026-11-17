import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { OrdenesService } from './dominio/ordenes.service';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { RegistrarMedicoDto } from './dto/registrar-medico.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { consolidarPreanalitica, esIncompatible } from './dominio/preanalitica';

@ApiTags('ordenes')
@Controller()
export class OrdenesController {
  constructor(private readonly servicio: OrdenesService, private readonly prisma: PrismaService) {}

  @Get('branches')
  sucursales(@UsuarioActual() sesion: Sesion) {
    return this.prisma.branch.findMany({ where: { tenantId: sesion.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  @Get('patients')
  async pacientes(@UsuarioActual() sesion: Sesion, @Query('q') q: unknown) {
    const query = String(q ?? '').trim();
    if (query.length > 100) throw new BadRequestException('Búsqueda de paciente demasiado larga');
    return this.prisma.patient.findMany({
      where: { tenantId: sesion.tenantId, ...(query ? { OR: [{ firstName: { contains: query } }, { lastName: { contains: query } }, { patientCode: { contains: query } }] } : {}) },
      select: { id: true, firstName: true, lastName: true, patientCode: true, birthDate: true, gender: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], take: 50,
    });
  }

  @Post('orders/indications/preview')
  async previsualizarIndicaciones(@UsuarioActual() sesion: Sesion, @Body() body: Record<string, unknown>) {
    return this.evaluarOrden(sesion.tenantId, body);
  }

  @Get('orders/:orderId/indications')
  async indicacionesGuardadas(@UsuarioActual() sesion: Sesion, @Param('orderId') rawId: string) {
    const orderId = Number(rawId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new BadRequestException('ID de orden inválido');
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId: sesion.tenantId }, select: { preAnalyticalSnapshot: true } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order.preAnalyticalSnapshot ?? { estudios: [], muestras: [], ayunos: [], preparacion: [], medicamentos: [], adicionales: [], conflictos: [], legacy: true };
  }

  @Get('concepts/search')
  buscarConceptos(@UsuarioActual() sesion: Sesion, @Query('q') q: unknown) {
    return this.servicio.searchConcepts(sesion.tenantId, q);
  }

  @Get('orders/check-open')
  ordenAbierta(@UsuarioActual() sesion: Sesion, @Query('patientId') patientId: unknown) {
    return this.servicio.checkOpenOrder(sesion.tenantId, patientId, new Date());
  }

  @Post('doctors/express')
  @HttpCode(201)
  registrarMedico(@UsuarioActual() sesion: Sesion, @Body() dto: RegistrarMedicoDto) {
    return this.servicio.registerDoctor({
      tenantId: sesion.tenantId,
      name: dto.name,
      cedula: dto.cedula,
      specialty: dto.specialty,
    });
  }

  @Post('orders')
  @HttpCode(201)
  async crear(@UsuarioActual() sesion: Sesion, @Body() dto: CrearOrdenDto) {
    // Preserve the established domain errors for missing patient or branch.
    if (!Number(dto.patientId) || !Number(dto.branchId)) return this.servicio.createOrder(sesion.tenantId, {
      patientId: dto.patientId, branchId: dto.branchId, doctorId: dto.doctorId, items: dto.items, totalAmount: dto.totalAmount,
    }, new Date());
    const branchId = Number(dto.branchId);
    if (!Number.isSafeInteger(branchId) || branchId <= 0 || !await this.prisma.branch.findFirst({ where: { id: branchId, tenantId: sesion.tenantId }, select: { id: true } })) throw new BadRequestException('La sucursal no pertenece a este laboratorio');
    if (dto.doctorId != null && dto.doctorId !== '') {
      const doctorId = Number(dto.doctorId);
      if (!Number.isSafeInteger(doctorId) || !await this.prisma.doctor.findFirst({ where: { id: doctorId, tenantId: sesion.tenantId }, select: { id: true } })) throw new BadRequestException('El médico no pertenece a este laboratorio');
    }
    const preAnalitica = await this.evaluarOrden(sesion.tenantId, dto as Record<string, unknown>);
    if (preAnalitica.indications.conflictos.length && dto.reviewedInstructionConflicts !== true) {
      throw new BadRequestException({ message: 'Revisa y confirma los conflictos de indicaciones antes de registrar la orden', conflicts: preAnalitica.indications.conflictos });
    }
    const mismatches = preAnalitica.incompatibleStudies;
    const rawApprovals = dto.exceptionApprovals ?? [];
    if (!Array.isArray(rawApprovals)) throw new BadRequestException('Las excepciones deben ser una lista de estudios y motivos');
    if (mismatches.length && !rawApprovals.length) throw new BadRequestException({ message: 'La orden incluye estudios incompatibles con el sexo registrado', incompatibleStudies: mismatches });
    if (rawApprovals.length && sesion.rol !== 'admin') throw new ForbiddenException('Solo un administrador puede autorizar excepciones de admisibilidad');
    const approvals = rawApprovals.map((raw) => {
      if (!raw || typeof raw !== 'object') throw new BadRequestException('Excepción inválida');
      const approval = raw as { testId?: unknown; reason?: unknown };
      const testId = Number(approval.testId);
      const reason = typeof approval.reason === 'string' ? approval.reason.trim() : '';
      if (!Number.isSafeInteger(testId) || reason.length < 1 || reason.length > 500) throw new BadRequestException('Cada excepción requiere un estudio y un motivo (máximo 500 caracteres)');
      if (!mismatches.some((item) => item.testId === testId)) throw new BadRequestException('La excepción no corresponde a un estudio incompatible de esta orden');
      return { testId, reason, authorizedByName: sesion.nombre, ...(sesion.usuarioId ? { authorizedById: sesion.usuarioId } : {}) };
    });
    const approvedIds = new Set(approvals.map((item) => item.testId));
    if (approvedIds.size !== approvals.length) throw new BadRequestException('No repitas estudios en las excepciones');
    const remaining = mismatches.filter((item) => !approvedIds.has(item.testId));
    if (remaining.length) throw new BadRequestException({ message: 'Falta autorización para uno o más estudios incompatibles', incompatibleStudies: remaining });
    const created = await this.servicio.createOrder(sesion.tenantId, {
      ...dto,
      preAnalyticalSnapshot: preAnalitica.indications,
      exceptionApprovals: approvals,
    }, new Date());
    return { ...created, indications: preAnalitica.indications };
  }

  private async evaluarOrden(tenantId: number, body: Record<string, unknown>) {
    const patientId = Number(body.patientId);
    if (!Number.isSafeInteger(patientId) || patientId <= 0) throw new BadRequestException('Selecciona un paciente válido');
    const selectedItems = Array.isArray(body.items) ? body.items : [];
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true, gender: true } });
    if (!patient) throw new NotFoundException('Paciente no encontrado en este laboratorio');
    const testIds: number[] = [];
    const profileIds: number[] = [];
    for (const raw of selectedItems) {
      if (!raw || typeof raw !== 'object') throw new BadRequestException('Concepto de orden inválido');
      const item = raw as { id?: unknown; type?: unknown };
      const id = Number(item.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Concepto de orden inválido');
      if (item.type === 'TEST') testIds.push(id);
      else if (item.type === 'PROFILE') profileIds.push(id);
      else throw new BadRequestException('Tipo de concepto inválido');
    }
    const [tests, profiles] = await Promise.all([
      this.prisma.testCatalog.findMany({ where: { tenantId, id: { in: [...new Set(testIds)] }, status: true }, include: { instructions: true } }),
      this.prisma.profileCatalog.findMany({ where: { tenantId, id: { in: [...new Set(profileIds)] }, status: true }, include: { tests: { include: { test: { include: { instructions: true } } } } } }),
    ]);
    if (tests.length !== new Set(testIds).size || profiles.length !== new Set(profileIds).size) throw new BadRequestException('Uno o más estudios o perfiles no existen o están inactivos en este laboratorio');
    const all = new Map<number, (typeof tests)[number]>();
    tests.forEach((test) => all.set(test.id, test));
    const unavailableProfileStudies = profiles.flatMap((profile) => profile.tests.filter(({ test }) => test.tenantId !== tenantId || !test.status).map(({ test }) => ({ profile: profile.name, study: test.name })));
    if (unavailableProfileStudies.length) throw new BadRequestException({ message: 'Un perfil contiene estudios inactivos o ajenos al laboratorio; revisa el perfil en el catálogo.', studies: unavailableProfileStudies });
    profiles.forEach((profile) => profile.tests.forEach(({ test }) => all.set(test.id, test)));
    const studies = [...all.values()];
    const incompatibleStudies = studies.filter((study) => esIncompatible(patient.gender, study.genderRestriction)).map((study) => ({ testId: study.id, code: study.code, name: study.name, reason: patient.gender === 'Other' ? 'El sexo del paciente no permite determinar compatibilidad con la restricción del estudio' : `El estudio aplica a ${study.genderRestriction === 'F' ? 'sexo femenino' : 'sexo masculino'}` }));
    return { patientGender: patient.gender, indications: consolidarPreanalitica(studies), incompatibleStudies };
  }
}
