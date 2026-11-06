import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaCapturaDeResultados from '../PaginaCapturaDeResultados';
import { guardarResultados, obtenerLista, obtenerOrden } from '../servicio';
import type { ListaDeTrabajo, OrdenDeLista } from '../tipos';

vi.mock('../servicio');

const glucosa = {
  orderItemId: 1,
  parameterId: 1,
  testName: 'Glucosa',
  parameterName: 'Glucosa',
  unit: 'mg/dL',
  rangeText: '70 – 100',
  previous: '90 mg/dL (10 ene 2026)',
  rule: { low: 70, high: 100, criticalHigh: 200 },
};

const sodio = {
  orderItemId: 1,
  parameterId: 2,
  testName: 'Glucosa',
  parameterName: 'Sodio',
  unit: 'mmol/L',
  rangeText: null,
  previous: null,
  rule: null,
};

function orden(overrides: Partial<OrdenDeLista> = {}): OrdenDeLista {
  return {
    orderId: 10,
    folio: 'SL-000010',
    receivedAt: '2026-01-15T09:30:00.000Z',
    capturedCount: 1,
    samples: [
      {
        id: 1,
        barcode: 'M-0001',
        description: 'Suero',
        equipment: 'Architect c8000',
        capturedByName: 'Laura Méndez',
      },
    ],
    patient: {
      id: 1,
      fullName: 'Ana Ruiz',
      patientCode: 'P-000001',
      gender: 'F',
      ageYears: 34,
    },
    pending: [glucosa, sodio],
    ...overrides,
  };
}

function lista(orders: OrdenDeLista[]): ListaDeTrabajo {
  return { totalPending: orders.length, withoutRange: 1, orders };
}

function renderCaptura(path = '/resultados/lista-de-trabajo/10') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/resultados/lista-de-trabajo" element={<div>Lista destino</div>} />
        <Route
          path="/resultados/lista-de-trabajo/:idOrden"
          element={<PaginaCapturaDeResultados />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Pantalla de captura de resultados (frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga la orden, sus parámetros y avisa cuando hay parámetros sin rango', async () => {
    vi.mocked(obtenerOrden).mockResolvedValue(orden());

    renderCaptura();

    expect(
      await screen.findByRole('heading', { name: 'Captura de resultados' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ana Ruiz · P-000001 · 34 años · Mujer · Glucosa/)).toBeInTheDocument();
    expect(screen.getByText('SL-000010')).toBeInTheDocument();
    expect(screen.getByText(/^Suero · recibida \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.getByText('Architect c8000')).toBeInTheDocument();
    expect(screen.getByLabelText('Resultado Glucosa')).toBeInTheDocument();
    expect(screen.getByLabelText('Resultado Sodio')).toBeInTheDocument();
    expect(screen.getByText('SIN RANGO')).toBeInTheDocument();
    expect(screen.getByText('Sin rango')).toBeInTheDocument();
    expect(screen.getByText('90 mg/dL (10 ene 2026)')).toBeInTheDocument();
    expect(obtenerOrden).toHaveBeenCalledWith(10);
  });

  it('calcula la bandera en vivo y bloquea un valor crítico sin notificación', async () => {
    vi.mocked(obtenerOrden).mockResolvedValue(orden());

    renderCaptura();
    await screen.findByRole('heading', { name: 'Captura de resultados' });

    fireEvent.change(screen.getByLabelText('Resultado Glucosa'), {
      target: { value: '250' },
    });

    expect(screen.getByText('HH')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/valor crítico \(HH\)/)).toBeInTheDocument();
    expect(guardarResultados).not.toHaveBeenCalled();
  });

  it('exige capturar al menos un resultado antes de guardar', async () => {
    vi.mocked(obtenerOrden).mockResolvedValue(orden());

    renderCaptura();
    await screen.findByRole('heading', { name: 'Captura de resultados' });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Escribe al menos un resultado.')).toBeInTheDocument();
    expect(guardarResultados).not.toHaveBeenCalled();
  });

  it('guarda los resultados y recarga la orden cuando quedan parámetros pendientes', async () => {
    vi.mocked(obtenerOrden)
      .mockResolvedValueOnce(orden())
      .mockResolvedValueOnce(orden({ capturedCount: 2, pending: [sodio] }));
    vi.mocked(guardarResultados).mockResolvedValue(undefined);

    renderCaptura();
    await screen.findByRole('heading', { name: 'Captura de resultados' });

    fireEvent.change(screen.getByLabelText('Resultado Glucosa'), {
      target: { value: '95' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(guardarResultados).toHaveBeenCalledWith(10, [
        { orderItemId: 1, parameterId: 1, value: '95' },
      ]),
    );
    expect(await screen.findByText('Resultados guardados.')).toBeInTheDocument();
    expect(await screen.findByLabelText('Resultado Sodio')).toBeInTheDocument();
    expect(screen.queryByLabelText('Resultado Glucosa')).not.toBeInTheDocument();
  });

  it('al guardar y siguiente vuelve a la lista cuando no quedan más órdenes', async () => {
    vi.mocked(obtenerOrden).mockResolvedValue(orden());
    vi.mocked(obtenerLista)
      .mockResolvedValueOnce(lista([orden()]))
      .mockResolvedValueOnce(lista([]));
    vi.mocked(guardarResultados).mockResolvedValue(undefined);

    renderCaptura();
    await screen.findByRole('heading', { name: 'Captura de resultados' });

    fireEvent.change(screen.getByLabelText('Resultado Glucosa'), {
      target: { value: '95' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y siguiente' }));

    expect(await screen.findByText('Lista destino')).toBeInTheDocument();
    expect(guardarResultados).toHaveBeenCalledTimes(1);
    expect(obtenerLista).toHaveBeenCalledTimes(2);
  });

  it('rechaza un identificador de orden inválido sin consultar el servicio', async () => {
    renderCaptura('/resultados/lista-de-trabajo/abc');

    expect(
      await screen.findByText('El identificador de la orden no es válido.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la lista' })).toHaveAttribute(
      'href',
      '/resultados/lista-de-trabajo',
    );
    expect(obtenerOrden).not.toHaveBeenCalled();
  });

  it('muestra el error de carga y el enlace para volver a la lista', async () => {
    vi.mocked(obtenerOrden).mockRejectedValue(new Error('falló'));

    renderCaptura();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo completar la operación.',
    );
    expect(screen.getByRole('link', { name: 'Volver a la lista' })).toBeInTheDocument();
  });
});
