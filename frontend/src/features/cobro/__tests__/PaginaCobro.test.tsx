import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaCobro from '../PaginaCobro';
import { cancelarPago, obtenerCobro, registrarPagos } from '../cobroApi';
import type { CobroOrden } from '../datosCobro';

vi.mock('../cobroApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../cobroApi')>();
  return {
    ...actual,
    obtenerCobro: vi.fn(),
    registrarPagos: vi.fn(),
    cancelarPago: vi.fn(),
  };
});

const orden: CobroOrden['orden'] = {
  id: 42,
  folio: 'SL-000042',
  paciente: 'María López García',
  expediente: 'P-000231',
  edad: 38,
  sexo: 'Mujer',
  medico: 'Dr. Roberto Salas',
  sucursal: 'Clínica Central',
  conceptos: [{ clave: 'BH', nombre: 'Biometría hemática', precio: 15000 }],
  resultadosEntregados: false,
};

function cobro(overrides: Partial<CobroOrden> = {}): CobroOrden {
  return {
    orden,
    descuento: { porcentaje: 0, motivo: '', autorizo: '' },
    factura: null,
    total: 15000,
    pagado: 0,
    pagos: [],
    bitacora: [],
    ...overrides,
  };
}

const pagoVigente = {
  id: 7,
  metodo: 'Efectivo' as const,
  monto: 15000,
  referencia: '',
  fecha: '15 ene 2026, 10:00',
  usuario: 'Laura Méndez',
  cancelado: false,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ordenes/cobro?orden=42']}>
      <PaginaCobro />
    </MemoryRouter>,
  );
}

describe('Pantalla de cobro (frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga la orden y muestra el formulario de cobro con sus totales', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Cobro de la orden' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/María López García · P-000231 · 38 años · Mujer/)).toBeInTheDocument();
    expect(screen.getByText('Resumen de la orden')).toBeInTheDocument();
    expect(screen.getByText('Biometría hemática')).toBeInTheDocument();
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
    expect(obtenerCobro).toHaveBeenCalledWith(42);
  });

  it('abre directo el comprobante cuando la orden ya tiene pagos', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(
      cobro({
        pagado: 15000,
        pagos: [pagoVigente],
        bitacora: [
          {
            fecha: '15 ene 2026, 10:00',
            usuario: 'Laura Méndez',
            accion: 'Registró pago',
            detalle: 'Efectivo $150.00',
          },
        ],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Orden SL-000042' }),
    ).toBeInTheDocument();
    expect(screen.getByText('PAGADA')).toBeInTheDocument();
    expect(screen.getByText('Pagos de la orden')).toBeInTheDocument();
    expect(screen.getByText('Bitácora de cobro')).toBeInTheDocument();
    expect(screen.getByText('Registró pago')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
  });

  it('valida que se capture al menos un monto antes de registrar el pago', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(
      await screen.findByText('Captura al menos un monto para registrar el pago.'),
    ).toBeInTheDocument();
    expect(registrarPagos).not.toHaveBeenCalled();
  });

  it('registra un pago en efectivo y muestra el comprobante resultante', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockResolvedValue(
      cobro({
        pagado: 15000,
        pagos: [pagoVigente],
        bitacora: [
          {
            fecha: '15 ene 2026, 10:00',
            usuario: 'Laura Méndez',
            accion: 'Registró pago',
            detalle: 'Efectivo $150.00 · cambio $0.00',
          },
        ],
      }),
    );

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    fireEvent.change(screen.getAllByPlaceholderText('$0.00')[0], {
      target: { value: '150' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    await waitFor(() => expect(registrarPagos).toHaveBeenCalledTimes(1));
    expect(registrarPagos).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        captura: expect.objectContaining({ efectivo: 15000 }),
        totales: expect.objectContaining({ pagadoAhora: 15000, saldo: 0 }),
      }),
      false,
    );

    expect(await screen.findByText('PAGADA')).toBeInTheDocument();
    expect(screen.getByText(/Folio SL-000042/)).toBeInTheDocument();
  });

  it('permite dejar la orden pendiente de pago sin capturar montos', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockResolvedValue(cobro());

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    fireEvent.click(screen.getByRole('button', { name: 'Dejar pendiente de pago' }));

    await waitFor(() => expect(registrarPagos).toHaveBeenCalledTimes(1));
    expect(registrarPagos).toHaveBeenCalledWith(42, expect.anything(), true);
  });

  it('muestra el error cuando el registro del pago falla', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockRejectedValue(new Error('falló'));

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    fireEvent.change(screen.getAllByPlaceholderText('$0.00')[0], {
      target: { value: '150' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocurrió un error inesperado.',
    );
  });

  it('cancela un pago con motivo y actualiza el comprobante a saldo pendiente', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(
      cobro({ pagado: 15000, pagos: [pagoVigente] }),
    );
    vi.mocked(cancelarPago).mockResolvedValue(
      cobro({
        pagado: 0,
        pagos: [{ ...pagoVigente, cancelado: true }],
        bitacora: [
          {
            fecha: '15 ene 2026, 10:05',
            usuario: 'Laura Méndez',
            accion: 'Canceló pago',
            detalle: 'Motivo: Se cobró a la tarjeta equivocada',
          },
        ],
      }),
    );

    renderPage();
    await screen.findByText('PAGADA');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pago' }));
    expect(screen.getByRole('dialog', { name: 'Cancelar pago' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(await screen.findByText('El motivo es obligatorio.')).toBeInTheDocument();
    expect(cancelarPago).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/se cobró a la tarjeta equivocada/i), {
      target: { value: 'Se cobró a la tarjeta equivocada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));

    await waitFor(() =>
      expect(cancelarPago).toHaveBeenCalledWith(7, 'Se cobró a la tarjeta equivocada'),
    );
    expect(
      await screen.findByText('Pago cancelado y registrado en bitácora.'),
    ).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });
});
