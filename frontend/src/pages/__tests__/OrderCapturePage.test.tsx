
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

    await act(async () => {
      render(<OrderCapturePage />);
    });

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

});
