import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FeatureWorkflowPage from '../FeatureWorkflowPage';
import { api } from '../../services/api';

vi.mock('../../services/api');

const paciente = {
  id: 1,
  firstName: 'Ana',
  lastName: 'Ruiz',
  patientCode: 'P-000001',
  gender: 'F',
  birthDate: '1990-01-01',
};

const glucosa = {
  id: 1,
  code: 'GLU001',
  name: 'Glucosa',
  price: '150',
  sampleType: 'Suero',
  instructions: [
    { type: 'fasting', text: 'Ayuno de 8 horas', minHours: 8, study: 'Glucosa' },
  ],
};

const biometria = {
  id: 2,
  code: 'BH001',
  name: 'Biometría hemática',
  price: '200',
  sampleType: 'Sangre total',
  instructions: [],
};

const tirotropina = {
  id: 3,
  code: 'TSH01',
  name: 'Tirotropina',
  price: '180',
  sampleType: 'Suero',
  instructions: [],
};

function datosBase(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Laboratorio Santa Lucía',
    branches: [{ id: 1, name: 'Clínica Central' }],
    practitioners: [
      { id: 1, fullName: 'Dr. Roberto Salas', specialty: 'Medicina general' },
    ],
    tests: [glucosa, biometria, tirotropina],
    orders: [
      {
        folio: 'SL-000010',
        patient: paciente,
        branch: { id: 1, name: 'Clínica Central' },
        physician: { fullName: 'Dra. Patricia Ruiz' },
        items: [],
        samples: [],
      },
    ],
    ...overrides,
  };
}

function datosDeResultados() {
  return datosBase({
    orders: [
      {
        folio: 'SL-000010',
        patient: paciente,
        branch: { id: 1, name: 'Clínica Central' },
        physician: { fullName: 'Dra. Patricia Ruiz' },
        samples: [
          {
            sampleDescription: 'Suero',
            receivedAt: '2026-01-15T09:30:00.000Z',
            equipment: 'Architect c8000',
            capturedByName: 'Laura Méndez',
          },
        ],
        items: [
          {
            id: 5,
            test: {
              id: 1,
              code: 'GLU001',
              name: 'Glucosa',
              price: '150',
              sampleType: 'Suero',
              parameters: [
                {
                  id: 11,
                  name: 'Glucosa',
                  unit: 'mg/dL',
                  qualitativeExpected: null,
                  previousValue: '90',
                  previousDate: '10 ene 2026',
                  ranges: [
                    {
                      gender: 'F',
                      minAgeYears: 18,
                      maxAgeYears: 120,
                      low: 70,
                      high: 100,
                      criticalHigh: 200,
                      display: '70 – 100',
                    },
                  ],
                },
              ],
            },
            testResults: [],
          },
        ],
      },
    ],
  });
}

function montar(data: Record<string, unknown>) {
  (api.get as any).mockResolvedValue({ data });
  return render(<FeatureWorkflowPage />);
}

describe('Página de flujo de trabajo (frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/ordenes/nueva');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('carga la nueva orden con el paciente, los estudios y las indicaciones consolidadas', async () => {
    montar(datosBase());

    expect(
      await screen.findByRole('heading', { name: 'Nueva orden' }),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/feature-data');
    expect(
      screen.getByText(/Ana Ruiz · P-000001 · 36 años · Mujer · Clínica Central/),
    ).toBeInTheDocument();
    expect(screen.getByText('Glucosa')).toBeInTheDocument();
    expect(screen.getByText('Biometría hemática')).toBeInTheDocument();
    expect(screen.getAllByText(/Ayuno de 8 horas/).length).toBeGreaterThan(0);
    expect(
      screen.getByText('2 conceptos · la paciente no tiene otra orden abierta hoy'),
    ).toBeInTheDocument();
    expect(screen.getByText('Subtotal $350.00')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('exige confirmar las indicaciones con F2 antes de continuar al cobro', async () => {
    (api.post as any).mockImplementation((url: string) => {
      if (url === '/orders') return Promise.resolve({ data: { id: 99 } });
      return Promise.resolve({ data: {} });
    });
    montar(datosBase());

    await screen.findByRole('heading', { name: 'Nueva orden' });

    fireEvent.click(screen.getByRole('button', { name: 'Continuar al cobro' }));

    expect(
      await screen.findByText(
        'Confirma con F2 que informaste las indicaciones antes de continuar.',
      ),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'F2' });
    expect(screen.getByRole('checkbox')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar al cobro' }));

    expect(
      await screen.findByRole('heading', { name: 'Cobro pendiente' }),
    ).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE-99')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/orders', { testIds: [1, 2] });
    expect(api.post).toHaveBeenCalledWith('/orders/99/confirmation', {
      observation: '',
    });
  });

  it('agrega un estudio con Enter desde el buscador y actualiza el subtotal', async () => {
    montar(datosBase());

    await screen.findByRole('heading', { name: 'Nueva orden' });

    const buscador = screen.getByLabelText(/Agregar estudio o perfil/i);
    fireEvent.change(buscador, { target: { value: 'Tiro' } });

    expect(
      screen.getByRole('button', { name: /TSH01 · Tirotropina · \$180\.00/ }),
    ).toBeInTheDocument();

    buscador.focus();
    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByText('Tirotropina')).toBeInTheDocument(),
    );
    expect(
      screen.getByText('3 conceptos · la paciente no tiene otra orden abierta hoy'),
    ).toBeInTheDocument();
    expect(screen.getByText('Subtotal $530.00')).toBeInTheDocument();
    expect(buscador).toHaveValue('');
  });

  it('captura resultados, marca el valor crítico y exige registrar la notificación', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    window.history.replaceState({}, '', '/resultados/captura/SL-000010');

    montar(datosDeResultados());

    expect(
      await screen.findByRole('heading', { name: 'Captura de resultados' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ana Ruiz · P-000001 · 36 años · Mujer · Glucosa/),
    ).toBeInTheDocument();
    expect(screen.getByText('Architect c8000')).toBeInTheDocument();
    expect(screen.getByText('90 (10 ene 2026)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Resultado Glucosa'), {
      target: { value: '250' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('FUERA DE RANGO');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Glucosa: 250 mg/dL por encima del límite crítico (70 – 100 mg/dL).',
    );
    expect(screen.getAllByText('HH').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText(
        'Resultado crítico: registra a quién notificaste antes de guardar.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Notificación de resultado crítico' }),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar notificación' }));

    expect(
      await screen.findByText(
        'Notificación lista. Guarda nuevamente para persistir el resultado.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/results/5', {
      parameterId: 11,
      value: '250',
      flag: 'HH',
      notification: expect.objectContaining({
        recipientName: 'Dra. Patricia Ruiz',
        registered: true,
      }),
    });
    expect(
      await screen.findByText(
        'Resultados guardados como capturados, pendientes de validar.',
      ),
    ).toBeInTheDocument();
  });

  it('muestra el error de carga cuando la API devuelve un mensaje de negocio', async () => {
    (api.get as any).mockRejectedValue({
      response: { data: { error: 'No se pudo cargar la orden.' } },
    });

    render(<FeatureWorkflowPage />);

    expect(
      await screen.findByRole('heading', { name: 'SoftLab' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No se pudo cargar la orden.')).toBeInTheDocument();
    expect(
      screen.getByText('Levanta la API y ejecuta el seed HU 5.2/6.2.'),
    ).toBeInTheDocument();
  });
});
