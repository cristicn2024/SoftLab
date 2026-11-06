import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaEntrega from '../PaginaEntrega';
import { api } from '../../../services/api';

vi.mock('../../../services/api');

function renderPage(entry = '/entrega') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PaginaEntrega />
    </MemoryRouter>,
  );
}

function errorBlob(payload: unknown) {
  const text = JSON.stringify(payload);
  const blob = new Blob([text], { type: 'application/json' });
  Object.defineProperty(blob, 'text', { value: () => Promise.resolve(text) });
  return blob;
}

function pdfBlob() {
  return new Blob(['%PDF-1.4'], { type: 'application/pdf' });
}

describe('Pantalla de entrega de resultados (frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (URL as any).createObjectURL = vi.fn(() => 'blob:informe-42');
    (URL as any).revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('valida el número de orden antes de abrir la consulta', () => {
    renderPage();

    const boton = screen.getByRole('button', { name: 'Consultar entrega' });
    expect(boton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Número de orden/i), {
      target: { value: '0' },
    });
    expect(boton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Número de orden/i), {
      target: { value: '42' },
    });
    expect(boton).toBeEnabled();
  });

  it('abre el modal de entrega con la orden indicada en la URL', async () => {
    renderPage('/entrega?orden=42');

    expect(screen.getByLabelText(/Número de orden/i)).toHaveValue(42);

    fireEvent.click(screen.getByRole('button', { name: 'Consultar entrega' }));

    expect(
      await screen.findByRole('dialog', { name: 'Entrega de resultados' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Entrega de resultados · Orden 42' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Canal')).toHaveValue('counter');
  });

  it('obtiene el PDF y muestra el enlace de descarga del informe', async () => {
    (api.post as any).mockResolvedValue({ data: pdfBlob() });
    renderPage('/entrega?orden=42');

    fireEvent.click(screen.getByRole('button', { name: 'Consultar entrega' }));
    await screen.findByRole('dialog', { name: 'Entrega de resultados' });

    fireEvent.change(screen.getByLabelText('Canal'), {
      target: { value: 'email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Obtener resultados' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/reports/orders/42/pdf',
        { channel: 'email' },
        expect.objectContaining({
          responseType: 'blob',
          headers: {
            'x-user-name': encodeURIComponent('Laura Méndez'),
            'x-user-role': encodeURIComponent('Administradora'),
          },
        }),
      ),
    );

    expect(await screen.findByText(/Documento liberado\./)).toBeInTheDocument();
    const enlace = screen.getByRole('link', { name: 'Descargar informe' });
    expect(enlace).toHaveAttribute('href', 'blob:informe-42');
    expect(enlace).toHaveAttribute('download', 'Informe_Orden_42.pdf');
    expect(screen.getByTitle('Informe de resultados')).toBeInTheDocument();
    expect((URL as any).createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('bloquea la entrega con saldo pendiente y permite autorizar una excepción con motivo', async () => {
    (api.post as any)
      .mockRejectedValueOnce({
        response: {
          data: errorBlob({
            error: 'La orden tiene saldo pendiente.',
            code: 'PAYMENT_REQUIRED',
          }),
        },
      })
      .mockResolvedValueOnce({ data: pdfBlob() });

    renderPage('/entrega?orden=42');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar entrega' }));
    await screen.findByRole('dialog', { name: 'Entrega de resultados' });

    fireEvent.click(screen.getByRole('button', { name: 'Obtener resultados' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La orden tiene saldo pendiente.',
    );
    expect(screen.getByRole('link', { name: 'Registrar pago' })).toHaveAttribute(
      'href',
      '/ordenes/cobro?orden=42',
    );
    expect(
      screen.getByText(/Puedes seguir capturando y validando mientras exista saldo\./),
    ).toBeInTheDocument();

    const autorizar = screen.getByRole('button', {
      name: 'Autorizar excepción y obtener resultados',
    });
    expect(autorizar).toBeDisabled();
    expect(screen.getByLabelText('Motivo de excepción')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Motivo de excepción'), {
      target: { value: 'Se autorizó por convenio con la empresa' },
    });
    expect(autorizar).toBeEnabled();
    fireEvent.click(autorizar);

    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith(
        '/reports/orders/42/pdf',
        { channel: 'counter', reason: 'Se autorizó por convenio con la empresa' },
        expect.anything(),
      ),
    );
    expect(await screen.findByText(/Documento liberado\./)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el error general cuando la descarga falla sin cuerpo de negocio', async () => {
    (api.post as any).mockRejectedValue(new Error('falló la red'));
    renderPage('/entrega?orden=42');

    fireEvent.click(screen.getByRole('button', { name: 'Consultar entrega' }));
    await screen.findByRole('dialog', { name: 'Entrega de resultados' });

    fireEvent.click(screen.getByRole('button', { name: 'Obtener resultados' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocurrió un error inesperado.',
    );
    expect(
      screen.queryByRole('link', { name: 'Registrar pago' }),
    ).not.toBeInTheDocument();
  });

  it('cierra el modal de entrega sin perder la orden capturada', async () => {
    renderPage('/entrega?orden=42');

    fireEvent.click(screen.getByRole('button', { name: 'Consultar entrega' }));
    await screen.findByRole('dialog', { name: 'Entrega de resultados' });

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(
      screen.queryByRole('dialog', { name: 'Entrega de resultados' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Número de orden/i)).toHaveValue(42);
  });
});
