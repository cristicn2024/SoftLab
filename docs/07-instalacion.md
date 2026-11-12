# 07. Instalación

Esta guía describe cómo preparar SoftLab para desarrollo local a partir de los archivos del repositorio. Los comandos de arranque del backend pueden crear o cambiar datos en la base; se señalan expresamente.

## Prerrequisitos

| Dependencia | Requisito observado | Evidencia |
|---|---|---|
| Node.js | 20 o superior en el README; las imágenes usan Node 22 | `README.md`, `backend/Dockerfile`, `frontend/Dockerfile` |
| npm | Incluido con Node; no hay versión fijada en `package.json` | `backend/package.json`, `frontend/package.json` |
| MySQL | MySQL 8 | `README.md`, `docker-compose.yaml`, `backend/prisma/schema.prisma` |
| Git | Necesario para clonar | Repositorio |
| Docker/Compose | Opcional, para levantar servicios locales | `docker-compose.yaml` |

No se encontró `.nvmrc`, `engines` en los `package.json` ni archivo de lock global en la raíz. Las versiones concretas están en [02-requisitos.md](02-requisitos.md).

## Clonar e instalar

El remoto configurado en el repositorio es `https://github.com/cristicn2024/SoftLab.git`.

```bash
git clone https://github.com/cristicn2024/SoftLab.git
cd SoftLab
```

Backend:

```bash
cd backend
npm ci
```

Frontend, en otra terminal:

```bash
cd frontend
npm ci
```

Los lockfiles están en `backend/package-lock.json` y `frontend/package-lock.json`.

## Preparar MySQL

La opción local documentada es Compose desde la raíz:

```bash
docker compose up -d db
```

La configuración observada expone MySQL 8 en `3306`, crea `softlab_db`, persiste los datos en el volumen `mysql_data` y define un healthcheck. El valor predeterminado de `MYSQL_ROOT_PASSWORD` está escrito en `docker-compose.yaml` y es inseguro; sustitúyalo antes de exponer el servicio a una red compartida.

También puede usarse una instancia MySQL 8 local o remota; por confirmar: configuración de usuarios, permisos, TLS y respaldos para cada entorno.

## Configurar entorno

Copie `backend/.env.example` a `backend/.env` y reemplace `DATABASE_URL` por la conexión MySQL local. El ejemplo incluye `PORT=4000` y `ORIGENES_PERMITIDOS`. El frontend reconoce `VITE_API_URL` y `VITE_TENANT_ID`; cuando no se definen, los valores por defecto apuntan a API local y tenant `1` (`frontend/src/compartido/api.ts` y configuración frontend relacionada).

No incluya credenciales reales en el repositorio. La tabla completa de variables está en [02-requisitos.md](02-requisitos.md). Por confirmar: si hay un gestor de secretos común para el equipo.

## Arranque en desarrollo

Desde `backend/`:

```bash
npm run dev
```

El script `predev` ejecuta `db:preparar`: crea `.env` desde `.env.example` si falta, genera Prisma, ejecuta `prisma db push --skip-generate` y llama `prisma/seed.ts --si-vacia` (`backend/package.json`, `backend/scripts/preparar-bd.cjs`). **Esto modifica el esquema y puede escribir datos.** No es un comando de solo lectura. Si se debe conservar una base existente, no lo ejecute hasta acordar una estrategia con el equipo.

Desde `frontend/`:

```bash
npm run dev
```

La URL/puerto exactos que muestra Vite dependen de la configuración local (`frontend/vite.config.ts`). El cliente usa `http://localhost:4000/api` por defecto (`frontend/src/compartido/api.ts` y `frontend/src/services/api.ts`). Por confirmar: si el backend requiere un prefijo de proxy distinto al `/api` consumido por el cliente.

## Problemas comunes

- **No conecta a MySQL:** compruebe que MySQL está levantado, que `DATABASE_URL` apunta al host/puerto correcto y que la base/usuario existen.
- **Prisma no genera cliente:** revise instalación de dependencias y `backend/prisma/schema.prisma`; el script `prisma:generate` está definido en `backend/package.json`.
- **CORS en navegador:** compare el origen del frontend con `ORIGENES_PERMITIDOS`; la configuración de CORS está en `backend/src/configurar-app.ts`.
- **No aparecen rutas o frontend:** inspeccione la conexión del cliente a `VITE_API_URL` y el tenant enviado (`frontend/src/compartido/api.ts`).
- **Datos demo inesperados:** los scripts de seed gestionan datos de demostración; revise `backend/prisma/seeds/demo.ts` antes de ejecutarlos.

Por confirmar: los mensajes de error más comunes observados por el equipo y los pasos de soporte específicos de su entorno.
