import type { EstudioExterno, LaboratorioExterno, UltimoEnvio } from './externos.types';

export interface ExternosRepository {
  laboratoriosActivos(tenantId: number): Promise<LaboratorioExterno[]>;
  estudiosExternos(tenantId: number): Promise<EstudioExterno[]>;
  ultimoCambio(tenantId: number, testIds: number[]): Promise<Date | null>;
  ultimoEnvio(tenantId: number): Promise<UltimoEnvio | null>;
}
