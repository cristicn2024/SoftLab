import request from 'supertest';
import express from 'express';
import orderCaptureRoutes from '../routes/orderCapture.routes';
import { prisma } from '../config/db';

const app = express();
app.use(express.json());
app.use('/api', orderCaptureRoutes);

describe('HU-07 (HU 5.1): Captura de Orden de Estudios', () => {
  let tenantId: number;
  let branchId: number;
  let patientId: number;

  beforeAll(async () => {
    // 1. Obtener o crear un Tenant válido
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: 'Lab Test', subdomain: `test-${Date.now()}` }
      });
    }
    tenantId = tenant.id;

    // 2. Obtener o crear una Sucursal (Branch) válida
    let branch = await prisma.branch.findFirst({ where: { tenantId } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: { tenantId, name: 'Sucursal Central' }
      });
    }
    branchId = branch.id;

    // 3. Obtener o crear un Paciente (Patient) válido (sin el campo 'code')
    let patient = await prisma.patient.findFirst({ where: { tenantId } });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          tenantId,
          firstName: 'Paciente',
          lastName: 'Prueba',
          gender: 'F',
          birthDate: new Date('1990-01-01')
        }
      });
    }
    patientId = patient.id;
  });

  describe('GET /api/concepts/search', () => {
    it('debe retornar resultados predictivos al buscar por clave o nombre', async () => {
      const res = await request(app)
        .get('/api/concepts/search?q=BH')
        .set('x-tenant-id', String(tenantId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/orders/check-open', () => {
    it('debe responder si un paciente tiene una orden activa en el día', async () => {
      const res = await request(app)
        .get(`/api/orders/check-open?patientId=${patientId}`)
        .set('x-tenant-id', String(tenantId));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hasOpenOrder');
      expect(typeof res.body.hasOpenOrder).toBe('boolean');
    });
  });

  describe('POST /api/doctors/express', () => {
    it('debe crear un médico solicitante en tiempo de captura', async () => {
      const payload = {
        name: 'Dr. Roberto Salas Test',
        cedula: '12345678',
        specialty: 'Medicina General'
      };

      const res = await request(app)
        .post('/api/doctors/express')
        .set('x-tenant-id', String(tenantId))
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(payload.name);
    });
  });

  describe('POST /api/orders', () => {
    it('debe generar un folio único estructurado al confirmar la orden', async () => {
      const orderPayload = {
        patientId,
        branchId,
        doctorId: null,
        totalAmount: 250.00,
        items: []
      };

      const res = await request(app)
        .post('/api/orders')
        .set('x-tenant-id', String(tenantId))
        .send(orderPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.folio).toMatch(/^ORD-\d{8}-\d{4}$/);
    });
  });
});