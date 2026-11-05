export type RangeRule = { low?: number | null; high?: number | null; lowInclusive?: boolean; highInclusive?: boolean; criticalLow?: number | null; criticalHigh?: number | null; criticalLowInclusive?: boolean; criticalHighInclusive?: boolean; expected?: string | null }
export type Flag = 'Normal' | 'H' | 'L' | 'HH' | 'LL' | 'A' | '—'

export function interpretResult(value: string | number | null, range?: RangeRule | null): Flag {
  if (value === null || value === '') return '—'
  if (!range) return '—'
  if (range.expected) return String(value).trim().toLowerCase() === range.expected.trim().toLowerCase() ? 'Normal' : 'A'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (range.criticalLow != null && (number < range.criticalLow || (range.criticalLowInclusive && number === range.criticalLow))) return 'LL'
  if (range.criticalHigh != null && (number > range.criticalHigh || (range.criticalHighInclusive && number === range.criticalHigh))) return 'HH'
  if (range.low != null && (number < range.low || (!range.lowInclusive && number === range.low))) return 'L'
  if (range.high != null && (number > range.high || (!range.highInclusive && number === range.high))) return 'H'
  return 'Normal'
}

export function selectRange<T extends { gender?: string | null; minAgeYears?: number | null; maxAgeYears?: number | null }>(ranges: T[], gender: string, age: number): T | undefined {
  return ranges.find((range) => (!range.gender || range.gender === gender) && (range.minAgeYears == null || age >= range.minAgeYears) && (range.maxAgeYears == null || age <= range.maxAgeYears))
}

export function calculateLipids(total: number, hdl: number, triglycerides: number) {
  const vldl = Math.round((triglycerides / 5) * 10) / 10
  return { vldl, ldl: Math.round((total - hdl - vldl) * 10) / 10 }
}

export function canSaveResult(flag: Flag, hasNotification: boolean) {
  return !['HH', 'LL'].includes(flag) || hasNotification
}

export function abnormalSummary(flags: Flag[]) {
  return flags.reduce((summary, flag) => {
    if (flag === 'H' || flag === 'L') summary.outOfRange++
    if (flag === 'HH' || flag === 'LL') summary.critical++
    if (flag === 'A') summary.qualitative++
    return summary
  }, { outOfRange: 0, critical: 0, qualitative: 0 })
}
