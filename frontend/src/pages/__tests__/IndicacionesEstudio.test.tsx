import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { OrderCapturePage } from '../OrderCapturePage';
import { api } from '../../services/api';

vi.mock('../../services/api');

const PACIENTE = {
  id: 1,
  firstName: 'Ana',
  lastName: 'QA',
  patientCode: 'P-1',
  birthDate: '1990-01-01',
  gender: 'F',
};

const ESTUDIO = {
  id: 10,
  type: 'TEST',
  code: 'GLU',
  name: 'Glucosa en ayuno',
  price: 250,
  genderRestriction: 'BOTH',
  includedTestIds: [10],
};

function preview(overrides: Record<string, unknown> = {}) {
  return {
    patientGender: 'F',
    indications: {
      studies: [{ id: 10, code: 'GLU', name: 'Glucosa en ayuno' }],
      muestras: [],
      ayunos: [{ horas: 8, texto: 'Ayuno 8 horas', estudios: ['Glucosa en ayuno'] }],
      preparacion: [],
      medicamentos: [],
      adicionales: [],
      conflictos: [],
      externos: [],
      ...overrides,
    },
    incompatibleStudies: [],
  };
}

async function capturarOrden(previewData = preview()) {
  (api.get as any).mockImplementation((url: string) => {
    if (url.includes('/patients')) return Promise.resolve({ data: [PACIENTE] });
    if (url.includes('/branches')) return Promise.resolve({ data: [{ id: 1, name: 'Sucursal Central' }] });
    if (url.includes('/doctors')) return Promise.resolve({ data: [] });
    if (url.includes('/check-open')) return Promise.resolve({ data: { hasOpenOrder: false } });
    if (url.includes('/concepts/search')) return Promise.resolve({ data: [ESTUDIO] });
    return Promise.resolve({ data: [] });
  });

  (api.post as any).mockImplementation((url: string) => {
    if (url.includes('/indications/preview')) return Promise.resolve({ data: previewData });
    if (url === '/orders') {
      return Promise.resolve({ data: { folio: 'ORD-20261119-0001', shipmentFolios: [] } });
    }
    return Promise.resolve({ data: {} });
  });

  render(<OrderCapturePage />);

  fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o clave'), {
    target: { value: 'Ana' },
  });
  await act(async () => { await Promise.resolve(); });

  fireEvent.change(screen.getByRole('combobox', { name: 'Seleccionar paciente' }), {
    target: { value: '1' },
  });
  await act(async () => { await Promise.resolve(); });

  fireEvent.change(screen.getByPlaceholderText('Busca por clave o nombre'), {
    target: { value: 'GLU' },
  });
  await act(async () => { await Promise.resolve(); });

  const resultado = await screen.findByText((_, element) =>
    element?.tagName.toLowerCase() === 'li' && (element.textContent ?? '').includes('[GLU]')
  );
  fireEvent.click(resultado);
  await act(async () => { await Promise.resolve(); });
}

const PANEL = { name: 'Indicaciones preanalíticas' };

describe('HU 5.2 · Indicaciones del Estudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. muestra de inmediato el panel con las indicaciones al agregar el estudio', async () => {
    await capturarOrden();
    const panel = await screen.findByRole('region', PANEL);

    expect(within(panel).getByText('Indicaciones de preparación')).toBeInTheDocument();
    expect(within(panel).getByText(/Ayuno/)).toBeInTheDocument();
    expect(within(panel).getByText(/8 horas/)).toBeInTheDocument();
  });

  it.skip('2. distingue visualmente en la lista de la orden los estudios con indicaciones', async () => {
    await capturarOrden();
    await screen.findByRole('region', PANEL);

    const fila = screen.getByRole('row', { name: /Glucosa en ayuno/ });
    expect(within(fila).getByText(/indicaciones/i)).toBeInTheDocument();
  });

  it('3. muestra consolidadas las indicaciones de estudios distintos de un perfil', async () => {
    await capturarOrden(preview({
      ayunos: [
        { horas: 8, texto: 'Ayuno 8 horas', estudios: ['Glucosa en ayuno'] },
        { horas: 12, texto: 'Ayuno 12 horas', estudios: ['Perfil lipídico'] },
      ],
      preparacion: [
        { texto: 'Acudir temprano', estudios: ['Glucosa en ayuno', 'Perfil lipídico'] },
      ],
    }));
    const panel = await screen.findByRole('region', PANEL);

    const consolidada = within(panel).getByText((_, element) =>
      element?.tagName.toLowerCase() === 'p' &&
      (element.textContent ?? '').includes('Acudir temprano') &&
      (element.textContent ?? '').includes('Glucosa en ayuno') &&
      (element.textContent ?? '').includes('Perfil lipídico')
    );
    expect(consolidada).toBeInTheDocument();
    expect(within(panel).getByText(/8 horas/)).toBeInTheDocument();
    expect(within(panel).getByText(/12 horas/)).toBeInTheDocument();
  });

  it.skip('4. confirma con F2 que informó al paciente y registra la confirmación al cerrar', async () => {
    await capturarOrden(preview({ conflictos: ['El paciente no cumplió el ayuno'] }));
    const panel = await screen.findByRole('region', PANEL);
    const confirmacion = within(panel).getByRole('checkbox', { name: /Confirmo que revisé/i });

    fireEvent.keyDown(screen.getByPlaceholderText('Busca por clave o nombre'), { key: 'F2' });
    await act(async () => { await Promise.resolve(); });

    expect(confirmacion).toBeChecked();

    vi.spyOn(window, 'alert').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Continuar al cobro' }));
    await act(async () => { await Promise.resolve(); });

    const envio = (api.post as any).mock.calls.find(([url]: [string]) => url === '/orders');
    expect(envio?.[1]).toMatchObject({ reviewedInstructionConflicts: true });
  });

  it('5a. permite imprimir las indicaciones', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    await capturarOrden();
    const panel = await screen.findByRole('region', PANEL);

    fireEvent.click(within(panel).getByRole('button', { name: /Imprimir indicaciones/i }));

    expect(imprimir).toHaveBeenCalledTimes(1);
    imprimir.mockRestore();
  });

  it.skip('5b. permite enviar las indicaciones al paciente por correo o mensaje', async () => {
    await capturarOrden();
    const panel = await screen.findByRole('region', PANEL);

    expect(within(panel).getByRole('button', { name: /correo/i })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /mensaje|whatsapp/i })).toBeInTheDocument();
  });

  it.skip('6. registra una observación cuando el paciente no cumplió la preparación', async () => {
    await capturarOrden(preview({ conflictos: ['El paciente no cumplió el ayuno de 8 horas'] }));
    const panel = await screen.findByRole('region', PANEL);
    const observacion = within(panel).getByLabelText(/observación/i);

    fireEvent.change(observacion, { target: { value: 'Paciente no ayunó' } });
    fireEvent.click(within(panel).getByRole('checkbox', { name: /Confirmo que revisé/i }));
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Continuar al cobro' }));
    await act(async () => { await Promise.resolve(); });

    const envio = (api.post as any).mock.calls.find(([url]: [string]) => url === '/orders');
    expect(JSON.stringify(envio?.[1] ?? {})).toContain('Paciente no ayunó');
  });

  it('7. avisa en el panel que un estudio externo puede tardar más', async () => {
    await capturarOrden(preview({
      externos: [{
        code: 'HBA001',
        name: 'Hemoglobina glucosilada (HbA1c)',
        laboratorio: 'Laboratorio Referencia Nacional',
        dias: 3,
      }],
    }));
    const panel = await screen.findByRole('region', PANEL);

    expect(within(panel).getByText(/El resultado puede tardar más/)).toBeInTheDocument();
    expect(within(panel).getByText(/3 días/)).toBeInTheDocument();
  });
});
