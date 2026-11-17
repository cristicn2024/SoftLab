type Estudio = {
  id: number; code: string; name: string; sampleType: string; containerType: string | null;
  sampleVolume: unknown; sampleVolumeUnit: string | null; fastingHours: number | null;
  preparationInstructions: string | null; medicationWarnings: string | null; additionalInstructions: string | null;
  genderRestriction: string;
  instructions?: { type: string; minHours: number | null; maxHours: number | null; text: string }[];
};

export function consolidarPreanalitica(estudios: Estudio[]) {
  const muestras = new Map<string, Estudio[]>();
  for (const estudio of estudios) {
    const clave = `${estudio.sampleType.trim().toLowerCase()}|${estudio.containerType?.trim().toLowerCase() ?? ''}`;
    muestras.set(clave, [...(muestras.get(clave) ?? []), estudio]);
  }
  const ayunos = new Map<string, { horas: number | null; texto: string; estudios: string[] }>();
  for (const estudio of estudios) {
    if (estudio.fastingHours != null) {
      const key = `h:${estudio.fastingHours}`;
      const condition = ayunos.get(key) ?? { horas: estudio.fastingHours, texto: '', estudios: [] };
      condition.estudios.push(estudio.name); ayunos.set(key, condition);
    }
    for (const instruction of estudio.instructions ?? []) if (instruction.type === 'fasting') {
      const hours = instruction.minHours === instruction.maxHours ? instruction.minHours : null;
      const label = hours != null ? '' : instruction.text;
      const key = hours != null ? `h:${hours}` : `t:${label.trim().toLocaleLowerCase()}`;
      const condition = ayunos.get(key) ?? { horas: hours, texto: label, estudios: [] };
      condition.estudios.push(estudio.name); ayunos.set(key, condition);
    }
  }
  const textos = (campo: 'preparationInstructions' | 'medicationWarnings' | 'additionalInstructions', tipo: string) => {
    const valores = new Map<string, { texto: string; estudios: string[] }>();
    for (const estudio of estudios) {
      const entradas = [estudio[campo], ...(estudio.instructions ?? []).filter((instruction) => instruction.type === tipo || (tipo === 'first_urine' && instruction.type === 'first_urine')).map((instruction) => instruction.text)];
      for (const raw of entradas) {
        const texto = raw?.trim();
        if (!texto) continue;
        const clave = texto.toLocaleLowerCase();
        const group = valores.get(clave) ?? { texto, estudios: [] };
        group.estudios.push(estudio.name);
        valores.set(clave, group);
      }
    }
    return [...valores.values()].map(({ texto, estudios }) => ({ texto, estudios: [...new Set(estudios)] }));
  };
  const condicionesAyuno = [...ayunos.values()].sort((a, b) => (a.horas ?? Number.MAX_SAFE_INTEGER) - (b.horas ?? Number.MAX_SAFE_INTEGER)).map((item) => ({ ...item, estudios: [...new Set(item.estudios)] }));
  const gruposMuestra = [...muestras.values()].map((grupo) => ({
    tipo: grupo[0].sampleType,
    contenedor: grupo[0].containerType,
    volumenes: [...new Set(grupo.filter((x) => x.sampleVolume != null).map((x) => `${String(x.sampleVolume)} ${x.sampleVolumeUnit ?? ''}`.trim()))],
    estudios: [...new Set(grupo.map((x) => x.name))],
  }));
  return {
    estudios: estudios.map((x) => ({ id: x.id, code: x.code, name: x.name, sampleType: x.sampleType, containerType: x.containerType, sampleVolume: x.sampleVolume == null ? null : Number(x.sampleVolume), sampleVolumeUnit: x.sampleVolumeUnit, fastingHours: x.fastingHours, preparationInstructions: x.preparationInstructions, medicationWarnings: x.medicationWarnings, additionalInstructions: x.additionalInstructions })),
    muestras: gruposMuestra,
    ayunos: condicionesAyuno,
    preparacion: textos('preparationInstructions', 'first_urine'),
    medicamentos: textos('medicationWarnings', 'medication'),
    adicionales: textos('additionalInstructions', 'text'),
    conflictos: [
      ...(condicionesAyuno.length > 1 ? ['Los estudios indican horas de ayuno distintas; revisar las condiciones aplicables antes de continuar.'] : []),
      ...(gruposMuestra.length > 1 ? ['La orden requiere distintos tipos de muestra o contenedores.'] : []),
      ...(gruposMuestra.some((grupo) => grupo.volumenes.length > 1) ? ['Los estudios indican volúmenes distintos para el mismo contenedor; confirmar el requerimiento antes de continuar.'] : []),
    ],
  };
}

export function esIncompatible(gender: string, restriction: string): boolean {
  if (restriction === 'BOTH') return false;
  if (gender === 'F' || gender === 'M') return gender !== restriction;
  return true;
}
