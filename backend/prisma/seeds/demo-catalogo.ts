export type Sexo = 'F' | 'M' | null;

export interface RangoDef {
  sexo: Sexo;
  desde: number;
  hasta: number;
  bajo: number | null;
  alto: number | null;
  altoIncluido: boolean;
  bajoIncluido: boolean;
  criticoBajo: number | null;
  criticoAlto: number | null;
  texto: string;
}

export interface ParametroDef {
  nombre: string;
  unidad: string | null;
  cualitativo: string | null;
  normal: string;
  anterior: string[] | null;
  rangos: RangoDef[];
}

export interface InstruccionDef {
  tipo: 'fasting' | 'first_urine' | 'medication' | 'text';
  minHoras: number | null;
  maxHoras: number | null;
  texto: string;
}

export interface EstudioDef {
  codigo: string;
  nombre: string;
  precio: number;
  muestra: string;
  laboratorioExterno: string | null;
  horasEntrega: number | null;
  instrucciones: InstruccionDef[];
  parametros: ParametroDef[];
}

export interface PerfilDef {
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  estudios: string[];
}

function rango(
  sexo: Sexo,
  desde: number,
  hasta: number,
  bajo: number | null,
  alto: number | null,
  texto: string,
  criticoBajo: number | null = null,
  criticoAlto: number | null = null,
): RangoDef {
  return {
    sexo,
    desde,
    hasta,
    bajo,
    alto,
    bajoIncluido: true,
    altoIncluido: true,
    criticoBajo,
    criticoAlto,
    texto,
  };
}

function menorQue(sexo: Sexo, alto: number, texto: string, criticoAlto: number | null = null): RangoDef {
  const resultado = rango(sexo, 18, 120, null, alto, texto, null, criticoAlto);
  resultado.altoIncluido = false;
  return resultado;
}

function mayorQue(sexo: Sexo, bajo: number, texto: string): RangoDef {
  const resultado = rango(sexo, 18, 120, bajo, null, texto);
  resultado.bajoIncluido = false;
  return resultado;
}

function numerico(
  nombre: string,
  unidad: string | null,
  normal: string,
  rangos: RangoDef[],
  anterior: string[] | null = null,
): ParametroDef {
  return { nombre, unidad, cualitativo: null, normal, anterior, rangos };
}

function cualitativo(nombre: string, esperado: string): ParametroDef {
  return { nombre, unidad: null, cualitativo: esperado, normal: esperado, anterior: null, rangos: [] };
}

const SIN_INSTRUCCIONES: InstruccionDef[] = [];

export const MUESTRA_AMARILLO = 'Sangre · tubo amarillo';
export const MUESTRA_LILA = 'Sangre · tubo lila';
export const MUESTRA_ORINA = 'Orina · frasco estéril';

export const ESTUDIOS: EstudioDef[] = [
  {
    codigo: 'GLU001',
    nombre: 'Glucosa en ayuno',
    precio: 120,
    muestra: MUESTRA_AMARILLO,
    laboratorioExterno: null,
    horasEntrega: null,
    instrucciones: [{ tipo: 'fasting', minHoras: 8, maxHoras: 12, texto: 'Ayuno de 8 a 12 horas' }],
    parametros: [
      numerico(
        'Glucosa en ayuno',
        'mg/dL',
        '88',
        [rango(null, 18, 120, 70, 99, '70 – 99', 40, 500), rango(null, 0, 17, 60, 100, '60 – 100', 40, 500)],
        ['98', '10 oct'],
      ),
    ],
  },
  {
    codigo: 'BH001',
    nombre: 'Biometría hemática',
    precio: 180,
    muestra: MUESTRA_LILA,
    laboratorioExterno: null,
    horasEntrega: null,
    instrucciones: SIN_INSTRUCCIONES,
    parametros: [
      numerico('Hemoglobina', 'g/dL', '14.0', [
        rango('F', 18, 120, 12, 16, '12.0 – 16.0', 7, 20),
        rango('M', 18, 120, 13.5, 17.5, '13.5 – 17.5', 7, 20),
        rango(null, 0, 17, 11.5, 15.5, '11.5 – 15.5', 7, 20),
      ]),
      numerico('Hematocrito', '%', '42', [
        rango('F', 18, 120, 36, 46, '36 – 46', 20, 60),
        rango('M', 18, 120, 41, 53, '41 – 53', 20, 60),
        rango(null, 0, 17, 35, 45, '35 – 45', 20, 60),
      ]),
      numerico('Leucocitos', '10³/µL', '7.2', [
        rango(null, 18, 120, 4.5, 11, '4.5 – 11.0', 2, 30),
        rango(null, 0, 17, 5, 14.5, '5.0 – 14.5', 2, 30),
      ]),
      numerico('Plaquetas', '10³/µL', '250', [rango(null, 0, 120, 150, 450, '150 – 450', 50, 1000)]),
    ],
  },
  {
    codigo: 'PERF02',
    nombre: 'Perfil lipídico',
    precio: 450,
    muestra: MUESTRA_AMARILLO,
    laboratorioExterno: null,
    horasEntrega: null,
    instrucciones: [{ tipo: 'fasting', minHoras: 12, maxHoras: 12, texto: 'Ayuno de 12 horas' }],
    parametros: [
      numerico('Colesterol total', 'mg/dL', '180', [menorQue(null, 200, '< 200')], ['192', '14 jun']),
      numerico('Triglicéridos', 'mg/dL', '120', [menorQue(null, 150, '< 150', 500)], ['160', '14 jun']),
      numerico(
        'Colesterol HDL',
        'mg/dL',
        '55',
        [mayorQue('M', 40, '> 40'), mayorQue('F', 50, '> 50')],
        ['49', '14 jun'],
      ),
      numerico('Colesterol LDL (calculado)', 'mg/dL', '100', [menorQue(null, 130, '< 130')], ['111', '14 jun']),
      numerico('Colesterol VLDL (calculado)', 'mg/dL', '24', [menorQue(null, 30, '< 30')], ['32', '14 jun']),
    ],
  },
  {
    codigo: 'EGO001',
    nombre: 'Examen general de orina',
    precio: 90,
    muestra: MUESTRA_ORINA,
    laboratorioExterno: null,
    horasEntrega: null,
    instrucciones: [
      { tipo: 'first_urine', minHoras: null, maxHoras: null, texto: 'Primera orina de la mañana en frasco estéril' },
    ],
    parametros: [
      numerico('pH', null, '6.0', [rango(null, 0, 120, 5, 8, '5.0 – 8.0')]),
      cualitativo('Nitritos', 'Negativo'),
      cualitativo('Proteínas', 'Negativo'),
    ],
  },
  {
    codigo: 'UREA01',
    nombre: 'Urea',
    precio: 70,
    muestra: MUESTRA_AMARILLO,
    laboratorioExterno: null,
    horasEntrega: null,
    instrucciones: SIN_INSTRUCCIONES,
    parametros: [numerico('Urea', 'mg/dL', '30', [rango(null, 18, 120, 15, 45, '15 – 45')])],
  },
  {
    codigo: 'CREA01',
    nombre: 'Creatinina sérica',
    precio: 90,
    muestra: MUESTRA_AMARILLO,
    laboratorioExterno: null,
    horasEntrega: null,
    instrucciones: SIN_INSTRUCCIONES,
    parametros: [
      numerico('Creatinina', 'mg/dL', '0.9', [
        rango('F', 18, 120, 0.5, 1.1, '0.5 – 1.1', null, 10),
        rango('M', 18, 120, 0.7, 1.3, '0.7 – 1.3', null, 10),
        rango(null, 0, 17, 0.3, 0.7, '0.3 – 0.7', null, 10),
      ]),
    ],
  },
  {
    codigo: 'TSH001',
    nombre: 'Hormona estimulante de tiroides (TSH)',
    precio: 250,
    muestra: MUESTRA_AMARILLO,
    laboratorioExterno: null,
    horasEntrega: null,
    instrucciones: [
      {
        tipo: 'medication',
        minHoras: null,
        maxHoras: null,
        texto: 'Avisar si toma levotiroxina u otro medicamento para la tiroides',
      },
    ],
    parametros: [numerico('TSH', 'µUI/mL', '2.1', [rango(null, 18, 120, 0.4, 4, '0.4 – 4.0', null, 20)])],
  },
  {
    codigo: 'EXT001',
    nombre: 'Vitamina D 25-OH (estudio externo)',
    precio: 700,
    muestra: MUESTRA_AMARILLO,
    laboratorioExterno: 'Laboratorio de Referencia del Norte',
    horasEntrega: 72,
    instrucciones: SIN_INSTRUCCIONES,
    parametros: [numerico('Vitamina D 25-OH', 'ng/mL', '45', [rango(null, 18, 120, 30, 100, '30 – 100')])],
  },
];

export const PERFILES: PerfilDef[] = [
  {
    codigo: 'PQB01',
    nombre: 'Química básica',
    descripcion: 'Glucosa, urea y creatinina',
    precio: 250,
    estudios: ['GLU001', 'UREA01', 'CREA01'],
  },
  {
    codigo: 'PCHK01',
    nombre: 'Chequeo general',
    descripcion: 'Biometría, glucosa, perfil lipídico y examen de orina',
    precio: 740,
    estudios: ['BH001', 'GLU001', 'PERF02', 'EGO001'],
  },
];

export function buscarEstudio(codigo: string): EstudioDef {
  for (const estudio of ESTUDIOS) {
    if (estudio.codigo === codigo) return estudio;
  }
  throw new Error(`Estudio ${codigo} no existe en el catálogo del seed`);
}

export function buscarPerfil(codigo: string): PerfilDef {
  for (const perfil of PERFILES) {
    if (perfil.codigo === codigo) return perfil;
  }
  throw new Error(`Perfil ${codigo} no existe en el catálogo del seed`);
}
