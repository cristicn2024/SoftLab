export type Metodo = 'cash' | 'card' | 'transfer';
export type EstadoOrden = 'pending' | 'in_process' | 'completed' | 'cancelled';
export type Sucursal = 'central' | 'norte';
export type Usuario = 'laura' | 'carlos' | 'daniela' | 'andrea' | 'marco';

export interface UsuarioDef {
  clave: Usuario;
  nombre: string;
  correo: string;
  rol: 'admin' | 'receptionist' | 'chemist';
  sucursal: Sucursal;
}

export interface MedicoDef {
  nombre: string;
  cedula: string;
  especialidad: string;
}

export interface PacienteDef {
  nombre: string;
  apellidos: string;
  nacimiento: string;
  sexo: 'F' | 'M';
  telefono: string;
  correo: string;
}

export interface PagoDef {
  metodo: Metodo;
  monto: number;
  referencia: string | null;
  minutos: number;
  anulado: string | null;
}

export interface FacturaDef {
  rfc: string;
  nombre: string;
  codigoPostal: string;
  uso: string;
}

export interface OrdenDef {
  clave: string;
  paciente: number;
  medico: number;
  sucursal: Sucursal;
  cajero: Usuario;
  diasAtras: number;
  hora: number;
  minuto: number;
  minutosAtras: number | null;
  estudios: string[];
  perfiles: string[];
  descuento: number;
  motivoDescuento: string | null;
  estado: EstadoOrden;
  muestra: 'ninguna' | 'tomada' | 'recibida';
  capturados: string[];
  validados: boolean;
  valores: Record<string, string>;
  pagos: PagoDef[];
  entregada: boolean;
  factura: FacturaDef | null;
  instrucciones: boolean;
  nota: string;
}

export const USUARIOS: UsuarioDef[] = [
  { clave: 'laura', nombre: 'Laura Méndez', correo: 'laura.mendez@santalucia.demo', rol: 'admin', sucursal: 'central' },
  { clave: 'carlos', nombre: 'Carlos Ibarra', correo: 'carlos.ibarra@santalucia.demo', rol: 'receptionist', sucursal: 'central' },
  { clave: 'daniela', nombre: 'Daniela Soto', correo: 'daniela.soto@santalucia.demo', rol: 'receptionist', sucursal: 'norte' },
  { clave: 'andrea', nombre: 'Q.F.B. Andrea Ruiz', correo: 'andrea.ruiz@santalucia.demo', rol: 'chemist', sucursal: 'central' },
  { clave: 'marco', nombre: 'Q.F.B. Marco Peña', correo: 'marco.pena@santalucia.demo', rol: 'chemist', sucursal: 'norte' },
];

export const MEDICOS: MedicoDef[] = [
  { nombre: 'Dra. Patricia Ruiz', cedula: '8845123', especialidad: 'Medicina interna' },
  { nombre: 'Dr. Ernesto Salas', cedula: '7712094', especialidad: 'Pediatría' },
  { nombre: 'Dra. Julia Contreras', cedula: '9021377', especialidad: 'Ginecología' },
];

export const PACIENTES: PacienteDef[] = [
  { nombre: 'María', apellidos: 'López García', nacimiento: '1988-03-12', sexo: 'F', telefono: '6445550042', correo: 'maria.lopez@correo.demo' },
  { nombre: 'José Luis', apellidos: 'Hernández Ramos', nacimiento: '1975-08-30', sexo: 'M', telefono: '6445550118', correo: 'jose.hernandez@correo.demo' },
  { nombre: 'Ana Sofía', apellidos: 'Torres Valdez', nacimiento: '2016-05-04', sexo: 'F', telefono: '6445550177', correo: 'torres.valdez@correo.demo' },
  { nombre: 'Roberto', apellidos: 'Camacho Díaz', nacimiento: '1951-11-21', sexo: 'M', telefono: '6445550230', correo: 'roberto.camacho@correo.demo' },
  { nombre: 'Fernanda', apellidos: 'Ríos Acosta', nacimiento: '1996-01-17', sexo: 'F', telefono: '6445550305', correo: 'fernanda.rios@correo.demo' },
  { nombre: 'Miguel Ángel', apellidos: 'Soto Lara', nacimiento: '2001-09-09', sexo: 'M', telefono: '6445550361', correo: 'miguel.soto@correo.demo' },
  { nombre: 'Guadalupe', apellidos: 'Mendoza Peña', nacimiento: '1969-06-25', sexo: 'F', telefono: '6445550412', correo: 'guadalupe.mendoza@correo.demo' },
  { nombre: 'Diego Armando', apellidos: 'Fierro Cota', nacimiento: '1990-12-02', sexo: 'M', telefono: '6445550499', correo: 'diego.fierro@correo.demo' },
];

const MARIA = 0;
const JOSE_LUIS = 1;
const ANA_SOFIA = 2;
const ROBERTO = 3;
const FERNANDA = 4;
const MIGUEL = 5;
const GUADALUPE = 6;
const DIEGO = 7;

const PATRICIA = 0;
const ERNESTO = 1;
const JULIA = 2;

function pago(metodo: Metodo, monto: number, minutos: number, referencia: string | null = null): PagoDef {
  return { metodo, monto, referencia, minutos, anulado: null };
}

function pagoAnulado(metodo: Metodo, monto: number, minutos: number, motivo: string): PagoDef {
  return { metodo, monto, referencia: null, minutos, anulado: motivo };
}

interface Opciones {
  clave: string;
  nota: string;
  paciente: number;
  medico: number;
  estudios: string[];
  estado: EstadoOrden;
  pagos: PagoDef[];
  sucursal?: Sucursal;
  cajero?: Usuario;
  perfiles?: string[];
  descuento?: number;
  motivoDescuento?: string | null;
  muestra?: 'ninguna' | 'tomada' | 'recibida';
  capturados?: string[];
  validados?: boolean;
  valores?: Record<string, string>;
  entregada?: boolean;
  factura?: FacturaDef | null;
  instrucciones?: boolean;
}

function hoy(minutosAtras: number, opciones: Opciones): OrdenDef {
  return armar(0, 0, 0, minutosAtras, opciones);
}

function enDia(diasAtras: number, hora: number, minuto: number, opciones: Opciones): OrdenDef {
  return armar(diasAtras, hora, minuto, null, opciones);
}

function armar(
  diasAtras: number,
  hora: number,
  minuto: number,
  minutosAtras: number | null,
  opciones: Opciones,
): OrdenDef {
  let muestra: 'ninguna' | 'tomada' | 'recibida' = 'ninguna';
  if (opciones.estado !== 'cancelled') muestra = 'recibida';
  if (opciones.muestra !== undefined) muestra = opciones.muestra;

  return {
    clave: opciones.clave,
    nota: opciones.nota,
    paciente: opciones.paciente,
    medico: opciones.medico,
    sucursal: opciones.sucursal ?? 'central',
    cajero: opciones.cajero ?? 'carlos',
    diasAtras,
    hora,
    minuto,
    minutosAtras,
    estudios: opciones.estudios,
    perfiles: opciones.perfiles ?? [],
    descuento: opciones.descuento ?? 0,
    motivoDescuento: opciones.motivoDescuento ?? null,
    estado: opciones.estado,
    muestra,
    capturados: opciones.capturados ?? [],
    validados: opciones.validados ?? false,
    valores: opciones.valores ?? {},
    pagos: opciones.pagos,
    entregada: opciones.entregada ?? false,
    factura: opciones.factura ?? null,
    instrucciones: opciones.instrucciones ?? false,
  };
}

export const ORDENES: OrdenDef[] = [
  hoy(20, {
    clave: 'nueva-con-perfil',
    nota: 'Orden abierta de hoy con perfil, sin pago y con la muestra apenas tomada',
    paciente: MARIA,
    medico: PATRICIA,
    estudios: ['EGO001'],
    perfiles: ['PQB01'],
    estado: 'pending',
    muestra: 'tomada',
    instrucciones: true,
    pagos: [],
  }),
  hoy(95, {
    clave: 'lista-sin-captura',
    nota: 'Lista de trabajo: muestra recibida y nada capturado. Pagada en efectivo',
    paciente: JOSE_LUIS,
    medico: PATRICIA,
    estudios: ['BH001', 'GLU001'],
    estado: 'in_process',
    pagos: [pago('cash', 300, 5)],
  }),
  hoy(80, {
    clave: 'lista-pediatrica',
    nota: 'Paciente pediátrica: usa los rangos de 0 a 17 años. Pagada con tarjeta',
    paciente: ANA_SOFIA,
    medico: ERNESTO,
    estudios: ['BH001'],
    estado: 'in_process',
    pagos: [pago('card', 180, 6, 'AUTH-4471')],
  }),
  hoy(140, {
    clave: 'captura-parcial',
    nota: 'Glucosa ya capturada (alta) y perfil lipídico pendiente. Pago parcial: queda saldo',
    paciente: ROBERTO,
    medico: PATRICIA,
    estudios: ['GLU001', 'PERF02'],
    estado: 'in_process',
    capturados: ['GLU001'],
    valores: { 'Glucosa en ayuno': '112' },
    pagos: [pago('cash', 200, 8), pago('transfer', 100, 9, 'SPEI-20481')],
  }),
  hoy(60, {
    clave: 'externo-con-descuento',
    nota: 'TSH pendiente y vitamina D de laboratorio externo (no sale en la lista). Descuento del 10% y pago parcial',
    paciente: GUADALUPE,
    medico: JULIA,
    estudios: ['TSH001', 'EXT001'],
    estado: 'in_process',
    descuento: 10,
    motivoDescuento: 'Paciente frecuente',
    pagos: [pago('card', 400, 7, 'AUTH-5528')],
  }),
  hoy(210, {
    clave: 'entrega-lista',
    nota: 'Entrega: resultados validados y cuenta liquidada. Genera el PDF sin bloqueo',
    paciente: FERNANDA,
    medico: PATRICIA,
    estudios: ['BH001', 'GLU001'],
    estado: 'completed',
    validados: true,
    pagos: [pago('cash', 300, 4)],
  }),
  hoy(190, {
    clave: 'entrega-con-saldo',
    nota: 'Entrega bloqueada: resultados validados pero debe $110',
    paciente: MIGUEL,
    medico: PATRICIA,
    estudios: ['EGO001', 'GLU001'],
    estado: 'completed',
    validados: true,
    valores: { 'Glucosa en ayuno': '105' },
    pagos: [pago('cash', 100, 5)],
  }),
  hoy(300, {
    clave: 'entregada-con-factura',
    nota: 'Descuento autorizado por admin, datos de factura y resultados ya entregados',
    paciente: DIEGO,
    medico: PATRICIA,
    estudios: ['PERF02', 'GLU001'],
    estado: 'completed',
    descuento: 10,
    motivoDescuento: 'Convenio empresarial',
    validados: true,
    entregada: true,
    factura: {
      rfc: 'FICD901202AB3',
      nombre: 'Diego Armando Fierro Cota',
      codigoPostal: '85000',
      uso: 'D01 · Honorarios médicos y gastos hospitalarios',
    },
    pagos: [pago('transfer', 513, 6, 'SPEI-20455')],
  }),
  hoy(330, {
    clave: 'pago-anulado',
    nota: 'Cobro en efectivo anulado por duplicado y vuelto a cobrar con tarjeta: el corte solo cuenta la tarjeta',
    paciente: GUADALUPE,
    medico: JULIA,
    estudios: ['TSH001'],
    estado: 'completed',
    validados: true,
    pagos: [pagoAnulado('cash', 250, 5, 'Cobro duplicado'), pago('card', 250, 12, 'AUTH-5490')],
  }),
  hoy(270, {
    clave: 'orden-cancelada',
    nota: 'Orden cancelada y su único pago anulado porque se devolvió el efectivo. No suma al corte',
    paciente: FERNANDA,
    medico: PATRICIA,
    estudios: ['GLU001'],
    estado: 'cancelled',
    pagos: [pagoAnulado('cash', 120, 5, 'Orden cancelada: se devolvió el efectivo')],
  }),

  enDia(1, 9, 10, {
    clave: 'ayer-m1',
    nota: 'Corte de ayer, matutino, Central',
    paciente: FERNANDA,
    medico: PATRICIA,
    estudios: ['GLU001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pago('cash', 120, 4)],
  }),
  enDia(1, 10, 25, {
    clave: 'ayer-m2',
    nota: 'Corte de ayer, matutino, Central',
    paciente: MIGUEL,
    medico: PATRICIA,
    estudios: ['BH001', 'GLU001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pago('card', 300, 5, 'AUTH-3301')],
  }),
  enDia(1, 11, 40, {
    clave: 'ayer-m3',
    nota: 'Corte de ayer, matutino, Central: descuento y pago mixto',
    paciente: DIEGO,
    medico: PATRICIA,
    estudios: ['PERF02'],
    estado: 'completed',
    descuento: 10,
    motivoDescuento: 'Convenio empresarial',
    validados: true,
    entregada: true,
    pagos: [pago('cash', 205, 4), pago('transfer', 200, 6, 'SPEI-19984')],
  }),
  enDia(1, 12, 30, {
    clave: 'ayer-m4',
    nota: 'Corte de ayer, matutino, Central: orden cancelada sin pago',
    paciente: MARIA,
    medico: PATRICIA,
    estudios: ['EGO001'],
    estado: 'cancelled',
    pagos: [],
  }),
  enDia(1, 13, 15, {
    clave: 'ayer-m5',
    nota: 'Corte de ayer, matutino, Central: tarjeta rechazada y cobro en efectivo',
    paciente: ROBERTO,
    medico: PATRICIA,
    estudios: ['TSH001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pagoAnulado('card', 250, 3, 'La terminal rechazó el cargo'), pago('cash', 250, 9)],
  }),
  enDia(1, 16, 5, {
    clave: 'ayer-v1',
    nota: 'Ayer, vespertino, Central: turno sin cerrar',
    paciente: ANA_SOFIA,
    medico: ERNESTO,
    estudios: ['BH001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pago('cash', 180, 5)],
  }),
  enDia(1, 18, 40, {
    clave: 'ayer-v2',
    nota: 'Ayer, vespertino, Central: turno sin cerrar',
    paciente: GUADALUPE,
    medico: JULIA,
    estudios: ['UREA01', 'CREA01', 'GLU001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pago('card', 280, 6, 'AUTH-3355')],
  }),
  enDia(1, 9, 30, {
    clave: 'ayer-norte-1',
    nota: 'Ayer, matutino, Norte: turno sin cerrar',
    paciente: ROBERTO,
    medico: PATRICIA,
    sucursal: 'norte',
    cajero: 'daniela',
    estudios: ['PERF02', 'GLU001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pago('transfer', 570, 5, 'SPEI-19990')],
  }),
  enDia(1, 12, 10, {
    clave: 'ayer-norte-2',
    nota: 'Ayer, matutino, Norte: turno sin cerrar',
    paciente: DIEGO,
    medico: JULIA,
    sucursal: 'norte',
    cajero: 'daniela',
    estudios: ['BH001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pago('cash', 180, 4)],
  }),

  enDia(2, 9, 20, {
    clave: 'antier-1',
    nota: 'Corte de antier, matutino, Central, sin diferencia',
    paciente: MIGUEL,
    medico: PATRICIA,
    estudios: ['GLU001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pago('cash', 120, 4)],
  }),
  enDia(2, 11, 5, {
    clave: 'antier-2',
    nota: 'Corte de antier, matutino, Central, sin diferencia',
    paciente: FERNANDA,
    medico: PATRICIA,
    estudios: ['EGO001', 'GLU001'],
    estado: 'completed',
    validados: true,
    entregada: true,
    pagos: [pago('card', 210, 5, 'AUTH-2204')],
  }),
];

export interface CorteDef {
  sucursal: Sucursal;
  cajero: Usuario;
  cerro: Usuario;
  diasAtras: number;
  turno: 'matutino' | 'vespertino' | 'nocturno';
  horaCierre: number;
  minutoCierre: number;
  contado: number;
  observacion: string | null;
}

export const CORTES_CERRADOS: CorteDef[] = [
  {
    sucursal: 'central',
    cajero: 'carlos',
    cerro: 'laura',
    diasAtras: 1,
    turno: 'matutino',
    horaCierre: 15,
    minutoCierre: 5,
    contado: 555,
    observacion: 'Faltante de cambio en caja',
  },
  {
    sucursal: 'central',
    cajero: 'carlos',
    cerro: 'laura',
    diasAtras: 2,
    turno: 'matutino',
    horaCierre: 15,
    minutoCierre: 0,
    contado: 120,
    observacion: null,
  },
];
