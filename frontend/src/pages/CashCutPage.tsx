import React, { useEffect, useMemo, useState } from 'react';
import { useSesion } from '../compartido/sesionContext';
import { api } from '../services/api';

interface BranchOption {
  id: number;
  name: string;
}

interface CashierOption {
  id: number;
  fullName: string;
  role: string;
  branchId: number | null;
}

interface ShiftOption {
  value: 'matutino' | 'vespertino' | 'nocturno';
  label: string;
  schedule: string;
}

interface CashCutContext {
  tenant: { id: number; name: string; subdomain: string };
  currentUser: CashierOption | null;
  branches: BranchOption[];
  cashiers: CashierOption[];
  shifts: ShiftOption[];
  today: string;
  defaultShift: 'matutino' | 'vespertino' | 'nocturno';
}

interface Movement {
  id: number;
  time: string;
  folio: string;
  patient: string;
  method: 'cash' | 'card' | 'transfer' | 'mixed' | 'pending' | 'cancelled';
  methodLabel: string;
  amount: number;
  status: string;
  payments: { method: string; label: string; amount: number }[];
}

interface SummaryPayload {
  scope: {
    branchId: number;
    branchName: string;
    cashierId: number;
    cashierName: string;
    shift: 'matutino' | 'vespertino' | 'nocturno';
    shiftLabel: string;
    schedule: string;
    date: string;
    periodStart: string;
    periodEnd: string;
  };
  status: 'open' | 'closed';
  cutId: number | null;
  closedAt: string | null;
  closedBy: { id: number; fullName: string } | null;
  countedCash: number | null;
  difference: number | null;
  observation: string;
  summary: {
    cashTotal: number;
    cardTotal: number;
    transferTotal: number;
    ordersCount: number;
    discountsTotal: number;
    cancellationsCount: number;
    totalPaid: number;
    expectedCash: number;
  };
  movements: Movement[];
}

const money = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

const formatDateLong = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

function apiErrorMessage(error: unknown) {
  const err = error as {
    response?: { data?: { error?: string; details?: { messages?: string[] }[] } };
    message?: string;
  };
  const details = err.response?.data?.details;
  if (details?.length && details[0].messages?.length) {
    return details[0].messages[0];
  }
  return err.response?.data?.error ?? err.message ?? 'Ocurrió un error inesperado';
}

const METHOD_THEME: Record<
  string,
  { background: string; color: string; dot: string }
> = {
  cash: { background: '#f1f0ea', color: '#4a4c4a', dot: '#9da09b' },
  card: { background: '#f1f0ea', color: '#4a4c4a', dot: '#9da09b' },
  transfer: { background: '#f1f0ea', color: '#4a4c4a', dot: '#9da09b' },
  mixed: { background: '#f1f0ea', color: '#4a4c4a', dot: '#9da09b' },
  pending: { background: '#f3f0e8', color: '#6a6d6c', dot: '#b1b2ac' },
  cancelled: { background: '#f7ecea', color: '#b3261e', dot: '#b3261e' }
};

const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({
  name,
  size = 18,
  color = 'currentColor'
}) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  switch (name) {
    case 'cash':
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case 'transfer':
      return (
        <svg {...common}>
          <path d="M4 7h13" />
          <path d="M14 4l3 3-3 3" />
          <path d="M20 17H7" />
          <path d="M10 14l-3 3 3 3" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...common}>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      );
    case 'discount':
      return (
        <svg {...common}>
          <path d="M20 12l-8 8-9-9V3h8z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
      );
    case 'cancel':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
      );
    case 'printer':
      return (
        <svg {...common}>
          <path d="M6 9V3h12v6" />
          <rect x="4" y="9" width="16" height="8" rx="2" />
          <path d="M8 17h8v4H8z" />
        </svg>
      );
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M4 21h16" />
        </svg>
      );
    default:
      return <svg {...common} />;
  }
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  detail?: string;
}> = ({ label, value, detail }) => (
  <div style={styles.kpiCard} className="print-card">
    <div style={styles.kpiLabel}>{label}</div>
    <div style={styles.kpiValue}>{value}</div>
    {detail ? <div style={styles.kpiDetail}>{detail}</div> : null}
  </div>
);

export const CashCutPage: React.FC = () => {
  const { actualizarSesion } = useSesion();

  const [context, setContext] = useState<CashCutContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState('');

  const [branchId, setBranchId] = useState(0);
  const [cashierId, setCashierId] = useState(0);
  const [shift, setShift] = useState<'matutino' | 'vespertino' | 'nocturno'>('matutino');
  const [date, setDate] = useState('');

  const [data, setData] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [counted, setCounted] = useState('');
  const [observation, setObservation] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setContextLoading(true);
    api
      .get<CashCutContext>('/cash-cuts/context')
      .then(response => {
        if (!active) return;
        const ctx = response.data;
        setContext(ctx);
        setContextError('');

        const branch =
          ctx.branches.find(item => item.id === ctx.currentUser?.branchId) ?? ctx.branches[0];
        const cashier =
          ctx.cashiers.find(item => item.id === ctx.currentUser?.id) ??
          ctx.cashiers.find(item => item.role === 'receptionist') ??
          ctx.cashiers[0];

        if (branch) setBranchId(branch.id);
        if (cashier) setCashierId(cashier.id);
        setShift(ctx.defaultShift ?? 'matutino');
        setDate(ctx.today);
      })
      .catch(error => {
        if (!active) return;
        setContextError(apiErrorMessage(error));
      })
      .finally(() => {
        if (active) setContextLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!context) return;
    const currentBranchName =
      context.currentUser?.branchId !== null
        ? context.branches.find(item => item.id === context.currentUser?.branchId)?.name
        : undefined;
    const branch =
      data?.scope.branchName ??
      context.branches.find(item => item.id === branchId)?.name ??
      currentBranchName;

    actualizarSesion({
      laboratorio: context.tenant.name,
      sucursal: branch ?? 'Clínica Central',
      usuario: context.currentUser?.fullName ?? 'Sin asignar',
      rol: context.currentUser ? (context.currentUser.role === 'admin' ? 'Administradora' : 'Cajero') : 'Sin asignar'
    });
  }, [actualizarSesion, branchId, context, data]);

  useEffect(() => {
    if (!branchId || !cashierId || !date) return;
    let active = true;

    setLoading(true);
    setLoadError('');
    api
      .get<SummaryPayload>('/cash-cuts/summary', {
        params: { branchId, cashierId, shift, date }
      })
      .then(response => {
        if (!active) return;
        setData(response.data);
      })
      .catch(error => {
        if (!active) return;
        setData(null);
        setLoadError(apiErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [branchId, cashierId, shift, date, refreshKey]);

  useEffect(() => {
    if (!data) return;
    if (data.status === 'closed') {
      setCounted(data.countedCash !== null ? String(data.countedCash) : '');
      setObservation(data.observation ?? '');
      setCloseError('');
    }
  }, [data]);

  const closed = data?.status === 'closed';

  const expectedCash = data?.summary.expectedCash ?? 0;
  const countedNumber = counted.trim() === '' ? null : Number(counted);
  const computedDifference =
    countedNumber === null || Number.isNaN(countedNumber)
      ? null
      : round2(countedNumber - expectedCash);
  const difference = closed ? (data?.difference ?? 0) : computedDifference;
  const hasDifference = difference !== null && Math.abs(difference) >= 0.005;

  const availableCashiers = useMemo(() => {
    if (!context) return [];
    const inBranch = context.cashiers.filter(
      cashier => cashier.branchId === branchId || cashier.branchId === null
    );
    return inBranch.length > 0 ? inBranch : context.cashiers;
  }, [context, branchId]);

  const resetDraft = () => {
    setCounted('');
    setObservation('');
    setCloseError('');
  };

  const handleBranchChange = (value: string) => {
    const nextBranch = Number(value);
    resetDraft();
    setBranchId(nextBranch);

    if (!context) return;
    const cashiers = context.cashiers.filter(
      cashier => cashier.branchId === nextBranch || cashier.branchId === null
    );
    if (cashiers.length > 0 && !cashiers.some(cashier => cashier.id === cashierId)) {
      setCashierId(cashiers[0].id);
    }
  };

  const handleClose = async () => {
    if (!data || closed || closing) return;

    if (countedNumber === null || Number.isNaN(countedNumber) || countedNumber < 0) {
      setCloseError('Captura un efectivo contado válido (mayor o igual a cero).');
      return;
    }

    if (hasDifference && observation.trim().length === 0) {
      setCloseError(
        'Existe una diferencia en el cuadre. La observación es obligatoria para poder cerrar el corte.'
      );
      return;
    }

    setClosing(true);
    setCloseError('');

    try {
      await api.post(
        '/cash-cuts/close',
        {
          branchId,
          cashierId,
          shift,
          date,
          countedCash: countedNumber,
          observation: observation.trim() || undefined
        },
        {
          headers: {
            'x-user-id': String(context?.currentUser?.id ?? cashierId)
          }
        }
      );
      setRefreshKey(key => key + 1);
    } catch (error) {
      setCloseError(apiErrorMessage(error));
    } finally {
      setClosing(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const rows: (string | number)[][] = [
      ['Reporte', 'Corte de caja'],
      ['Laboratorio', context?.tenant.name ?? ''],
      ['Sucursal', data.scope.branchName],
      ['Cajero', data.scope.cashierName],
      ['Turno', data.scope.shiftLabel],
      ['Fecha', data.scope.date],
      ['Estado', data.status === 'closed' ? 'Cerrado' : 'Abierto'],
      ['Efectivo esperado', data.summary.expectedCash.toFixed(2)],
      ['Efectivo contado', countedNumber !== null ? countedNumber.toFixed(2) : ''],
      ['Diferencia', difference !== null ? difference.toFixed(2) : ''],
      ['Observación', observation || ''],
      [],
      ['HORA', 'FOLIO', 'PACIENTE', 'MÉTODO', 'MONTO'],
      ...data.movements.map(movement => [
        formatTime(movement.time),
        movement.folio,
        movement.patient,
        movement.methodLabel,
        movement.amount.toFixed(2)
      ])
    ];

    const csv = rows
      .map(row =>
        row
          .map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `corte-caja-${data.scope.date}-${data.scope.shift}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <main className="sl-pagina">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border: 1px solid #d7d1c4 !important; }
          body { background: #ffffff !important; }
        }
        .kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
        .cuadre-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; }
        @media (max-width: 1180px) {
          .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 860px) {
          .cuadre-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      <div className="sl-migas">Recepción / Corte de caja</div>

          {contextLoading && <div style={styles.stateBox}>Cargando contexto de caja...</div>}

          {contextError && (
            <div style={{ ...styles.stateBox, ...styles.errorBox }}>
              No se pudo cargar el contexto: {contextError}
            </div>
          )}

          {!contextLoading && !contextError && (
            <>
              {closed && data && (
                <div style={styles.closedBanner}>
                  <div style={styles.closedBannerIcon}>
                    <Icon name="check" size={18} color="#2e6b3f" />
                  </div>
                  <div>
                    <div style={styles.closedBannerTitle}>
                      Corte cerrado · {data.scope.branchName} · {data.scope.shiftLabel}
                    </div>
                    <div style={styles.closedBannerText}>
                      Cerrado por {data.closedBy?.fullName ?? data.scope.cashierName} el{' '}
                      {formatDateTime(data.closedAt)} —{' '}
                      {difference === 0
                        ? 'sin diferencia registrada'
                        : `diferencia de ${money(difference ?? 0)} registrada con observación`}
                    </div>
                  </div>
                </div>
              )}

              <div style={styles.pageHead}>
                <div>
                  <h1 style={styles.pageTitle}>Corte de caja</h1>
                  <p style={styles.pageSubtitle}>
                    {data
                      ? `${formatDateLong(data.scope.date)} · Turno ${data.scope.shiftLabel} (${data.scope.schedule})`
                      : 'Resumen y cierre del turno por sucursal y cajero.'}
                  </p>
                </div>
                <div style={styles.pageActions} className="no-print">
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={handleExport}
                    disabled={!data}
                  >
                    <Icon name="download" size={15} />
                    Exportar
                  </button>
                  <button type="button" style={styles.secondaryBtn} onClick={handlePrint}>
                    <Icon name="printer" size={15} />
                    Imprimir
                  </button>
                </div>
              </div>

              <section style={styles.filtersSection} className="no-print">
                <div style={styles.filterGrid}>
                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="cash-cut-branch">
                      Sucursal
                    </label>
                    <select
                      id="cash-cut-branch"
                      style={styles.input}
                      value={branchId}
                      onChange={event => handleBranchChange(event.target.value)}
                      disabled={contextLoading}
                    >
                      {(context?.branches ?? []).map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="cash-cut-cashier">
                      Cajero
                    </label>
                    <select
                      id="cash-cut-cashier"
                      style={styles.input}
                      value={cashierId}
                      onChange={event => {
                        resetDraft();
                        setCashierId(Number(event.target.value));
                      }}
                      disabled={contextLoading}
                    >
                      {availableCashiers.length === 0 && <option value={0}>Sin cajeros registrados</option>}{availableCashiers.map(cashier => (
                        <option key={cashier.id} value={cashier.id}>
                          {cashier.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="cash-cut-shift">
                      Turno
                    </label>
                    <select
                      id="cash-cut-shift"
                      style={styles.input}
                      value={shift}
                      onChange={event => {
                        resetDraft();
                        setShift(event.target.value as 'matutino' | 'vespertino' | 'nocturno');
                      }}
                      disabled={contextLoading}
                    >
                      {(context?.shifts ?? []).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label} · {option.schedule}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="cash-cut-date">
                      Fecha
                    </label>
                    <input
                      id="cash-cut-date"
                      type="date"
                      style={styles.input}
                      value={date}
                      onChange={event => {
                        resetDraft();
                        setDate(event.target.value);
                      }}
                      disabled={contextLoading}
                    />
                  </div>
                </div>
              </section>

              {loadError && (
                <div style={{ ...styles.stateBox, ...styles.errorBox }}>{loadError}</div>
              )}

              {loading && !data && <div style={styles.stateBox}>Calculando acumulados del turno...</div>}

              {data && (
                <>
                  <section style={styles.kpiGrid} className="kpi-grid">
                    <KpiCard
                      label="Efectivo total"
                      value={money(data.summary.cashTotal)}
                      detail="Pagos en efectivo"
                    />
                    <KpiCard
                      label="Tarjeta total"
                      value={money(data.summary.cardTotal)}
                      detail="Débito y crédito"
                    />
                    <KpiCard
                      label="Transferencia"
                      value={money(data.summary.transferTotal)}
                      detail="Transferencias bancarias"
                    />
                    <KpiCard
                      label="Órdenes"
                      value={String(data.summary.ordersCount)}
                      detail="Registradas en el turno"
                    />
                    <KpiCard
                      label="Descuentos"
                      value={money(data.summary.discountsTotal)}
                      detail="Otorgados en el turno"
                    />
                    <KpiCard
                      label="Cancelaciones"
                      value={String(data.summary.cancellationsCount)}
                      detail="Órdenes canceladas"
                    />
                  </section>

                  <section style={styles.card} className="print-card">
                    <div style={styles.cardHeadingRow}>
                      <div>
                        <h2 style={styles.cardTitle}>Cuadre de caja</h2>
                        <p style={styles.cardHint}>
                          El efectivo esperado se calcula automáticamente con los pagos en efectivo
                          del turno.
                        </p>
                      </div>
                      <span
                        style={{
                          ...styles.statusPill,
                          ...(closed ? styles.statusPillClosed : styles.statusPillOpen)
                        }}
                      >
                        <span
                          style={{
                            ...styles.statusDot,
                            backgroundColor: closed ? '#2e6b3f' : '#8b8e89'
                          }}
                        />
                        {closed ? 'Corte cerrado' : 'Abierto'}
                      </span>
                    </div>

                    <div className="cuadre-grid">
                      <div style={styles.cuadreMain}>
                        <div style={styles.moneyGrid}>
                          <div style={styles.moneyBox}>
                            <span style={styles.moneyLabel}>Efectivo esperado</span>
                            <span style={styles.moneyValue}>{money(expectedCash)}</span>
                            <span style={styles.moneyHelp}>Calculado por el sistema</span>
                          </div>

                          <div style={styles.moneyBox}>
                            <label style={styles.moneyLabel} htmlFor="counted-cash">
                              Efectivo contado
                            </label>
                            <div
                              style={{
                                ...styles.moneyInputWrap,
                                ...(closed ? styles.moneyInputDisabled : {})
                              }}
                            >
                              <span style={styles.currencyPrefix}>$</span>
                              <input
                                id="counted-cash"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={counted}
                                onChange={event => setCounted(event.target.value)}
                                disabled={closed}
                                style={styles.moneyInput}
                              />
                            </div>
                            <span style={styles.moneyHelp}>Conteo físico de la caja</span>
                          </div>

                          <div
                            style={{
                              ...styles.moneyBox,
                              ...(hasDifference ? styles.moneyBoxAlert : styles.moneyBoxOk)
                            }}
                          >
                            <span style={styles.moneyLabel}>Diferencia</span>
                            <span
                              style={{
                                ...styles.moneyValue,
                                color: hasDifference ? '#b3261e' : '#2e6b3f'
                              }}
                            >
                              {difference === null ? '—' : money(difference)}
                            </span>
                            <span
                              style={{
                                ...styles.moneyHelp,
                                color: hasDifference ? '#b3261e' : '#2e6b3f'
                              }}
                            >
                              {difference === null
                                ? 'Captura el efectivo contado'
                                : hasDifference
                                  ? 'Requiere observación'
                                  : 'Cuadre exacto'}
                            </span>
                          </div>
                        </div>

                        <div style={styles.observationBlock}>
                          <div style={styles.observationLabelRow}>
                            <label style={styles.label} htmlFor="observation">
                              Observación
                            </label>
                            {hasDifference && !closed ? (
                              <span style={styles.requiredBadge}>Obligatoria por diferencia</span>
                            ) : null}
                          </div>
                          <textarea
                            id="observation"
                            style={{
                              ...styles.textarea,
                              ...(closed ? styles.inputDisabled : {})
                            }}
                            rows={3}
                            maxLength={500}
                            placeholder="Ej. Faltante por cambio entregado de más, diferencia por redondeo, etc."
                            value={observation}
                            onChange={event => setObservation(event.target.value)}
                            disabled={closed}
                          />
                          <div style={styles.observationFooter}>
                            <span>
                              {closed
                                ? 'La observación quedó congelada con el cierre.'
                                : hasDifference
                                  ? 'Describe el motivo de la diferencia para poder cerrar.'
                                  : 'Si no hay diferencia, la observación es opcional.'}
                            </span>
                            <span>{observation.length}/500</span>
                          </div>
                        </div>

                        {closeError && <div style={styles.inlineError}>{closeError}</div>}
                      </div>

                      <aside style={styles.cuadreAside}>
                        <div style={styles.asideTitle}>Resumen del cierre</div>
                        <div style={styles.asideRow}>
                          <span>Cajero</span>
                          <strong>{data.scope.cashierName}</strong>
                        </div>
                        <div style={styles.asideRow}>
                          <span>Turno</span>
                          <strong>{data.scope.shiftLabel}</strong>
                        </div>
                        <div style={styles.asideRow}>
                          <span>Horario</span>
                          <strong>{data.scope.schedule}</strong>
                        </div>
                        <div style={styles.asideRow}>
                          <span>Total cobrado</span>
                          <strong>{money(data.summary.totalPaid)}</strong>
                        </div>
                        <div style={styles.asideDivider} />
                        <div style={styles.asideRow}>
                          <span>Esperado</span>
                          <strong>{money(expectedCash)}</strong>
                        </div>
                        <div style={styles.asideRow}>
                          <span>Contado</span>
                          <strong>{countedNumber === null ? '—' : money(countedNumber)}</strong>
                        </div>
                        <div style={styles.asideRow}>
                          <span>Diferencia</span>
                          <strong style={{ color: hasDifference ? '#b3261e' : '#2e6b3f' }}>
                            {difference === null ? '—' : money(difference)}
                          </strong>
                        </div>
                        <div style={styles.asideNote}>
                          <Icon name="lock" size={14} color="#8b8e89" />
                          <span>
                            Al cerrar, los acumulados y movimientos quedan bloqueados para consulta.
                          </span>
                        </div>
                      </aside>
                    </div>
                  </section>

                  <section style={styles.card} className="print-card">
                    <div style={styles.cardHeadingRow}>
                      <div>
                        <h2 style={styles.cardTitle}>Movimientos del turno</h2>
                        <p style={styles.cardHint}>
                          {data.movements.length} movimiento
                          {data.movements.length === 1 ? '' : 's'} · {data.scope.periodStart ? formatTime(data.scope.periodStart) : ''} a{' '}
                          {data.scope.periodEnd ? formatTime(data.scope.periodEnd) : ''}
                        </p>
                      </div>
                      <span style={styles.countBadge}>{data.movements.length}</span>
                    </div>

                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, width: '8%' }}>HORA</th>
                            <th style={{ ...styles.th, width: '16%' }}>FOLIO</th>
                            <th style={{ ...styles.th, width: '30%' }}>PACIENTE</th>
                            <th style={{ ...styles.th, width: '24%' }}>MÉTODO</th>
                            <th style={{ ...styles.th, width: '22%', textAlign: 'right' }}>MONTO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.movements.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={styles.emptyCell}>
                                No hay movimientos registrados para este turno.
                              </td>
                            </tr>
                          ) : (
                            data.movements.map(movement => {
                              const theme = METHOD_THEME[movement.method] ?? METHOD_THEME.pending;
                              return (
                                <tr
                                  key={movement.id}
                                  style={
                                    movement.method === 'cancelled' ? styles.rowCancelled : undefined
                                  }
                                >
                                  <td style={styles.td}>{formatTime(movement.time)}</td>
                                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>
                                    {movement.folio}
                                  </td>
                                  <td style={styles.td}>{movement.patient}</td>
                                  <td style={styles.td}>
                                    <span
                                      style={{
                                        ...styles.methodBadge,
                                        backgroundColor: theme.background,
                                        color: theme.color
                                      }}
                                    >
                                      <span
                                        style={{ ...styles.methodDot, backgroundColor: theme.dot }}
                                      />
                                      {movement.methodLabel}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      ...styles.td,
                                      textAlign: 'right',
                                      fontWeight: 600
                                    }}
                                  >
                                    {money(movement.amount)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <div
                    style={{
                      ...styles.actionRow,
                      justifyContent: closed ? 'flex-start' : 'flex-end'
                    }}
                    className="no-print"
                  >
                    {closed ? (
                      <div style={styles.closedAction}>
                        <span style={styles.closedActionBadge}>
                          <Icon name="lock" size={15} />
                          Corte cerrado
                        </span>
                        <span style={styles.closedActionText}>
                          Solo lectura · consulta el consolidado de todas las sucursales con el rol
                          correspondiente.
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        style={{
                          ...styles.primaryBtn,
                          ...(closing || countedNumber === null ? styles.primaryBtnDisabled : {})
                        }}
                        onClick={handleClose}
                        disabled={closing || countedNumber === null}
                      >
                        <Icon name="lock" size={16} color="#ffffff" />
                        {closing ? 'Cerrando corte...' : 'Cerrar corte'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f3f2ee',
    minHeight: '100vh',
    color: '#1a1a1a',
    width: '100%',
    boxSizing: 'border-box'
  },
  topHeader: {
    display: 'flex',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e5e5',
    padding: '8px 24px',
    gap: '32px',
    fontSize: '12px'
  },
  infoGroup: { display: 'flex', flexDirection: 'column' },
  infoLabel: {
    color: '#737373',
    fontWeight: 700,
    fontSize: '10px',
    letterSpacing: '0.5px'
  },
  infoValue: { color: '#171717', fontWeight: 500 },
  mainLayout: { display: 'flex', alignItems: 'stretch' },
  sidebar: {
    width: '230px',
    flexShrink: 0,
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e5e5',
    minHeight: 'calc(100vh - 45px)',
    padding: '16px 0'
  },
  brandTitle: {
    fontWeight: 700,
    fontSize: '15px',
    padding: '0 20px 16px 20px',
    color: '#171717'
  },
  navMenu: { display: 'flex', flexDirection: 'column' },
  navGroup: { display: 'flex', flexDirection: 'column' },
  navItem: {
    padding: '10px 20px',
    fontSize: '13px',
    color: '#404040',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  arrow: { color: '#a3a3a3', fontSize: '12px' },
  submenu: { display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' },
  subItem: {
    padding: '8px 20px 8px 32px',
    fontSize: '12px',
    color: '#525252',
    cursor: 'pointer'
  },
  activeSubItem: { backgroundColor: '#1b3b2b', color: '#ffffff', fontWeight: 500 },
  contentArea: {
    flex: 1,
    minWidth: 0,
    padding: '24px 40px 48px',
    maxWidth: '1400px',
    boxSizing: 'border-box'
  },
  breadcrumb: { fontSize: '12px', color: '#737373', marginBottom: '14px' },
  pageHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '18px'
  },
  pageActions: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingTop: '2px' },
  pageTitle: { fontSize: '30px', fontWeight: 600, margin: 0, color: '#14181b', letterSpacing: '-0.3px' },
  pageSubtitle: { fontSize: '13px', color: '#6a6d6c', margin: '5px 0 0' },
  statusPillWrap: { display: 'flex', alignItems: 'center', paddingTop: '6px' },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '4px 10px',
    border: '1px solid #d7d1c4',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  statusPillOpen: { backgroundColor: 'transparent', color: '#6a6d6c' },
  statusPillClosed: { backgroundColor: 'transparent', color: '#2e6b3f' },
  statusDot: { width: '6px', height: '6px', borderRadius: '999px', display: 'inline-block' },
  closedBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: '#fbfaf6',
    border: '1px solid #e8e4da',
    borderRadius: '6px',
    padding: '13px 16px',
    marginBottom: '18px'
  },
  closedBannerIcon: {
    width: '26px',
    height: '26px',
    borderRadius: '999px',
    backgroundColor: '#e7efe8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  closedBannerTitle: { fontSize: '13px', fontWeight: 700, color: '#2e6b3f' },
  closedBannerText: { fontSize: '12px', color: '#6a6d6c', marginTop: '3px', lineHeight: 1.45 },
  card: {
    backgroundColor: '#fbfaf6',
    borderRadius: '6px',
    border: '1px solid #e8e4da',
    boxShadow: 'none',
    padding: '18px 20px',
    marginBottom: '16px'
  },
  cardHeadingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '14px'
  },
  cardTitle: { fontSize: '15px', fontWeight: 700, margin: 0, color: '#14181b' },
  cardHint: { fontSize: '12px', color: '#6a6d6c', margin: '3px 0 0', lineHeight: 1.4 },
  filtersSection: { marginBottom: '20px' },
  filterIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    backgroundColor: '#eef1ec',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '24px'
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#6a6d6c',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  input: {
    padding: '6px 0',
    fontSize: '13px',
    border: 'none',
    borderBottom: '1px solid #d7d1c4',
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: '#14181b',
    outline: 'none',
    minWidth: 0
  },
  inputDisabled: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: '#14181b',
    opacity: 1,
    cursor: 'default',
    paddingLeft: 0,
    paddingRight: 0,
    appearance: 'none'
  },
  kpiGrid: { marginBottom: '16px' },
  kpiCard: {
    backgroundColor: '#fbfaf6',
    borderRadius: '6px',
    border: '1px solid #e8e4da',
    boxShadow: 'none',
    padding: '14px 16px',
    minWidth: 0
  },
  kpiIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '9px'
  },
  kpiLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#6a6d6c',
    textTransform: 'uppercase',
    letterSpacing: '0.55px'
  },
  kpiValue: {
    fontSize: '22px',
    fontWeight: 600,
    color: '#14181b',
    marginTop: '5px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  kpiDetail: { fontSize: '10px', color: '#8b8e89', marginTop: '3px' },
  cuadreGrid: { display: 'grid' },
  cuadreMain: { minWidth: 0 },
  moneyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px'
  },
  moneyBox: {
    border: 'none',
    borderRadius: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    backgroundColor: 'transparent',
    minWidth: 0
  },
  moneyBoxAlert: { backgroundColor: 'transparent' },
  moneyBoxOk: { backgroundColor: 'transparent' },
  moneyLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#6a6d6c',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  moneyValue: { fontSize: '20px', fontWeight: 600, color: '#14181b' },
  moneyHelp: { fontSize: '10px', color: '#8b8e89' },
  moneyInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    border: 'none',
    borderBottom: '1px solid #d7d1c4',
    borderRadius: 0,
    backgroundColor: 'transparent',
    padding: '0'
  },
  moneyInputDisabled: { backgroundColor: 'transparent', borderColor: 'transparent' },
  currencyPrefix: { fontSize: '13px', color: '#6a6d6c', fontWeight: 600 },
  moneyInput: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '6px 0',
    fontSize: '17px',
    fontWeight: 600,
    color: '#14181b',
    width: '100%',
    minWidth: 0
  },
  observationBlock: {
    marginTop: '14px',
    borderTop: '1px solid #e8e4da',
    paddingTop: '12px'
  },
  observationLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '5px'
  },
  requiredBadge: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#b3261e',
    backgroundColor: 'transparent',
    border: '1px solid #e0c4c0',
    borderRadius: '4px',
    padding: '1px 7px'
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    padding: '9px 10px',
    fontSize: '12px',
    lineHeight: 1.45,
    border: '1px solid #d7d1c4',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: '#14181b',
    outline: 'none',
    fontFamily: 'inherit'
  },
  observationFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '10px',
    color: '#8b8e89',
    marginTop: '4px'
  },
  inlineError: {
    marginTop: '10px',
    backgroundColor: '#fbf3f1',
    border: '1px solid #e0c4c0',
    color: '#b3261e',
    borderRadius: '4px',
    padding: '9px 11px',
    fontSize: '12px'
  },
  cuadreAside: {
    backgroundColor: '#f5f2ec',
    border: '1px solid #e8e4da',
    borderRadius: '4px',
    padding: '14px',
    alignSelf: 'start'
  },
  asideTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#14181b',
    marginBottom: '9px'
  },
  asideRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    fontSize: '11px',
    color: '#6a6d6c',
    padding: '4px 0'
  },
  asideDivider: { borderTop: '1px solid #e8e4da', margin: '6px 0' },
  asideNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '7px',
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid #e8e4da',
    fontSize: '10px',
    color: '#8b8e89',
    lineHeight: 1.4
  },
  countBadge: {
    minWidth: '26px',
    height: '26px',
    padding: '0 8px',
    borderRadius: '4px',
    backgroundColor: '#f3f0e8',
    color: '#6a6d6c',
    fontSize: '11px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  th: {
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: 700,
    color: '#6a6d6c',
    letterSpacing: '0.5px',
    padding: '8px 10px',
    borderBottom: '1px solid #d7d1c4',
    backgroundColor: 'transparent',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '10px',
    borderBottom: '1px solid #e8e4da',
    color: '#14181b',
    verticalAlign: 'middle'
  },
  emptyCell: {
    padding: '28px 10px',
    textAlign: 'center',
    color: '#8b8e89',
    fontSize: '12px'
  },
  rowCancelled: { opacity: 0.65 },
  methodBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  methodDot: { width: '5px', height: '5px', borderRadius: '999px' },
  actionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    marginTop: '4px'
  },
  actionLeft: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#fbfaf6',
    color: '#2e6b3f',
    border: '1px solid #d7d1c4',
    borderRadius: '4px',
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#2e6b3f',
    color: '#ffffff',
    border: '1px solid #2e6b3f',
    borderRadius: '4px',
    padding: '9px 16px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  primaryBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  closedAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  },
  closedActionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    backgroundColor: 'transparent',
    color: '#6a6d6c',
    border: '1px solid #d7d1c4',
    borderRadius: '4px',
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 700
  },
  closedActionText: { fontSize: '11px', color: '#8b8e89', maxWidth: '330px' },
  stateBox: {
    backgroundColor: '#fbfaf6',
    border: '1px solid #e8e4da',
    borderRadius: '6px',
    padding: '18px 20px',
    fontSize: '12px',
    color: '#6a6d6c',
    marginBottom: '16px'
  },
  errorBox: { borderColor: '#e0c4c0', backgroundColor: '#fbf3f1', color: '#b3261e' }
};
