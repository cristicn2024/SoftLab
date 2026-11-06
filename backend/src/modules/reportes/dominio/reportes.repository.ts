import type { ReleaseOrder, ReportOrder, ReportPdfData, ReportTemplateData, VerifiedReport } from './reportes.types';

export interface ReleaseUnit {
  findOrder(): Promise<ReleaseOrder | null>;
  log(userName: string, action: string, detail: string): Promise<void>;
  findReportOrder(): Promise<ReportOrder | null>;
  findDefaultTemplate(): Promise<ReportTemplateData | null>;
  getOrCreateQrToken(templateId: number): Promise<string>;
  markDelivered(deliveredAt: Date): Promise<void>;
}

export interface ReportesRepository {
  transaction<T>(tenantId: number, orderId: number, work: (unit: ReleaseUnit) => Promise<T>): Promise<T>;
  findVerified(token: string): Promise<VerifiedReport | null>;
}

export interface PdfRenderer {
  render(data: ReportPdfData): Promise<Buffer>;
}
