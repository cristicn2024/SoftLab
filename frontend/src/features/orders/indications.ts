export type Instruction = { type: 'fasting' | 'first_urine' | 'medication' | 'text'; text: string; minHours?: number | null; maxHours?: number | null; study: string }

export function consolidateInstructions(instructions: Instruction[]) {
  const fasting = instructions.filter((item) => item.type === 'fasting')
  const groups = new Map<string, Instruction[]>()
  for (const item of instructions.filter((entry) => entry.type !== 'fasting')) {
    const group = groups.get(item.type) ?? []
    group.push(item)
    groups.set(item.type, group)
  }
  const consolidated: { title: string; studies: string[]; note?: string }[] = []
  if (fasting.length) {
    const strictest = fasting.reduce((a, b) => (b.minHours ?? 0) > (a.minHours ?? 0) ? b : a)
    consolidated.push({ title: `Ayuno de ${strictest.minHours ?? strictest.maxHours ?? ''} horas`, studies: [...new Set(fasting.map((item) => item.study))], note: fasting.length > 1 ? 'Se aplica la indicación más estricta.' : undefined })
  }
  for (const [type, entries] of groups) {
    const title = type === 'first_urine' ? 'Primera orina de la mañana, frasco estéril' : entries.map((entry) => entry.text).join(' · ')
    consolidated.push({ title, studies: [...new Set(entries.map((item) => item.study))] })
  }
  return consolidated
}

export function canContinueToCheckout(hasInstructions: boolean, confirmed: boolean) {
  return !hasInstructions || confirmed
}
