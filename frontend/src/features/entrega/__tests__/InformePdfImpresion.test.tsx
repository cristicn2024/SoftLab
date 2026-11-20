import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaEntrega from '../PaginaEntrega';
import { api } from '../../../services/api';

vi.mock('../../../services/api');

function pdfBlob() {
  return new Blob(['%PDF-1.4'], { type: 'application/pdf' });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/entrega?orden=42']}>
      <PaginaEntrega />
    </MemoryRouter>,
  );
}

async function abrirModal() {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar entrega' }));
  await screen.findByRole('dialog', { name: 'Entrega de resultados' });
}

describe('HU-06 · emisión e impresión del informe PDF validado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (URL as any).createObjectURL = vi.fn(() => 'blob:informe-42');
    (URL as any).revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('genera el informe con el canal de impresión y lo deja listo para entregar', async () => {
    (api.post as any).mockResolvedValue({ data: pdfBlob() });
    await abrirModal();

    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'print' } });
    fireEvent.click(screen.getByRole('button', { name: 'Obtener resultados' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/reports/orders/42/pdf',
        { channel: 'print' },
        expect.objectContaining({ responseType: 'blob' }),
      ),
    );
    expect(await screen.findByText(/Documento liberado\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descargar informe' })).toHaveAttribute(
      'download',
      'Informe_Orden_42.pdf',
    );
    expect(screen.getByTitle('Informe de resultados')).toBeInTheDocument();
  });

  it('descarta el PDF anterior al cambiar de canal y vuelve a solicitarlo', async () => {
    (api.post as any).mockResolvedValue({ data: pdfBlob() });
    await abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Obtener resultados' }));
    expect(await screen.findByTitle('Informe de resultados')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'print' } });
    expect(screen.queryByTitle('Informe de resultados')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Obtener resultados' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith(
        '/reports/orders/42/pdf',
        { channel: 'print' },
        expect.anything(),
      ),
    );
    expect(await screen.findByTitle('Informe de resultados')).toBeInTheDocument();
  });

  it.skip('ofrece un botón explícito para imprimir el informe validado desde el sistema', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    (api.post as any).mockResolvedValue({ data: pdfBlob() });
    await abrirModal();

    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'print' } });
    fireEvent.click(screen.getByRole('button', { name: 'Obtener resultados' }));
    await screen.findByTitle('Informe de resultados');

    const boton = screen.getByRole('button', { name: /Imprimir informe/ });
    fireEvent.click(boton);
    expect(imprimir).toHaveBeenCalledTimes(1);
  });
});
