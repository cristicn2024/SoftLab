import { ErrorDeDominio } from '../../../comun/errores';
import { CancelledOrderError, InvalidChannelError, ReleaseOrderNotFoundError, ReportGenerationError } from './reportes.errors';
import type { PdfRenderer, ReleaseUnit, ReportesRepository } from './reportes.repository';
import type {
  Actor,
  Channel,
  ReleaseOrder,
  ReleaseResult,
  ReportOrder,
  ReportPdfData,
  ReportTemplateData,
  VerifiedReport,
} from './reportes.types';

const CHANNELS: string[] = ['counter', 'email', 'portal', 'print'];
const MAX_REASON_LENGTH = 1000;

function cents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

function pesos(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2);
}

export function parseChannel(raw: unknown): Channel {
  const channel = raw ?? 'counter';
  if (typeof channel !== 'string' || !CHANNELS.includes(channel)) throw new InvalidChannelError();
  return channel as Channel;
}

export function pendingBalance(order: ReleaseOrder): number {
  let subtotal = 0;
  for (const price of order.itemPrices) subtotal += cents(price);
  const total = subtotal - Math.round((subtotal * order.discountPercent) / 100);
  let paid = 0;
  for (const payment of order.payments) {
    if (!payment.cancelled) paid += cents(payment.amount);
  }
  return Math.max(total - paid, 0);
}

export function buildPdfData(
  order: ReportOrder,
  template: ReportTemplateData,
  qrToken: string,
  today: Date,
): ReportPdfData {
  const items: ReportPdfData['resultsByArea'][number]['items'] = [];
  for (const item of order.items) {
    items.push({
      testName: item.testName ?? item.profileName ?? 'Concepto sin nombre',
      resultValue: item.resultValue || 'N/A',
      units: 'mg/dL',
      referenceRange: item.referenceRange || 'Normal',
      flag: item.isAlert ? 'HIGH' : 'NORMAL',
    });
  }

  return {
    tenantName: order.tenantName,
    subdomain: order.tenantSubdomain,
    orderId: order.id,
    folio: order.folio ?? `ORD-${order.id.toString().padStart(6, '0')}`,
    createdAt: order.createdAt,
    patient: {
      fullName: `${order.patient.firstName} ${order.patient.lastName}`,
      ageYears: today.getFullYear() - new Date(order.patient.birthDate).getFullYear(),
      gender: order.patient.gender,
      patientId: order.patient.id,
    },
    doctorName: order.doctorName ? `Dr. ${order.doctorName}` : 'Particular',
    template: {
      primaryColor: template.primaryColor,
      logoUrl: template.logoUrl || undefined,
      signatureUrl: template.signatureUrl || undefined,
      chemistName: template.chemistName || undefined,
      chemistCedula: template.chemistCedula || undefined,
    },
    resultsByArea: [{ areaName: 'LABORATORIO CLÍNICO GENERAL', items }],
    qrToken,
  };
}

export class ReportesService {
  constructor(
    private readonly repository: ReportesRepository,
    private readonly renderer: PdfRenderer,
  ) {}

  async release(
    actor: Actor,
    orderId: number,
    rawChannel: unknown,
    rawReason: unknown,
    now: Date = new Date(),
  ): Promise<ReleaseResult> {
    const channel = parseChannel(rawChannel);
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    const renderer = this.renderer;

    async function work(unit: ReleaseUnit): Promise<ReleaseResult> {
      const order = await unit.findOrder();
      if (!order) throw new ReleaseOrderNotFoundError();
      if (order.status === 'cancelled') throw new CancelledOrderError();

      const balance = pendingBalance(order);
      if (balance > 0 && (!actor.isAdmin || !reason || reason.length > MAX_REASON_LENGTH)) {
        await unit.log(actor.name, 'Entrega bloqueada', `Canal: ${channel} · Saldo: $${pesos(balance)}`);
        return {
          kind: 'blocked',
          message: `Entrega bloqueada. Saldo pendiente: $${pesos(balance)}.`,
          balance: pesos(balance),
          paymentUrl: `/ordenes/cobro?orden=${orderId}`,
        };
      }

      const reportOrder = await unit.findReportOrder();
      if (!reportOrder) throw new Error('Orden no encontrada');
      const template = await unit.findDefaultTemplate();
      if (!template) throw new Error('Configura una plantilla predeterminada para emitir informes');
      const qrToken = await unit.getOrCreateQrToken(template.id);
      const buffer = await renderer.render(buildPdfData(reportOrder, template, qrToken, now));

      if (balance > 0) {
        await unit.log(
          actor.name,
          'Excepción de entrega autorizada',
          `Canal: ${channel} · Saldo: $${pesos(balance)} · Motivo: ${reason}`,
        );
      }
      await unit.markDelivered(order.resultsDeliveredAt ?? now);
      await unit.log(actor.name, 'Resultados entregados', `Canal: ${channel}`);
      return { kind: 'released', buffer };
    }

    try {
      return await this.repository.transaction(actor.tenantId, orderId, work);
    } catch (error) {
      if (error instanceof ErrorDeDominio) throw error;
      console.error(error);
      throw new ReportGenerationError();
    }
  }

  verify(token: string): Promise<VerifiedReport | null> {
    return this.repository.findVerified(token);
  }
}
