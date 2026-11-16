export interface ReferenceRule {
 type: 'numeric' | 'qualitative' | 'text';
 gender: 'M' | 'F' | 'Other' | null;
 ageUnit: 'days' | 'months' | 'years';
 minAge: number; maxAge: number | null;
 condition: string; minWeeks: number | null; maxWeeks: number | null;
 low: number | null; high: number | null;
 criticalLow: number | null; criticalHigh: number | null;
 expected: string | null; display: string; unit: string; method: string;
}
export function validateRules(input: unknown): ReferenceRule[] {
 if (!Array.isArray(input) || !input.length || input.length > 200) throw new Error('Captura entre 1 y 200 rangos');
 const rules = input.map((raw: unknown) => {
  if (!raw || typeof raw !== 'object') throw new Error('Rango inválido');
  const r = raw as ReferenceRule;
  if (!['numeric','qualitative','text'].includes(r.type) || !['days','months','years'].includes(r.ageUnit) || ![null,'M','F','Other'].includes(r.gender)) throw new Error('Tipo, edad o sexo inválido');
  for (const k of ['minAge','maxAge','minWeeks','maxWeeks','low','high','criticalLow','criticalHigh'] as const) {
   if (r[k] !== null && (typeof r[k] !== 'number' || !Number.isFinite(r[k]) || Math.abs(r[k]!) > 99999999)) throw new Error('Límites inválidos');
  }
  if (!Number.isInteger(r.minAge) || r.minAge < 0 || (r.maxAge !== null && (!Number.isInteger(r.maxAge) || r.maxAge <= r.minAge))) throw new Error('La edad final debe ser mayor que la inicial');
  for (const k of ['condition','display','unit','method'] as const) if (typeof r[k] !== 'string' || r[k].length > 100) throw new Error('Texto inválido (máximo 100 caracteres)');
  if (!r.display.trim() || !r.method.trim()) throw new Error('Indica referencia y reactivo o método');
  if (r.type === 'numeric' && (!r.unit.trim() || r.low === null || r.high === null || r.low > r.high || (r.criticalLow !== null && r.criticalLow >= r.low) || (r.criticalHigh !== null && r.criticalHigh <= r.high))) throw new Error('Revisa unidad, límites normales y críticos');
  if (r.type !== 'numeric' && [r.low,r.high,r.criticalLow,r.criticalHigh].some(v => v !== null)) throw new Error('Solo las pruebas numéricas admiten límites numéricos');
  if (r.type === 'qualitative' && (typeof r.expected !== 'string' || !r.expected.trim() || r.expected.length > 100)) throw new Error('Indica el resultado cualitativo esperado');
  if (r.type !== 'qualitative' && r.expected !== null) throw new Error('El valor esperado solo aplica a pruebas cualitativas');
  if ((r.minWeeks === null) !== (r.maxWeeks === null) || (r.minWeeks !== null && (!r.condition.trim() || r.minWeeks < 0 || r.maxWeeks! <= r.minWeeks))) throw new Error('Revisa el intervalo de semanas y la condición');
  return { ...r, condition: r.condition.trim().toLowerCase(), method: r.method.trim(), unit: r.unit.trim() };
 });
 // Cada grupo cubre desde nacimiento sin huecos; extremos superiores excluyentes.
 const groups = new Map<string, ReferenceRule[]>();
 for (const r of rules) {
  const key = JSON.stringify([r.gender,r.condition]);
  const group = groups.get(key) ?? []; group.push(r); groups.set(key,group);
 }
 for (const group of groups.values()) {
  if (new Set(group.map(r=>r.ageUnit)).size !== 1) throw new Error('Usa la misma unidad de edad en cada grupo');
  const bands = new Map<string, ReferenceRule[]>();
  for (const r of group) { const k=JSON.stringify([r.minWeeks,r.maxWeeks]); const a=bands.get(k)??[]; a.push(r); bands.set(k,a); }
  const weeks = [...bands.values()].map(a=>a[0]).sort((a,b)=>(a.minWeeks??0)-(b.minWeeks??0));
  for(let i=1;i<weeks.length;i++) if(weeks[i-1].maxWeeks !== weeks[i].minWeeks) throw new Error('Hay huecos o traslapes entre semanas');
  if(weeks.length>1 && weeks.some(r=>r.minWeeks===null)) throw new Error('Semanas traslapadas');
  for(const band of bands.values()) {
   band.sort((a,b)=>a.minAge-b.minAge);
   if(band[0].minAge!==0 || band.at(-1)!.maxAge!==null) throw new Error('Cubre las edades desde 0 hasta sin límite');
   for(let i=1;i<band.length;i++) if(band[i-1].maxAge!==band[i].minAge) throw new Error('Hay huecos o traslapes de edad');
  }
 }
 for(const a of rules) for(const b of rules) if(a!==b && a.gender===null && b.gender!==null && a.condition===b.condition) throw new Error('No combines sexo general y específico para la misma condición');
 return rules;
}
export function selectReference(rules: ReferenceRule[], birth: Date, at: Date, gender: string, condition = '', weeks: number | null = null): ReferenceRule | undefined {
 const days = Math.floor((Date.UTC(at.getUTCFullYear(),at.getUTCMonth(),at.getUTCDate())-Date.UTC(birth.getUTCFullYear(),birth.getUTCMonth(),birth.getUTCDate()))/86400000);
 const months = (at.getUTCFullYear()-birth.getUTCFullYear())*12+at.getUTCMonth()-birth.getUTCMonth()-(at.getUTCDate()<birth.getUTCDate()?1:0);
 const candidates=rules.filter(r=> r.condition === condition.trim().toLowerCase());
 return candidates.find(r=> {
  const age=r.ageUnit==='days'?days:r.ageUnit==='months'?months:Math.floor(months/12);
  return (r.gender===null || r.gender===gender) && age>=r.minAge && (r.maxAge===null || age<r.maxAge) && (r.minWeeks===null || (weeks!==null && weeks>=r.minWeeks && weeks<r.maxWeeks!));
 });
}
