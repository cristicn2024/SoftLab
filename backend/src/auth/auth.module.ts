import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IntentosService } from './intentos.service';
import { SesionGuard } from './guards/sesion.guard';

@Module({
  imports: [PrismaModule], controllers: [AuthController], providers: [
    AuthService, IntentosService, SesionGuard, { provide: APP_GUARD, useExisting: SesionGuard },
  ],
})
export class AuthModule {}
