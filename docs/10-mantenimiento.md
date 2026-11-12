# 10. Mantenimiento

Este documento resume las tareas de mantenimiento que se pueden derivar de la estructura y scripts actuales. No se encontró un manual operativo completo; los procedimientos no descritos quedan marcados como pendientes de confirmar.

## Actualizar dependencias

Backend y frontend mantienen manifiestos y lockfiles separados (`backend/package.json`, `backend/package-lock.json`, `frontend/package.json`, `frontend/package-lock.json`). Para una instalación reproducible, use `npm ci` en cada carpeta. Revise los cambios de lockfile y ejecute build/lint/pruebas que sean seguras para el entorno antes de fusionar. No actualice dependencias directamente en producción.

Los scripts disponibles están en los respectivos `package.json`; el frontend tiene `lint`, `build` y `test`, mientras backend tiene `build` y varios grupos de test. No se encontró un flujo CI activo que los ejecute automáticamente. Por confirmar: calendario de actualizaciones, política de versiones y proceso de aprobación de dependencias.

## Respaldos, monitoreo y logs

La aplicación usa MySQL y escribe logs del backend por medio de NestJS/Express (`backend/src/main.ts`, `backend/src/configurar-app.ts`). No se encontró documentación de rotación de logs, agregador, métricas, alertas, RPO/RTO ni procedimiento de restauración. **Por confirmar:** herramientas y responsables de observabilidad y respaldo.

No se debe asumir que `db:reset` o `db:seed` sean procedimientos de recuperación: `backend/package.json` muestra que el primero fuerza el reset del esquema, y el segundo repuebla datos demo.

## Agregar un módulo o endpoint

1. Defina qué dominio posee los datos y revise el modelo en `backend/prisma/schema.prisma` antes de cambiar el esquema.
2. Añada la lógica y tipos/validaciones al módulo backend apropiado, siguiendo la organización en `backend/src/modules/` (controllers, servicios/repositorios/DTOs donde existan).
3. Registre el controlador o la ruta en la composición de `backend/src/app.module.ts` y revise guards globales y validación en `backend/src/configurar-app.ts`.
4. Si requiere persistencia, cambie el schema Prisma y regenere el cliente con el comando definido en `backend/package.json`. No se observaron migraciones versionadas; cualquier `db push` debe revisarse cuidadosamente.
5. Añada pruebas unitarias con repositorios fake cuando la lógica lo permita. Las pruebas HTTP están bajo suites Nest; las pruebas de integración con Prisma deben usar una base desechable.
6. Añada/actualice la llamada API y tipos del cliente en `frontend/src/compartido/` o el feature correspondiente, y conecte la vista/ruta según `frontend/src/App.tsx`.
7. Agregue estados de carga/error y validación del formulario de acuerdo con los features existentes, y ejecute las comprobaciones seguras descritas en [08-pruebas.md](08-pruebas.md).

Como referencia de consistencia de extremo a extremo, revise el flujo de órdenes y captura de resultados entre `backend/src/modules/ordenes/`, `backend/src/modules/lista-trabajo/` y sus features en `frontend/src/features/`. No se confirma que sea la mejor práctica arquitectónica: el repositorio tiene acceso compartido a modelos y patrones heterogéneos.

## Convenciones y contribución

Se observan nombres de módulos backend en español, DTOs validados con `class-validator`, persistencia mediante Prisma, rutas agrupadas por controllers y features frontend con React/TypeScript. Los nombres concretos y las convenciones por capa están explicados en [03-arquitectura.md](03-arquitectura.md).

No se encontró `CONTRIBUTING.md`, plantilla de pull request, política de ramas o workflow CI. `RAILWAY.md` refiere una rama `integracion` para la demo, pero no basta para inferir el proceso de contribución completo. **Por confirmar:** formato de PR, revisores requeridos, estrategia de ramas y reglas de release.

## Deuda técnica conocida

El repositorio incluye un informe específico de auditoría con defectos, evidencia, severidad y propuestas: [docs/DEFECTOS.md](DEFECTOS.md). Revíselo antes de planear cambios; este manual no reproduce ese contenido.

Temas estructurales visibles que requieren coordinación: autenticación basada en headers de demo, aislamiento tenant aplicado en consultas y no como credencial, falta de migraciones versionadas y ejecución de seeds/demos en scripts de desarrollo. Los detalles y limitaciones están en `06-seguridad.md`, `04-base-de-datos.md` y `07-instalacion.md`.

Por confirmar: propietario técnico por módulo, calendario de mantenimiento, clasificación priorizada de deuda y política para cerrar hallazgos de `DEFECTOS.md`.
