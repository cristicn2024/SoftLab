import {
  render,
  screen,
  fireEvent,
  act
} from '@testing-library/react';

import { OrderCapturePage } from '../OrderCapturePage';
import { api } from '../../services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../services/api');

describe('HU-07: OrderCapturePage (Frontend)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe mostrar el estado vacío (Empty State) al inicializar sin estudios', async () => {
    (api.get as any).mockResolvedValue({ data: [] });

    await act(async () => {
      render(<OrderCapturePage />);
    });

    expect(
      screen.getByText(/Aún no hay estudios en esta orden/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /Continuar al cobro/i })
    ).toBeDisabled();
  });

  it('debe advertir si se intenta agregar un estudio duplicado', async () => {

    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/patients')) return Promise.resolve({ data: [{ id: 1, firstName: 'Ana', lastName: 'QA', patientCode: 'P-1', birthDate: '1990-01-01', gender: 'F' }] });
      if (url.includes('/concepts/search')) {
        return Promise.resolve({
          data: [
            {
              id: 10,
              type: 'TEST',
              code: 'BH',
              name: 'Biometría Hemática',
              price: 250,
              genderRestriction: 'BOTH',
              includedTestIds: [10]
            }
          ]
        });
      }

      return Promise.resolve({ data: [] });
    });
    (api.post as any).mockResolvedValue({ data: { patientGender: 'F', indications: { studies: [], muestras: [{ tipo: 'Sangre', contenedor: 'Tubo rojo', volumenes: ['3 mL'], estudios: ['Biometría Hemática'] }], ayunos: [], preparacion: [], medicamentos: [], adicionales: [], conflictos: [] }, incompatibleStudies: [] } });

    await act(async () => {
      render(<OrderCapturePage />);
    });

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre o clave/i), { target: { value: 'Ana' } });
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole('combobox', { name: /Seleccionar paciente/i }), { target: { value: '1' } });

    const searchInput = screen.getByPlaceholderText(
      /Busca por clave o nombre/i
    );

    // Primera búsqueda
    fireEvent.change(searchInput, {
      target: { value: 'BH' }
    });

    // Esperar a que aparezca el resultado
    const findStudy = () =>
      screen.findByText((_, element) =>
        element?.tagName.toLowerCase() === 'li' &&
        element.textContent?.includes('[BH]') === true &&
        element.textContent?.includes('Biometría Hemática') === true
      );

    const firstItem = await findStudy();

    // Agregar el primer estudio
    fireEvent.click(firstItem);
    expect(await screen.findByText(/Tubo rojo/)).toBeInTheDocument();

    // Verificar que se agregó
    expect(
      screen.getByText('Biometría Hemática')
    ).toBeInTheDocument();

    // Segunda búsqueda del mismo estudio
    fireEvent.change(searchInput, {
      target: { value: 'BH' }
    });

    const secondItem = await findStudy();

    // Intentar agregarlo nuevamente
    fireEvent.click(secondItem);

    // Verificar advertencia de duplicado
    expect(
      await screen.findByText(/ya fue agregado a la orden/i)
    ).toBeInTheDocument();

    // Verificar que solamente existe una fila de estudio
    const rows = screen.getAllByRole('row');

    expect(rows).toHaveLength(2); // Encabezado + un estudio
  });

  it('carga los médicos solicitantes al abrir la pantalla, sin esperar al paciente', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/doctors') return Promise.resolve({ data: [{ id: 3, name: 'Dra. Patricia Ruiz' }, { id: 4, name: 'Dr. Ernesto Salas' }] });
      return Promise.resolve({ data: [] });
    });

    await act(async () => {
      render(<OrderCapturePage />);
    });

    expect(screen.getByRole('option', { name: 'Dra. Patricia Ruiz' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dr. Ernesto Salas' })).toBeInTheDocument();
  });

  it('avisa si no se pudieron consultar los médicos', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/doctors') return Promise.reject({ response: { data: { error: { mensaje: 'Error al consultar los médicos solicitantes' } } } });
      return Promise.resolve({ data: [] });
    });

    await act(async () => {
      render(<OrderCapturePage />);
    });

    expect(screen.getByText('Error al consultar los médicos solicitantes')).toBeInTheDocument();
  });
});
