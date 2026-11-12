# 08. Pruebas

Este documento cataloga los scripts de pruebas y comprobaciones que aparecen en los manifiestos. No se ejecutaron pruebas durante la preparación de esta guía, para respetar la instrucción de no ejecutar suites que puedan escribir en base de datos.

## Backend

Desde `backend/`:

| Script | Comando | Alcance observado | Base de datos |
|---|---|---|---|
| `test` | `npm test` | Node test runner + `tsx` sobre `src/modules/**/*.test.ts`; principalmente pruebas de lógica de dominio | Los fakes identificados no requieren DB; confirmar cada archivo antes de ejecutar |
| `test:nest` | `npm run test:nest` | Jest sobre `**/modules/**/*.spec.ts`, incluye pruebas HTTP con Nest/Supertest | Se observan repositorios falsos en las suites revisadas; por confirmar para nuevas suites |
| `test:screens` | `npm run test:screens` | Pruebas de `src/__tests__/screens/**/*.test.ts` y `*.spec.ts` en serie | Las pruebas de pantallas revisadas pueden usar Prisma/base real; asumir que requieren DB y pueden escribir hasta confirmar lo contrario |
| `test:hu` | `npm run test:hu` | Jest sobre `src/__tests__/*.test.ts`, pruebas de historias de usuario/integración | Hay pruebas que usan Prisma real y crean recursos; pueden modificar DB |
| `test:all` | `npm run test:all` | Ejecuta los cuatro grupos anteriores | **No ejecutar contra una base compartida:** incluye suites con DB real |

Los scripts están definidos en `backend/package.json`. En particular, `src/__tests__/orderCapture.test.ts` y `src/__tests__/templateAndPdf.test.ts` integran Prisma/app real; lea sus setup/cleanup antes de elegir entorno. No se encontró un script separado que cree una base temporal aislada de forma garantizada.

## Frontend

Desde `frontend/`:

| Script | Comando | Alcance |
|---|---|---|
| `test` | `npm test` | Vitest en modo `run`, con configuración de tests del frontend |
| `test:logica` | `npm run test:logica` | Node test runner para lógica de indicaciones, interpretación y captura; archivos enumerados en el script |
| `lint` | `npm run lint` | ESLint sobre `.` |
| `build` | `npm run build` | `tsc -b` seguido de `vite build`; type-check y empaquetado de producción |

Configuración y casos de prueba se encuentran en `frontend/vitest.config.ts` y junto a las features, como `frontend/src/features/orders/indications.test.ts`.

## Cobertura y comprobaciones

No se encontró configuración de cobertura ni script `coverage` en `backend/package.json` o `frontend/package.json`; por tanto, **la cobertura porcentual no está confirmada**. Tampoco se observó script `typecheck` separado: el type-check del frontend forma parte de `build`. En backend, el build habitual es `npm run build` desde `backend/`.

El informe existente [DEFECTOS.md](DEFECTOS.md) registra resultados de una auditoría anterior. Esos resultados no se volvieron a ejecutar para esta documentación y no deben tomarse como ejecución actual. El repositorio tiene pruebas unitarias/lógicas y suites HTTP/integración, pero no se encontró evidencia de una cobertura exhaustiva para todos los módulos.

## Ejecución segura

Antes de correr `test:screens`, `test:hu` o `test:all`, revise sus conexiones en `.env` y configuración de Prisma; use una base desechable aprobada por el equipo. No corra `db:reset`, `db:seed` o scripts de preparación sobre datos que deban conservarse. `backend/package.json` define `db:reset` mediante `prisma db push --force-reset` y `db:seed` ejecuta el seed demo.

Por confirmar: comando aprobado para preparar una base de pruebas aislada, política de limpieza de datos y umbrales de cobertura requeridos en CI.
