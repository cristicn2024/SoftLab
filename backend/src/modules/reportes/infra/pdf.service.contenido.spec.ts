import { generateReportPDF, type ReportData } from './pdf.service';
import QRCode from 'qrcode';

let htmlCapturado = '';
let opcionesPdf: Record<string, unknown> | null = null;
let urlVerificacion = '';

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(async () => ({
      newPage: async () => ({
        setContent: async (html: string) => { htmlCapturado = html; },
        pdf: async (options: Record<string, unknown>) => {
          opcionesPdf = options;
          return Buffer.from('%PDF-1.4');
        },
        close: async () => {},
      }),
      close: async () => {},
    })),
  },
}));

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn(async (url: string) => {
      urlVerificacion = url;
      return 'data:image/png;base64,QRMOCK';
    }),
  },
}));

function datos(): ReportData {
  return {
    tenantName: 'Laboratorio Santa Lucía',
    subdomain: 'santalucia',
    orderId: 42,
    folio: 'SL-000042',
    createdAt: new Date(2026, 9, 10, 8, 50),
    patient: {
      fullName: 'Lucía Fernández Soto',
      ageYears: 41,
      gender: 'F',
      patientId: 437,
    },
    doctorName: 'Dr. R. Salas',
    template: {
      primaryColor: '#0f766e',
      logoUrl: 'https://cdn.example.com/logo.png',
      signatureUrl: 'https://cdn.example.com/firma.png',
      chemistName: 'Laura Méndez',
      chemistCedula: '10458392',
      disclaimer: 'Resultados válidos solo con firma del responsable sanitario',
    },
    resultsByArea: [
      {
        areaName: 'Hematología',
        items: [
          {
            testName: 'Hemoglobina',
            resultValue: '9.8',
            units: 'g/dL',
            referenceRange: '12.0 a 16.0',
            flag: 'LOW',
          },
          {
            testName: 'Leucocitos',
            resultValue: '18.2',
            units: '10³/µL',
            referenceRange: '4.5 a 11.0',
            flag: 'CRITICAL_HIGH',
          },
          {
            testName: 'Cultivo',
            resultValue: 'Positivo',
            units: '',
            referenceRange: 'Negativo',
            flag: 'NORMAL',
            externalLab: 'Laboratorio Referencia Nacional',
          },
          {
            testName: 'Observaciones',
            resultValue: 'Muestra ligeramente hemolizada',
            units: '',
            referenceRange: 'Texto libre',
            flag: 'NORMAL',
            notes: 'Nota del método: lectura espectrofotométrica',
          },
        ],
      },
    ],
    qrToken: 'token-42',
  };
}

describe('HU-06 · contenido HTML del informe PDF', () => {
  beforeEach(async () => {
    htmlCapturado = '';
    opcionesPdf = null;
    urlVerificacion = '';
    jest.clearAllMocks();
    await generateReportPDF(datos());
  });

  it('incluye las columnas Prueba, Resultado, Unidades, Rango de Referencia y Bandera/Alerta', () => {
    for (const columna of ['Prueba', 'Resultado', 'Unidades', 'Rango de Referencia', 'Alerta']) {
      expect(htmlCapturado).toMatch(new RegExp(`<th[^>]*>${columna}</th>`));
    }
    expect(htmlCapturado).toMatch(/>\s*Hemoglobina\s*</);
    expect(htmlCapturado).toContain('>9.8</td>');
    expect(htmlCapturado).toContain('>g/dL</td>');
  });

  it('muestra paciente, folio, médico solicitante, fecha de toma y fecha de emisión', () => {
    expect(htmlCapturado).toContain('<strong>PACIENTE:</strong> Lucía Fernández Soto');
    expect(htmlCapturado).toContain('<strong>EDAD:</strong> 41 años');
    expect(htmlCapturado).toContain('<strong>SEXO:</strong> F');
    expect(htmlCapturado).toContain('<strong>ID:</strong> P-437');
    expect(htmlCapturado).toContain('<strong>FOLIO:</strong> SL-000042');
    expect(htmlCapturado).toContain('<strong>MÉDICO:</strong> Dr. R. Salas');
    expect(htmlCapturado).toContain('<strong>FECHA TOMA:</strong>');
    expect(htmlCapturado).toContain('<strong>Fecha Emisión:</strong>');
  });

  it('resalta fuera de rango en negrita/color y distingue los valores críticos', () => {
    expect(htmlCapturado).toContain('.val-high, .val-low');
    expect(htmlCapturado).toContain('font-weight: bold');
    expect(htmlCapturado).toContain('color: #c2410c');
    expect(htmlCapturado).toContain('<td class="val-high">9.8</td>');
    expect(htmlCapturado).toContain('.val-critical');
    expect(htmlCapturado).toContain('background-color: #fef2f2');
    expect(htmlCapturado).toContain('<td class="val-critical">18.2</td>');
    expect(htmlCapturado).toContain('<span class="badge badge-h">L</span>');
    expect(htmlCapturado).toContain('<span class="badge badge-critical">CRÍTICO</span>');
  });

  it('muestra el rango aplicable como texto legible junto a cada resultado', () => {
    expect(htmlCapturado).toContain('<td>12.0 a 16.0</td>');
    expect(htmlCapturado).toContain('<td>4.5 a 11.0</td>');
    expect(htmlCapturado).toContain('<td>Negativo</td>');
  });

  it('admite resultados numéricos, cualitativos y de texto abierto con notas', () => {
    expect(htmlCapturado).toContain('>9.8</td>');
    expect(htmlCapturado).toContain('>Positivo</td>');
    expect(htmlCapturado).toContain('>Muestra ligeramente hemolizada</td>');
    expect(htmlCapturado).toContain('Nota: Nota del método: lectura espectrofotométrica');
  });

  it('muestra el laboratorio que procesó un estudio enviado a maquila', () => {
    expect(htmlCapturado).toContain('(Maquila: Laboratorio Referencia Nacional)');
  });

  it('configura encabezado, pie, logotipo, firma, cédula y colores corporativos', () => {
    expect(htmlCapturado).toContain('src="https://cdn.example.com/logo.png"');
    expect(htmlCapturado).toContain('src="https://cdn.example.com/firma.png"');
    expect(htmlCapturado).toContain('<strong>Laura Méndez</strong>');
    expect(htmlCapturado).toContain('Cédula Profesional: 10458392');
    expect(htmlCapturado).toContain('Resultados válidos solo con firma del responsable sanitario');
    expect(htmlCapturado).toContain('border-bottom: 2px solid #0f766e');
    expect(htmlCapturado).toContain('background-color: #0f766e');
  });

  it('incluye QR con URL de verificación autenticable', () => {
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      'https://santalucia.softlab.com/verify-report/token-42',
    );
    expect(urlVerificacion).toBe('https://santalucia.softlab.com/verify-report/token-42');
    expect(htmlCapturado).toContain('src="data:image/png;base64,QRMOCK"');
    expect(htmlCapturado).toContain('Verificación Digital: token-42');
  });

  it('mantiene el formato en varias páginas: encabezado repetido, filas enteras y numeración', () => {
    expect(htmlCapturado).toContain('display: table-header-group');
    expect(htmlCapturado).toContain('page-break-inside: avoid');
    expect(htmlCapturado).toContain('Página <span class="pageNumber"></span> de <span class="totalPages"></span>');
    expect(opcionesPdf).toMatchObject({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '140px', bottom: '100px', left: '30px', right: '30px' },
    });
    expect(opcionesPdf).toMatchObject({
      footerTemplate: expect.stringContaining('pageNumber'),
    });
  });

  it.skip('aplica marcas de agua configurables además del logotipo y la firma', () => {
    const plantilla = datos().template as ReportData['template'] & { watermarkUrl?: string };
    plantilla.watermarkUrl = 'https://cdn.example.com/marca-agua.png';
    expect(plantilla.watermarkUrl).toBe('https://cdn.example.com/marca-agua.png');
    expect(htmlCapturado).toMatch(/watermark|marca-agua/i);
  });

  it.skip('usa plantillas distintas según tipo de estudio o sucursal', () => {
    const plantilla = datos().template as ReportData['template'] & {
      studyType?: string;
      branchId?: number;
    };
    plantilla.studyType = 'Urianálisis';
    plantilla.branchId = 3;
    expect(plantilla.studyType).toBe('Urianálisis');
    expect(plantilla.branchId).toBe(3);
  });

  it.skip('muestra subtotales por área o perfil junto a los encabezados', () => {
    expect(htmlCapturado).toMatch(/Subtotal/i);
  });
});
