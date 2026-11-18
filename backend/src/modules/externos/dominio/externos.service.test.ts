import assert from 'node:assert/strict';
import test from 'node:test';
import { estudio, FakeExternosRepository } from './externos.escenarios';
import { leerFiltro } from './externos.rules';
import { ExternosService } from './externos.service';

function escenario(): FakeExternosRepository {
  const repositorio = new FakeExternosRepository();
  repositorio.agregarLaboratorio(1, { id: 1, name: 'Laboratorio Referencia Nacional' });
  repositorio.agregarLaboratorio(2, { id: 9, name: 'Laboratorio de otro cliente' });
  repositorio.agregarEstudio(1, estudio(10, 'HBA001', 'Hemoglobina glucosilada (HbA1c)', 1, 'Laboratorio Referencia Nacional'));
  repositorio.agregarEstudio(2, estudio(20, 'OTRO01', 'Estudio de otro laboratorio', 9, 'Laboratorio de otro cliente'));
  repositorio.cambios.push({ tenantId: 1, dato: { testId: 10, fecha: new Date('2026-10-10T16:18:00Z') } });
  repositorio.envios.push({
    tenantId: 1,
    dato: { folio: 'ENV-261010-0001', code: 'HBA001', laboratorio: 'Laboratorio Referencia Nacional', estimatedDays: 3, outsourcingCost: 90, createdAt: new Date('2026-10-10T16:18:00Z') },
  });
  return repositorio;
}

test('lista solo los estudios externos del laboratorio con su resumen', async () => {
  const servicio = new ExternosService(escenario());
  const lista = await servicio.listar(1, leerFiltro('', '', ''));
  assert.equal(lista.estudios.length, 1);
  assert.equal(lista.estudios[0].code, 'HBA001');
  assert.deepEqual(lista.resumen, { total: 1, activos: 1, porLaboratorio: [{ laboratorio: 'Laboratorio Referencia Nacional', cantidad: 1 }] });
  assert.equal(lista.actualizada?.toISOString(), '2026-10-10T16:18:00.000Z');
  assert.equal(lista.ultimoEnvio?.folio, 'ENV-261010-0001');
  assert.deepEqual(lista.laboratorios, [{ id: 1, name: 'Laboratorio Referencia Nacional' }]);
});

test('un laboratorio sin estudios externos no tiene envíos ni fecha', async () => {
  const servicio = new ExternosService(escenario());
  const lista = await servicio.listar(3, leerFiltro('', '', ''));
  assert.equal(lista.estudios.length, 0);
  assert.equal(lista.actualizada, null);
  assert.equal(lista.ultimoEnvio, null);
});
