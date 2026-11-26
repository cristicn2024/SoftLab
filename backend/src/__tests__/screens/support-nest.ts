import { SesionGuard } from '../../auth/guards/sesion.guard';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { configurarApp } from '../sesion-de-prueba';

export async function construirAppNest(): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SesionGuard).useValue({ canActivate: () => true }).compile();
  const app = modulo.createNestApplication();
  configurarApp(app as never);
  await app.init();
  return app;
}
