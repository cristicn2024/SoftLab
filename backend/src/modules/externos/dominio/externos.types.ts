export type FiltroEstatus = 'todos' | 'activos' | 'inactivos';

export interface LaboratorioExterno {
  id: number;
  name: string;
}

export interface EstudioExterno {
  id: number;
  code: string;
  name: string;
  status: boolean;
  externalLabId: number;
  laboratorio: string;
  turnaroundDays: number | null;
  outsourcingCost: number | null;
}

export interface UltimoEnvio {
  folio: string;
  code: string;
  laboratorio: string;
  estimatedDays: number;
  outsourcingCost: number | null;
  createdAt: Date;
}

export interface FiltroExternos {
  q: string;
  laboratorioId: number | null;
  estatus: FiltroEstatus;
}

export interface ConteoPorLaboratorio {
  laboratorio: string;
  cantidad: number;
}

export interface ResumenExternos {
  total: number;
  activos: number;
  porLaboratorio: ConteoPorLaboratorio[];
}

export interface ListaExternos {
  estudios: EstudioExterno[];
  resumen: ResumenExternos;
  actualizada: Date | null;
  ultimoEnvio: UltimoEnvio | null;
  laboratorios: LaboratorioExterno[];
}

export interface DatosExternos {
  externalLabId: number | null;
  turnaroundDays: number | null;
  outsourcingCost: number | null;
}

export interface EstudioParaEnvio {
  testId: number;
  externalLabId: number | null;
  turnaroundDays: number | null;
  outsourcingCost: number | null;
}

export interface EnvioNuevo {
  testId: number;
  externalLabId: number;
  folio: string;
  estimatedDays: number;
  outsourcingCost: number | null;
}
