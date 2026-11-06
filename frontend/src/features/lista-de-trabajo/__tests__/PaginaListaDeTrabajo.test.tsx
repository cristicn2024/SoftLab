import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaListaDeTrabajo from '../PaginaListaDeTrabajo';
import { obtenerLista } from '../servicio';
import type { ListaDeTrabajo, OrdenDeLista } from '../tipos';

vi.mock('../servicio');

function orden(overrides: Partial<OrdenDeLista>): OrdenDeLista {
  return {
    orderId: 10,
    folio: 'SL-000010',
    receivedAt: '2026-01-15T09:30:00.000Z',
    capturedCount: 0,
    samples: [],
    patient: {
      id: 1,
      fullName: 'Ana Ruiz',
      patientCode: 'P-000001',
      gender: 'F',
      ageYears: 34,
    },
    pending: [
      {
        orderItemId: 1,
        parameterId: 1,
        testName: 'Glucosa',
        parameterName: 'Glucosa',
        unit: 'mg/dL',
        rangeText: '70 – 100',
        previous: null,
        rule: { low: 70, high: 100 },
      },
    ],
    ...overrides,
  };
}

function lista(orders: OrdenDeLista[]): ListaDeTrabajo {
  return { totalPending: orders.length, withoutRange: 0, orders };
}

const recibida = orden({});
const enAnalisis = orden({
  orderId: 11,
  folio: 'SL-000011',
  capturedCount: 2,
  patient: { ...orden({}).patient, id: 2, fullName: 'Luis Soto', patientCode: 'P-000002', gender: 'M' },
  pending: [
    {
      orderItemId: 2,
      parameterId: 2,
      testName: 'Hemograma',
      parameterName: 'Hemoglobina',
      unit: 'g/dL',
      rangeText: '12 – 16',
      previous: null,
      rule: { low: 12, high: 16 },
    },
  ],
});

function renderPage(entry: string | { pathname: string; state?: unknown } = '/resultados/lista-de-trabajo') {
  return render(
    <MemoryRouter initialEntries={[entry as any]}>
      <PaginaListaDeTrabajo />
    </MemoryRouter>,
  );
}

describe('Pantalla de lista de trabajo (frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista las órdenes con paciente, estudios pendientes y estado de muestra', async () => {
    vi.mocked(obtenerLista).mockResolvedValue(lista([recibida, enAnalisis]));

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Lista de trabajo' })).toBeInTheDocument();
    expect(screen.getByText('SL-000010')).toBeInTheDocument();
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Glucosa')).toBeInTheDocument();
    expect(screen.getByText('SL-000011')).toBeInTheDocument();
    expect(screen.getByText('Luis Soto')).toBeInTheDocument();
    expect(screen.getByText('Hemograma')).toBeInTheDocument();
    expect(screen.getByText('Recibido')).toBeInTheDocument();
    expect(screen.getAllByText('En análisis').length).toBeGreaterThan(0);
    expect(screen.getByText('2 órdenes por capturar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Capturar SL-000010' })).toHaveAttribute(
      'href',
      '/resultados/lista-de-trabajo/10',
    );
  });

  it('filtra por estatus de muestra', async () => {
    vi.mocked(obtenerLista).mockResolvedValue(lista([recibida, enAnalisis]));

    renderPage();
    await screen.findByRole('heading', { name: 'Lista de trabajo' });

    fireEvent.change(screen.getByLabelText('Estatus de muestra'), {
      target: { value: 'recibida' },
    });

    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.queryByText('Luis Soto')).not.toBeInTheDocument();
    expect(screen.getByText('1 orden por capturar')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Estatus de muestra'), {
      target: { value: 'analisis' },
    });

    expect(screen.getByText('Luis Soto')).toBeInTheDocument();
    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay órdenes por capturar', async () => {
    vi.mocked(obtenerLista).mockResolvedValue(lista([]));

    renderPage();

    expect(await screen.findByText('No hay órdenes por capturar.')).toBeInTheDocument();
    expect(screen.getByText('0 órdenes por capturar')).toBeInTheDocument();
  });

  it('muestra el aviso de guardado que llega por navegación', async () => {
    vi.mocked(obtenerLista).mockResolvedValue(lista([recibida]));

    renderPage({
      pathname: '/resultados/lista-de-trabajo',
      state: { aviso: 'Resultados guardados.' },
    });

    expect(await screen.findByText('Resultados guardados.')).toBeInTheDocument();
  });

  it('muestra el error cuando falla la carga de la lista', async () => {
    vi.mocked(obtenerLista).mockRejectedValue(new Error('falló'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo completar la operación.',
    );
  });
});
