import { BadRequestException, Body, ConflictException, Controller, Get, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import { Roles } from '../../auth/decoradores/roles.decorator';
import type { Sesion } from '../../auth/dominio/sesion';

@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@UsuarioActual() sesion: Sesion) {
    const where = { tenantId: sesion.tenantId };
    const [studies, profiles] = await Promise.all([
      this.prisma.testCatalog.findMany({ where, orderBy: { name: 'asc' } }),
      this.prisma.profileCatalog.findMany({ where, include: { tests: { include: { test: true } } }, orderBy: { name: 'asc' } }),
    ]);
    return { studies, profiles };
  }

  @Get('bitacora')
  @Roles('admin')
  audit(@UsuarioActual() sesion: Sesion) {
    return this.prisma.catalogAudit.findMany({ where: { tenantId: sesion.tenantId }, orderBy: { id: 'desc' }, take: 200 });
  }

  @Post(':kind')
  @Roles('admin')
  crear(@UsuarioActual() sesion: Sesion, @Param('kind') kind: string, @Body() body: Record<string, unknown>) {
    return this.guardar(sesion, kind, body);
  }

  @Put(':kind/:id')
  @Roles('admin')
  editar(@UsuarioActual() sesion: Sesion, @Param('kind') kind: string, @Param('id') rawId: string, @Body() body: Record<string, unknown>) {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('ID inválido');
    return this.guardar(sesion, kind, body, id);
  }

  private async guardar(sesion: Sesion, kind: string, body: Record<string, unknown>, id?: number) {
    if (!['studies', 'profiles'].includes(kind)) throw new BadRequestException('Tipo inválido');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Datos inválidos');
    const text = (key: string, max: number) => {
      const value = typeof body[key] === 'string' ? body[key].trim() : '';
      if (!value || value.length > max) throw new BadRequestException(`Revisa ${key} (máximo ${max} caracteres)`);
      return value;
    };
    const code = text('code', 30).toUpperCase();
    const name = text('name', 150);
    const price = Number(body.price);
    if (body.price === '' || body.price == null || !Number.isFinite(price) || price < 0 || price > 99999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) throw new BadRequestException('Precio inválido');
    if (typeof body.status !== 'boolean') throw new BadRequestException('Estatus inválido');
    const data = { code, name, price, status: body.status };
    const study = kind === 'studies' ? { department: text('department', 100), sampleType: text('sampleType', 50) } : null;
    const testIds = kind === 'profiles' && Array.isArray(body.testIds) ? [...new Set(body.testIds)] : [];
    if (kind === 'profiles' && (!testIds.length || testIds.some(v => !Number.isSafeInteger(v) || Number(v) <= 0))) throw new BadRequestException('Selecciona al menos un estudio');

    try {
      return await this.prisma.$transaction(async tx => {
        // Serializa las escrituras del catálogo del laboratorio para evitar duplicados concurrentes.
        await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${sesion.tenantId} FOR UPDATE`;
        const where = { tenantId: sesion.tenantId };
        const studies = await tx.testCatalog.findMany({ where });
        const profiles = await tx.profileCatalog.findMany({ where });
        const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
        for (const [type, items] of [['studies', studies], ['profiles', profiles]] as const) {
          if (items.some(item => !(type === kind && item.id === id) && (normalize(item.code) === normalize(code) || normalize(item.name) === normalize(name)))) {
            throw new ConflictException('La clave o el nombre ya existe en el catálogo');
          }
        }
        const before = id ? (kind === 'studies'
          ? await tx.testCatalog.findFirst({ where: { ...where, id } })
          : await tx.profileCatalog.findFirst({ where: { ...where, id }, include: { tests: true } })) : null;
        if (id && !before) throw new NotFoundException('Registro no encontrado');
        if (kind === 'profiles' && studies.filter(t => testIds.includes(t.id)).length !== testIds.length) throw new BadRequestException('Estudio ajeno al laboratorio o inexistente');
        let after;
        if (study) {
          after = id
            ? await tx.testCatalog.update({ where: { id }, data: { ...data, ...study } })
            : await tx.testCatalog.create({ data: { ...data, ...study, ...where } });
        } else {
          const tests = { create: (testIds as number[]).map(testId => ({ testId })) };
          after = id
            ? await tx.profileCatalog.update({ where: { id }, data: { ...data, tests: { deleteMany: {}, ...tests } }, include: { tests: true } })
            : await tx.profileCatalog.create({ data: { ...data, ...where, tests }, include: { tests: true } });
        }
        await tx.catalogAudit.create({ data: { tenantId: sesion.tenantId, kind, itemId: after.id, userName: sesion.nombre,
          before: before ? JSON.parse(JSON.stringify(before)) : Prisma.DbNull,
          after: JSON.parse(JSON.stringify(after)) } });
        return after;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('La clave o nombre ya existe');
      throw error;
    }
  }
}

@Module({ imports: [PrismaModule], controllers: [CatalogoController] })
export class CatalogoModule {}
