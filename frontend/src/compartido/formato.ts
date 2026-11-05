export function sexoCorto(sexo: string): string {
  if (sexo === 'F') return 'M'
  if (sexo === 'M') return 'H'
  return '—'
}

export function palabraSexo(sexo: string): string {
  if (sexo === 'F') return 'Mujer'
  if (sexo === 'M') return 'Hombre'
  return 'Otro'
}

export function tituloDeRango(sexo: string, edad: number): string {
  if (sexo !== 'F' && sexo !== 'M') return 'RANGO'
  const esMujer = sexo === 'F'
  if (edad >= 18) {
    if (esMujer) return 'RANGO (MUJER ADULTA)'
    return 'RANGO (HOMBRE ADULTO)'
  }
  if (esMujer) return 'RANGO (NIÑA)'
  return 'RANGO (NIÑO)'
}

export function unirConComas(nombres: string[]): string {
  return nombres.join(', ')
}

export function unirConY(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('')
  const ultimo = nombres[nombres.length - 1]
  const anteriores = nombres.slice(0, nombres.length - 1)
  return `${anteriores.join(', ')} y ${ultimo}`
}

export function horaDe(fechaIso: string | null): string {
  if (!fechaIso) return '—'
  return new Date(fechaIso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}
