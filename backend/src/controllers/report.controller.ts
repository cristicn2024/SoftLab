import { releaseReport } from '../services/delivery.service';
import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { generateReportPDF } from '../services/pdf.service';
import crypto from 'crypto';

// Todos los canales obtienen el documento mediante la misma comprobación de saldo.
export async function getOrderPdf(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const orderId = Number(req.params.orderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isSafeInteger(tenantId) || tenantId <= 0) {
      return res.status(400).json({ error: 'Orden o laboratorio no válido' });
    }
    const channel = req.body?.channel ?? req.query.channel ?? 'counter';
    if (!['counter', 'email', 'portal', 'print'].includes(channel)) {
      return res.status(400).json({ error: 'Canal de entrega no válido' });
    }
    res.setHeader('Cache-Control', 'no-store, private');
    const result = await releaseReport(req, tenantId, orderId, channel, async (tx) => {
      const order = await tx.order.findFirst({
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
        throw new Error('Orden no encontrada');
      }

      // Buscar la plantilla vigente
      const template = await tx.reportTemplate.findFirst({
        where: { tenantId, isDefault: true }
      });
      if (!template) throw new Error('Configura una plantilla predeterminada para emitir informes');

      // Generar o recuperar token QR
      let orderReport = await tx.orderReport.findFirst({ where: { orderId, tenantId } });
      if (!orderReport) {
        const qrToken = crypto.randomBytes(16).toString('hex');
        orderReport = await tx.orderReport.create({
          data: {
            tenantId,
            orderId,
            templateId: template.id,
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
                testName: item.test?.name || 'Perfil',
                resultValue: resVal,
                units: 'mg/dL',
                referenceRange: item.test?.referenceRange || 'Normal',
                flag: item.testResults[0]?.isAlert ? 'HIGH' : 'NORMAL'
              };
            })
          }
        ],
        qrToken: orderReport.qrToken
      });

      return reportBuffer;
    });
    if ('error' in result) return res.status(result.status).json(result);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Informe_Orden_${orderId}.pdf`);
    return res.send(result.buffer);
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