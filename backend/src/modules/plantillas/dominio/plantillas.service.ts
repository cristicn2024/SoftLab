import type { PlantillasRepository } from './plantillas.repository';
import type { FallbackTemplate, ReportTemplate, TemplateInput } from './plantillas.types';

export const FALLBACK_TEMPLATE: FallbackTemplate = {
  name: 'Biometría hemática · Clínica Central · v3 · Publicada',
  headerText: 'Logotipo · Laboratorio Santa Lucía · Clínica Central',
  disclaimer: 'Resultados válidos solo con firma del responsable sanitario',
  chemistName: 'Laura Méndez',
  chemistCedula: '10458392',
  version: 3,
};

export class PlantillasService {
  constructor(private readonly repository: PlantillasRepository) {}

  async getActive(tenantId: number): Promise<ReportTemplate | FallbackTemplate> {
    const template = await this.repository.findDefault(tenantId);
    if (!template) return { ...FALLBACK_TEMPLATE };
    return template;
  }

  async save(tenantId: number, input: TemplateInput): Promise<ReportTemplate> {
    const last = await this.repository.findLatest(tenantId);
    const newVersion = (last?.version || 0) + 1;

    await this.repository.unsetDefaults(tenantId);

    return this.repository.create({
      tenantId,
      name: `Biometría hemática · v${newVersion}`,
      headerText: input.headerText,
      disclaimer: input.disclaimer,
      chemistName: input.chemistName,
      chemistCedula: input.chemistCedula,
      version: newVersion,
      isDefault: true,
    });
  }

  history(tenantId: number): Promise<ReportTemplate[]> {
    return this.repository.findAll(tenantId);
  }
}
