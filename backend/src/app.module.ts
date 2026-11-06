import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { CobroModule } from './modules/cobro/cobro.module';
import { WorklistModule } from './modules/worklist/worklist.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, WorklistModule, CobroModule],
})
export class AppModule {}
