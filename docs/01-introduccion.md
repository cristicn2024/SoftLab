# 01. Introducción

Este documento presenta SoftLab, su alcance observable en el repositorio y el vocabulario usado por el equipo. Describe el estado implementado en esta rama; no sustituye una especificación funcional aprobada.

## Propósito

SoftLab es una aplicación web para apoyar la operación de laboratorios clínicos: recepción de órdenes, captura de resultados, cobro, cortes de caja y emisión/entrega de informes. El README lo describe como un SaaS dirigido a laboratorios pequeños (`README.md`), y Swagger usa la descripción “Sistema de gestión para laboratorios clínicos pequeños” (`backend/src/configurar-app.ts`).

La interfaz React concentra las pantallas de trabajo diario; una API NestJS aplica reglas de dominio y persiste la información en MySQL mediante Prisma.

## Usuarios y roles

El esquema declara los roles `admin`, `receptionist`, `chemist` y `doctor` (`backend/prisma/schema.prisma`, enum `UserRole`). Los nombres corresponden a administración, recepción/caja, personal químico y médicos. El seed genera usuarios de demostración con algunos de esos roles (`backend/prisma/seeds/demo-ordenes.ts`, `backend/prisma/seeds/demo.ts`).

El estado actual no tiene pantalla ni endpoint de inicio de sesión. El cliente muestra una identidad de demostración en `frontend/src/compartido/sesion.ts`; la API construye su sesión leyendo `x-tenant-id`, `x-user-id`, `x-user-name` y `x-user-role` (`backend/src/auth/guards/sesion-por-encabezados.guard.ts`). Los permisos administrativos de cobro/entrega derivan de ese rol recibido en el encabezado (`backend/src/modules/cobro/cobro.controller.ts`, `backend/src/modules/reportes/reportes.controller.ts`). Por ello, los roles descritos aquí son roles del modelo y de las reglas actuales, no una identidad autenticada.

| Rol de datos | Uso observable |
|---|---|
| `admin` | Aplicar/cambiar descuentos, cancelar pagos y autorizar excepcionalmente la entrega de resultados con saldo pendiente, según los servicios de cobro y reportes. |
| `receptionist` | Rol utilizado por el seed y seleccionado en las pantallas de caja; puede realizar operaciones no reservadas a administración. |
| `chemist` | Está definido en el esquema y usado por datos demo; la captura de resultados se expone en Worklist. No hay autenticación real que limite la ruta a este rol. |
| `doctor` | Está definido en el esquema. Por confirmar: no hay flujo de inicio de sesión ni pantalla de trabajo del médico en las rutas React visibles. |

## Alcance funcional implementado

Las rutas React se registran en `frontend/src/App.tsx`:

| Área | Función visible | API principal |
|---|---|---|
| Recepción | Buscar conceptos, revisar una orden abierta, registrar médico en captura y crear una orden. | `concepts/search`, `orders/check-open`, `doctors/express`, `orders`. |
| Lista de trabajo | Ver órdenes con muestras recibidas, capturar resultados por parámetro y avanzar entre órdenes. | `/worklist`. |
| Cobro | Consultar total/saldo, registrar pagos, descuento/facturación y cancelar pagos. | `orders/:id/billing`, `orders/:id/payments`, `payments/:id/cancel`. |
| Corte de caja | Consultar contexto/resumen, cerrar turno, consultar historial y exportar CSV. | `/cash-cuts`. |
| Plantillas | Consultar plantilla vigente/historial y publicar una nueva versión. | `/templates`. |
| Entrega | Solicitar PDF; la API bloquea la liberación con saldo salvo excepción administrativa con motivo. | `/reports/orders/:orderId/pdf`. |
| Verificación | Consultar autenticidad básica de un informe mediante token QR. | `/verify-report/:token`. |

Los controllers están en `backend/src/modules/` y las vistas/componentes en `frontend/src/pages/` y `frontend/src/features/`.

### Límites del alcance observado

- El esquema tiene modelos de pacientes, sucursales, catálogos y muestras, pero no vi módulos API dedicados a administrar pacientes, sucursales, catálogo o recepción de muestras. La pantalla de nueva orden usa un paciente fijo en `frontend/src/pages/OrderCapturePage.tsx`.
- El README describe indicaciones de preparación y notificaciones críticas; el esquema contiene `StudyInstruction`, `InstructionConfirmation`, `InstructionDelivery` y `CriticalNotification`, pero no encontré endpoints que implementen esos flujos. Por confirmar: si pertenecen a una etapa posterior.
- El canal de entrega (`counter`, `print`, `email`, `portal`) se acepta y registra en la liberación. El código y `backend/HU-5.5.md` especifican que el canal email no envía correo y que no existe portal autenticado.
- No hay colas ni caché distribuida identificadas. Por confirmar: infraestructura externa que no está en este repositorio.

## Módulos principales

| Módulo NestJS | Responsabilidad |
|---|---|
| `ordenes` | Búsqueda de conceptos, consulta de órdenes abiertas, registro express de médicos y creación de órdenes. |
| `worklist` | Selección de órdenes capturables, interpretación de rangos y persistencia de resultados. |
| `cobro` | Saldos, pagos, descuentos, datos de factura y cancelaciones con bitácora. |
| `corte-caja` | Resumen por sucursal/cajero/turno, cierre con snapshot e informes CSV. |
| `plantillas` | Versiones de plantilla y publicación de la vigente. |
| `reportes` | Verificación de token y generación/liberación de PDF. |
| `health` | Comprobación de conexión consultando MySQL. |

El ensamblaje está en `backend/src/app.module.ts`; Prisma se proporciona desde `backend/src/prisma/prisma.module.ts`.

## Glosario

| Término | Significado en este repositorio |
|---|---|
| Tenant / laboratorio | Organización aislada lógicamente; cada request privado indica su ID en `x-tenant-id`. |
| Sucursal (`Branch`) | Ubicación del laboratorio asociada a usuarios, órdenes, pagos y cortes. |
| Estudio (`TestCatalog`) | Prueba de laboratorio vendible con precio, tipo de muestra y parámetros/rangos. |
| Perfil (`ProfileCatalog`) | Concepto con precio que agrupa estudios mediante `ProfileTest`. |
| Orden (`Order`) | Solicitud de estudios/perfiles para un paciente y sucursal; agrupa conceptos, muestras, resultados, pagos e informe. |
| Parámetro | Medición individual de un estudio, con unidad y rangos de referencia. |
| Lista de trabajo | Órdenes con muestras recibidas y parámetros aún pendientes de captura. |
| Corte de caja | Resumen persistido de pagos/efectivo por sucursal, cajero, fecha y turno. |
| Folio | Identificador legible de la orden. La creación usa el formato `ORD-<fecha UTC>-<consecutivo>` (`backend/src/modules/ordenes/dominio/ordenes.rules.ts`). |

## Estado actual

El repositorio se presenta como **demo**: `RAILWAY.md` lo llama “Demo del sprint” y pide mantener datos ficticios; el README advierte que todavía no existe login. Hay datos semilla de Santa Lucía y componentes de UI funcionales para varios flujos. Por tanto, el material aquí describe una demo integrada, no acredita que el sistema esté listo para producción ni que todas las historias documentadas estén conectadas.

Para revisar hallazgos de seguridad/mantenibilidad, consultar [el informe de defectos](DEFECTOS.md). El resto de esta documentación se divide en [requisitos](02-requisitos.md), [arquitectura](03-arquitectura.md), [datos](04-base-de-datos.md), [API](05-api.md), [seguridad](06-seguridad.md), [instalación](07-instalacion.md), [pruebas](08-pruebas.md), [despliegue](09-despliegue.md) y [mantenimiento](10-mantenimiento.md).
