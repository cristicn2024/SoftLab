# 06. Seguridad

Este documento separa los controles observables de las recomendaciones pendientes. El estado descrito corresponde al código del repositorio; la existencia de un gateway, WAF o proveedor de identidad externo es **por confirmar**.

## Autenticación actual

No hay pantalla ni endpoint de login. `backend/src/auth/guards/sesion-por-encabezados.guard.ts` toma `x-tenant-id`, `x-user-id`, `x-user-name` y `x-user-role` directamente de la solicitud y construye `req.user`. El frontend define un perfil fijo de demo en `frontend/src/compartido/sesion.ts`. El seed guarda `passwordHash` con `scrypt` (`backend/prisma/seeds/demo.ts`), pero no hay código visible que valide esa contraseña o emita sesión/token.

`x-tenant-id` identifica el contexto de consulta, no prueba pertenencia al tenant. La API key mostrada en Swagger también describe ese header como `apiKey`, no una credencial autenticada (`backend/src/configurar-app.ts`). Los encabezados de usuario se pueden controlar desde el cliente y el rol admin se usa para reglas financieras/entrega.

**Implementado:** guard global que exige tenant entero positivo para rutas no públicas y normaliza alias de rol en `backend/src/auth/encabezados.ts`.

**No implementado en el código observado:** verificación de contraseña, cookie/token firmado, expiración/revocación de sesión, login/logout, MFA o asociación validada entre usuario/rol y tenant. Por confirmar: si una infraestructura exterior autentica/reemplaza esos headers antes de la API.

## Autorización y roles

Existe `RolesGuard` y decorador `@Roles`, pero no encontré uso del decorador en controllers. Cobro crea `isAdmin` comparando el rol recibido (`backend/src/modules/cobro/cobro.controller.ts`); reportes hace lo mismo (`backend/src/modules/reportes/reportes.controller.ts`). Por tanto, las restricciones lógicas existen, pero dependen de un header no firmado.

Los modelos de datos declaran `admin`, `receptionist`, `chemist`, `doctor`, pero actualmente los endpoints privados solo exigen tenant y no aplican un rol mínimo general. Las operaciones específicas están listadas en `05-api.md`.

## Aislamiento de tenant

La mayoría de entidades incorpora `tenantId`; los repositorios filtran por tenant (por ejemplo `backend/src/modules/cobro/infra/cobro-prisma.repository.ts`). No obstante:

- El ID de tenant que filtra consultas es suministrado por el caller en `x-tenant-id`.
- Crear orden recibe `branchId`, `patientId` y `doctorId` por body y el repositorio crea con `OrderUncheckedCreateInput`; no observa validación tenant-scoped previa para todos esos IDs (`backend/src/modules/ordenes/`).
- Las relaciones del schema usan en varios casos FKs simples y no siempre constraints compuestas tenant+ID (`backend/prisma/schema.prisma`).

Se requiere autenticación de tenant en servidor y validación de pertenencia para toda referencia. El análisis detallado está en [docs/DEFECTOS.md](DEFECTOS.md), especialmente DEF-01 y DEF-04.

## CORS

`backend/src/configurar-app.ts` toma la allowlist desde `ORIGENES_PERMITIDOS`. Si falta, retorna configuración sin `origin`; el middleware `cors` instalado usa `*` como origen por defecto. El ejemplo de backend documenta orígenes locales y advierte que vacío permite todos (`backend/.env.example`).

**Implementado:** allowlist explícita por coma cuando la variable se establece; métodos permitidos en esa rama son GET/POST/PUT/PATCH/DELETE.

**Recomendado:** hacer obligatoria la lista en entornos compartidos, definir métodos y headers explícitos y no considerar CORS como autenticación. Véase DEF-08 en el informe de defectos.

## Validación de entradas

La API registra un `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted`, `transform` y conversión implícita (`backend/src/configurar-app.ts`). Algunos DTO usan restricciones concretas, como `ConsultaCorteDto`/`CerrarCorteDto`; Worklist define un validador personalizado de cada entrada (`backend/src/modules/worklist/dto/guardar-resultados.dto.ts`). `IdPositivoPipe` se usa en IDs de orden/pago/corte.

La validación no es uniforme. `CrearOrdenDto`, `RegistrarPagosDto` y `EntregarInformeDto` marcan propiedades con `@Allow()` y exponen valores `unknown`; las reglas se aplican más tarde o, en algunos campos, no se comprueba todo lo que corresponde. Además, orden confía en el precio enviado por cliente. Revisar DEF-03 y endpoints de `05-api.md` antes de integrar consumidores nuevos.

## Secretos y configuración

- `backend/.env.example` muestra la forma de `DATABASE_URL`; el script puede copiarlo a `backend/.env` al arrancar desarrollo (`backend/scripts/preparar-bd.cjs`). No se debe copiar a repositorio una `.env` con credenciales reales.
- `docker-compose.yaml` incluye credencial por defecto de MySQL y publica el puerto de MySQL en el host. Cambiar secretos y restringir exposición antes de usar una red compartida (DEF-09).
- `VITE_API_URL` y `VITE_TENANT_ID` son variables públicas de build, no deben contener secretos. El Dockerfile las incorpora al bundle (`frontend/Dockerfile`).
- `RAILWAY.md` advierte no cargar `.env` local ni publicar credenciales.
- No encontré gestor de secretos ni rotación automatizada en el repo. Por confirmar: controles del proveedor de despliegue.

## PDF y documentos

Puppeteer genera el informe con HTML construido por interpolación en `backend/src/modules/reportes/infra/pdf.service.ts`, usa `page.setContent` y lanza Chromium con `--no-sandbox`. Textos de plantilla/resultados se insertan en markup sin escape contextual visible. El renderer no establece un origen/allowlist de recursos en el fragmento revisado.

El servicio usa token generado con `randomBytes(16)` y verifica vía ruta pública `/api/verify-report/:token`; la respuesta expone nombre del laboratorio, nombre del paciente y fecha de emisión (`backend/src/modules/reportes/infra/reportes-prisma.repository.ts`). Es una verificación informativa, no autenticación del paciente.

**Recomendado:** escapar por contexto, validar URLs de recursos, reducir HTML activo, aislar Chromium y evaluar política de privacidad del endpoint QR. Ver DEF-02 y DEF-06 en [el informe de defectos](DEFECTOS.md).

## Errores, logging y controles no observados

El middleware registra método, URL, status, latencia y request ID en stdout (`backend/src/comun/middleware/registro.middleware.ts`). Los filtros normalizan errores de HTTP/dominio, pero el healthcheck público incluye el mensaje raw de Prisma en respuestas de error (`backend/src/health/health.controller.ts`; DEF-14).

No encontré rate limiting, protección antifuerza bruta, política CSP configurada por Nginx, cifrado a nivel de aplicación, redacción de datos sensibles, rotación de logs ni política de retención. Su existencia en proxy/plataforma queda **por confirmar**. No se realizó una prueba de penetración ni una auditoría externa.

## Estado de seguridad y limitación de uso

`README.md` y `RAILWAY.md` describen datos ficticios y uso de demo; el estado actual de encabezados de identidad no es apropiado para operar información clínica real sin controles externos/implementación de autenticación. Antes de producción se deben cerrar al menos DEF-01 a DEF-04 y revisar el resto de [DEFECTOS.md](DEFECTOS.md).
