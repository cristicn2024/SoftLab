import type { ExternosRepository } from './externos.repository';
import { filtrarEstudios, resumir } from './externos.rules';
import type { FiltroExternos, LaboratorioExterno, ListaExternos } from './externos.types';

export class ExternosService {
  constructor(private readonly repositorio: ExternosRepository) {}

  laboratorios(tenantId: number): Promise<LaboratorioExterno[]> {
    return this.repositorio.laboratoriosActivos(tenantId);
  }

  async listar(tenantId: number, filtro: FiltroExternos): Promise<ListaExternos> {
    const todos = await this.repositorio.estudiosExternos(tenantId);
    const estudios = filtrarEstudios(todos, filtro);

    const ids: number[] = [];
    for (const estudio of todos) ids.push(estudio.id);

    const actualizada = await this.repositorio.ultimoCambio(tenantId, ids);
    const ultimoEnvio = await this.repositorio.ultimoEnvio(tenantId);
    const laboratorios = await this.repositorio.laboratoriosActivos(tenantId);

    return { estudios, resumen: resumir(estudios), actualizada, ultimoEnvio, laboratorios };
  }
}
