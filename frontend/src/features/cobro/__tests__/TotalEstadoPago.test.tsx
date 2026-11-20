import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

function pago(overrides: Partial<CobroOrden['pagos'][number]> = {}): CobroOrden['pagos'][number] {
  return {
    id: 7,
    metodo: 'Efectivo',
    monto: 15000,
    referencia: '',
    fecha: '19 nov 2026, 10:00',
    usuario: 'Laura Méndez',
    cancelado: false,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ordenes/cobro?orden=42']}>
      <PaginaCobro />
    </MemoryRouter>,
  );
}

describe('HU 5.3 · Total y Estado de Pago', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. muestra el total de la orden y permite marcarla como pagada o pendiente', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockResolvedValue(cobro());

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cobro de la orden' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Total' })).toBeInTheDocument();
    expect(screen.getAllByText('$150.00').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dejar pendiente de pago' }));

    await waitFor(() =>
      expect(registrarPagos).toHaveBeenCalledWith(42, expect.anything(), true),
    );
    expect(await screen.findByText('PENDIENTE')).toBeInTheDocument();
  });

  it('2. combina efectivo, tarjeta y transferencia con cálculo de cambio en efectivo', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockResolvedValue(
      cobro({ pagado: 15000, pagos: [pago({ metodo: 'Tarjeta', monto: 3000 })] }),
    );

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    const montos = screen.getAllByPlaceholderText('$0.00');
    fireEvent.change(montos[0], { target: { value: '200' } });
    fireEvent.change(montos[1], { target: { value: '30' } });
    fireEvent.change(screen.getByPlaceholderText('Núm. de autorización'), {
      target: { value: 'AUTH-123' },
    });
    fireEvent.change(montos[2], { target: { value: '20' } });
    fireEvent.change(screen.getByPlaceholderText('Referencia o clave de rastreo'), {
      target: { value: 'TR-987' },
    });

    expect(screen.getByText(/Se aplican \$100\.00 · cambio \$100\.00/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    await waitFor(() => expect(registrarPagos).toHaveBeenCalledTimes(1));
    expect(registrarPagos).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        captura: { efectivo: 20000, tarjeta: 3000, transferencia: 2000 },
        totales: expect.objectContaining({
          efectivoAplicado: 10000,
          cambio: 10000,
          pagadoAhora: 15000,
          saldo: 0,
        }),
        referenciaTarjeta: 'AUTH-123',
        referenciaTransferencia: 'TR-987',
      }),
      false,
    );
    expect(await screen.findByText('PAGADA')).toBeInTheDocument();
  });

  it('3. deja la orden pendiente con un pago parcial y muestra el saldo por cobrar', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockResolvedValue(
      cobro({ pagado: 5000, pagos: [pago({ monto: 5000 })] }),
    );

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    fireEvent.change(screen.getAllByPlaceholderText('$0.00')[0], { target: { value: '50' } });
    expect(screen.getByText('Es un pago parcial: la orden quedará como pendiente.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(await screen.findByText('PENDIENTE')).toBeInTheDocument();
    expect(screen.getByText(/Orden registrada con saldo pendiente: \$100\.00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('4. informa que se puede cobrar antes o después del análisis, pero no tras entregar resultados', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    expect(
      screen.getByText(/Se puede pagar antes o después de la toma y el análisis, pero nunca después de entregar resultados/),
    ).toBeInTheDocument();
  });

  it('5. exige motivo para aplicar un descuento y lo registra en el envío', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockResolvedValue(cobro({ total: 13500, pagado: 13500 }));

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    fireEvent.change(screen.getAllByPlaceholderText('$0.00')[0], { target: { value: '135' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Descuento/i }), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(await screen.findByText('El descuento requiere un motivo.')).toBeInTheDocument();
    expect(registrarPagos).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/cortesía autorizada por dirección/i), {
      target: { value: 'Cortesía autorizada por dirección' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    await waitFor(() => expect(registrarPagos).toHaveBeenCalledTimes(1));
    expect(registrarPagos).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        descuento: {
          porcentaje: 10,
          motivo: 'Cortesía autorizada por dirección',
          autorizo: 'Laura Méndez',
        },
        totales: expect.objectContaining({ descuento: 1500, total: 13500 }),
      }),
      false,
    );
  });

  it('6. indica que el cobro se registra en la caja de la sucursal', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    expect(
      screen.getByText(/El pago se registra en la caja de Clínica Central\./),
    ).toBeInTheDocument();
  });

  it('7. genera un ticket con folio, imprimible y enviable', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro({ pagado: 15000, pagos: [pago()] }));
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});

    renderPage();
    await screen.findByText('PAGADA');

    const ticket = screen.getByRole('complementary', { name: 'Comprobante de pago' });
    expect(within(ticket).getByText('Ticket T-000042')).toBeInTheDocument();
    expect(within(ticket).getByText('Orden SL-000042')).toBeInTheDocument();
    expect(within(ticket).getByText('ESTADO: PAGADO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir ticket' }));
    expect(imprimir).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket' }));
    expect(await screen.findByText('Ticket enviado al correo de la paciente.')).toBeInTheDocument();

    imprimir.mockRestore();
  });

  it('8. captura los datos de facturación y los envía con el pago', async () => {
    const datosFactura = {
      rfc: 'LOGM880312AB1',
      razonSocial: 'Laboratorio QA SA',
      codigoPostal: '01000',
      usoCfdi: 'G03',
    };
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockResolvedValue(
      cobro({ pagado: 15000, factura: datosFactura, pagos: [pago()] }),
    );

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    fireEvent.click(screen.getByRole('checkbox', { name: /La paciente requiere factura/i }));
    fireEvent.change(screen.getByPlaceholderText('LOGM880312AB1'), {
      target: { value: 'logm880312ab1' },
    });
    fireEvent.change(screen.getByLabelText('Nombre o razón social'), {
      target: { value: 'Laboratorio QA SA' },
    });
    fireEvent.change(screen.getByLabelText('C.P. fiscal'), { target: { value: '01000' } });
    fireEvent.change(screen.getByLabelText(/Uso del CFDI/), { target: { value: 'G03' } });
    fireEvent.change(screen.getAllByPlaceholderText('$0.00')[0], { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    await waitFor(() => expect(registrarPagos).toHaveBeenCalledTimes(1));
    expect(registrarPagos).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ factura: datosFactura }),
      false,
    );
    expect(
      await screen.findByText(/Datos de facturación: LOGM880312AB1 · Laboratorio QA SA · C.P. 01000 · G03/),
    ).toBeInTheDocument();
  });

  it('9. cancela un pago con motivo y deja bitácora con usuario y fecha', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro({ pagado: 15000, pagos: [pago()] }));
    vi.mocked(cancelarPago).mockResolvedValue(
      cobro({
        pagado: 0,
        pagos: [pago({ cancelado: true })],
        bitacora: [
          {
            fecha: '19 nov 2026, 10:05',
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
    fireEvent.change(screen.getByPlaceholderText(/se cobró a la tarjeta equivocada/i), {
      target: { value: 'Se cobró a la tarjeta equivocada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));

    await waitFor(() =>
      expect(cancelarPago).toHaveBeenCalledWith(7, 'Se cobró a la tarjeta equivocada'),
    );
    expect(await screen.findByText('Canceló pago')).toBeInTheDocument();
    expect(screen.getByText('19 nov 2026, 10:05')).toBeInTheDocument();
    expect(screen.getByText('Laura Méndez')).toBeInTheDocument();
    expect(screen.getByText('Motivo: Se cobró a la tarjeta equivocada')).toBeInTheDocument();
  });

  it('10. permite registrar el pago usando solo el teclado (Ctrl+Enter)', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());
    vi.mocked(registrarPagos).mockResolvedValue(
      cobro({ pagado: 15000, pagos: [pago()] }),
    );

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    const campo = screen.getAllByPlaceholderText('$0.00')[0];
    fireEvent.change(campo, { target: { value: '150' } });
    fireEvent.keyDown(campo, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(registrarPagos).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('PAGADA')).toBeInTheDocument();
  });

  it('11. resalta el saldo por cobrar de una orden pendiente', async () => {
    vi.mocked(obtenerCobro).mockResolvedValue(cobro());

    renderPage();
    await screen.findByRole('heading', { name: 'Cobro de la orden' });

    const saldo = screen.getByText('Saldo pendiente').parentElement;
    expect(saldo).toHaveTextContent('$150.00');
    expect(saldo?.className).toContain('cb-saldo-pendiente');
  });
});
