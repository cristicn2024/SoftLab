# HU 5.5 — Bloqueo de entrega sin pago

Disponible en Resultados → Entrega de resultados. Seleccionar la orden y el canal.
El enlace Registrar pago conserva el número de orden; en cobro existe un enlace para volver a entrega.

GET y POST /api/reports/orders/:orderId/pdf usan la misma regla de saldo para
counter, print, email y portal. POST admite channel y, para una excepción,
reason. El motivo es obligatorio, de hasta 1000 caracteres, y requiere un rol
administrador según el mecanismo actual del proyecto.

Con saldo se responde 409, code PAYMENT_REQUIRED, balance y paymentUrl.
La bitácora payment_logs conserva usuario, canal, saldo y motivo de la excepción.
Una excepción aplica únicamente a esa liberación, no autoriza futuras descargas.
El saldo se recalcula con conceptos, descuento y pagos vigentes cada vez; al
liquidar no hay que quitar una bandera de bloqueo. No modifica captura ni validación.
La emisión exitosa del PDF registra results_delivered_at. El cobro, la cancelación y
la emisión coordinan el acceso a la orden mediante bloqueo de fila.

No requiere campos nuevos: utiliza el esquema existente de la HU 5.3. El cliente
Prisma y la base de datos deben estar actualizados a backend/prisma/schema.prisma.
Requiere una plantilla predeterminada para emitir el informe.

## Datos de prueba

Desde `backend`, ejecutar `npx prisma generate`, `npx prisma db push --skip-generate`
y `npm run seed:hu55`. Detener el backend antes de regenerar Prisma en Windows.
El seed utiliza el laboratorio 1 (el que envía actualmente el frontend), conserva
su configuración si existe y crea una plantilla predeterminada si no hay ninguna.
No borra datos ni reinicia órdenes existentes. La consola muestra los IDs reales;
no se debe asumir que las órdenes tendrán siempre IDs del 1 al 6.

| Escenario | Saldo inicial | Resultado esperado |
| --- | --- | --- |
| Sin pago | $500 | Bloqueada; permite probar pago y excepción administrativa |
| Pago parcial | $300 | Bloqueada hasta liquidar |
| Liquidada | $0 | Permite emitir PDF |
| Liquidada con descuento del 10% | $0 | Permite emitir PDF con pago de $450 |
| Pago cancelado | $500 | El pago cancelado no libera la entrega |
| Orden cancelada | $0 | Bloqueada por cancelación |

Abrir `/resultados/entrega?orden=ID` en el frontend y probar los cuatro canales.
Las órdenes incluyen un estudio ficticio de $500 y un resultado validado.
Para probar el desbloqueo automático, liquidar una orden con saldo desde el enlace
Registrar pago y regresar a entrega. Para probar excepciones, la sesión demo
actual tiene rol Administradora: proporcionar un motivo y volver a solicitar sin
motivo para comprobar que la autorización no persiste. El saldo y los eventos
pueden consultarse en `/ordenes/cobro?orden=ID`.

Pruebas de la regla: npm run test:delivery (13 casos, sin conexión a MySQL).

Limitaciones del proyecto: la identidad y el rol aún se reciben por encabezados,
como en cobro. Deben provenir de una sesión autenticada antes de producción.
No existe transporte de correo ni portal de pacientes autenticado; el canal correo
permite descargar para adjuntar y el servidor protege la emisión de todos los canales.
La entrega registrada corresponde a liberar el documento, no a confirmar recepción
por correo o entrega física. Falta validar la integración completa con MySQL.
