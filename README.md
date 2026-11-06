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
- API en `/api/worklist` (requiere el encabezado `x-tenant-id`). Sus datos de prueba se cargan solos al correr `npm run dev`.
- Pruebas: `npm test` en `backend` y en `frontend`.

## Cómo correr el proyecto

Se necesita Node 20 o más reciente y un MySQL 8 corriendo. Para tener el MySQL sin instalar nada, en la raíz del repositorio:

```powershell
docker compose up -d db
```

Si prefieres tu propio MySQL, cambia usuario y contraseña en `backend/.env` (se crea solo en el paso siguiente).

1. En la carpeta `backend`:

```powershell
npm install
npm run dev
```

`npm run dev` crea `backend/.env` si no existe, genera el cliente de Prisma, crea la base `softlab_db` con todas sus tablas y carga los datos de prueba si la base está vacía. No hace falta correr SQL a mano ni ejecutar los seeds por separado.

2. En la carpeta `frontend`:

```powershell
npm install
npm run dev
```

Para levantar todo con Docker: `docker compose up --build`. El backend prepara la base solo, igual que arriba.

### Datos de prueba

Hay un solo laboratorio, Santa Lucía (id 1, el que manda el frontend en `x-tenant-id`), con los datos de todas las historias: catálogo, orden de cobro, HU 5.2 y 6.2, lista de trabajo de la HU 6.1, corte de caja y los escenarios de entrega de la HU 5.5.

| Comando (en `backend`) | Qué hace |
| --- | --- |
| `npm run db:preparar` | Lo que hace `npm run dev` antes de arrancar: tablas y datos si la base está vacía |
| `npm run db:seed` | Carga todos los datos de prueba; lo que ya existe se conserva |
| `npm run db:reset` | Borra todo y vuelve a cargar los datos de prueba |
| `npm run seed:hu-5-2-6-2`, `seed:hu-6-1`, `db:seed:cashcut`, `seed:hu55` | Cargan solo una parte, igual que antes |

### Si algo falla

| Mensaje | Causa | Qué hacer |
| --- | --- | --- |
| `Can't reach database server` o `Access denied` | MySQL apagado o contraseña distinta | `docker compose up -d db`, o revisa `DATABASE_URL` en `backend/.env` |
| `prisma db push` pide aceptar pérdida de datos | La base viene de una versión vieja del esquema | `npm run db:reset` |
| `EPERM` al generar Prisma en Windows | El backend sigue corriendo | Detén el backend y repite |

## Rutas para observar el funcionamiento

- [Nueva orden](http://localhost:5173/ordenes/nueva)
- [Captura de resultados](http://localhost:5173/resultados/captura/SL-261020-0057)

> Mantén las terminales del backend y frontend abiertas mientras revisas la aplicación.
