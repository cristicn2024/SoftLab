import { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import {
  buildLiveSummary,
  buildSnapshot,
  formatLocalDate,
  parseDateOnly,
  resolvePeriod,
} from '../../src/modules/corte-caja/dominio/corte-caja.rules';
import type { LiveOrder, Scope } from '../../src/modules/corte-caja/dominio/corte-caja.types';
import {
  buildRule,
  calculateAge,
  interpretValue,
  pickRange,
} from '../../src/modules/worklist/dominio/worklist.rules';
import type { RangeRecord } from '../../src/modules/worklist/dominio/worklist.types';
import { buscarEstudio, buscarPerfil, ESTUDIOS, PERFILES } from './demo-catalogo';
import type { EstudioDef } from './demo-catalogo';
import { CORTES_CERRADOS, MEDICOS, ORDENES, PACIENTES, USUARIOS } from './demo-ordenes';
import type { OrdenDef, Sucursal } from './demo-ordenes';

type Tx = Prisma.TransactionClient;

export const CLAVE_DEMO = 'softlab2026';
const NOMBRE_LABORATORIO = 'Laboratorio Santa Lucía';
const SUBDOMINIO = 'central';
const ID_PREFERIDO = 1;

const METODOS: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

interface EstudioCreado {
  id: number;
  def: EstudioDef;
  parametros: Record<string, number>;
  rangos: RangoGuardado[];
}

interface RangoGuardado {
  parametro: string;
  registro: RangeRecord;
}

interface OrdenCreada {
  def: OrdenDef;
  id: number;
  folio: string;
  creada: Date;
  live: LiveOrder;
}

export interface ResumenDemo {
  tenantId: number;
  filas: Array<Record<string, string | number>>;
}

function hashClave(clave: string): string {
  const sal = randomBytes(16).toString('hex');
  const hash = scryptSync(clave, sal, 32).toString('hex');
  return `scrypt$${sal}$${hash}`;
}

function pesos(valor: number): string {
  return `$${valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sumarMinutos(base: Date, minutos: number, tope: Date): Date {
  const resultado = new Date(base.getTime() + minutos * 60000);
  if (resultado.getTime() > tope.getTime()) return tope;
  return resultado;
}

function momentoDeOrden(def: OrdenDef, ahora: Date): Date {
  if (def.minutosAtras !== null) return new Date(ahora.getTime() - def.minutosAtras * 60000);
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - def.diasAtras, def.hora, def.minuto, 0, 0);
}

function fechaLocal(ahora: Date, diasAtras: number): string {
  return formatLocalDate(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - diasAtras));
}

function claveDeMuestra(muestra: string): string {
  if (muestra.indexOf('amarillo') >= 0) return 'AMARILLO';
  if (muestra.indexOf('lila') >= 0) return 'LILA';
  return 'ORINA';
}

function equipoDeMuestra(muestra: string): string {
  if (muestra.indexOf('amarillo') >= 0) return 'Analizador químico AQ-2';
  if (muestra.indexOf('lila') >= 0) return 'Analizador hematológico HM-1';
  return 'Lectora de tiras de orina UR-1';
}

async function borrarLaboratorio(tx: Tx, tenantId: number): Promise<void> {
  const where = { tenantId };
  await tx.criticalNotification.deleteMany({ where });
  await tx.instructionDelivery.deleteMany({ where });
  await tx.instructionConfirmation.deleteMany({ where });
  await tx.testResult.deleteMany({ where });
  await tx.payment.deleteMany({ where });
  await tx.paymentLog.deleteMany({ where });
  await tx.orderReport.deleteMany({ where });
  await tx.sample.deleteMany({ where });
  await tx.orderItem.deleteMany({ where: { order: { tenantId } } });
  await tx.order.deleteMany({ where });
  await tx.cashCut.deleteMany({ where });
  await tx.referenceRange.deleteMany({ where });
  await tx.testParameter.deleteMany({ where });
  await tx.studyInstruction.deleteMany({ where });
  await tx.profileTest.deleteMany({ where: { profile: { tenantId } } });
  await tx.profileCatalog.deleteMany({ where });
  await tx.testCatalog.deleteMany({ where });
  await tx.reportTemplate.deleteMany({ where });
  await tx.practitioner.deleteMany({ where });
  await tx.doctor.deleteMany({ where });
  await tx.patient.deleteMany({ where });
  await tx.user.deleteMany({ where });
  await tx.branch.deleteMany({ where });
  await tx.tenant.delete({ where: { id: tenantId } });
}

async function crearLaboratorio(tx: Tx): Promise<number> {
  const previos = await tx.tenant.findMany({
    where: { OR: [{ subdomain: SUBDOMINIO }, { name: NOMBRE_LABORATORIO }] },
  });
  for (const previo of previos) {
    await borrarLaboratorio(tx, previo.id);
  }

  const ocupado = await tx.tenant.findUnique({ where: { id: ID_PREFERIDO } });
  const datos: Prisma.TenantCreateInput = { name: NOMBRE_LABORATORIO, subdomain: SUBDOMINIO, status: 'active' };
  if (ocupado === null) {
    const conId = await tx.tenant.create({ data: { id: ID_PREFERIDO, ...datos } });
    return conId.id;
  }

  console.log(`El laboratorio ${ID_PREFERIDO} es de otro cliente y no se tocó. El demo usará otro id.`);
  const nuevo = await tx.tenant.create({ data: datos });
  return nuevo.id;
}

async function crearCatalogo(tx: Tx, tenantId: number): Promise<Record<string, EstudioCreado>> {
  const creados: Record<string, EstudioCreado> = {};

  for (const def of ESTUDIOS) {
    const estudio = await tx.testCatalog.create({
      data: {
        tenantId,
        code: def.codigo,
        name: def.nombre,
        price: def.precio,
        sampleType: def.muestra,
        externalLab: def.laboratorioExterno,
        turnaroundHours: def.horasEntrega,
      },
    });
    const creado: EstudioCreado = { id: estudio.id, def, parametros: {}, rangos: [] };

    for (const instruccion of def.instrucciones) {
      await tx.studyInstruction.create({
        data: {
          tenantId,
          testId: estudio.id,
          type: instruccion.tipo,
          minHours: instruccion.minHoras,
          maxHours: instruccion.maxHoras,
          text: instruccion.texto,
        },
      });
    }

    let orden = 0;
    for (const parametro of def.parametros) {
      orden += 1;
      const guardado = await tx.testParameter.create({
        data: {
          tenantId,
          testId: estudio.id,
          name: parametro.nombre,
          unit: parametro.unidad,
          sortOrder: orden,
          qualitativeExpected: parametro.cualitativo,
          previousValue: parametro.anterior === null ? null : parametro.anterior[0],
          previousDate: parametro.anterior === null ? null : parametro.anterior[1],
        },
      });
      creado.parametros[parametro.nombre] = guardado.id;

      for (const rango of parametro.rangos) {
        await tx.referenceRange.create({
          data: {
            tenantId,
            testId: estudio.id,
            parameterId: guardado.id,
            gender: rango.sexo,
            minAgeYears: rango.desde,
            maxAgeYears: rango.hasta,
            low: rango.bajo,
            high: rango.alto,
            lowInclusive: rango.bajoIncluido,
            highInclusive: rango.altoIncluido,
            criticalLow: rango.criticoBajo,
            criticalHigh: rango.criticoAlto,
            display: rango.texto,
          },
        });
        creado.rangos.push({
          parametro: parametro.nombre,
          registro: {
            gender: rango.sexo,
            minAgeYears: rango.desde,
            maxAgeYears: rango.hasta,
            low: rango.bajo,
            high: rango.alto,
            lowInclusive: rango.bajoIncluido,
            highInclusive: rango.altoIncluido,
            criticalLow: rango.criticoBajo,
            criticalHigh: rango.criticoAlto,
            criticalLowInclusive: false,
            criticalHighInclusive: false,
            display: rango.texto,
          },
        });
      }
    }
    creados[def.codigo] = creado;
  }

  return creados;
}

async function crearPerfiles(
  tx: Tx,
  tenantId: number,
  estudios: Record<string, EstudioCreado>,
): Promise<Record<string, number>> {
  const ids: Record<string, number> = {};
  for (const def of PERFILES) {
    const perfil = await tx.profileCatalog.create({
      data: {
        tenantId,
        code: def.codigo,
        name: def.nombre,
        description: def.descripcion,
        price: def.precio,
        status: true,
      },
    });
    ids[def.codigo] = perfil.id;
    for (const codigo of def.estudios) {
      await tx.profileTest.create({ data: { profileId: perfil.id, testId: estudios[codigo].id } });
    }
  }
  return ids;
}

function calcularBandera(creado: EstudioCreado, parametro: string, valor: string, sexo: string, edad: number): string {
  const aplicables: RangeRecord[] = [];
  for (const rango of creado.rangos) {
    if (rango.parametro === parametro) aplicables.push(rango.registro);
  }
  let esperado: string | null = null;
  for (const def of creado.def.parametros) {
    if (def.nombre === parametro) esperado = def.cualitativo;
  }
  const rango = pickRange(aplicables, sexo, edad);
  return interpretValue(valor, buildRule(rango, esperado));
}

export async function sembrarDemo(prisma: PrismaClient): Promise<ResumenDemo> {
  const ahora = new Date();
  const clave = hashClave(CLAVE_DEMO);

  return prisma.$transaction(
    async (tx) => {
      const tenantId = await crearLaboratorio(tx);

      const sucursales: Record<Sucursal, number> = { central: 0, norte: 0 };
      const central = await tx.branch.create({
        data: { tenantId, name: 'Clínica Central', address: 'Av. Principal 100', phone: '6445550100' },
      });
      const norte = await tx.branch.create({
        data: { tenantId, name: 'Clínica Norte', address: 'Blvd. Norte 250', phone: '6445550200' },
      });
      sucursales.central = central.id;
      sucursales.norte = norte.id;

      const usuarios: Record<string, { id: number; nombre: string }> = {};
      for (const def of USUARIOS) {
        const usuario = await tx.user.create({
          data: {
            tenantId,
            branchId: sucursales[def.sucursal],
            fullName: def.nombre,
            email: def.correo,
            passwordHash: clave,
            role: def.rol,
          },
        });
        usuarios[def.clave] = { id: usuario.id, nombre: def.nombre };
      }

      const medicos: Array<{ doctorId: number; practitionerId: number; nombre: string }> = [];
      for (const def of MEDICOS) {
        const doctor = await tx.doctor.create({
          data: { tenantId, name: def.nombre, cedula: def.cedula, specialty: def.especialidad },
        });
        const practicante = await tx.practitioner.create({
          data: { tenantId, fullName: def.nombre, specialty: def.especialidad },
        });
        medicos.push({ doctorId: doctor.id, practitionerId: practicante.id, nombre: def.nombre });
      }

      const pacientes: Array<{ id: number; sexo: 'F' | 'M'; nacimiento: Date; nombre: string; apellidos: string }> = [];
      let numero = 0;
      for (const def of PACIENTES) {
        numero += 1;
        const nacimiento = new Date(`${def.nacimiento}T00:00:00Z`);
        const paciente = await tx.patient.create({
          data: {
            tenantId,
            firstName: def.nombre,
            lastName: def.apellidos,
            birthDate: nacimiento,
            gender: def.sexo,
            patientCode: `P-${String(numero).padStart(6, '0')}`,
            phone: def.telefono,
            email: def.correo,
          },
        });
        pacientes.push({
          id: paciente.id,
          sexo: def.sexo,
          nacimiento,
          nombre: def.nombre,
          apellidos: def.apellidos,
        });
      }

      const estudios = await crearCatalogo(tx, tenantId);
      const perfiles = await crearPerfiles(tx, tenantId, estudios);

      await tx.reportTemplate.create({
        data: {
          tenantId,
          name: 'Informe Santa Lucía',
          version: 1,
          isDefault: false,
          chemistName: 'Q.F.B. Andrea Ruiz',
          chemistCedula: '10234567',
          footerText: 'Laboratorio Santa Lucía',
        },
      });
      const plantilla = await tx.reportTemplate.create({
        data: {
          tenantId,
          name: 'Informe Santa Lucía',
          version: 2,
          isDefault: true,
          primaryColor: '#0f766e',
          chemistName: 'Q.F.B. Andrea Ruiz',
          chemistCedula: '10234567',
          headerText: 'Laboratorio Santa Lucía · Análisis clínicos',
          footerText: 'Av. Principal 100 · Tel. 644 555 0100',
          disclaimer: 'Los resultados deben ser interpretados por el médico tratante.',
        },
      });

      const ordenadas: OrdenDef[] = [];
      const tiempos: Record<string, Date> = {};
      for (const def of ORDENES) {
        tiempos[def.clave] = momentoDeOrden(def, ahora);
        ordenadas.push(def);
      }
      ordenadas.sort(function porFecha(a, b) {
        return tiempos[a.clave].getTime() - tiempos[b.clave].getTime();
      });

      const consecutivos: Record<string, number> = {};
      const creadas: OrdenCreada[] = [];

      for (const def of ordenadas) {
        const creada = tiempos[def.clave];
        const dia = creada.toISOString().slice(0, 10).replace(/-/g, '');
        consecutivos[dia] = (consecutivos[dia] ?? 0) + 1;
        const folio = `ORD-${dia}-${String(consecutivos[dia]).padStart(4, '0')}`;

        const paciente = pacientes[def.paciente];
        const medico = medicos[def.medico];
        const cajero = usuarios[def.cajero];
        const quimico = usuarios[def.sucursal === 'norte' ? 'marco' : 'andrea'];
        const edad = calculateAge(paciente.nacimiento, creada);

        let subtotal = 0;
        for (const codigo of def.estudios) subtotal += buscarEstudio(codigo).precio;
        for (const codigo of def.perfiles) subtotal += buscarPerfil(codigo).precio;
        const descuento = Math.round((subtotal * def.descuento) / 100);
        const total = subtotal - descuento;

        let pagado = 0;
        for (const pago of def.pagos) {
          if (pago.anulado === null) pagado += pago.monto;
        }

        const orden = await tx.order.create({
          data: {
            tenantId,
            branchId: sucursales[def.sucursal],
            patientId: paciente.id,
            doctorId: medico.doctorId,
            physicianId: medico.practitionerId,
            doctorName: medico.nombre,
            cashierId: cajero.id,
            totalAmount: total,
            discountAmount: descuento,
            discountPercent: def.descuento,
            discountReason: def.motivoDescuento,
            discountAuthorizedBy: def.descuento > 0 ? usuarios.laura.nombre : null,
            paidAmount: pagado,
            status: def.estado,
            folio,
            createdAt: creada,
            invoiceRfc: def.factura === null ? null : def.factura.rfc,
            invoiceName: def.factura === null ? null : def.factura.nombre,
            invoiceZip: def.factura === null ? null : def.factura.codigoPostal,
            invoiceUse: def.factura === null ? null : def.factura.uso,
            resultsDeliveredAt: def.entregada ? sumarMinutos(creada, 180, ahora) : null,
          },
        });

        const tiposDeMuestra: string[] = [];
        for (const codigo of def.estudios) {
          const estudio = estudios[codigo];
          const item = await tx.orderItem.create({
            data: { orderId: orden.id, testId: estudio.id, price: estudio.def.precio },
          });
          if (tiposDeMuestra.indexOf(estudio.def.muestra) < 0) tiposDeMuestra.push(estudio.def.muestra);

          const capturar = def.validados || def.capturados.indexOf(codigo) >= 0;
          if (!capturar) continue;

          for (const parametro of estudio.def.parametros) {
            let valor = parametro.normal;
            if (def.valores[parametro.nombre] !== undefined) valor = def.valores[parametro.nombre];
            const bandera = calcularBandera(estudio, parametro.nombre, valor, paciente.sexo, edad);
            await tx.testResult.create({
              data: {
                tenantId,
                orderItemId: item.id,
                parameterId: estudio.parametros[parametro.nombre],
                resultValue: valor,
                flag: bandera,
                isAlert: bandera !== 'Normal' && bandera !== '—',
                status: def.validados ? 'validated' : 'captured',
                validatedBy: def.validados ? quimico.id : null,
                validatedAt: def.validados ? sumarMinutos(creada, 120, ahora) : null,
                createdAt: sumarMinutos(creada, 90, ahora),
              },
            });
          }
        }
        for (const codigo of def.perfiles) {
          await tx.orderItem.create({
            data: { orderId: orden.id, profileId: perfiles[codigo], price: buscarPerfil(codigo).precio },
          });
        }

        if (def.muestra !== 'ninguna') {
          for (const tipo of tiposDeMuestra) {
            const recibida = def.muestra === 'recibida';
            await tx.sample.create({
              data: {
                tenantId,
                orderId: orden.id,
                barcode: `${folio}-${claveDeMuestra(tipo)}`,
                status: recibida ? 'received' : 'collected',
                collectedAt: sumarMinutos(creada, 10, ahora),
                receivedAt: recibida ? sumarMinutos(creada, 25, ahora) : null,
                sampleDescription: tipo,
                equipment: recibida ? equipoDeMuestra(tipo) : null,
                capturedByName: recibida ? quimico.nombre : null,
                createdAt: sumarMinutos(creada, 10, ahora),
              },
            });
          }
        }

        if (def.descuento > 0) {
          await tx.paymentLog.create({
            data: {
              tenantId,
              orderId: orden.id,
              userName: usuarios.laura.nombre,
              action: 'Aplicó descuento',
              detail: `${def.descuento}% · ${def.motivoDescuento} · autorizó ${usuarios.laura.nombre}`,
              createdAt: sumarMinutos(creada, 3, ahora),
            },
          });
        }

        const pagosVivos: LiveOrder['payments'] = [];
        for (const pago of def.pagos) {
          const fecha = sumarMinutos(creada, pago.minutos, ahora);
          const anulado = pago.anulado !== null;
          await tx.payment.create({
            data: {
              tenantId,
              branchId: sucursales[def.sucursal],
              orderId: orden.id,
              cashierId: cajero.id,
              method: pago.metodo,
              amount: pago.monto,
              reference: pago.referencia,
              createdBy: cajero.nombre,
              createdAt: fecha,
              cancelled: anulado,
              cancelReason: pago.anulado,
              cancelledBy: anulado ? usuarios.laura.nombre : null,
              cancelledAt: anulado ? sumarMinutos(fecha, 15, ahora) : null,
            },
          });
          await tx.paymentLog.create({
            data: {
              tenantId,
              orderId: orden.id,
              userName: cajero.nombre,
              action: 'Registró pago',
              detail: `${METODOS[pago.metodo]} · ${pesos(pago.monto)}`,
              createdAt: fecha,
            },
          });
          if (anulado) {
            await tx.paymentLog.create({
              data: {
                tenantId,
                orderId: orden.id,
                userName: usuarios.laura.nombre,
                action: 'Canceló pago',
                detail: `${METODOS[pago.metodo]} · ${pesos(pago.monto)} · ${pago.anulado}`,
                createdAt: sumarMinutos(fecha, 15, ahora),
              },
            });
          }
          pagosVivos.push({ method: pago.metodo, amount: pago.monto, cancelled: anulado });
        }
        if (total - pagado > 0 && def.estado !== 'cancelled') {
          await tx.paymentLog.create({
            data: {
              tenantId,
              orderId: orden.id,
              userName: cajero.nombre,
              action: 'Orden pendiente de pago',
              detail: `Saldo por cobrar ${pesos(total - pagado)}`,
              createdAt: sumarMinutos(creada, 20, ahora),
            },
          });
        }
        if (def.factura !== null) {
          await tx.paymentLog.create({
            data: {
              tenantId,
              orderId: orden.id,
              userName: cajero.nombre,
              action: 'Capturó datos de facturación',
              detail: def.factura.rfc,
              createdAt: sumarMinutos(creada, 7, ahora),
            },
          });
        }

        if (def.instrucciones) {
          await tx.instructionConfirmation.create({
            data: {
              tenantId,
              orderId: orden.id,
              userId: cajero.id,
              branchId: sucursales[def.sucursal],
              confirmedAt: sumarMinutos(creada, 2, ahora),
            },
          });
          await tx.instructionDelivery.create({
            data: { tenantId, orderId: orden.id, userId: cajero.id, channel: 'whatsapp', createdAt: sumarMinutos(creada, 3, ahora) },
          });
        }

        if (def.entregada && def.estado === 'completed') {
          await tx.orderReport.create({
            data: {
              tenantId,
              orderId: orden.id,
              templateId: plantilla.id,
              qrToken: randomBytes(16).toString('hex'),
              createdAt: sumarMinutos(creada, 180, ahora),
            },
          });
        }

        creadas.push({
          def,
          id: orden.id,
          folio,
          creada,
          live: {
            id: orden.id,
            createdAt: creada,
            folio,
            status: def.estado,
            totalAmount: total,
            discountAmount: descuento,
            patientFirstName: paciente.nombre,
            patientLastName: paciente.apellidos,
            payments: pagosVivos,
          },
        });
      }

      for (const corte of CORTES_CERRADOS) {
        const fecha = fechaLocal(ahora, corte.diasAtras);
        const periodo = resolvePeriod(fecha, corte.turno);
        const cajero = usuarios[corte.cajero];
        const cierra = usuarios[corte.cerro];
        const sucursalId = sucursales[corte.sucursal];

        const delTurno: OrdenCreada[] = [];
        for (const orden of creadas) {
          const delDia = orden.def.diasAtras === corte.diasAtras && orden.def.minutosAtras === null;
          const mismoLugar = delDia && orden.def.sucursal === corte.sucursal && orden.def.cajero === corte.cajero;
          const enPeriodo = orden.creada >= periodo.start && orden.creada < periodo.end;
          if (mismoLugar && enPeriodo) delTurno.push(orden);
        }
        const vivas: LiveOrder[] = [];
        const ids: number[] = [];
        for (const orden of delTurno) {
          vivas.push(orden.live);
          ids.push(orden.id);
        }

        const alcance: Scope = {
          tenantId,
          branchId: sucursalId,
          cashierId: cajero.id,
          shift: corte.turno,
          date: fecha,
        };
        const resumen = buildLiveSummary(vivas, periodo.start, periodo.end);
        const cierre = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - corte.diasAtras, corte.horaCierre, corte.minutoCierre, 0, 0);
        const nombreSucursal = corte.sucursal === 'norte' ? 'Clínica Norte' : 'Clínica Central';
        const fotografia = buildSnapshot(alcance, nombreSucursal, cajero.nombre, resumen, cierre);
        const diferencia = Math.round((corte.contado - resumen.summary.expectedCash) * 100) / 100;

        const guardado = await tx.cashCut.create({
          data: {
            tenantId,
            branchId: sucursalId,
            cashierId: cajero.id,
            shift: corte.turno,
            cutDate: parseDateOnly(fecha),
            periodStart: periodo.start,
            periodEnd: periodo.end,
            status: 'closed',
            cashTotal: resumen.summary.cashTotal,
            cardTotal: resumen.summary.cardTotal,
            transferTotal: resumen.summary.transferTotal,
            discountsTotal: resumen.summary.discountsTotal,
            ordersCount: resumen.summary.ordersCount,
            cancellationsCount: resumen.summary.cancellationsCount,
            expectedCash: resumen.summary.expectedCash,
            countedCash: corte.contado,
            difference: diferencia,
            observation: corte.observacion,
            snapshotJson: JSON.stringify(fotografia),
            closedById: cierra.id,
            closedAt: cierre,
          },
        });
        await tx.payment.updateMany({
          where: { tenantId, branchId: sucursalId, orderId: { in: ids }, cashCutId: null },
          data: { cashCutId: guardado.id },
        });
      }

      const filas: Array<Record<string, string | number>> = [];
      for (const orden of creadas) {
        filas.push({ orden: orden.id, folio: orden.folio, caso: orden.def.nota });
      }
      return { tenantId, filas };
    },
    { timeout: 180000, maxWait: 30000 },
  );
}
