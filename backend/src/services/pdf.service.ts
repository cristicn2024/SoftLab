import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

export interface ReportData {
  tenantName: string;
  subdomain: string;
  orderId: number;
  folio: string;
  createdAt: Date;
  patient: {
    fullName: string;
    ageYears: number;
    gender: string;
    patientId: number;
  };
  doctorName: string;
  doctorCedula?: string;
  template: {
    primaryColor: string;
    logoUrl?: string;
    signatureUrl?: string;
    chemistName?: string;
    chemistCedula?: string;
    disclaimer?: string;
  };
  resultsByArea: {
    areaName: string;
    items: {
      testName: string;
      resultValue: string;
      units: string;
      referenceRange: string;
      flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';
      externalLab?: string;
      notes?: string;
    }[];
  }[];
  qrToken: string;
}

export async function generateReportPDF(data: ReportData): Promise<Buffer> {
  const verifyUrl = `https://${data.subdomain}.softlab.com/verify-report/${data.qrToken}`;
  const qrBase64 = await QRCode.toDataURL(verifyUrl);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: letter;
          margin: 140px 30px 100px 30px;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11pt;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        /* Encabezado Fijo Impresión */
        .header-fixed {
          position: fixed;
          top: -120px;
          left: 0;
          right: 0;
          height: 110px;
          border-bottom: 2px solid ${data.template.primaryColor};
          padding-bottom: 8px;
        }
        .header-table { width: 100%; border-collapse: collapse; }
        .logo { max-height: 55px; }
        
        /* Datos Paciente */
        .patient-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 15px;
          font-size: 9.5pt;
        }
        .patient-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 6px;
        }

        /* Tabla de Resultados */
        .area-title {
          background-color: ${data.template.primaryColor};
          color: #ffffff;
          padding: 4px 8px;
          font-weight: bold;
          font-size: 10.5pt;
          margin-top: 15px;
          border-radius: 3px;
        }
        table.results-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
        }
        table.results-table thead {
          display: table-header-group; /* Repite encabezado en nuevas páginas */
        }
        table.results-table th {
          border-bottom: 2px solid #cbd5e1;
          font-size: 9pt;
          text-align: left;
          padding: 6px;
          color: #475569;
        }
        table.results-table td {
          border-bottom: 1px solid #f1f5f9;
          padding: 6px;
          font-size: 9.5pt;
        }
        tr { page-break-inside: avoid; }

        /* Estilos de Banderas / Alertas */
        .val-high, .val-low {
          font-weight: bold;
          color: #c2410c; /* Naranja/Rojo */
        }
        .val-critical {
          font-weight: bold;
          color: #dc2626;
          background-color: #fef2f2;
          padding: 2px 4px;
          border-radius: 3px;
        }
        .badge {
          display: inline-block;
          font-size: 8pt;
          font-weight: bold;
          padding: 1px 5px;
          border-radius: 3px;
        }
        .badge-h { background: #ffedd5; color: #c2410c; }
        .badge-critical { background: #fee2e2; color: #991b1b; }

        /* Pie de Página Fijo */
        .footer-fixed {
          position: fixed;
          bottom: -80px;
          left: 0;
          right: 0;
          height: 70px;
          border-top: 1px solid #e2e8f0;
          padding-top: 6px;
          font-size: 8pt;
          color: #64748b;
        }
        .signature-box {
          text-align: center;
          margin-top: 20px;
          page-break-inside: avoid;
        }
        .signature-img { max-height: 45px; }
      </style>
    </head>
    <body>

      <!-- Encabezado Repetitivo -->
      <div class="header-fixed">
        <table class="header-table">
          <tr>
            <td style="width: 30%;">
              ${data.template.logoUrl ? `<img src="${data.template.logoUrl}" class="logo"/>` : `<h2>${data.tenantName}</h2>`}
            </td>
            <td style="text-align: right; font-size: 9pt;">
              <strong>FOLIO:</strong> ${data.folio}<br/>
              <strong>Fecha Emisión:</strong> ${new Date().toLocaleDateString('es-MX')}<br/>
              <span style="color: ${data.template.primaryColor}; font-weight: bold;">INFORME DE RESULTADOS</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Datos Paciente -->
      <div class="patient-card">
        <div class="patient-grid">
          <div><strong>PACIENTE:</strong> ${data.patient.fullName}</div>
          <div><strong>EDAD:</strong> ${data.patient.ageYears} años</div>
          <div><strong>SEXO:</strong> ${data.patient.gender}</div>
          <div><strong>ID:</strong> P-${data.patient.patientId}</div>
        </div>
        <div class="patient-grid" style="margin-top: 4px;">
          <div><strong>MÉDICO:</strong> ${data.doctorName}</div>
          <div><strong>FECHA TOMA:</strong> ${new Date(data.createdAt).toLocaleDateString('es-MX')}</div>
        </div>
      </div>

      <!-- Resultados Clínicos -->
      ${data.resultsByArea.map(area => `
        <div class="area-title">${area.areaName}</div>
        <table class="results-table">
          <thead>
            <tr>
              <th style="width: 35%;">Prueba</th>
              <th style="width: 20%;">Resultado</th>
              <th style="width: 15%;">Unidades</th>
              <th style="width: 20%;">Rango de Referencia</th>
              <th style="width: 10%;">Alerta</th>
            </tr>
          </thead>
          <tbody>
            ${area.items.map(item => {
              const isCritical = item.flag.includes('CRITICAL');
              const isOut = item.flag !== 'NORMAL';
              const valClass = isCritical ? 'val-critical' : (isOut ? 'val-high' : '');
              
              return `
                <tr>
                  <td>
                    ${item.testName}
                    ${item.externalLab ? `<br/><small style="color:#64748b;">(Maquila: ${item.externalLab})</small>` : ''}
                  </td>
                  <td class="${valClass}">${item.resultValue}</td>
                  <td>${item.units || '-'}</td>
                  <td>${item.referenceRange}</td>
                  <td>
                    ${item.flag === 'HIGH' ? '<span class="badge badge-h">H</span>' : ''}
                    ${item.flag === 'LOW' ? '<span class="badge badge-h">L</span>' : ''}
                    ${isCritical ? '<span class="badge badge-critical">CRÍTICO</span>' : ''}
                  </td>
                </tr>
                ${item.notes ? `<tr><td colspan="5" style="font-size: 8.5pt; color: #475569; font-style: italic;">Nota: ${item.notes}</td></tr>` : ''}
              `;
            }).join('')}
          </tbody>
        </table>
      `).join('')}

      <!-- Firma del Responsable -->
      <div class="signature-box">
        ${data.template.signatureUrl ? `<img src="${data.template.signatureUrl}" class="signature-img"/><br/>` : ''}
        <strong>${data.template.chemistName || 'Químico Responsable'}</strong><br/>
        <small>Cédula Profesional: ${data.template.chemistCedula || 'N/A'}</small>
      </div>

      <!-- Pie de Página con QR y Números de Página -->
      <div class="footer-fixed">
        <table style="width:100%;">
          <tr>
            <td style="width: 60px;">
              <img src="${qrBase64}" style="width: 50px; height: 50px;"/>
            </td>
            <td style="font-size: 7.5pt;">
              Verificación Digital: ${data.qrToken}<br/>
              ${data.template.disclaimer || 'Este documento es una representación oficial de los análisis clínicos realizados.'}
            </td>
            <td style="text-align: right; font-size: 8pt;">
              Página <span class="pageNumber"></span> de <span class="totalPages"></span>
            </td>
          </tr>
        </table>
      </div>

    </body>
    </html>
  `;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 8pt; width: 100%; text-align: right; padding-right: 30px; color: #64748b;">
          Página <span class="pageNumber"></span> de <span class="totalPages"></span>
        </div>
      `,
      margin: { top: '140px', bottom: '100px', left: '30px', right: '30px' }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}