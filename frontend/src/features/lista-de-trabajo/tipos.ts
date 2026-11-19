import type { RangeRule } from '../results/interpretation.ts'

export type ParametroPendiente = {
  orderItemId: number
  parameterId: number
  testName: string
  parameterName: string
  unit: string | null
  rangeText: string | null
  previous: string | null
  rule: RangeRule | null
}

export type MuestraDeOrden = {
  id: number
  barcode: string
  description: string | null
  equipment: string | null
  capturedByName: string | null
}

export type OrdenDeLista = {
  referenceContext?: { processedAt: string | null; condition: string; weeks: number | null }
  orderId: number
  folio: string
  receivedAt: string | null
  capturedCount: number
  samples: MuestraDeOrden[]
  patient: {
    id: number
    fullName: string
    patientCode: string | null
    gender: string
    ageYears: number
  }
  pending: ParametroPendiente[]
}

export type ListaDeTrabajo = {
  totalPending: number
  withoutRange: number
  orders: OrdenDeLista[]
}

export type DestinatarioCritico = 'doctor' | 'patient'
export type MedioDeContacto = 'phone' | 'email' | 'whatsapp' | 'in_person'

/** HU 6.2 CA5: a quién y por qué medio se avisó de un valor crítico. */
export type NotificacionCritica = {
  recipient: DestinatarioCritico
  recipientName: string
  contactMethod: MedioDeContacto
}

export type EntradaResultado = {
  orderItemId: number
  parameterId: number
  value: string
  notification?: NotificacionCritica
}
