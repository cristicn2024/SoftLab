import test from 'node:test'
import assert from 'node:assert/strict'
import { paginaDe, pesos, textoDeActivos, textoDeDias, textoDeEnvio, textoDeResumen, totalDePaginas } from './externos.ts'
import type { EstudioExterno } from './tipos.ts'

test('arma el resumen como en el Figma', () => {
  const resumen = { total: 1, activos: 1, porLaboratorio: [{ laboratorio: 'Laboratorio Referencia Nacional', cantidad: 1 }] }
  assert.equal(textoDeResumen(resumen), '1 estudio externo · Laboratorio Referencia Nacional: 1')
  assert.equal(textoDeActivos(1), '1 activo')
  assert.equal(textoDeActivos(3), '3 activos')
})

test('formatea días, maquila y el aviso de la orden de envío', () => {
  assert.equal(textoDeDias(3), '3 días')
  assert.equal(textoDeDias(1), '1 día')
  assert.equal(pesos(90), '$90.00')
  assert.equal(
    textoDeEnvio({ folio: 'ENV-261010-0001', code: 'HBA001', laboratorio: 'Laboratorio Referencia Nacional', estimatedDays: 3, outsourcingCost: 90, createdAt: '' }),
    'HBA001 se envía a Laboratorio Referencia Nacional en lugar de procesarse aquí. Entrega estimada: 3 días · Maquila: $90.00. El resultado puede tardar más; se avisa al personal y al paciente.',
  )
})

test('pagina de 10 en 10', () => {
  const estudios: EstudioExterno[] = []
  for (let i = 1; i <= 12; i++) {
    estudios.push({ id: i, code: `E${i}`, name: `Estudio ${i}`, status: true, externalLabId: 1, laboratorio: 'L', turnaroundDays: 1, outsourcingCost: null })
  }
  assert.equal(totalDePaginas(12), 2)
  assert.equal(totalDePaginas(0), 1)
  assert.equal(paginaDe(estudios, 2).length, 2)
  assert.equal(paginaDe(estudios, 2)[0].code, 'E11')
})
