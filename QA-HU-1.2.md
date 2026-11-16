# Verificación de HU 1.2 — 16 de noviembre de 2026

Resultado: todavía no cumple el 100% de la historia. No se hizo push ni se modificó código de producción durante esta revisión.

## Ejecuciones completadas

| Alcance | Resultado |
| --- | --- |
| Backend: reglas y servicios de dominio, incluidos rangos | 115 aprobadas |
| Backend: pruebas HTTP de Nest existentes | 50 aprobadas en 7 suites |
| Frontend: suites existentes | 39 aprobadas en 8 archivos |
| Frontend: pruebas nuevas de ReferenciasPage | 3 aprobadas |
| Verificación adicional de referencias contra API/MySQL y repositorios | 16 aprobadas, 1 fallida |

Las primeras ejecuciones amplias tuvieron errores de memoria y restricciones del aislamiento. Se repitieron en serie y fuera del aislamiento. Los números anteriores corresponden a ejecuciones terminadas, no a esos intentos interrumpidos.

## Comprobaciones específicas

- Creación de parámetro mediante la API.
- Escritura permitida a administrador y químico, rechazada a recepción, médico y rol ausente.
- Rechazo de parámetros de otro laboratorio y aislamiento de versiones.
- Rechazo de huecos, traslapes, unidad vacía, método vacío, límites críticos internos y fechas retroactivas.
- Conservación de versiones y bitácora con usuario, valor anterior y nuevo.
- Selección de versión vigente frente a otra futura; interpretación normal, alta, baja y crítica.
- Pantalla: carga, agregar/quitar rangos, guardar texto abierto con encabezados de sesión y mostrar errores del servidor.

La prueba de API creó un laboratorio temporal y eliminó sus registros al terminar.

## Falla reproducida

**El informe omite parámetros.** Un estudio con dos resultados produce una sola fila. `PrismaReleaseUnit.findReportOrder()` toma `item.testResults[0]` y agrega una sola entrada por estudio. La prueba esperaba dos entradas y obtuvo una. Afecta la presentación de resultados y sus referencias en estudios con varios parámetros.

Reproducción: con backend local iniciado y MySQL disponible, ejecutar `node scripts/qa-referencias.cjs` desde backend. El script devuelve estado de error mientras persista la falla y limpia sus datos temporales.

## Limitaciones encontradas en la revisión

- Condición especial y semanas de embarazo están en la base y participan en la selección, pero falta un formulario o flujo de captura de ese contexto del paciente.
- La selección de versión usa `new Date()` al consultar/capturar. No existe una fecha de procesamiento independiente para seleccionar referencias históricas; esa parte del criterio 6 no queda cubierta si procesamiento y captura suceden en fechas diferentes.
- Las nuevas capturas guardan una referencia en el resultado. No se realizó una prueba integral de PDF emitido previamente, cambio de versión y nueva descarga; no se da por demostrada toda la conservación histórica del criterio 7.
- Se probaron componentes con Testing Library y jsdom; no hubo revisión visual en un navegador real.

No se recomienda considerar la HU cerrada hasta corregir el informe y resolver/verificar estos flujos pendientes.
