import { DatoExternoInvalidoError, FiltroInvalidoError } from './externos.errors';
import type {
  ConteoPorLaboratorio,
  DatosExternos,
  EnvioNuevo,
  EstudioExterno,
  EstudioParaEnvio,
  FiltroEstatus,
  FiltroExternos,
  ResumenExternos,
} from './externos.types';

const MAX_DIAS = 365;
const MAX_COSTO = 99999999.99;
const MAX_BUSQUEDA = 100;

function estaVacio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === '';
}

function leerEnteroPositivo(valor: unknown): number | null {
  if (typeof valor !== 'number' && typeof valor !== 'string') return null;
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) return null;
  return numero;
}

function tieneMasDeDosDecimales(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) > 0.00001;
}

/**
 * Lee la sección "Laboratorio externo" del estudio.
 * Regresa undefined si el cuerpo no trae isExternal (otras pantallas que no la mandan no la borran).
 */
export function leerDatosExternos(cuerpo: Record<string, unknown>): DatosExternos | undefined {
  if (cuerpo.isExternal === undefined) return undefined;
  if (typeof cuerpo.isExternal !== 'boolean') {
    throw new DatoExternoInvalidoError('Indica si el estudio se procesa en un laboratorio externo.');
  }
  if (!cuerpo.isExternal) {
    return { externalLabId: null, turnaroundDays: null, outsourcingCost: null };
  }

  const externalLabId = leerEnteroPositivo(cuerpo.externalLabId);
  if (externalLabId === null) {
    throw new DatoExternoInvalidoError('Selecciona el laboratorio que procesa el estudio.');
  }

  const dias = leerEnteroPositivo(cuerpo.turnaroundDays);
  if (dias === null || dias > MAX_DIAS) {
    throw new DatoExternoInvalidoError(`El tiempo estimado de entrega debe ser un número entero de días entre 1 y ${MAX_DIAS}.`);
  }

  let costo: number | null = null;
  if (!estaVacio(cuerpo.outsourcingCost)) {
    const valor = cuerpo.outsourcingCost;
    if (typeof valor !== 'number' && typeof valor !== 'string') {
      throw new DatoExternoInvalidoError('El costo de maquila no es válido.');
    }
    costo = Number(valor);
    if (!Number.isFinite(costo) || costo < 0 || costo > MAX_COSTO || tieneMasDeDosDecimales(costo)) {
      throw new DatoExternoInvalidoError('El costo de maquila debe ser un importe mayor o igual a 0 con máximo dos decimales.');
    }
  }

  return { externalLabId, turnaroundDays: dias, outsourcingCost: costo };
}

function leerEstatus(valor: unknown): FiltroEstatus {
  if (estaVacio(valor) || valor === 'todos') return 'todos';
  if (valor === 'activos' || valor === 'inactivos') return valor;
  throw new FiltroInvalidoError('El filtro de estatus debe ser todos, activos o inactivos.');
}

export function leerFiltro(q: unknown, laboratorio: unknown, estatus: unknown): FiltroExternos {
  let texto = '';
  if (typeof q === 'string') texto = q.trim();
  if (texto.length > MAX_BUSQUEDA) throw new FiltroInvalidoError('La búsqueda es demasiado larga.');

  let laboratorioId: number | null = null;
  if (!estaVacio(laboratorio) && laboratorio !== 'todos') {
    laboratorioId = leerEnteroPositivo(laboratorio);
    if (laboratorioId === null) throw new FiltroInvalidoError('El laboratorio del filtro no es válido.');
  }

  return { q: texto, laboratorioId, estatus: leerEstatus(estatus) };
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function cumpleFiltro(estudio: EstudioExterno, filtro: FiltroExternos): boolean {
  if (filtro.laboratorioId !== null && estudio.externalLabId !== filtro.laboratorioId) return false;
  if (filtro.estatus === 'activos' && !estudio.status) return false;
  if (filtro.estatus === 'inactivos' && estudio.status) return false;
  if (filtro.q === '') return true;
  const buscado = normalizar(filtro.q);
  return normalizar(estudio.code).includes(buscado) || normalizar(estudio.name).includes(buscado);
}

export function filtrarEstudios(estudios: EstudioExterno[], filtro: FiltroExternos): EstudioExterno[] {
  const resultado: EstudioExterno[] = [];
  for (const estudio of estudios) {
    if (cumpleFiltro(estudio, filtro)) resultado.push(estudio);
  }
  return resultado;
}

export function resumir(estudios: EstudioExterno[]): ResumenExternos {
  const porLaboratorio: ConteoPorLaboratorio[] = [];
  let activos = 0;
  for (const estudio of estudios) {
    if (estudio.status) activos = activos + 1;
    let conteo: ConteoPorLaboratorio | undefined;
    for (const existente of porLaboratorio) {
      if (existente.laboratorio === estudio.laboratorio) conteo = existente;
    }
    if (conteo === undefined) {
      porLaboratorio.push({ laboratorio: estudio.laboratorio, cantidad: 1 });
    } else {
      conteo.cantidad = conteo.cantidad + 1;
    }
  }
  return { total: estudios.length, activos, porLaboratorio };
}

export function prefijoDeEnvio(fecha: Date): string {
  const iso = fecha.toISOString();
  return `ENV-${iso.slice(2, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-`;
}

export function folioDeEnvio(fecha: Date, consecutivo: number): string {
  return `${prefijoDeEnvio(fecha)}${String(consecutivo).padStart(4, '0')}`;
}

/**
 * Un estudio externo genera una orden de envío en lugar de una de proceso interno.
 * Se arma una por estudio externo, sin repetir el mismo estudio en la orden.
 */
export function armarEnvios(estudios: EstudioParaEnvio[], fecha: Date, enviosDelDia: number): EnvioNuevo[] {
  const envios: EnvioNuevo[] = [];
  const vistos: number[] = [];
  for (const estudio of estudios) {
    if (estudio.externalLabId === null) continue;
    if (vistos.includes(estudio.testId)) continue;
    vistos.push(estudio.testId);
    let dias = 1;
    if (estudio.turnaroundDays !== null) dias = estudio.turnaroundDays;
    envios.push({
      testId: estudio.testId,
      externalLabId: estudio.externalLabId,
      folio: folioDeEnvio(fecha, enviosDelDia + envios.length + 1),
      estimatedDays: dias,
      outsourcingCost: estudio.outsourcingCost,
    });
  }
  return envios;
}
