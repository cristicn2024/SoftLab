import type { EstudioExterno, ListaExternos, UltimoEnvio } from './tipos.ts'

export const POR_PAGINA = 10

export function pesos(valor: number): string {
  return `$${valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function textoDeDias(dias: number | null): string {
  if (dias === null) return '—'
  if (dias === 1) return '1 día'
  return `${dias} días`
}

export function textoDeMaquila(costo: number | null): string {
  if (costo === null) return '—'
  return pesos(costo)
}

export function fechaDeActualizacion(iso: string): string {
  const fecha = new Date(iso)
  const dia = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
  const hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${dia}, ${hora}`
}

export function textoDeResumen(resumen: ListaExternos['resumen']): string {
  let texto = `${resumen.total} estudios externos`
  if (resumen.total === 1) texto = '1 estudio externo'
  for (const conteo of resumen.porLaboratorio) {
    texto = `${texto} · ${conteo.laboratorio}: ${conteo.cantidad}`
  }
  return texto
}

export function textoDeActivos(activos: number): string {
  if (activos === 1) return '1 activo'
  return `${activos} activos`
}

export function textoDeEnvio(envio: UltimoEnvio): string {
  let texto = `${envio.code} se envía a ${envio.laboratorio} en lugar de procesarse aquí. Entrega estimada: ${textoDeDias(envio.estimatedDays)}`
  if (envio.outsourcingCost !== null) texto = `${texto} · Maquila: ${pesos(envio.outsourcingCost)}`
  return `${texto}. El resultado puede tardar más; se avisa al personal y al paciente.`
}

export function totalDePaginas(cantidad: number): number {
  if (cantidad === 0) return 1
  return Math.ceil(cantidad / POR_PAGINA)
}

export function paginaDe(estudios: EstudioExterno[], pagina: number): EstudioExterno[] {
  const inicio = (pagina - 1) * POR_PAGINA
  const visibles: EstudioExterno[] = []
  for (let i = inicio; i < estudios.length && i < inicio + POR_PAGINA; i++) {
    visibles.push(estudios[i])
  }
  return visibles
}
