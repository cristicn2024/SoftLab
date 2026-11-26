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
- API en `/api/worklist` (requiere sesión con permiso de resultados). Sus datos de prueba se cargan solos al correr `npm run dev`.
- Pruebas: `npm test` en `backend` y en `frontend`.

## Cómo correr el proyecto

Se necesita Node 24.7 o posterior y MySQL 8.0.29 o posterior corriendo. Para tener el MySQL sin instalar nada, en la raíz del repositorio:

```powershell
docker compose up -d db
```

Si prefieres tu propio MySQL, cambia usuario y contraseña en `backend/.env` (se crea solo en el paso siguiente).

1. En la carpeta `backend`:

```powershell
npm install
npm run dev
```

`npm run dev` crea `backend/.env` si no existe, genera el cliente de Prisma, crea la base `softlab_db` con todas sus tablas y carga los datos de prueba si la base está vacía. No hace falta correr SQL a mano ni ejecutar el seed por separado.

2. En la carpeta `frontend`:

```powershell
npm install
npm run dev
```

Para levantar todo con Docker: `docker compose up --build`. El backend prepara la base solo, igual que arriba.

### Datos de prueba

Hay un solo laboratorio de demo, Santa Lucía (la sesión determina el laboratorio), con una historia completa: 2 sucursales, 8 usuarios, 3 médicos, 8 pacientes, catálogo con parámetros y rangos de referencia, perfiles, plantilla de informe y 21 órdenes repartidas entre hoy, ayer y antier. Cubren nueva orden, lista de trabajo y captura, cobro (sin pago, parcial, liquidada, con descuento, pago anulado y orden cancelada), entrega y corte de caja (dos cortes cerrados y turnos abiertos). Al terminar, la consola imprime el ID y el folio de cada orden con el caso que prueba.

### HU 7.5 — Inicio de sesión

Abre [/login](http://localhost:5173/login). El usuario es el correo. Estas credenciales son **solo para desarrollo**. Las cuatro cuentas comparten la contraseña `softlab2026`.

| Usuario | Resultado esperado |
| --- | --- |
| `laura.mendez@santalucia.demo` | Administración. Abre Nueva orden en Clínica Central. |
| `coordinacion@santalucia.demo` | Coordinación de resultados. Elige Clínica Central o Clínica Norte y abre Lista de trabajo. |
| `inactivo@santalucia.demo` | Acceso denegado con el mismo mensaje que una contraseña incorrecta. |
| `sin.sucursal@santalucia.demo` | Acceso denegado con indicación de solicitar una sucursal. |

En una base de desarrollo que ya contiene el demo, ejecuta `npm run db:preparar` y luego `npm run db:seed:login` desde `backend`. Este último agrega las cuentas de prueba faltantes y conserva los datos. El seed completo se omite cuando `NODE_ENV=production`.

**Contrato de la API**

| Método y ruta | Resultado |
| --- | --- |
| `POST /api/auth/login` con `{usuario, clave}` | Devuelve `{sesion}` si hay una sucursal o `{sucursales}` y un desafío de hasta cinco minutos si hay varias. |
| `POST /api/auth/sucursal` con `{sucursalId}` | Consume el desafío una sola vez y emite una nueva cookie de sesión. |
| `GET /api/auth/sesion` | Devuelve usuario, rol, permisos y sucursal vigentes. Una sesión inválida recibe 401. |
| `POST /api/auth/logout` | Revoca la credencial en MySQL, elimina la cookie y devuelve 204. |

El panel inicial es el primer módulo navegable en la lista de permisos del rol. Un rol sin módulos recibe un panel vacío con opción de salir. La sucursal principal existente y las asignaciones adicionales del mismo laboratorio forman la lista de opciones. Las consultas de autenticación releen el estatus, el rol y las asignaciones. Los hashes scrypt del demo anterior se actualizan a Argon2id después de verificar la contraseña.

Configura las variables en `backend/.env.example`. En producción usa HTTPS, `NODE_ENV=production`, un `SESION_SECRETO` aleatorio compartido y el origen exacto del frontend en `ORIGENES_PERMITIDOS`. La cookie usa HttpOnly y SameSite=Strict. Frontend y API deben pertenecer al mismo sitio. El límite de intentos usa la IP de la conexión. Detrás de un proxy, configura la red de confianza antes de atribuir IP de cliente desde encabezados.

En instalaciones gestionadas con migraciones, aplica `202611260001_inicio_sesion` sobre el esquema previo. El flujo local con `db push` instala también los roles iniciales y los triggers. La cuenta de la aplicación debe carecer de privilegios DDL sobre la bitácora después de aprovisionarla. Los eventos conservan correo, identificadores conocidos, IP y fecha con milisegundos. Un fallo previo a la elección de sucursal deja ese campo vacío.

**Verificación**. En `backend`, ejecuta `npm run test:login` y `npm test`. En `frontend`, ejecuta `npm test`. Las pruebas de la HU usan servicios de autenticación reales con persistencia de prueba y React Router con respuestas de API simuladas.

**Integración pendiente**. Las HU 1–3 administrarán los roles, sus permisos y asignaciones. La HU 4 podrá consultar los eventos de autenticación. La HU 6 administrará el campo `active` que el guard ya comprueba.

| Comando (en `backend`) | Qué hace |
| --- | --- |
| `npm run db:preparar` | Lo que hace `npm run dev` antes de arrancar: tablas y datos si la base está vacía |
| `npm run db:seed` | Borra y vuelve a crear el laboratorio demo; no toca otros laboratorios |
| `npm run db:reset` | Borra toda la base y vuelve a cargar los datos de prueba |

### Si algo falla

| Mensaje | Causa | Qué hacer |
| --- | --- | --- |
| `Can't reach database server` o `Access denied` | MySQL apagado o contraseña distinta | `docker compose up -d db`, o revisa `DATABASE_URL` en `backend/.env` |
| `prisma db push` pide aceptar pérdida de datos | La base viene de una versión vieja del esquema | `npm run db:reset` |
| `EPERM` al generar Prisma en Windows | El backend sigue corriendo | Detén el backend y repite |

## Rutas para observar el funcionamiento

- [Nueva orden](http://localhost:5173/recepcion/nueva-orden)
- [Cobro](http://localhost:5173/ordenes/cobro)
- [Corte de caja](http://localhost:5173/ordenes/corte-caja)
- [Lista de trabajo](http://localhost:5173/resultados/lista-de-trabajo)
- [Entrega de resultados](http://localhost:5173/resultados/entrega)
- [Plantillas de informe](http://localhost:5173/resultados/plantillas)

> Mantén las terminales del backend y frontend abiertas mientras revisas la aplicación.
