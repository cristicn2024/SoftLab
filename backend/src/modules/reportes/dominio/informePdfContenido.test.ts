import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeRenderer, FakeRepository, releaseOrder } from './reportes.escenarios';
import { buildPdfData, ReportesService } from './reportes.service';
import type { Actor, ReportOrder, ReportTemplateData } from './reportes.types';

const HOY = new Date(2026, 10, 19, 10, 30);
const ANA: Actor = { tenantId: 1, name: 'Ana', isAdmin: false };

const PLANTILLA: ReportTemplateData = {
  id: 9,
  primaryColor: '#0f766e',
  logoUrl: 'logo.png',
  signatureUrl: 'firma.png',
  chemistName: 'Laura Méndez',
  chemistCedula: '10458392',
};

function orden(): ReportOrder {
  return {
    id: 42,
    folio: 'SL-000042',
    createdAt: new Date(2026, 10, 10, 8, 50),
    tenantName: 'Laboratorio Santa Lucía',
    tenantSubdomain: 'santalucia',
    patient: {
      id: 437,
      firstName: 'Lucía',
      lastName: 'Fernández Soto',
      birthDate: new Date(1985, 2, 12),
      gender: 'F',
    },
    doctorName: 'R. Salas',
    items: [
      { testName: 'Hemoglobina', profileName: null, referenceRange: '12.0 a 16.0', resultValue: '9.8', unit: 'g/dL', flag: 'L', isAlert: false },
      { testName: 'Leucocitos', profileName: null, referenceRange: '4.5 a 11.0', resultValue: '18.2', unit: '10³/µL', flag: 'HH', isAlert: false },
      { testName: 'Cultivo', profileName: null, referenceRange: 'Negativo', resultValue: 'Positivo', unit: '', flag: null, isAlert: true },
      { testName: 'Observaciones', profileName: null, referenceRange: 'Texto libre', resultValue: 'Muestra ligeramente hemolizada', unit: '', flag: null, isAlert: false },
    ],
  };
}

test('HU-06 · el informe lleva las cinco columnas, el rango aplicable y valores numéricos, cualitativos y de texto', () => {
  const datos = buildPdfData(orden(), PLANTILLA, 'token-42', HOY);
  const [hemoglobina, leucocitos, cultivo, observaciones] = datos.resultsByArea[0].items;

  assert.deepEqual(Object.keys(hemoglobina).sort(), [
    'flag', 'referenceRange', 'resultValue', 'testName', 'units',
  ]);
  assert.equal(hemoglobina.testName, 'Hemoglobina');
  assert.equal(hemoglobina.resultValue, '9.8');
  assert.equal(hemoglobina.units, 'g/dL');
  assert.equal(hemoglobina.referenceRange, '12.0 a 16.0');
  assert.equal(hemoglobina.flag, 'LOW');

  assert.equal(leucocitos.flag, 'CRITICAL_HIGH');
  assert.equal(cultivo.resultValue, 'Positivo');
  assert.equal(observaciones.resultValue, 'Muestra ligeramente hemolizada');
  assert.equal(observaciones.referenceRange, 'Texto libre');
});

test('HU-06 · los datos de encabezado incluyen paciente, folio, médico y fecha de toma', () => {
  const datos = buildPdfData(orden(), PLANTILLA, 'token-42', HOY);

  assert.equal(datos.patient.fullName, 'Lucía Fernández Soto');
  assert.equal(datos.patient.ageYears, 41);
  assert.equal(datos.patient.gender, 'F');
  assert.equal(datos.patient.patientId, 437);
  assert.equal(datos.folio, 'SL-000042');
  assert.equal(datos.doctorName, 'Dr. R. Salas');
  assert.equal(datos.createdAt.toDateString(), new Date(2026, 10, 10, 8, 50).toDateString());
  assert.equal(datos.tenantName, 'Laboratorio Santa Lucía');
});

test('HU-06 · las banderas fuera de rango y las críticas se distinguen en los datos del PDF', () => {
  const datos = buildPdfData(orden(), PLANTILLA, 'token-42', HOY);
  const banderas = datos.resultsByArea[0].items.map((item) => item.flag);

  assert.deepEqual(banderas, ['LOW', 'CRITICAL_HIGH', 'HIGH', 'NORMAL']);
  assert.equal(datos.qrToken, 'token-42');
  assert.equal(datos.template.signatureUrl, 'firma.png');
  assert.equal(datos.template.chemistCedula, '10458392');
});

test('HU-06 · al validar se genera el PDF con la plantilla vigente y se guarda con su QR', async () => {
  const repository = new FakeRepository();
  repository.template = PLANTILLA;
  repository.add(1, releaseOrder(42, { payments: [{ amount: 100, cancelled: false }] }));
  const renderer = new FakeRenderer();
  const service = new ReportesService(repository, renderer);

  const resultado = await service.release(ANA, 42, 'print', undefined, HOY);

  assert.equal(resultado.kind, 'released');
  assert.equal(renderer.received.length, 1);
  assert.equal(renderer.received[0].template.primaryColor, '#0f766e');
  assert.equal(renderer.received[0].template.logoUrl, 'logo.png');
  assert.equal(repository.stored(1, 42)?.qrToken, 'token-42');
  assert.equal(repository.stored(1, 42)?.issuedPdf?.toString(), 'pdf');
  assert.deepEqual(repository.stored(1, 42)?.delivered, HOY);
});

test('HU-06 · publicar una plantilla nueva no regenera ni modifica un informe ya emitido', async () => {
  const repository = new FakeRepository();
  repository.template = PLANTILLA;
  repository.add(1, releaseOrder(42, { payments: [{ amount: 100, cancelled: false }] }));
  const renderer = new FakeRenderer();
  const service = new ReportesService(repository, renderer);

  await service.release(ANA, 42, 'counter', undefined, HOY);
  const pdfOriginal = repository.stored(1, 42)?.issuedPdf;
  repository.template = { ...PLANTILLA, id: 10, primaryColor: '#123456', logoUrl: 'nuevo.png' };

  await service.release(ANA, 42, 'print', undefined, HOY);

  assert.equal(renderer.received.length, 1);
  assert.equal(renderer.received[0].template.primaryColor, '#0f766e');
  assert.equal(repository.stored(1, 42)?.issuedPdf, pdfOriginal);
});

test.skip('HU-06 · agrupa resultados por área o perfil con subtotales y encabezados claros', () => {
  const datos = buildPdfData(orden(), PLANTILLA, 'token-42', HOY);
  assert.deepEqual(datos.resultsByArea.map((area) => area.areaName), ['Hematología', 'Cultivos']);
  assert.ok(datos.resultsByArea.every((area) => typeof area.subtotal === 'string'));
});

test.skip('HU-06 · los estudios externos llevan el laboratorio que los procesó', () => {
  const datos = buildPdfData(orden(), PLANTILLA, 'token-42', HOY);
  assert.equal(datos.resultsByArea[0].items[2].externalLab, 'Laboratorio Referencia Nacional');
});

test.skip('HU-06 · la plantilla aporta colores corporativos, marcas de agua y firma escaneada al PDF', () => {
  const datos = buildPdfData(orden(), PLANTILLA, 'token-42', HOY);
  assert.equal(datos.template.watermarkUrl, 'marca-agua.png');
  assert.equal(datos.template.headerText, 'Logotipo · Clínica Central');
  assert.equal(datos.template.footerText, 'Aviso legal · Responsable sanitario');
});
