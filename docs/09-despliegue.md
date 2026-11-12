# 09. Despliegue

Esta guía describe las rutas de despliegue que sí están configuradas en el repositorio: Docker Compose para servicios locales y Railway para la demo. No hay evidencia suficiente para afirmar que exista un proceso de producción.

## Artefactos de despliegue

| Archivo | Función observada |
|---|---|
| `docker-compose.yaml` | Levanta MySQL y servicios de la aplicación según la configuración Compose |
| `backend/Dockerfile` | Imagen del backend Node 22 e instalación/preparación de Chromium requerido por Puppeteer |
| `frontend/Dockerfile` | Construye frontend con Node 22 y lo sirve con `nginx:1.27-alpine` |
| `frontend/nginx.conf` | Configuración del servidor estático/proxy del frontend |
| `RAILWAY.md` | Instrucciones de despliegue de demo en Railway |

## Docker Compose

Desde la raíz:

```bash
docker compose up --build
```

Consulte `docker-compose.yaml` para nombres de servicios, puertos y variables exactas. La configuración predeterminada incluye una contraseña MySQL de desarrollo y publica el puerto 3306; no debe exponerse sin revisión. El backend depende del healthcheck de `db` y arranca con `npm run db:preparar && npm start`, que sincroniza el esquema y puede cargar el seed demo si la base está vacía.

## Railway

`RAILWAY.md` describe la demo asociada a la rama `integracion`, la conexión backend-MySQL por URL privada y el health endpoint `/api/health`. Según ese documento, la plataforma requiere configurar las variables del backend y ejecutar sincronización del esquema antes de iniciar la demo. El documento indica que el seed debe ejecutarse solo en una DB demo nueva. Los pasos exactos y el comando completo deben seguirse desde `RAILWAY.md`, que es la fuente operativa del repositorio.

La secuencia documentada usa Prisma `db push`, no una carpeta de migraciones versionadas (`backend/prisma/migrations` no existe en el inventario revisado). `db push` puede cambiar el esquema; nunca lo ejecute sin respaldo y una revisión de compatibilidad. Por confirmar: si el proyecto mantiene otro mecanismo de migraciones fuera del repositorio.

## Variables por entorno y healthcheck

Las variables identificadas son `DATABASE_URL`, `PORT`, `ORIGENES_PERMITIDOS`, `VITE_API_URL`, `VITE_TENANT_ID` y variables de Compose como `MYSQL_ROOT_PASSWORD`; véase [02-requisitos.md](02-requisitos.md). El endpoint de salud implementado es `GET /api/health` en `backend/src/health/health.controller.ts` (verifique la ruta y prefijo global en `backend/src/configurar-app.ts`).

El handler consulta `tenant.count()` y devuelve `tenantsRegistrados`; por eso comprueba acceso a MySQL además de responder a la plataforma. Si falla la consulta, responde con error HTTP 500 (`backend/src/health/health.controller.ts`). `RAILWAY.md` configura este endpoint como healthcheck de backend.

## Checklist antes de una publicación

- Separar variables de demo y de producción; almacenar secretos fuera del repositorio.
- Confirmar disponibilidad, respaldo y acceso restringido a MySQL.
- Revisar que `ORIGENES_PERMITIDOS` incluya únicamente los orígenes esperados.
- Revisar autenticación/identidad: el repositorio usa encabezados de demo confiados por el servidor; véase [06-seguridad.md](06-seguridad.md).
- Probar generación de PDF y disponibilidad de Chromium dentro de la imagen backend.
- Inspeccionar el diff de esquema y probarlo sobre una copia antes de `prisma db push`.
- Confirmar que no se cargan datos de demostración en una base real.
- Verificar `GET /api/health`, build de ambos paquetes y pruebas seguras para el entorno.
- Acordar plan de reversión y responsable operativo.

Por confirmar: dominio/HTTPS, estrategia de rollback, plataforma de producción, retención de backups, alertas y responsables de guardia. No se encontró workflow de CI/CD en `.github/workflows/` ni configuración verificable de un proveedor distinto a Railway.
