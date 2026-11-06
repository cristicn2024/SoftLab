import { Module } from '@nestjs/common';
import { CobroService } from './dominio/cobro.service';
import type { CobroRepository } from './dominio/cobro.repository';
import { CobroPrismaRepository } from './infra/cobro-prisma.repository';
import { CobroController } from './cobro.controller';
import { COBRO_REPOSITORY } from './cobro.tokens';

function crearServicio(repositorio: CobroRepository) {
  return new CobroService(repositorio);
}

@Module({
  controllers: [CobroController],
  providers: [
    { provide: COBRO_REPOSITORY, useClass: CobroPrismaRepository },
    { provide: CobroService, useFactory: crearServicio, inject: [COBRO_REPOSITORY] },
  ],
})
export class CobroModule {}
