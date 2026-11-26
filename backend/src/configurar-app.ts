import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, type Request, type Response, type NextFunction } from 'express';
import { DominioExceptionFilter } from './comun/filtros/dominio.filter';
import { HttpExceptionFilter } from './comun/filtros/http.filter';
import { RegistroMiddleware } from './comun/middleware/registro.middleware';

function origenesPermitidos() {
  const locales = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://localhost:8080';
  return (process.env.ORIGENES_PERMITIDOS ?? locales).split(',').map(s => s.trim()).filter(Boolean);
}

function configurarSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('SoftLab API')
    .setDescription('Sistema de gestión para laboratorios clínicos pequeños')
    .setVersion('1.0')
    .addCookieAuth('softlab_sesion')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}

export function configurarApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  const origin = origenesPermitidos();
  app.enableCors({ origin, credentials: true, exposedHeaders: ['Location', 'X-Request-Id'] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const sitio = req.headers.origin;
    if (sitio && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        !origin.includes(sitio) && sitio !== req.protocol + '://' + req.get('host')) {
      res.sendStatus(403);
      return;
    }
    next();
  });

  const registro = new RegistroMiddleware();
  app.use(registro.use.bind(registro));
  app.use(json());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(), new DominioExceptionFilter());

  configurarSwagger(app);
}
