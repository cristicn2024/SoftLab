# Demo del sprint en Railway

Crear tres servicios en un proyecto: MySQL, backend y frontend. Conectar los dos
servicios de aplicación a este repositorio y a la rama `integracion`.

## Backend

- Root Directory: `/backend`. Railway detecta el Dockerfile.
- `DATABASE_URL`: referencia a `MYSQL_URL` del servicio MySQL (red privada).
- `PORT`: `4000`.
- Healthcheck: `/api/health`.
- Generar dominio HTTPS con puerto destino 4000.
- En una base nueva de demo, ejecutar `npx prisma db push --skip-generate`
  como comando previo al despliegue. No agregar `--accept-data-loss`.
- Una vez disponible la base, ejecutar `npm run db:seed` en el servicio backend.
  El seed borra y vuelve a crear el laboratorio demo (id 1) y no toca otros
  laboratorios. Ejecutarlo solo en una base de demo.

El contenedor instala Chromium para generar PDFs. No cargar el archivo `.env`
local ni publicar credenciales en el repositorio.

## Frontend

- Root Directory: `/frontend`. Railway detecta el Dockerfile.
- `VITE_API_URL`: `https://DOMINIO-DEL-BACKEND/api`.
- `VITE_TENANT_ID`: `1`.
- Generar dominio HTTPS con puerto destino 80 (Nginx).
- Las variables VITE se incorporan al compilar: redesplegar si cambian.

## Comprobación

Abrir la página, recargar una ruta interna y verificar cobro y entrega. Usar los
IDs impresos por el seed: una orden liquidada debe emitir PDF y una con saldo
debe responder PAYMENT_REQUIRED. Mantener solo datos ficticios en esta demo:
la identidad y el rol actuales provienen de encabezados del navegador.

Revisar el plan y el consumo en Railway antes de habilitar recursos de pago.
