import type { NewTemplateData, ReportTemplate } from './plantillas.types';

export interface PlantillasRepository {
  findDefault(tenantId: number): Promise<ReportTemplate | null>;
  findLatest(tenantId: number): Promise<ReportTemplate | null>;
  findAll(tenantId: number): Promise<ReportTemplate[]>;
  unsetDefaults(tenantId: number): Promise<void>;
  create(data: NewTemplateData): Promise<ReportTemplate>;
}
