import { Module } from '@nestjs/common';
import { ReportesService } from './dominio/reportes.service';
import type { PdfRenderer, ReportesRepository } from './dominio/reportes.repository';
import { PdfPuppeteerRenderer } from './infra/pdf-puppeteer.renderer';
import { ReportesPrismaRepository } from './infra/reportes-prisma.repository';
import { ReportesController } from './reportes.controller';
import { REPORTES_PDF_RENDERER, REPORTES_REPOSITORY } from './reportes.tokens';

function crearServicio(repositorio: ReportesRepository, generador: PdfRenderer) {
  return new ReportesService(repositorio, generador);
}

@Module({
  controllers: [ReportesController],
  providers: [
    { provide: REPORTES_REPOSITORY, useClass: ReportesPrismaRepository },
    { provide: REPORTES_PDF_RENDERER, useClass: PdfPuppeteerRenderer },
    { provide: ReportesService, useFactory: crearServicio, inject: [REPORTES_REPOSITORY, REPORTES_PDF_RENDERER] },
  ],
})
export class ReportesModule {}
