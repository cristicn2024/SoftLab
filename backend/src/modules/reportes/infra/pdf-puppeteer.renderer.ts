import { Injectable } from '@nestjs/common';
import { generateReportPDF } from './pdf.service';
import type { PdfRenderer } from '../dominio/reportes.repository';
import type { ReportPdfData } from '../dominio/reportes.types';

@Injectable()
export class PdfPuppeteerRenderer implements PdfRenderer {
  render(data: ReportPdfData): Promise<Buffer> {
    return generateReportPDF(data);
  }
}
