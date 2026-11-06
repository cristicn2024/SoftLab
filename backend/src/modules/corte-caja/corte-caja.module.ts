import { Module } from '@nestjs/common';
import { CorteCajaController } from './corte-caja.controller';
import type { CorteCajaRepository } from './dominio/corte-caja.repository';
import { CorteCajaService } from './dominio/corte-caja.service';
import { CorteCajaPrismaRepository } from './infra/corte-caja-prisma.repository';
import { CORTE_CAJA_REPOSITORY } from './corte-caja.tokens';

function crearServicio(repositorio: CorteCajaRepository) {
  return new CorteCajaService(repositorio);
}

/**
 * @author Jesús Rodrigo Villegas Argüelles - 261186
 */
@Module({
  controllers: [CorteCajaController],
  providers: [
    { provide: CORTE_CAJA_REPOSITORY, useClass: CorteCajaPrismaRepository },
    { provide: CorteCajaService, useFactory: crearServicio, inject: [CORTE_CAJA_REPOSITORY] },
  ],
})
export class CorteCajaModule {}
