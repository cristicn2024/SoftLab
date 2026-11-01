import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { generateReportPDF } from '../services/pdf.service';
import crypto from 'crypto';

// 1. Emisión e Impresión de PDF por ID de Orden
export async function getOrderPdf(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1); // Extraído del token/middleware
    const orderId = Number(req.params.orderId);

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: true,
        items: {
          include: {
            test: true,
            testResults: true
          }
        },
        tenant: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Buscar la plantilla vigente
    const template = await prisma.reportTemplate.findFirst({
      where: { tenantId, isDefault: true }
    }) || {
      primaryColor: '#0f766e',
      chemistName: 'Q.F.B. Juan Pérez',
      chemistCedula: '12345678'
    };

    // Generar o recuperar token QR
    let orderReport = await prisma.orderReport.findFirst({ where: { orderId } });
    if (!orderReport) {
      const qrToken = crypto.randomBytes(16).toString('hex');
      orderReport = await prisma.orderReport.create({
        data: {
          tenantId,
          orderId,
          templateId: template.id || 1,
          qrToken
        }
      });
    }

    // Mapeo dinámico de datos clínicos
    const reportBuffer = await generateReportPDF({
      tenantName: order.tenant.name,
      subdomain: order.tenant.subdomain,
      orderId: order.id,
      folio: `ORD-${order.id.toString().padStart(6, '0')}`,
      createdAt: order.createdAt,
      patient: {
        fullName: `${order.patient.firstName} ${order.patient.lastName}`,
        ageYears: new Date().getFullYear() - new Date(order.patient.birthDate).getFullYear(),
        gender: order.patient.gender,
        patientId: order.patient.id
      },
      doctorName: 'Dr. Medico Tratante',
      template: {
        primaryColor: template.primaryColor,
        logoUrl: template.logoUrl || undefined,
        signatureUrl: template.signatureUrl || undefined,
        chemistName: template.chemistName || undefined,
        chemistCedula: template.chemistCedula || undefined
      },
      resultsByArea: [
        {
          areaName: 'LABORATORIO CLÍNICO GENERAL',
          items: order.items.map(item => {
            const resVal = item.testResults[0]?.resultValue || 'N/A';
            return {
              testName: item.test.name,
              resultValue: resVal,
              units: 'mg/dL',
              referenceRange: item.test.referenceRange || 'Normal',
              flag: item.testResults[0]?.isAlert ? 'HIGH' : 'NORMAL'
            };
          })
        }
      ],
      qrToken: orderReport.qrToken
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Informe_Orden_${order.id}.pdf`);
    return res.send(reportBuffer);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al generar informe PDF' });
  }
}

// 2. Public QR Verification Endpoint
export async function verifyReport(req: Request, res: Response) {
  const { token } = req.params;
  const report = await prisma.orderReport.findUnique({
    where: { qrToken: token },
    include: { order: { include: { patient: true } }, tenant: true }
  });

  if (!report) {
    return res.status(404).json({ valid: false, message: 'Documento no auténtico' });
  }

  return res.json({
    valid: true,
    laboratory: report.tenant.name,
    patient: `${report.order.patient.firstName} ${report.order.patient.lastName}`,
    issuedAt: report.createdAt
  });
}