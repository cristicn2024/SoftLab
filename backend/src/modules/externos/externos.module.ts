import { Module } from '@nestjs/common';
import type { ExternosRepository } from './dominio/externos.repository';
import { ExternosService } from './dominio/externos.service';
import { ExternosController } from './externos.controller';
import { EXTERNOS_REPOSITORY } from './externos.tokens';
import { ExternosPrismaRepository } from './infra/externos-prisma.repository';

function crearServicio(repositorio: ExternosRepository) {
  return new ExternosService(repositorio);
}

@Module({
  controllers: [ExternosController],
  providers: [
    { provide: EXTERNOS_REPOSITORY, useClass: ExternosPrismaRepository },
    { provide: ExternosService, useFactory: crearServicio, inject: [EXTERNOS_REPOSITORY] },
  ],
})
export class ExternosModule {}
