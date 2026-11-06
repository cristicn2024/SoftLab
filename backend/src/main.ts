import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  configurarApp(app);

  const puerto = process.env.PORT ?? 4000;
  await app.listen(puerto);
  console.log(`Servidor de Softlab corriendo en http://localhost:${puerto}`);
}
bootstrap();
