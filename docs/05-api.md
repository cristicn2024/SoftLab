# 05. API

Este documento resume la API HTTP que declaran los controllers NestJS. Los cuerpos/contratos se basan en DTOs y tipos de respuesta del código; Swagger no sustituye este inventario y algunos DTOs aceptan `unknown` con validación de negocio posterior.

## Base URL y convenciones

- Prefijo global: `/api` (`backend/src/configurar-app.ts`). Local: `http://localhost:4000/api`.
- Swagger: configuración en `backend/src/configurar-app.ts`, ruta `docs`.
- Tipo común: JSON. Excepciones: PDF (`application/pdf`) y exportación CSV (`text/csv; charset=utf-8`).
- Todos los endpoints privados requieren `x-tenant-id` entero positivo. El guard lo obtiene de headers (`backend/src/auth/guards/sesion-por-encabezados.guard.ts`).
- `x-user-id`, `x-user-name` y `x-user-role` son opcionales en la sesión construida por el guard; operaciones administrativas dependen de `x-user-role`. Estos encabezados no se autentican.
- No hay prefijo de versión `/v1`.
- Errores Nest/dominio se serializan como `{ error: { statusCode, tipo, mensaje }, meta: { ruta, timestamp } }`. Errores de dominio mapean 404, 403, 422 o 409 (`backend/src/comun/filtros/dominio.filter.ts`). Algunos endpoints tienen respuesta de error propia, indicadas abajo.

### Convención de roles

No encontré `@Roles(...)` aplicado a los controllers. La tabla indica restricciones declaradas por regla de dominio; las operaciones “admin” usan el valor de `x-user-role`, no una identidad verificada. Los otros endpoints requieren el tenant, pero no declaran rol mínimo.

## Salud

| Método y ruta | Descripción | Parámetros/cuerpo | Respuesta correcta | Errores / acceso |
|---|---|---|---|---|
| `GET /api/health` | Consulta MySQL y cuenta tenants. | Sin parámetros ni cuerpo. No requiere `x-tenant-id` (`@Publico`). | `200 { status: "ok", message, tenantsRegistrados }`. | Si falla Prisma devuelve 500 con mensaje de error incluido. Público. |

## Órdenes y recepción

Controller: `backend/src/modules/ordenes/ordenes.controller.ts`.

| Método y ruta | Descripción | Parámetros/cuerpo | Respuesta correcta | Errores / acceso |
|---|---|---|---|---|
| `GET /api/concepts/search` | Busca estudios y perfiles del tenant por código/nombre. | Query opcional `q`. | `200` array de `{ id, type: TEST\|PROFILE, code, name, price, genderRestriction, includedTestIds }`. Query vacía devuelve `[]`. | 400 si falta/invalid `x-tenant-id`; 500 de dominio si falla búsqueda. Sin rol mínimo. |
| `GET /api/orders/check-open` | Comprueba orden pendiente del día para paciente. | Query opcional `patientId`; no numérico/cero se interpreta como sin orden. | `200 { hasOpenOrder: boolean, orderId: number\|null }`. | 400 sin tenant; error de búsqueda traducido a 500. Sin rol mínimo. |
| `POST /api/doctors/express` | Registra médico solicitante rápidamente. | JSON `{ name: string, cedula?: string, specialty?: string }`. `name` solo tiene validación de string; campos opcionales no tienen límites de longitud en DTO. | `201` registro Doctor Prisma (incluye ID/tenant/fechas/campos opcionales). | 400 por DTO/tenant; 500 de dominio si falla persistencia. Sin rol mínimo. |
| `POST /api/orders` | Crea orden y líneas. | `{ patientId, branchId, doctorId?, items?, totalAmount? }`; items esperados por la regla: `[{ id, type: "TEST"\|"PROFILE", price }]`. El DTO usa `unknown`; reglas exigen paciente/sucursal no vacíos, no valida el catálogo/precio en DTO. | `201 { success: true, folio, orderId }`. | 400 si falta tenant/paciente/sucursal; 422 para paciente/sucursal requeridos; 500 ante falla de creación/folio. Sin rol mínimo. |

**Ruta no declarada:** el frontend intenta `GET /doctors`, pero no existe un handler de listado en `OrdenesController`. No debe considerarse parte de la API actual.

## Worklist y resultados

Controller: `backend/src/modules/worklist/worklist.controller.ts`.

| Método y ruta | Descripción | Parámetros/cuerpo | Respuesta correcta | Errores / acceso |
|---|---|---|---|---|
| `GET /api/worklist` | Lista órdenes de tenant con muestra recibida y parámetros pendientes. | Sin parámetros. | `200 { totalPending, withoutRange, orders: WorklistOrder[] }`. Cada orden incluye IDs, folio, recepción, paciente, muestras y `pending[]` con `orderItemId`, `parameterId`, estudio/parámetro/unidad/rango/regla. | 400 sin tenant; 500 ante error inesperado de persistencia. Sin rol mínimo explícito. |
| `GET /api/worklist/orders/:orderId` | Obtiene captura de una orden. | Path `orderId` entero positivo. | `200 WorklistOrder` con información de paciente/muestra, contadores y parámetros pendientes. | 400 por ID/tenant; 404 si no existe en tenant o no tiene muestra recibida. Sin rol mínimo explícito. |
| `POST /api/worklist/orders/:orderId/results` | Valida y persiste una o más capturas. | `{ results: [{ orderItemId: integer, parameterId: integer, value: string }] }`. | `201 { saved: [{ orderItemId, parameterId, value, flag }] }`. | 400 por forma/ID/tenant; 404 orden; 409 parámetro no pendiente o conflicto de unicidad; 422 valor inválido/vacío/crítico. Los valores críticos `HH`/`LL` no se guardan. Sin rol mínimo explícito. |

La selección de rango usa sexo/edad y la lógica está en `backend/src/modules/worklist/dominio/worklist.rules.ts`. El endpoint requiere muestra con estado `received` en el repositorio.

## Cobro

Controller: `backend/src/modules/cobro/cobro.controller.ts`.

| Método y ruta | Descripción | Parámetros/cuerpo | Respuesta correcta | Errores / acceso |
|---|---|---|---|---|
| `GET /api/orders/:id/billing` | Consulta datos financieros completos de una orden. | Path `id` positivo. | `200 Billing`: folio, paciente, sucursal, conceptos, descuento, factura, subtotal/impuestos/total/pagado/saldo, pagos y bitácora. Importes se serializan como texto decimal. | 400 ID/tenant; 404 orden inexistente o ajena. Sin rol mínimo. |
| `POST /api/orders/:id/payments` | Aplica descuento/datos de factura y registra pagos; puede dejar pendiente. | `{ payments?: [{ method: "cash"\|"card"\|"transfer", amount, reference? }], cashReceived?, discount?: { percent, reason }, invoice?: { rfc, name, zip, use }, leavePending? }`. | `201 Billing` actualizado. La regla documenta descuentos permitidos 0/5/10/15/20, referencia para tarjeta/transferencia y no exceder saldo. | 400 ID/tenant; 403 si el cambio de descuento requiere admin; 404 orden; 409 saldo/estado incompatible; 422 pago, descuento o factura inválidos. Descuento administrativo depende de `x-user-role=admin`. |
| `POST /api/payments/:id/cancel` | Marca pago cancelado sin borrar y actualiza orden/bitácora. | Path `id` positivo; body `{ reason: string }` (DTO permite unknown, regla exige texto no vacío). | `200 Billing` de la orden actualizada. | 400 ID/tenant; 403 rol admin; 404 pago; 409 si ya está cancelado/orden entregada según regla; 422 motivo inválido. Admin deriva de `x-user-role`. |

## Corte de caja

Controller: `backend/src/modules/corte-caja/corte-caja.controller.ts`.

| Método y ruta | Descripción | Parámetros/cuerpo | Respuesta correcta | Errores / acceso |
|---|---|---|---|---|
| `GET /api/cash-cuts/context` | Devuelve laboratorio, sucursales, cajeros, turnos, fecha y valores por defecto. | Sin parámetros. | `200 { tenant, currentUser, branches, cashiers, shifts, today, defaultShift }`. | 400 sin tenant; 404 laboratorio/sucursales ausentes; 500 error interno genérico. Sin rol mínimo. |
| `GET /api/cash-cuts/summary` | Calcula resumen abierto o devuelve snapshot de corte cerrado. | Query requerida: `branchId` entero, `cashierId` entero (`0` = sin asignar), `shift` de `matutino\|vespertino\|nocturno`, `date` `YYYY-MM-DD`. | `200 { scope, status, cutId, closedAt, closedBy, countedCash, difference, observation, summary, movements }`. | 400 validación/tenant; 404 sucursal/cajero; 422 fecha real/turno inválidos; 500 error genérico. Sin rol mínimo. |
| `GET /api/cash-cuts` | Historial, ordenado por fecha reciente. | Sin parámetros. El repositorio limita a 50 registros. | `200 HistoryRow[]`. | 400 tenant; 500 genérico. Sin rol mínimo. |
| `GET /api/cash-cuts/:id/export` | Exporta corte a CSV con BOM UTF-8. | Path `id` positivo. | `200 text/csv`, descarga `corte-caja-<id>.csv`. | 400 ID/tenant; 404 corte; 500 genérico. Sin rol mínimo. |
| `POST /api/cash-cuts/close` | Cierra corte y guarda snapshot/asignación de pagos. | `{ branchId, cashierId, shift, date, countedCash, observation? }`; efectivo >=0, máx. 2 decimales, observación máx. 500 caracteres. | `201` objeto con `cutId`, estado/fecha, diferencia, resumen, movimientos, sucursal y cajero. | 400 DTO/tenant; 404 sucursal/cajero; 409 corte ya cerrado; 422 diferencia sin observación/fecha inválida. `x-user-id` puede registrarse como cerrador; no requiere rol explícito. |

## Plantillas de informe

Controller: `backend/src/modules/plantillas/plantillas.controller.ts`.

| Método y ruta | Descripción | Parámetros/cuerpo | Respuesta correcta | Errores / acceso |
|---|---|---|---|---|
| `GET /api/templates/active` | Devuelve plantilla vigente o fallback en memoria si no hay una guardada. | Sin parámetros. | `200 ReportTemplate` o el objeto fallback (`name`, textos, químicos, `version`). | 400 sin tenant; errores generales. Sin rol mínimo. |
| `GET /api/templates` | Lista versiones por tenant, descendente por versión. | Sin parámetros. | `200 ReportTemplate[]`. | 400 sin tenant. Sin rol mínimo. |
| `POST /api/templates` | Crea una nueva versión y la vuelve predeterminada. | JSON con campos opcionales `headerText`, `disclaimer`, `chemistName`, `chemistCedula`, todos strings o null. | `201 ReportTemplate`. | 400 DTO/tenant; errores generales. No declara rol mínimo. |

La API guarda nueva versión con nombre generado, no recibe nombre/version del cliente.

## Informes PDF y verificación

Controller: `backend/src/modules/reportes/reportes.controller.ts`.

| Método y ruta | Descripción | Parámetros/cuerpo | Respuesta correcta | Errores / acceso |
|---|---|---|---|---|
| `GET /api/reports/orders/:orderId/pdf` | Genera/libera PDF con canal de query opcional. | Path ID positivo; query `channel`: `counter`, `email`, `portal`, `print`; default `counter`. GET no recibe motivo. | `200 application/pdf`, inline `Informe_Orden_<id>.pdf`, `Cache-Control: no-store, private`. | 400 ID/tenant/canal; 404 orden; 409 cancelada o `PAYMENT_REQUIRED` por saldo. Sin rol mínimo; con saldo el GET no ofrece motivo de excepción. |
| `POST /api/reports/orders/:orderId/pdf` | Equivalente POST que permite indicar motivo de excepción. | Path ID; query `channel` opcional; JSON `{ channel?, reason? }`. | `200 application/pdf` con los mismos headers si se libera. | 400 ID/tenant/canal; 404 orden; 409 cancelada o body `{ status:409, code:"PAYMENT_REQUIRED", error, balance, paymentUrl }`. Saldo exige rol `admin` y motivo de hasta 1000 caracteres, según servicio; rol viene de header. |
| `GET /api/verify-report/:token` | Verifica token QR sin sesión de tenant. | Path `token`; endpoint `@Publico`. | `200 { valid:true, laboratory, patient, issuedAt }`. | `404 { valid:false, message:"Documento no auténtico" }`. Público. |

La emisión requiere una plantilla predeterminada, coordina cambios con transacción/bloqueo de orden y actualiza `resultsDeliveredAt`. Los canales email/portal no implementan transporte externo en el código.

## Convenciones de error

| Código | Uso general |
|---:|---|
| 400 | Falta tenant, ID inválido o request rechazado por `ValidationPipe`/pipe de ID. |
| 403 | Regla de autorización de dominio, por ejemplo cancelar pago o cambiar descuento sin rol admin. |
| 404 | Recurso no encontrado dentro del tenant. |
| 409 | Conflicto de negocio/estado o pago requerido antes de liberar informe. |
| 422 | Datos inválidos o regla de dominio que clasifica entrada inválida. |
| 500 | Error inesperado normalizado; algunos filtros preservan solo el mensaje de dominio. |

Los ejemplos de status son los que resultan de `HttpCode`, defaults de Nest y filtros de error del código. Por confirmar: si se requiere un OpenAPI completo y contract tests para todos los esquemas.
