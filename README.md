# SoftLab

### SaaS para la gestión de laboratorios clínicos

SoftLab reúne los flujos de recepción y captura de resultados en una interfaz pensada para el trabajo diario del laboratorio.

## Historias incluidas

### HU 5.2 · Nueva orden con indicaciones

- Selección de estudios y perfiles para una orden.
- Consolidación de indicaciones de preparación para el paciente.
- Confirmación de que las indicaciones fueron comunicadas.
- Acciones para imprimirlas o registrar su envío por WhatsApp.

### HU 6.2 · Captura de resultados fuera de rango

- Captura de resultados con rangos de referencia según edad y sexo.
- Identificación visual de resultados normales, fuera de rango y críticos.
- Cálculo de LDL y VLDL cuando hay datos suficientes.
- Registro de resultados y notificación de valores críticos.

### HU 6.1 · Captura ágil en listas de trabajo

- Lista de trabajo con pacientes y estudios pendientes (`/resultados/lista-de-trabajo`).
- Captura rápida: Enter avanza al siguiente parámetro y Ctrl + Enter guarda y abre la siguiente orden.
- El rango de referencia se elige con el sexo y la edad del paciente; si no hay rango, se avisa y se captura sin interpretación automática.
- API en `/api/worklist` (requiere el encabezado `x-tenant-id`). Datos de prueba: `npm run seed:hu-5-2-6-2` y luego `npm run seed:hu-6-1`.
- Pruebas: `npm test` en `backend` y en `frontend`.

## Cómo correr el proyecto (sin Docker)

1. En MySQLWorkbench: abre backend/src/database/schema.sql y ejecútalo (rayo). Recrea softlab_db con las tablas base.
2. desde la carpeta backend, en PowerShell ejecuta estos comandos

```powershell
npm install
npx prisma db execute --file prisma/migrations/202611010001_hu_5_2_6_2_support/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 202611010001_hu_5_2_6_2_support
npx prisma generate
npm run seed:hu-5-2-6-2
npm run dev
```

3. en el frontend 

```powershell
npm run dev
```

## Rutas para observar el funcionamiento

- [Nueva orden](http://localhost:5173/ordenes/nueva)
- [Captura de resultados](http://localhost:5173/resultados/captura/SL-261020-0057)

> Mantén las terminales del backend y frontend abiertas mientras revisas la aplicación.
