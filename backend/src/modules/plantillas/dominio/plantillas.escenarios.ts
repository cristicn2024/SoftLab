import type { PlantillasRepository } from './plantillas.repository';
import type { NewTemplateData, ReportTemplate } from './plantillas.types';

export class FakeRepository implements PlantillasRepository {
  private readonly rows: ReportTemplate[] = [];
  private nextId = 1;

  async findDefault(tenantId: number): Promise<ReportTemplate | null> {
    let found: ReportTemplate | null = null;
    for (const row of this.rows) {
      if (row.tenantId !== tenantId || !row.isDefault) continue;
      if (found === null || row.version > found.version) found = row;
    }
    return found;
  }

  async findLatest(tenantId: number): Promise<ReportTemplate | null> {
    let found: ReportTemplate | null = null;
    for (const row of this.rows) {
      if (row.tenantId !== tenantId) continue;
      if (found === null || row.version > found.version) found = row;
    }
    return found;
  }

  async findAll(tenantId: number): Promise<ReportTemplate[]> {
    const list: ReportTemplate[] = [];
    for (const row of this.rows) {
      if (row.tenantId === tenantId) list.push(row);
    }
    list.sort(function porVersionDescendente(a, b) {
      return b.version - a.version;
    });
    return list;
  }

  async unsetDefaults(tenantId: number): Promise<void> {
    for (const row of this.rows) {
      if (row.tenantId === tenantId) row.isDefault = false;
    }
  }

  async create(data: NewTemplateData): Promise<ReportTemplate> {
    const now = new Date(2026, 10, 3, 9, 0);
    const row: ReportTemplate = {
      id: this.nextId++,
      tenantId: data.tenantId,
      name: data.name,
      studyType: null,
      branchId: null,
      version: data.version,
      isDefault: data.isDefault,
      primaryColor: '#0f766e',
      logoUrl: null,
      watermarkUrl: null,
      signatureUrl: null,
      chemistName: data.chemistName ?? null,
      chemistCedula: data.chemistCedula ?? null,
      headerText: data.headerText ?? null,
      footerText: null,
      disclaimer: data.disclaimer ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }
}
