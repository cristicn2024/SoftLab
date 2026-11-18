import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidarPreanalitica, esIncompatible } from './preanalitica';

const study = (id: number, overrides: Record<string, unknown> = {}) => ({
  id, code: `T-${id}`, name: `Estudio ${id}`, sampleType: 'Sangre', containerType: null,
  sampleVolume: null, sampleVolumeUnit: null, fastingHours: null,
  preparationInstructions: null, medicationWarnings: null, additionalInstructions: null,
  genderRestriction: 'BOTH', ...overrides,
});

test('conserva requisitos configurados, deduplica textos y marca ayunos distintos', () => {
  const result = consolidarPreanalitica([
    study(1, { containerType: 'Tubo rojo', sampleVolume: 3, sampleVolumeUnit: 'mL', fastingHours: 8, preparationInstructions: 'Acudir temprano' }),
    study(2, { containerType: 'Tubo morado', sampleVolume: 2, sampleVolumeUnit: 'mL', fastingHours: 12, preparationInstructions: ' acudir temprano ' }),
  ]);
  assert.equal(result.muestras.length, 2);
  assert.equal(result.ayunos.length, 2);
  assert.equal(result.preparacion.length, 1);
  assert.equal(result.conflictos.length, 2);
});

test('incluye indicaciones preexistentes de StudyInstruction sin inventar instrucciones', () => {
  const result = consolidarPreanalitica([study(1, { instructions: [
    { type: 'fasting', minHours: 8, maxHours: 8, text: 'Ayuno configurado' },
    { type: 'medication', minHours: null, maxHours: null, text: 'Registrar medicamento' },
    { type: 'first_urine', minHours: null, maxHours: null, text: 'Primera muestra del día' },
  ] })]);
  assert.equal(result.ayunos[0].horas, 8);
  assert.equal(result.medicamentos[0].texto, 'Registrar medicamento');
  assert.equal(result.preparacion[0].texto, 'Primera muestra del día');
  assert.equal(result.conflictos.length, 0);
});

test('no suma volúmenes del mismo contenedor y solicita revisión si difieren', () => {
  const result = consolidarPreanalitica([
    study(1, { containerType: 'Tubo rojo', sampleVolume: 2, sampleVolumeUnit: 'mL' }),
    study(2, { containerType: 'Tubo rojo', sampleVolume: 5, sampleVolumeUnit: 'mL' }),
  ]);
  assert.deepEqual(result.muestras[0].volumenes, ['2 mL', '5 mL']);
  assert.ok(result.conflictos.some((conflict) => conflict.includes('volúmenes distintos')));
});

test('deniega restricciones cuando sexo no es determinable', () => {
  assert.equal(esIncompatible('Other', 'F'), true);
  assert.equal(esIncompatible('Other', 'BOTH'), false);
  assert.equal(esIncompatible('F', 'M'), true);
  assert.equal(esIncompatible('F', 'F'), false);
});

test('avisa qué estudios se envían a laboratorio externo y cuántos días tardan', () => {
  const result = consolidarPreanalitica([
    study(1),
    study(2, { code: 'HBA001', name: 'Hemoglobina glucosilada (HbA1c)', externalLabRef: { name: 'Laboratorio Referencia Nacional' }, turnaroundDays: 3 }),
  ]);
  assert.deepEqual(result.externos, [{ code: 'HBA001', name: 'Hemoglobina glucosilada (HbA1c)', laboratorio: 'Laboratorio Referencia Nacional', dias: 3 }]);
});
