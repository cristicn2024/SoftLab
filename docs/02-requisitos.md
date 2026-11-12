# 02. Requisitos

Este documento enumera requisitos funcionales observables, requisitos técnicos y variables de entorno necesarias para ejecutar los proyectos. Las versiones son las declaradas en manifiestos o imágenes, no garantías de compatibilidad fuera de esas declaraciones.

## Requisitos funcionales

| Módulo/área | Requisito respaldado por el código |
|---|---|
| Órdenes | Buscar estudios/perfiles por código o nombre, consultar si un paciente tiene orden pendiente del día, registrar médico express y crear orden. `backend/src/modules/ordenes/ordenes.controller.ts`. |
| Worklist | Listar órdenes con muestras recibidas; mostrar paciente, muestras, parámetros pendientes y rangos; validar y guardar resultados por parámetro. `backend/src/modules/worklist/`. |
| Cobro | Consultar líneas, subtotal, descuento, total, pagos, saldo y bitácora; aceptar efectivo/tarjeta/transferencia; validar referencias de pagos no efectivo; manejar datos de factura; anular pagos con motivo. `backend/src/modules/cobro/`. |
| Corte de caja | Obtener contexto de laboratorio/sucursal/cajeros/turnos; calcular resumen del período; cerrar corte con efectivo contado; exigir observación ante diferencia; consultar historial y exportar CSV. `backend/src/modules/corte-caja/`. |
| Plantillas | Consultar activa e historial; guardar nueva versión y hacerla predeterminada. `backend/src/modules/plantillas/`. |
| Reportes | Emitir PDF, registrar liberación y permitir verificar un token QR; bloquear saldo, salvo excepción con rol administrativo según el mecanismo actual. `backend/src/modules/reportes/`. |
| Salud | Exponer `/api/health` con comprobación de consulta a MySQL. `backend/src/health/health.controller.ts`. |

Indicaciones de preparación, notificación crítica, administración completa de pacientes/catálogos, login y envío real de correo/portal aparecen como conceptos o datos en documentación/esquema, pero no se verifican como flujos API completos. Por confirmar: alcance aprobado de esas funciones.

## Requisitos no funcionales observables

- API REST sobre HTTP mediante NestJS y Express; prefijo global `/api` (`backend/src/configurar-app.ts`).
- Persistencia relacional MySQL mediante Prisma (`backend/prisma/schema.prisma`).
- Separación lógica por `tenantId`; la aplicación privada exige `x-tenant-id` (`backend/src/auth/guards/sesion-por-encabezados.guard.ts`).
- Los datos monetarios se modelan como `Decimal`; algunos cálculos convierten a centavos en las reglas de cobro.
- Generación PDF con Chromium/Puppeteer. El Dockerfile del backend instala Chromium (`backend/Dockerfile`).
- Frontend servido por Nginx en el contenedor y configuración SPA de fallback en `frontend/nginx.conf`.
- El middleware registra método, URL, estado, duración e ID de solicitud en `backend/src/comun/middleware/registro.middleware.ts`.
- No se encontraron requisitos medidos de disponibilidad, RPO/RTO, límites de carga, retención, copias de seguridad o SLA. **Por confirmar:** valores con el equipo/operación.

## Versiones y dependencias

Las versiones en `package.json` son rangos semver. Los lockfiles (`backend/package-lock.json`, `frontend/package-lock.json`) determinan las resoluciones de instalación.

| Componente | Versión/rango declarado | Evidencia |
|---|---|---|
| Node para desarrollo | Node 20 o posterior | `README.md`. |
| Node en Docker | `node:22-bookworm-slim` en backend y etapa de build frontend | `backend/Dockerfile`, `frontend/Dockerfile`. |
| MySQL | `mysql:8.0` | `docker-compose.yaml`. |
| NestJS | `^11.2.8` (common/core/platform-express); Swagger `^11.4.8` | `backend/package.json`. |
| Prisma | Cliente y CLI `^6.19.3` | `backend/package.json`. Existe `backend/prisma7.config.ts`; compatibilidad/uso real de ese archivo con Prisma 6 queda **por confirmar**. |
| Backend TypeScript | `~5.9.3` | `backend/package.json`. |
| React / React DOM | `^19.3.1` | `frontend/package.json`. |
| React Router | `^7.18.4` | `frontend/package.json`. |
| Vite | `^8.3.4`; plugin React `^6.1.2` | `frontend/package.json`. |
| Frontend TypeScript | `~6.0.3` | `frontend/package.json`. |
| Cliente HTTP | Axios `^1.20.0` | `frontend/package.json`. |
| Validación backend | `class-validator ^0.15.1`, `class-transformer ^0.5.1` | `backend/package.json`. |
| Tests | Vitest `^5.1.0`; Jest `^30.5.2`; tsx `^4.23.15` | Ambos `package.json`. |
| PDF | Puppeteer `^25.16.0`, `qrcode ^1.5.4` | `backend/package.json`. |
| Nginx | `nginx:1.27-alpine` | `frontend/Dockerfile`. |

No encontré `.nvmrc`, `engines` en `package.json` ni versión de npm fijada. El repositorio usa npm y conserva lockfiles.

## Variables de entorno

Ejemplos abajo usan placeholders deliberados; no son credenciales reales. Las variables Vite se insertan al compilar el frontend y requieren reconstrucción/despliegue para cambiar su valor.

| Variable | Proceso | Obligatoria | Descripción / ejemplo seguro |
|---|---|---:|---|
| `DATABASE_URL` | Backend/Prisma | Sí | DSN MySQL. Ejemplo: `mysql://USUARIO:CAMBIAR_EN_LOCAL@localhost:3306/softlab_db`. En Compose el host de backend es `db`; en Railway se documenta referenciar la URL privada del servicio MySQL. |
| `PORT` | Backend | No | Puerto HTTP; predeterminado `4000` en `backend/src/main.ts`. Ejemplo: `4000`. |
| `ORIGENES_PERMITIDOS` | Backend | Recomendable | Lista separada por comas que configura CORS. Ejemplo local: `http://localhost:5173,http://localhost:8080`. Si no se especifica, CORS queda con el comportamiento por defecto del middleware; ver `backend/src/configurar-app.ts`. |
| `MYSQL_ROOT_PASSWORD` | Docker Compose | No en Compose; requerido para credencial propia | Contraseña usada por el servicio MySQL y el backend. Compose incluye un valor por defecto de conveniencia; reemplazarlo con un valor privado antes de cualquier entorno compartido. No copiar contraseñas reales a documentación. |
| `VITE_API_URL` | Compilación frontend | No | Base de la API; predeterminada `http://localhost:4000/api`. Ejemplo desplegado: `https://api.ejemplo.invalid/api`. |
| `VITE_TENANT_ID` | Compilación frontend | No | ID del tenant que se manda como `x-tenant-id`; predeterminado `1`. Ejemplo de demo: `1`. No es un secreto ni prueba identidad. |
| `PUPPETEER_SKIP_DOWNLOAD` | Docker backend | Definida por Dockerfile | Se establece en `true` para usar Chromium del sistema. |
| `PUPPETEER_EXECUTABLE_PATH` | Docker backend | Definida por Dockerfile | Ruta a Chromium: `/usr/bin/chromium`. |

Railway documenta una variable `MYSQL_URL` provista por el servicio MySQL y el mapeo de `DATABASE_URL` a esa URL (`RAILWAY.md`). Por confirmar: nombre exacto y formato disponibles en cada entorno Railway configurado.
