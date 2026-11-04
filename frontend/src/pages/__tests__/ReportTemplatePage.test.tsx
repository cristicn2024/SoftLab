import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportTemplatePage } from '../ReportTemplatePage';
import { api } from '../../services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../services/api');

describe('HU-06: ReportTemplatePage (Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe cargar la plantilla activa y renderizar la vista previa correctamente', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/templates') {
        return Promise.resolve({
          data: [
            {
              id: 1,
              version: 3,
              headerText: 'Laboratorio Santa Lucía · Clínica Central',
              disclaimer: 'Resultados válidos solo con firma del responsable sanitario',
              chemistName: 'Laura Méndez',
              chemistCedula: '10458392',
              isDefault: true,
              createdAt: '2026-10-10T12:00:00.000Z'
            }
          ]
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<ReportTemplatePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Laboratorio Santa Lucía · Clínica Central/i)).toBeInTheDocument();
    });

    // Usar getAllByText en lugar de getByText porque v3 aparece en select y en tabla
    expect(screen.getAllByText(/v3/i).length).toBeGreaterThan(0);
  });

  it('debe mostrar el banner de notificación tras guardar una nueva plantilla', async () => {
    (api.get as any).mockResolvedValue({
      data: [{ id: 1, version: 3, isDefault: true, createdAt: '2026-10-10' }]
    });

    (api.post as any).mockResolvedValue({
      data: { id: 2, version: 4, isDefault: true }
    });

    render(<ReportTemplatePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Publicar plantilla/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Publicar plantilla/i }));

    await waitFor(() => {
      expect(screen.getByText(/Plantilla publicada · versión 4/i)).toBeInTheDocument();
    });
  });
});