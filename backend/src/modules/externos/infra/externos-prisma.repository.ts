import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ExternosRepository } from '../dominio/externos.repository';
import type { EstudioExterno, LaboratorioExterno, UltimoEnvio } from '../dominio/externos.types';

function aNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  return Number(valor);
}

@Injectable()
export class ExternosPrismaRepository implements ExternosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async laboratoriosActivos(tenantId: number): Promise<LaboratorioExterno[]> {
    const filas = await this.prisma.externalLab.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const lista: LaboratorioExterno[] = [];
    for (const fila of filas) lista.push({ id: fila.id, name: fila.name });
    return lista;
  }

  async estudiosExternos(tenantId: number): Promise<EstudioExterno[]> {
    const filas = await this.prisma.testCatalog.findMany({
      where: { tenantId, externalLabId: { not: null } },
      include: { externalLabRef: true },
      orderBy: { code: 'asc' },
    });
    const lista: EstudioExterno[] = [];
    for (const fila of filas) {
      if (fila.externalLabId === null || fila.externalLabRef === null) continue;
      lista.push({
        id: fila.id,
        code: fila.code,
        name: fila.name,
        status: fila.status,
        externalLabId: fila.externalLabId,
        laboratorio: fila.externalLabRef.name,
        turnaroundDays: fila.turnaroundDays,
        outsourcingCost: aNumero(fila.outsourcingCost),
      });
    }
    return lista;
  }

  async ultimoCambio(tenantId: number, testIds: number[]): Promise<Date | null> {
    if (testIds.length === 0) return null;
    const cambio = await this.prisma.catalogAudit.findFirst({
      where: { tenantId, kind: 'studies', itemId: { in: testIds } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (cambio === null) return null;
    return cambio.createdAt;
  }

  async ultimoEnvio(tenantId: number): Promise<UltimoEnvio | null> {
    const envio = await this.prisma.shipmentOrder.findFirst({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { test: { select: { code: true } }, externalLab: { select: { name: true } } },
    });
    if (envio === null) return null;
    return {
      folio: envio.folio,
      code: envio.test.code,
      laboratorio: envio.externalLab.name,
      estimatedDays: envio.estimatedDays,
      outsourcingCost: aNumero(envio.outsourcingCost),
      createdAt: envio.createdAt,
    };
  }
}
