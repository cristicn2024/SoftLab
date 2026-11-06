import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeRepository } from './plantillas.escenarios';
import { FALLBACK_TEMPLATE, PlantillasService } from './plantillas.service';

function body(suffix: string) {
  return {
    headerText: `Encabezado ${suffix} · Laboratorio QA`,
    disclaimer: `Aviso legal ${suffix}`,
    chemistName: `Q.F.B. ${suffix}`,
    chemistCedula: `CED-${suffix}`,
  };
}

test('sin plantilla configurada usa la de respaldo', async () => {
  const service = new PlantillasService(new FakeRepository());
  const active = await service.getActive(1);
  assert.deepEqual(active, FALLBACK_TEMPLATE);
  assert.equal(active.version, 3);
});

test('la primera versión queda como predeterminada', async () => {
  const service = new PlantillasService(new FakeRepository());
  const saved = await service.save(1, body('Primera'));
  assert.equal(saved.version, 1);
  assert.equal(saved.name, 'Biometría hemática · v1');
  assert.equal(saved.isDefault, true);
  assert.equal(saved.tenantId, 1);
  assert.equal(saved.primaryColor, '#0f766e');
  assert.equal(saved.chemistCedula, 'CED-Primera');
});

test('una nueva versión desmarca la anterior y es la vigente', async () => {
  const repository = new FakeRepository();
  const service = new PlantillasService(repository);
  await service.save(1, body('Primera'));
  const second = await service.save(1, body('Segunda'));
  assert.equal(second.version, 2);
  assert.equal(second.name, 'Biometría hemática · v2');

  const active = await service.getActive(1);
  assert.equal(active.version, 2);
  assert.equal(active.headerText, 'Encabezado Segunda · Laboratorio QA');

  const history = await service.history(1);
  assert.deepEqual(history.map((item) => item.version), [2, 1]);
  assert.deepEqual(history.map((item) => item.isDefault), [true, false]);
});

test('cada laboratorio tiene sus propias versiones', async () => {
  const service = new PlantillasService(new FakeRepository());
  await service.save(1, body('Uno'));
  await service.save(1, body('Dos'));
  const other = await service.save(2, body('Otro'));
  assert.equal(other.version, 1);
  assert.deepEqual(await service.history(3), []);
  assert.deepEqual(await service.getActive(3), FALLBACK_TEMPLATE);
});

test('guardar sin campos crea la versión con textos vacíos', async () => {
  const service = new PlantillasService(new FakeRepository());
  const saved = await service.save(1, {});
  assert.equal(saved.version, 1);
  assert.equal(saved.headerText, null);
});
