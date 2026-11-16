import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ReleaseUnit, ReportesRepository } from '../dominio/reportes.repository';
import type {
  ReleaseOrder,
  ReportItem,
  ReportOrder,
  ReportTemplateData,
  VerifiedReport,
} from '../dominio/reportes.types';

class PrismaReleaseUnit implements ReleaseUnit {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly tenantId: number,
    private readonly orderId: number,
  ) {}

  async findIssuedPdf(): Promise<Buffer | null> {
    const report = await this.tx.orderReport.findFirst({ where: { tenantId: this.tenantId, orderId: this.orderId }, orderBy: { id: 'asc' } });
    return report?.issuedPdf ? Buffer.from(report.issuedPdf, 'base64') : null;
  }

  async saveIssuedPdf(buffer: Buffer): Promise<void> {
    const report = await this.tx.orderReport.findFirst({ where: { tenantId: this.tenantId, orderId: this.orderId }, orderBy: { id: 'asc' } });
    if (!report) throw new Error('Informe no registrado');
    await this.tx.orderReport.update({ where: { id: report.id }, data: { issuedPdf: buffer.toString('base64') } });
  }

  async findOrder(): Promise<ReleaseOrder | null> {
    const order = await this.tx.order.findFirst({
      where: { id: this.orderId, tenantId: this.tenantId },
      include: { items: true, payments: true },
    });
    if (!order) return null;

    const itemPrices: number[] = [];
    for (const item of order.items) itemPrices.push(Number(item.price));
    const payments: { amount: number; cancelled: boolean }[] = [];
    for (const payment of order.payments) payments.push({ amount: Number(payment.amount), cancelled: payment.cancelled });

    return {
      id: order.id,
      status: order.status,
      discountPercent: order.discountPercent,
      resultsDeliveredAt: order.resultsDeliveredAt,
      itemPrices,
      payments,
    };
  }

  async log(userName: string, action: string, detail: string): Promise<void> {
    await this.tx.paymentLog.create({
      data: { tenantId: this.tenantId, orderId: this.orderId, userName, action, detail },
    });
  }

  async findReportOrder(): Promise<ReportOrder | null> {
    const order = await this.tx.order.findFirst({
      where: { id: this.orderId, tenantId: this.tenantId },
      include: {
        patient: true,
        doctor: true,
        items: { include: { test: true, profile: true, testResults: { include: { parameter: true }, orderBy: { id: 'asc' } } } },
        tenant: true,
      },
    });
    if (!order) return null;

    const items: ReportItem[] = [];
    for (const item of order.items) {
      const results = item.testResults.length ? item.testResults : [null];
      for (const result of results) {
        const snapshot = result?.referenceSnapshot ? JSON.parse(result.referenceSnapshot) : null;
        items.push({
          testName: result?.parameter?.name ? `${item.test?.name ?? ''} · ${result.parameter.name}` : item.test?.name ?? null,
          profileName: item.profile?.name ?? null,
          referenceRange: snapshot ? snapshot.display ?? null : item.test?.referenceRange ?? null,
          unit: snapshot ? snapshot.unit ?? '' : result?.parameter?.unit ?? '',
          flag: result?.flag ?? null,
          resultValue: result?.resultValue ?? null,
          isAlert: result?.isAlert ?? false,
        });
      }
    }

    return {
      id: order.id,
      folio: order.folio,
      createdAt: order.createdAt,
      tenantName: order.tenant.name,
      tenantSubdomain: order.tenant.subdomain,
      patient: {
        id: order.patient.id,
        firstName: order.patient.firstName,
        lastName: order.patient.lastName,
        birthDate: order.patient.birthDate,
        gender: order.patient.gender,
      },
      doctorName: order.doctor ? order.doctor.name : null,
      items,
    };
  }

  async findDefaultTemplate(): Promise<ReportTemplateData | null> {
    const template = await this.tx.reportTemplate.findFirst({
      where: { tenantId: this.tenantId, isDefault: true },
      orderBy: { version: 'desc' },
    });
    if (!template) return null;
    return {
      id: template.id,
      primaryColor: template.primaryColor,
      logoUrl: template.logoUrl,
      signatureUrl: template.signatureUrl,
      chemistName: template.chemistName,
      chemistCedula: template.chemistCedula,
    };
  }

  async getOrCreateQrToken(templateId: number): Promise<string> {
    const existing = await this.tx.orderReport.findFirst({
      where: { orderId: this.orderId, tenantId: this.tenantId },
    });
    if (existing) return existing.qrToken;

    const created = await this.tx.orderReport.create({
      data: {
        tenantId: this.tenantId,
        orderId: this.orderId,
        templateId,
        qrToken: randomBytes(16).toString('hex'),
      },
    });
    return created.qrToken;
  }

  async markDelivered(deliveredAt: Date): Promise<void> {
    await this.tx.order.update({ where: { id: this.orderId }, data: { resultsDeliveredAt: deliveredAt } });
  }
}

@Injectable()
export class ReportesPrismaRepository implements ReportesRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(tenantId: number, orderId: number, work: (unit: ReleaseUnit) => Promise<T>): Promise<T> {
    const prisma = this.prisma;
    async function inTransaction(tx: Prisma.TransactionClient): Promise<T> {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
      return work(new PrismaReleaseUnit(tx, tenantId, orderId));
    }
    return prisma.$transaction(inTransaction, { timeout: 60000 });
  }

  async findVerified(token: string): Promise<VerifiedReport | null> {
    const report = await this.prisma.orderReport.findUnique({
      where: { qrToken: token },
      include: { order: { include: { patient: true } }, tenant: true },
    });
    if (!report) return null;
    return {
      laboratory: report.tenant.name,
      patient: `${report.order.patient.firstName} ${report.order.patient.lastName}`,
      issuedAt: report.createdAt,
    };
  }
}
