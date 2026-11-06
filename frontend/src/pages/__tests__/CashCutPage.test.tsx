import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CashCutPage } from '../CashCutPage';
import { SesionProvider } from '../../compartido/SesionProvider';
import { api } from '../../services/api';

vi.mock('../../services/api');

const context = {
  tenant: { id: 1, name: 'Laboratorio QA', subdomain: 'qa' },
  currentUser: { id: 2, fullName: 'Cajero QA', role: 'receptionist', branchId: 10 },
  branches: [{ id: 10, name: 'Sucursal Norte' }],
  cashiers: [{ id: 2, fullName: 'Cajero QA', role: 'receptionist', branchId: 10 }],
  shifts: [
    { value: 'matutino', label: 'Matutino', schedule: '08:00 – 15:00' },
    { value: 'vespertino', label: 'Vespertino', schedule: '15:00 – 22:00' },
    { value: 'nocturno', label: 'Nocturno', schedule: '22:00 – 08:00' },
  ],
  today: '2026-01-15',
  defaultShift: 'matutino',
};

function summary(overrides: Record<string, unknown> = {}) {
  return {
    scope: {
      branchId: 10,
      branchName: 'Sucursal Norte',
      cashierId: 2,
      cashierName: 'Cajero QA',
      shift: 'matutino',
      shiftLabel: 'Matutino',
      schedule: '08:00 – 15:00',
      date: '2026-01-15',
      periodStart: '2026-01-15T08:00:00.000Z',
      periodEnd: '2026-01-15T15:00:00.000Z',
    },
    status: 'open',
    cutId: null,
    closedAt: null,
    closedBy: null,
    countedCash: null,
    difference: null,
    observation: '',
    summary: {
      cashTotal: 1500,
      cardTotal: 200,
      transferTotal: 100,
      ordersCount: 3,
      discountsTotal: 0,
      cancellationsCount: 0,
      totalPaid: 1800,
      expectedCash: 1500,
    },
    movements: [
      {
        id: 1,
        time: '2026-01-15T09:15:00.000Z',
        folio: 'SL-000001',
        patient: 'María López',
        method: 'cash',
        methodLabel: 'Efectivo',
        amount: 1500,
        status: 'completed',
        payments: [],
      },
      {
        id: 2,
        time: '2026-01-15T10:00:00.000Z',
        folio: 'SL-000002',
        patient: 'Luis Soto',
        method: 'card',
        methodLabel: 'Tarjeta',
        amount: 200,
        status: 'completed',
        payments: [],
      },
    ],
    ...overrides,
  };
}

const closedSummary = summary({
  status: 'closed',
  cutId: 77,
  closedAt: '2026-01-15T15:05:00.000Z',
  closedBy: { id: 2, fullName: 'Cajero QA' },
  countedCash: 1400,
  difference: -100,
  observation: 'Faltante de cambio',
});

const contextSinUsuarios = {
  ...context,
  currentUser: null,
  cashiers: [],
};

const unassignedSummary = summary({
  scope: {
    ...summary().scope,
    cashierId: 0,
    cashierName: 'Sin asignar',
  },
});

function renderPage() {
  return render(
    <SesionProvider>
      <CashCutPage />
    </SesionProvider>,
  );
}

function mockApi(
  summaryPayload: ReturnType<typeof summary>,
  contextPayload: typeof context | typeof contextSinUsuarios = context,
) {
  (api.get as any).mockImplementation((url: string) => {
    if (url === '/cash-cuts/context') return Promise.resolve({ data: contextPayload });
    if (url === '/cash-cuts/summary') return Promise.resolve({ data: summaryPayload });
    return Promise.resolve({ data: {} });
  });
}

describe('Pantalla de corte de caja (frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('muestra los acumulados, el estado abierto y los movimientos del turno', async () => {
    mockApi(summary());

    renderPage();

    expect(await screen.findByText('Efectivo total')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Corte de caja' })).toBeInTheDocument();
    expect(screen.getByText(/Turno Matutino \(08:00 – 15:00\)/)).toBeInTheDocument();
    expect(screen.getAllByText('$1,500.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$200.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$100.00').length).toBeGreaterThan(0);
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('SL-000001')).toBeInTheDocument();
    expect(screen.getByText('María López')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
    expect(screen.getByText('Abierto')).toBeInTheDocument();
  });

  it('exige observación cuando hay diferencia y envía el cierre con el efectivo contado', async () => {
    mockApi(summary());
    (api.post as any).mockResolvedValue({ data: { cutId: 77 } });

    renderPage();
    await screen.findByText('Efectivo total');

    fireEvent.change(screen.getByLabelText('Efectivo contado'), { target: { value: '1400' } });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar corte/i }));

    expect(
      await screen.findByText(/La observación es obligatoria para poder cerrar el corte\./),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Observación'), {
      target: { value: 'Faltante de cambio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar corte/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith(
      '/cash-cuts/close',
      expect.objectContaining({
        branchId: 10,
        cashierId: 2,
        shift: 'matutino',
        date: '2026-01-15',
        countedCash: 1400,
        observation: 'Faltante de cambio',
      }),
      expect.objectContaining({ headers: { 'x-user-id': '2' } }),
    );
  });

  it('no permite cerrar sin capturar el efectivo contado', async () => {
    mockApi(summary());

    renderPage();
    await screen.findByText('Efectivo total');

    expect(screen.getByRole('button', { name: /Cerrar corte/i })).toBeDisabled();
    expect(screen.getByText('Captura el efectivo contado')).toBeInTheDocument();
  });

  it('permite cerrar el corte sin usuarios registrados', async () => {
    mockApi(unassignedSummary, contextSinUsuarios);
    (api.post as any).mockResolvedValue({ data: { cutId: 88 } });

    renderPage();
    await screen.findByText('Efectivo total');

    expect(screen.getByLabelText('Cajero')).toHaveValue('0');
    expect(screen.getByRole('option', { name: 'Sin asignar' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Efectivo contado'), { target: { value: '1500' } });
    const cerrar = screen.getByRole('button', { name: /Cerrar corte/i });
    expect(cerrar).toBeEnabled();
    fireEvent.click(cerrar);

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith(
      '/cash-cuts/close',
      expect.objectContaining({
        branchId: 10,
        cashierId: 0,
        shift: 'matutino',
        date: '2026-01-15',
        countedCash: 1500,
      }),
      {},
    );
  });

  it('muestra el corte cerrado en solo lectura con su diferencia y observación congeladas', async () => {
    mockApi(closedSummary);

    renderPage();

    expect(
      await screen.findByText('Corte cerrado · Sucursal Norte · Matutino'),
    ).toBeInTheDocument();
    expect(screen.getByText(/diferencia de -\$100\.00 registrada con observación/)).toBeInTheDocument();
    expect(screen.getByLabelText('Efectivo contado')).toBeDisabled();
    expect(screen.getByLabelText('Observación')).toBeDisabled();
    expect(screen.getAllByText('Sucursal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cajero').length).toBeGreaterThan(0);
    const selectores = screen.getAllByRole('combobox');
    expect(selectores).toHaveLength(3);
    selectores.forEach((selector) => expect(selector).not.toBeDisabled());
    expect(screen.getByText('La observación quedó congelada con el cierre.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cerrar corte/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Solo lectura · consulta el consolidado/)).toBeInTheDocument();
  });

  it('permite cambiar los filtros aunque el corte esté cerrado', async () => {
    mockApi(closedSummary);

    renderPage();
    await screen.findByText('Corte cerrado · Sucursal Norte · Matutino');

    expect(screen.getByLabelText('Sucursal')).toBeEnabled();
    expect(screen.getByLabelText('Cajero')).toBeEnabled();
    expect(screen.getByLabelText('Turno')).toBeEnabled();
    expect(screen.getByLabelText('Fecha')).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-01-16' } });

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/cash-cuts/summary',
        expect.objectContaining({
          params: expect.objectContaining({ date: '2026-01-16' }),
        }),
      ),
    );
  });

  it('muestra el error cuando no se puede cargar el contexto de caja', async () => {
    (api.get as any).mockRejectedValue(new Error('sin conexión'));

    renderPage();

    expect(
      await screen.findByText(/No se pudo cargar el contexto: sin conexión/),
    ).toBeInTheDocument();
  });

  it('lee el mensaje del formato de error nuevo del servidor', async () => {
    (api.get as any).mockRejectedValue({
      message: 'Request failed with status code 404',
      response: { data: { error: { statusCode: 404, tipo: 'NoEncontradoError', mensaje: 'Sucursal no encontrada' } } },
    });

    renderPage();

    expect(
      await screen.findByText(/No se pudo cargar el contexto: Sucursal no encontrada/),
    ).toBeInTheDocument();
  });

  it('muestra el primer mensaje cuando el servidor devuelve una lista', async () => {
    (api.get as any).mockRejectedValue({
      response: { data: { error: { statusCode: 400, mensaje: ['Turno inválido', 'branchId debe ser un entero'] } } },
    });

    renderPage();

    expect(
      await screen.findByText(/No se pudo cargar el contexto: Turno inválido/),
    ).toBeInTheDocument();
  });
});
