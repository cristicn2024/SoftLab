import { Module } from '@nestjs/common';
import { PlantillasService } from './dominio/plantillas.service';
import type { PlantillasRepository } from './dominio/plantillas.repository';
import { PlantillasPrismaRepository } from './infra/plantillas-prisma.repository';
import { PlantillasController } from './plantillas.controller';
import { PLANTILLAS_REPOSITORY } from './plantillas.tokens';

function crearServicio(repositorio: PlantillasRepository) {
  return new PlantillasService(repositorio);
}

@Module({
  controllers: [PlantillasController],
  providers: [
    { provide: PLANTILLAS_REPOSITORY, useClass: PlantillasPrismaRepository },
    { provide: PlantillasService, useFactory: crearServicio, inject: [PLANTILLAS_REPOSITORY] },
  ],
})
export class PlantillasModule {}
