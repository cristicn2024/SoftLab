import { jest } from '@jest/globals';

// MOCK DE PUPPETEER (Evita el conflicto ESM y la carga de navegador headless)
jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 Mock PDF Content')),
        close: jest.fn().mockResolvedValue(undefined),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { generateReportPDF } from '../services/pdf.service';
import { construirAppNest } from './screens/support-nest';

let app: INestApplication;

beforeAll(async () => {
  app = await construirAppNest();
});

afterAll(async () => {
  await app.close();
});

describe('HU-06: Módulo de Plantillas e Informes PDF', () => {

  describe('GET /api/templates/active', () => {
    it('debe responder con la plantilla predeterminada y cabecera 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/templates/active')
        .set('x-tenant-id', '1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('headerText');
    });
  });

  describe('POST /api/templates', () => {
    it('debe crear una nueva versión de plantilla', async () => {
      const payload = {
        headerText: 'Logotipo · Laboratorio Central Test',
        disclaimer: 'Resultados válidos para prueba unitaria',
        chemistName: 'Dr. Test QA',
        chemistCedula: '99999999'
      };

      const res = await request(app.getHttpServer())
        .post('/api/templates')
        .set('x-tenant-id', '1')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.version).toBeGreaterThan(0);
    });
  });

  describe('Generación de PDF con Puppeteer (Mocked)', () => {
    it('debe generar un Buffer de PDF sin errores de navegador', async () => {
      const mockData = {
        tenantName: 'Laboratorio Santa Lucía',
        subdomain: 'santalucia',
        orderId: 101,
        folio: 'ORD-20261104-0001',
        createdAt: new Date(),
        patient: {
          fullName: 'Lucía Fernández Soto',
          ageYears: 41,
          gender: 'Mujer',
          patientId: 437
        },
        doctorName: 'Dr. R. Salas',
        template: {
          primaryColor: '#0f766e',
          chemistName: 'Laura Méndez',
          chemistCedula: '10458392'
        },
        resultsByArea: [],
        qrToken: 'test-token-uuid-1234'
      };

      const pdfBuffer = await generateReportPDF(mockData);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });

});