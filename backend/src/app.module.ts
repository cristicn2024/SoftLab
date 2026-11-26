import { ReferenciasModule } from './modules/referencias/referencias.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { ExternosModule } from './modules/externos/externos.module';
import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { CorteCajaModule } from './modules/corte-caja/corte-caja.module';
import { CobroModule } from './modules/cobro/cobro.module';
import { PlantillasModule } from './modules/plantillas/plantillas.module';
import { OrdenesModule } from './modules/ordenes/ordenes.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { WorklistModule } from './modules/worklist/worklist.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ReferenciasModule, CatalogoModule, ExternosModule, PrismaModule, HealthModule, WorklistModule, CobroModule, PlantillasModule, ReportesModule, OrdenesModule, CorteCajaModule],
  imports: [AuthModule, ReferenciasModule, CatalogoModule, PrismaModule, HealthModule, WorklistModule, CobroModule, PlantillasModule, ReportesModule, OrdenesModule, CorteCajaModule],
})
export class AppModule {}

