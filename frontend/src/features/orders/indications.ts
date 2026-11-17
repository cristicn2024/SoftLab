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
  const fastingGroups = new Map<number, Instruction[]>()
  for (const item of fasting) {
    const hours = item.minHours ?? item.maxHours
    if (hours == null) continue
    fastingGroups.set(hours, [...(fastingGroups.get(hours) ?? []), item])
  }
  for (const [hours, entries] of [...fastingGroups].sort(([a], [b]) => a - b)) {
    consolidated.push({ title: `Ayuno de ${hours} horas`, studies: [...new Set(entries.map((item) => item.study))], note: fastingGroups.size > 1 ? 'Hay indicaciones de ayuno distintas; requiere revisión.' : undefined })
  }
  for (const entries of groups.values()) {
    const title = entries.map((entry) => entry.text).filter((text, index, all) => all.findIndex((value) => value.trim().toLocaleLowerCase() === text.trim().toLocaleLowerCase()) === index).join(' · ')
    consolidated.push({ title, studies: [...new Set(entries.map((item) => item.study))] })
  }
  return consolidated
}

export function canContinueToCheckout(hasInstructions: boolean, confirmed: boolean) {
  return !hasInstructions || confirmed
}
