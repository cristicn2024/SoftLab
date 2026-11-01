import { Request, Response } from 'express';
import { prisma } from '../config/db';

// GET /api/templates/active
export async function getActiveTemplate(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const template = await prisma.reportTemplate.findFirst({
      where: { tenantId, isDefault: true },
      orderBy: { version: 'desc' }
    });

    if (!template) {
      return res.json({
        name: 'Biometría hemática · Clínica Central · v3 · Publicada',
        headerText: 'Logotipo · Laboratorio Santa Lucía · Clínica Central',
        disclaimer: 'Resultados válidos solo con firma del responsable sanitario',
        chemistName: 'Laura Méndez',
        chemistCedula: '10458392',
        version: 3
      });
    }

    return res.json(template);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener la plantilla' });
  }
}

// POST /api/templates
export async function saveTemplate(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const { headerText, disclaimer, chemistName, chemistCedula } = req.body;

    // Obtener última versión existente
    const lastTemplate = await prisma.reportTemplate.findFirst({
      where: { tenantId },
      orderBy: { version: 'desc' }
    });

    const newVersion = (lastTemplate?.version || 0) + 1;

    // Marcar anteriores como no predeterminadas
    await prisma.reportTemplate.updateMany({
      where: { tenantId },
      data: { isDefault: false }
    });

    // Crear la nueva versión de plantilla
    const newTemplate = await prisma.reportTemplate.create({
      data: {
        tenantId,
        name: `Biometría hemática · v${newVersion}`,
        headerText,
        disclaimer,
        chemistName,
        chemistCedula,
        version: newVersion,
        isDefault: true
      }
    });

    return res.status(201).json(newTemplate);
  } catch (error) {
    return res.status(500).json({ error: 'Error al guardar la plantilla' });
  }
}

// GET /api/templates
export async function getTemplateHistory(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const templates = await prisma.reportTemplate.findMany({
      where: { tenantId },
      orderBy: { version: 'desc' }
    });

    return res.json(templates);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener historial de versiones' });
  }
}