import type { PdfRenderer, ReleaseUnit, ReportesRepository } from './reportes.repository';
import type {
  ReleaseOrder,
  ReportOrder,
  ReportPdfData,
  ReportTemplateData,
  VerifiedReport,
} from './reportes.types';

export interface StoredOrder {
  release: ReleaseOrder;
  report: ReportOrder;
  qrToken: string | null;
  delivered: Date | null;
}

export interface LogEntry {
  tenantId: number;
  orderId: number;
  userName: string;
  action: string;
  detail: string;
}

export function releaseOrder(id: number, overrides: Partial<ReleaseOrder> = {}): ReleaseOrder {
  return {
    id,
    status: 'completed',
    discountPercent: 0,
    resultsDeliveredAt: null,
    itemPrices: [100],
    payments: [],
    ...overrides,
  };
}

export function reportOrder(id: number): ReportOrder {
  return {
    id,
    folio: `SL-${id}`,
    createdAt: new Date(2026, 10, 3, 9, 0),
    tenantName: 'Laboratorio QA',
    tenantSubdomain: 'qa',
    patient: { id: id * 10, firstName: 'Paciente', lastName: `Orden ${id}`, birthDate: new Date(1990, 5, 15), gender: 'F' },
    doctorName: null,
    items: [
      { testName: 'Glucosa', profileName: null, referenceRange: '70 - 99', resultValue: '90', isAlert: false },
      { testName: null, profileName: 'Perfil lipídico', referenceRange: null, resultValue: null, isAlert: true },
      { testName: null, profileName: null, referenceRange: null, resultValue: null, isAlert: false },
    ],
  };
}

export const TEMPLATE: ReportTemplateData = {
  id: 77,
  primaryColor: '#0f766e',
  logoUrl: null,
  signatureUrl: 'firma.png',
  chemistName: 'Laura Méndez',
  chemistCedula: '10458392',
};

export class FakeRenderer implements PdfRenderer {
  readonly received: ReportPdfData[] = [];
  failWith: Error | null = null;

  async render(data: ReportPdfData): Promise<Buffer> {
    if (this.failWith) throw this.failWith;
    this.received.push(data);
    return Buffer.from('pdf');
  }
}

export class FakeRepository implements ReportesRepository {
  readonly logs: LogEntry[] = [];
  readonly orders = new Map<string, StoredOrder>();
  template: ReportTemplateData | null = TEMPLATE;
  readonly verified = new Map<string, VerifiedReport>();

  add(tenantId: number, release: ReleaseOrder) {
    this.orders.set(`${tenantId}:${release.id}`, {
      release,
      report: reportOrder(release.id),
      qrToken: null,
      delivered: release.resultsDeliveredAt,
    });
  }

  stored(tenantId: number, orderId: number): StoredOrder | undefined {
    return this.orders.get(`${tenantId}:${orderId}`);
  }

  async transaction<T>(tenantId: number, orderId: number, work: (unit: ReleaseUnit) => Promise<T>): Promise<T> {
    const logsBefore = this.logs.length;
    const stored = this.stored(tenantId, orderId);
    const tokenBefore = stored ? stored.qrToken : null;
    const deliveredBefore = stored ? stored.delivered : null;
    const repository = this;

    const unit: ReleaseUnit = {
      async findOrder() {
        return stored ? stored.release : null;
      },
      async log(userName, action, detail) {
        repository.logs.push({ tenantId, orderId, userName, action, detail });
      },
      async findReportOrder() {
        return stored ? stored.report : null;
      },
      async findDefaultTemplate() {
        return repository.template;
      },
      async getOrCreateQrToken() {
        if (stored && stored.qrToken === null) stored.qrToken = `token-${orderId}`;
        return stored ? (stored.qrToken as string) : '';
      },
      async markDelivered(deliveredAt) {
        if (stored) stored.delivered = deliveredAt;
      },
    };

    try {
      return await work(unit);
    } catch (error) {
      this.logs.length = logsBefore;
      if (stored) {
        stored.qrToken = tokenBefore;
        stored.delivered = deliveredBefore;
      }
      throw error;
    }
  }

  async findVerified(token: string): Promise<VerifiedReport | null> {
    return this.verified.get(token) ?? null;
  }
}
