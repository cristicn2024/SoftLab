import { Prisma, PrismaClient } from '@prisma/client'
import type { ContextoSeed } from './contexto'

const decimal = (value: number) => new Prisma.Decimal(value)

export async function sembrarHu5262(prisma: PrismaClient, { tenant, branch }: ContextoSeed) {
  const ensureUser = async (name: string, role: 'admin' | 'chemist', address: string) => {
    const equivalent = await prisma.user.findFirst({ where: { tenantId: tenant.id, fullName: name } })
    if (equivalent) return equivalent
    const existing = await prisma.user.findUnique({ where: { email: address } })
    if (existing) return existing
    return prisma.user.create({ data: { tenantId: tenant.id, branchId: branch.id, fullName: name, email: address, passwordHash: 'seed-only-not-for-login', role } })
  }
  await ensureUser('Laura Méndez', 'admin', 'laura.mendez@santa-lucia.invalid')
  const analyst = await ensureUser('Q.F.B. Andrea Ruiz', 'chemist', 'andrea.ruiz@santa-lucia.invalid')
  let patient = await prisma.patient.findFirst({ where: { tenantId: tenant.id, firstName: 'María', lastName: 'López García' } })
  if (!patient) {
    const birthDate = new Date(); birthDate.setFullYear(birthDate.getFullYear() - 38)
    patient = await prisma.patient.create({ data: { tenantId: tenant.id, firstName: 'María', lastName: 'López García', birthDate, gender: 'F', patientCode: 'P-000231' } })
  }
  if (!patient.patientCode) patient = await prisma.patient.update({ where: { id: patient.id }, data: { patientCode: 'P-000231' } })
  let physician = await prisma.practitioner.findFirst({ where: { tenantId: tenant.id, fullName: 'Dra. Patricia Ruiz' } })
  if (!physician) physician = await prisma.practitioner.create({ data: { tenantId: tenant.id, fullName: 'Dra. Patricia Ruiz', specialty: 'Medicina interna' } })
  for (const extra of [{ fullName: 'Dr. Ernesto Salas', specialty: 'Pediatría' }, { fullName: 'Dra. Julia Contreras', specialty: 'Ginecología' }]) {
    if (!(await prisma.practitioner.findFirst({ where: { tenantId: tenant.id, fullName: extra.fullName } }))) await prisma.practitioner.create({ data: { tenantId: tenant.id, ...extra } })
  }
  const catalog = [
    { code: 'GLU001', name: 'Glucosa en ayuno', price: 120, sampleType: 'Sangre · tubo amarillo', instructions: [{ type: 'fasting' as const, minHours: 8, maxHours: 12, text: 'Ayuno 8–12 h' }] },
    { code: 'BH001', name: 'Biometría hemática', price: 180, sampleType: 'Sangre · tubo lila', instructions: [] },
    { code: 'PERF02', name: 'Perfil lipídico (perfil)', price: 450, sampleType: 'Sangre · tubo amarillo', instructions: [{ type: 'fasting' as const, minHours: 12, maxHours: 12, text: 'Ayuno 12 h' }] },
    { code: 'EG0001', name: 'Examen general de orina', price: 90, sampleType: 'Orina · frasco estéril', instructions: [{ type: 'first_urine' as const, text: 'Primera orina de la mañana, frasco estéril' }] },
    { code: 'EXT001', name: 'Vitamina D (estudio externo)', price: 700, sampleType: 'Sangre · tubo amarillo', instructions: [], externalLab: 'Laboratorio de Referencia del Norte', turnaroundHours: 72 },
  ]
  const tests: Record<string, number> = {}
  const prices: Record<string, Prisma.Decimal> = {}
  for (const item of catalog) {
    const test = await prisma.testCatalog.upsert({ where: { uq_tenant_test_code: { tenantId: tenant.id, code: item.code } }, update: {}, create: { tenantId: tenant.id, code: item.code, name: item.name, price: decimal(item.price), sampleType: item.sampleType, ...( 'externalLab' in item ? { externalLab: item.externalLab, turnaroundHours: item.turnaroundHours } : {}) } })
    tests[item.code] = test.id
    prices[item.code] = test.price
    for (const entry of item.instructions) {
      const found = await prisma.studyInstruction.findFirst({ where: { testId: test.id, type: entry.type, text: entry.text } })
      if (!found) await prisma.studyInstruction.create({ data: { tenantId: tenant.id, testId: test.id, ...entry } })
    }
  }
  const parameterSeed = [
    ['GLU001', 'Glucosa en ayuno', 'mg/dL', 0, 70, 99, true, true, 40, 500, '70–99'],
    ['PERF02', 'Colesterol total', 'mg/dL', 1, null, 200, false, false, null, null, '< 200'],
    ['PERF02', 'Triglicéridos', 'mg/dL', 2, null, 150, false, false, null, 500, '< 150'],
    ['PERF02', 'Colesterol HDL', 'mg/dL', 3, 40, null, false, false, null, null, '> 40'],
    ['PERF02', 'Colesterol LDL (calculado)', 'mg/dL', 4, null, 130, false, false, null, null, '< 130'],
    ['PERF02', 'Colesterol VLDL (calculado)', 'mg/dL', 5, null, 30, false, false, null, null, '< 30'],
    ['BH001', 'Nitritos', null, 1, null, null, true, true, null, null, 'Negativo'],
  ] as const
  const parameterIds: Record<string, number> = {}
  for (const [code, name, unit, sortOrder, low, high, lowInclusive, highInclusive, criticalLow, criticalHigh, display] of parameterSeed) {
    const testId = tests[code]
    let parameter = await prisma.testParameter.findFirst({ where: { testId, name } })
    if (!parameter) parameter = await prisma.testParameter.create({ data: { tenantId: tenant.id, testId, name, unit, sortOrder, qualitativeExpected: display === 'Negativo' ? 'Negativo' : null } })
    parameterIds[`${code}:${name}`] = parameter.id
    const oldValue = ({ 'Glucosa en ayuno': ['98', '10 oct'], 'Colesterol total': ['192', '14 jun'], 'Triglicéridos': ['160', '14 jun'], 'Colesterol HDL': ['49', '14 jun'], 'Colesterol LDL (calculado)': ['111', '14 jun'], 'Colesterol VLDL (calculado)': ['32', '14 jun'] } as Record<string, string[]>)[name]
    if (oldValue && !parameter.previousValue) await prisma.testParameter.update({ where: { id: parameter.id }, data: { previousValue: oldValue[0], previousDate: oldValue[1] } })
    const ranges = [
      { gender: 'F' as const, minAgeYears: 18, maxAgeYears: 120, display, low: low === null ? null : decimal(low), high: high === null ? null : decimal(high), lowInclusive, highInclusive, criticalLow: criticalLow === null ? null : decimal(criticalLow), criticalHigh: criticalHigh === null ? null : decimal(criticalHigh), criticalLowInclusive: false, criticalHighInclusive: name === 'Triglicéridos' },
      { gender: 'M' as const, minAgeYears: 18, maxAgeYears: 120, display: 'Rango hombre adulto', low: low === null ? null : decimal(low), high: high === null ? null : decimal(high), lowInclusive, highInclusive, criticalLow: criticalLow === null ? null : decimal(criticalLow), criticalHigh: criticalHigh === null ? null : decimal(criticalHigh), criticalLowInclusive: false, criticalHighInclusive: name === 'Triglicéridos' },
      { gender: 'F' as const, minAgeYears: 0, maxAgeYears: 17, display: 'Rango pediátrico', low: low === null ? null : decimal(low), high: high === null ? null : decimal(high), lowInclusive, highInclusive, criticalLow: criticalLow === null ? null : decimal(criticalLow), criticalHigh: criticalHigh === null ? null : decimal(criticalHigh), criticalLowInclusive: false, criticalHighInclusive: name === 'Triglicéridos' },
    ]
    for (const range of ranges) {
      const exists = await prisma.referenceRange.findFirst({ where: { tenantId: tenant.id, testId, parameterId: parameter.id, gender: range.gender, minAgeYears: range.minAgeYears, maxAgeYears: range.maxAgeYears } })
      if (!exists) await prisma.referenceRange.create({ data: { tenantId: tenant.id, testId, parameterId: parameter.id, ...range } })
    }
  }
  let order = await prisma.order.findUnique({ where: { folio: 'SL-261020-0057' } })
  if (!order) order = await prisma.order.create({ data: { tenantId: tenant.id, branchId: branch.id, patientId: patient.id, physicianId: physician.id, folio: 'SL-261020-0057', totalAmount: prices.PERF02.add(prices.GLU001), status: 'in_process' } })
  for (const code of ['GLU001', 'PERF02']) {
    const exists = await prisma.orderItem.findFirst({ where: { orderId: order.id, testId: tests[code] } })
    if (!exists) await prisma.orderItem.create({ data: { orderId: order.id, testId: tests[code], price: catalog.find((test) => test.code === code)!.price } })
  }
  if (!(await prisma.sample.findFirst({ where: { orderId: order.id } }))) await prisma.sample.create({ data: { tenantId: tenant.id, orderId: order.id, barcode: 'SL-261020-0057-AMARILLO', status: 'received', collectedAt: new Date('2026-10-20T09:58:00'), receivedAt: new Date('2026-10-20T09:58:00'), sampleDescription: 'Suero · tubo amarillo', equipment: 'Analizador químico AQ-2', capturedByName: analyst.fullName } })
  const current: Record<string, string> = { 'Glucosa en ayuno': '98', 'Colesterol total': '186', 'Triglicéridos': '238', 'Colesterol HDL': '52', 'Colesterol LDL (calculado)': '86', 'Colesterol VLDL (calculado)': '47.6' }
  for (const item of await prisma.orderItem.findMany({ where: { orderId: order.id }, include: { test: { include: { parameters: true } } } })) {
    if (!item.test) continue
    for (const parameter of item.test.parameters) {
      const value = current[parameter.name]
      if (!value) continue
      const found = await prisma.testResult.findFirst({ where: { orderItemId: item.id, parameterId: parameter.id } })
      if (!found) await prisma.testResult.create({ data: { tenantId: tenant.id, orderItemId: item.id, parameterId: parameter.id, resultValue: value, flag: parameter.name === 'Triglicéridos' || parameter.name === 'Colesterol VLDL (calculado)' ? 'H' : 'Normal', isAlert: parameter.name === 'Triglicéridos' || parameter.name === 'Colesterol VLDL (calculado)' } })
    }
  }
  console.log(`HU seed ready: ${tenant.name}; user ${analyst.fullName}; order ${order.folio}. Existing rows reused; missing rows created.`)
}
