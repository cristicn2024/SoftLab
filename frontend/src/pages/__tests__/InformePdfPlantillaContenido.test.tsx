import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportTemplatePage } from '../ReportTemplatePage';
import { ResultFlag } from '../../components/ResultFlag';
import { api } from '../../services/api';

vi.mock('../../services/api');

const VERSIONES = [
  {
    id: 1,
    version: 2,
    headerText: 'Encabezado anterior · Laboratorio Santa Lucía',
    disclaimer: 'Aviso legal anterior',
    chemistName: 'Q.F.B. Anterior',
    chemistCedula: '111',
    isDefault: false,
    createdAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 2,
    version: 3,
    headerText: 'Logotipo · Laboratorio Santa Lucía · Clínica Central',
    disclaimer: 'Resultados válidos solo con firma del responsable sanitario',
    chemistName: 'Laura Méndez',
    chemistCedula: '10458392',
    isDefault: true,
    createdAt: '2026-10-10T12:00:00.000Z',
  },
];

function renderPage() {
  return render(<ReportTemplatePage />);
}

describe('HU-06 · plantilla, contenido y vista previa del informe PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/templates' ? VERSIONES : [] }),
    );
  });

  it('previsualiza las cinco columnas y los resultados de ejemplo antes de publicar', async () => {
    renderPage();

    expect(await screen.findByText('Vista previa del informe PDF')).toBeInTheDocument();
    for (const columna of ['Prueba', 'Resultado', 'Unidades', 'Rango de referencia', 'Bandera']) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeInTheDocument();
    }

    const fila = screen.getByText('Hemoglobina').closest('tr') as HTMLElement;
    expect(within(fila).getByText('9.8')).toBeInTheDocument();
    expect(within(fila).getByText('g/dL')).toBeInTheDocument();
    expect(within(fila).getByText('12.0 a 16.0')).toBeInTheDocument();
    expect(within(fila).getByText('L')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('muestra en la vista previa los datos del paciente, folio, médico y fechas', async () => {
    renderPage();

    expect(await screen.findByText('Lucía Fernández Soto')).toBeInTheDocument();
    expect(screen.getByText('41 años · Mujer')).toBeInTheDocument();
    expect(screen.getByText('ID P-000437')).toBeInTheDocument();
    expect(screen.getByText('Folio SL-261010-0059')).toBeInTheDocument();
    expect(screen.getByText('Médico solicitante: Dr. R. Salas')).toBeInTheDocument();
    expect(screen.getByText('Toma: 10 oct 2026, 08:50')).toBeInTheDocument();
    expect(screen.getByText('Emisión: 10 oct 2026, 12:05')).toBeInTheDocument();
  });

  it('muestra un encabezado de área claro para el grupo de resultados de ejemplo', async () => {
    renderPage();

    expect(await screen.findByText('Hematología · Biometría hemática')).toBeInTheDocument();
  });

  it('resalta en negrita los resultados fuera de rango y muestra sus banderas', async () => {
    renderPage();

    await screen.findByText('Vista previa del informe PDF');
    const fila = screen.getByText('Leucocitos').closest('tr') as HTMLElement;
    expect(within(fila).getByText('12.8').tagName).toBe('STRONG');
    expect(screen.getAllByText('L').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('H').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra el rango aplicable en texto legible y no una lista de rangos', async () => {
    renderPage();

    await screen.findByText('Vista previa del informe PDF');
    const fila = screen.getByText('Hemoglobina').closest('tr') as HTMLElement;
    expect(within(fila).getByText('12.0 a 16.0')).toBeInTheDocument();
    expect(fila).not.toHaveTextContent('36 a 46');
    expect(fila).not.toHaveTextContent('4.5 a 11.0');
  });

  it('permite configurar encabezado, aviso legal, firma y cédula, y los refleja en la vista previa', async () => {
    renderPage();

    await screen.findByText('Vista previa del informe PDF');
    expect(screen.getByText('LOGO')).toBeInTheDocument();
    expect(screen.getByText('Encabezado')).toBeInTheDocument();
    expect(screen.getByText('Aviso legal')).toBeInTheDocument();
    expect(screen.getByText('Firma y cédula')).toBeInTheDocument();

    fireEvent.change(
      screen.getByDisplayValue('Logotipo · Laboratorio Santa Lucía · Clínica Central'),
      { target: { value: 'Nuevo encabezado · Sucursal Norte' } },
    );
    expect(screen.getByText('Nuevo encabezado · Sucursal Norte')).toBeInTheDocument();

    fireEvent.change(
      screen.getByDisplayValue('Resultados válidos solo con firma del responsable sanitario'),
      { target: { value: 'Aviso legal actualizado' } },
    );
    expect(screen.getByText('Aviso legal actualizado')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Laura Méndez · Cédula 10458392'), {
      target: { value: 'Nueva responsable · Cédula 999' },
    });
    expect(screen.getByText('Nueva responsable · Cédula 999')).toBeInTheDocument();
  });

  it('publica la configuración como nueva versión sin alterar informes ya emitidos', async () => {
    (api.post as any).mockResolvedValue({ data: { id: 3, version: 4, isDefault: true } });
    renderPage();

    expect(await screen.findByText('Versiones')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getAllByText('Publicada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reemplazada').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Publicar plantilla/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/templates', {
        headerText: 'Logotipo · Laboratorio Santa Lucía · Clínica Central',
        disclaimer: 'Resultados válidos solo con firma del responsable sanitario',
        chemistName: 'Laura Méndez',
        chemistCedula: '10458392',
      }),
    );
    expect(await screen.findByText(/Plantilla publicada · versión 4/)).toBeInTheDocument();
    expect(screen.getByText(/informes ya emitidos no cambian/i)).toBeInTheDocument();
  });

  it('muestra el código QR y la numeración de páginas en la vista previa', async () => {
    renderPage();

    expect(await screen.findByText(/Verifica este informe con el código QR/)).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
  });

  it.skip('muestra subtotales por área o perfil en la vista previa', async () => {
    renderPage();
    expect(await screen.findByText(/Subtotal/i)).toBeInTheDocument();
  });

  it.skip('incluye resultados cualitativos y de texto abierto en la vista previa', async () => {
    renderPage();
    await screen.findByText('Vista previa del informe PDF');
    expect(screen.getByText(/Cultivo|Positivo/)).toBeInTheDocument();
    expect(screen.getByText(/Interpretación|Observaciones|Notas del método/)).toBeInTheDocument();
  });

  it.skip('distingue visualmente los valores críticos en la vista previa', async () => {
    renderPage();
    await screen.findByText('Vista previa del informe PDF');
    expect(screen.getByText(/CRÍTICO|HH|LL/)).toBeInTheDocument();
  });

  it.skip('ofrece controles para colores corporativos, marcas de agua, logotipo y firma escaneada', async () => {
    renderPage();
    await screen.findByText('Vista previa del informe PDF');
    expect(
      screen.getByLabelText(/color corporativo|marca de agua|logotipo|firma escaneada/i),
    ).toBeInTheDocument();
  });

  it.skip('permite elegir plantillas distintas por tipo de estudio o sucursal', async () => {
    renderPage();
    await screen.findByText('Vista previa del informe PDF');
    expect(screen.getByLabelText(/tipo de estudio|sucursal/i)).toBeInTheDocument();
  });

  it.skip('usa la misma escala de banderas en pantalla, PDF e impresión', () => {
    render(<ResultFlag value="HH" />);
    expect(screen.getByText('CRÍTICO')).toHaveClass('flag-critical');
  });
});
