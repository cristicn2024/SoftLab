import { Module } from '@nestjs/common';
import { WorklistService } from './dominio/worklist.service';
import type { WorklistRepository } from './dominio/worklist.repository';
import { WorklistPrismaRepository } from './infra/worklist-prisma.repository';
import { WorklistController } from './worklist.controller';
import { WORKLIST_REPOSITORY } from './worklist.tokens';

function crearServicio(repositorio: WorklistRepository) {
  return new WorklistService(repositorio);
}

@Module({
  controllers: [WorklistController],
  providers: [
    { provide: WORKLIST_REPOSITORY, useClass: WorklistPrismaRepository },
    { provide: WorklistService, useFactory: crearServicio, inject: [WORKLIST_REPOSITORY] },
  ],
})
export class WorklistModule {}
