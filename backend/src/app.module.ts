import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { WorklistModule } from './modules/worklist/worklist.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, WorklistModule],
})
export class AppModule {}
