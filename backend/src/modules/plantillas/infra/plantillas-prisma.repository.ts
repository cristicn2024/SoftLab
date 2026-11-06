import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PlantillasRepository } from '../dominio/plantillas.repository';
import type { NewTemplateData, ReportTemplate } from '../dominio/plantillas.types';

@Injectable()
export class PlantillasPrismaRepository implements PlantillasRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDefault(tenantId: number): Promise<ReportTemplate | null> {
    return this.prisma.reportTemplate.findFirst({
      where: { tenantId, isDefault: true },
      orderBy: { version: 'desc' },
    });
  }

  findLatest(tenantId: number): Promise<ReportTemplate | null> {
    return this.prisma.reportTemplate.findFirst({
      where: { tenantId },
      orderBy: { version: 'desc' },
    });
  }

  findAll(tenantId: number): Promise<ReportTemplate[]> {
    return this.prisma.reportTemplate.findMany({
      where: { tenantId },
      orderBy: { version: 'desc' },
    });
  }

  async unsetDefaults(tenantId: number): Promise<void> {
    await this.prisma.reportTemplate.updateMany({
      where: { tenantId },
      data: { isDefault: false },
    });
  }

  create(data: NewTemplateData): Promise<ReportTemplate> {
    return this.prisma.reportTemplate.create({ data });
  }
}
