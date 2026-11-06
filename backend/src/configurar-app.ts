import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import { SesionPorEncabezadosGuard } from './auth/guards/sesion-por-encabezados.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { DominioExceptionFilter } from './comun/filtros/dominio.filter';
import { HttpExceptionFilter } from './comun/filtros/http.filter';
import { RegistroMiddleware } from './comun/middleware/registro.middleware';

function opcionesDeCors() {
  const expuestos = ['Location', 'X-Request-Id'];
  const configurados = process.env.ORIGENES_PERMITIDOS;
  if (!configurados) return { exposedHeaders: expuestos };

  const origenes: string[] = [];
  for (const origen of configurados.split(',')) {
    origenes.push(origen.trim());
  }
  return {
    origin: origenes,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    exposedHeaders: expuestos,
  };
}

function configurarSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('SoftLab API')
    .setDescription('Sistema de gestión para laboratorios clínicos pequeños')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'tenant')
    .addSecurityRequirements('tenant')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}

export function configurarApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  app.enableCors(opcionesDeCors());

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

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new SesionPorEncabezadosGuard(reflector), new RolesGuard(reflector));

  configurarSwagger(app);
}
