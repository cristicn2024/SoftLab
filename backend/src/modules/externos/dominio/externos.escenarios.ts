import type { ExternosRepository } from './externos.repository';
import type { EstudioExterno, LaboratorioExterno, UltimoEnvio } from './externos.types';

export function estudio(
  id: number,
  code: string,
  name: string,
  externalLabId: number,
  laboratorio: string,
  status = true,
): EstudioExterno {
  return { id, code, name, status, externalLabId, laboratorio, turnaroundDays: 3, outsourcingCost: 90 };
}

interface Registro<T> {
  tenantId: number;
  dato: T;
}

export class FakeExternosRepository implements ExternosRepository {
  laboratoriosGuardados: Registro<LaboratorioExterno>[] = [];
  estudiosGuardados: Registro<EstudioExterno>[] = [];
  cambios: Registro<{ testId: number; fecha: Date }>[] = [];
  envios: Registro<UltimoEnvio>[] = [];

  agregarLaboratorio(tenantId: number, dato: LaboratorioExterno): void {
    this.laboratoriosGuardados.push({ tenantId, dato });
  }

  agregarEstudio(tenantId: number, dato: EstudioExterno): void {
    this.estudiosGuardados.push({ tenantId, dato });
  }

  async laboratoriosActivos(tenantId: number): Promise<LaboratorioExterno[]> {
    const lista: LaboratorioExterno[] = [];
    for (const registro of this.laboratoriosGuardados) {
      if (registro.tenantId === tenantId) lista.push(registro.dato);
    }
    return lista;
  }

  async estudiosExternos(tenantId: number): Promise<EstudioExterno[]> {
    const lista: EstudioExterno[] = [];
    for (const registro of this.estudiosGuardados) {
      if (registro.tenantId === tenantId) lista.push(registro.dato);
    }
    return lista;
  }

  async ultimoCambio(tenantId: number, testIds: number[]): Promise<Date | null> {
    let ultima: Date | null = null;
    for (const registro of this.cambios) {
      if (registro.tenantId !== tenantId || !testIds.includes(registro.dato.testId)) continue;
      if (ultima === null || registro.dato.fecha.getTime() > ultima.getTime()) ultima = registro.dato.fecha;
    }
    return ultima;
  }

  async ultimoEnvio(tenantId: number): Promise<UltimoEnvio | null> {
    let ultimo: UltimoEnvio | null = null;
    for (const registro of this.envios) {
      if (registro.tenantId !== tenantId) continue;
      if (ultimo === null || registro.dato.createdAt.getTime() > ultimo.createdAt.getTime()) ultimo = registro.dato;
    }
    return ultimo;
  }
}
