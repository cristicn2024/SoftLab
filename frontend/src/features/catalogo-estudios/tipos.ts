export interface EstudioCatalogo {
  id: number
  code: string
  name: string
  price: string | number
  status: boolean
  department: string
  sampleType: string
  genderRestriction?: string
  containerType?: string | null
  sampleVolume?: number | string | null
  sampleVolumeUnit?: string | null
  fastingHours?: number | null
  preparationInstructions?: string | null
  medicationWarnings?: string | null
  additionalInstructions?: string | null
  externalLabId?: number | null
  turnaroundDays?: number | null
  outsourcingCost?: number | string | null
}

export interface LaboratorioExterno {
  id: number
  name: string
}

export type TipoIndicacion = 'ayuno' | 'preparacion' | 'medicamentos' | 'adicional'

export interface Indicacion {
  tipo: TipoIndicacion
  texto: string
  horas: number | null
}

export interface FormularioEstudio {
  code: string
  name: string
  department: string
  status: boolean
  sampleType: string
  containerType: string
  volumen: string
  genderRestriction: string
  indicaciones: Indicacion[]
  esExterno: boolean
  externalLabId: string
  turnaroundDays: string
  outsourcingCost: string
}

export interface EstudioExterno {
  id: number
  code: string
  name: string
  status: boolean
  externalLabId: number
  laboratorio: string
  turnaroundDays: number | null
  outsourcingCost: number | null
}

export interface UltimoEnvio {
  folio: string
  code: string
  laboratorio: string
  estimatedDays: number
  outsourcingCost: number | null
  createdAt: string
}

export interface ListaExternos {
  estudios: EstudioExterno[]
  resumen: { total: number; activos: number; porLaboratorio: { laboratorio: string; cantidad: number }[] }
  actualizada: string | null
  ultimoEnvio: UltimoEnvio | null
  laboratorios: LaboratorioExterno[]
}
