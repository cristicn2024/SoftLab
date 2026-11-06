import { Module } from '@nestjs/common';
import { OrdenesService } from './dominio/ordenes.service';
import type { OrdenesRepository } from './dominio/ordenes.repository';
import { OrdenesPrismaRepository } from './infra/ordenes-prisma.repository';
import { OrdenesController } from './ordenes.controller';
import { ORDENES_REPOSITORY } from './ordenes.tokens';

function crearServicio(repositorio: OrdenesRepository) {
  return new OrdenesService(repositorio);
}

@Module({
  controllers: [OrdenesController],
  providers: [
    { provide: ORDENES_REPOSITORY, useClass: OrdenesPrismaRepository },
    { provide: OrdenesService, useFactory: crearServicio, inject: [ORDENES_REPOSITORY] },
  ],
})
export class OrdenesModule {}
