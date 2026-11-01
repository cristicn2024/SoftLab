import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './config/db';
import { Prisma } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/feature-data', async (_req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst({ where: { name: 'Laboratorio Santa Lucía' }, include: {
      branches: { where: { name: 'Clínica Central' } },
      patients: { where: { firstName: 'María' }, take: 1 },
      tests: { include: { instructions: true, parameters: { include: { ranges: true }, orderBy: { sortOrder: 'asc' } } } },
      orders: { where: { folio: 'SL-261020-0057' }, include: { patient: true, branch: true, physician: true, items: { include: { test: { include: { instructions: true } }, testResults: { include: { parameter: true, criticalNotifications: true } } } }, samples: true, instructionConfirmation: true } },
      practitioners: true,
    } });
    if (!tenant) return res.status(404).json({ error: 'No hay datos HU. Ejecuta el seed específico.' });
    res.json(tenant);
  } catch (error) { res.status(500).json({ error: (error as Error).message }); }
});

app.post('/api/orders', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirstOrThrow({ where: { name: 'Laboratorio Santa Lucía' } });
    const branch = await prisma.branch.findFirstOrThrow({ where: { tenantId: tenant.id, name: 'Clínica Central' } });
    const patient = await prisma.patient.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: 'María', lastName: 'López García' } });
    const tests = await prisma.testCatalog.findMany({ where: { tenantId: tenant.id, id: { in: req.body.testIds ?? [] } } });
    if (!tests.length) return res.status(422).json({ error: 'Agrega al menos un estudio para crear la orden.' });
    const total = tests.reduce((sum, test) => sum.add(test.price), new Prisma.Decimal(0));
    const order = await prisma.order.create({ data: { tenantId: tenant.id, branchId: branch.id, patientId: patient.id, physicianId: req.body.physicianId ?? null, totalAmount: total, items: { create: tests.map((test) => ({ testId: test.id, price: test.price })) } } });
    res.status(201).json(order);
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

app.post('/api/orders/:orderId/confirmation', async (req, res) => {
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: Number(req.params.orderId) } });
    const user = await prisma.user.findFirst({ where: { tenantId: order.tenantId, fullName: 'Laura Méndez' } });
    const confirmation = await prisma.instructionConfirmation.upsert({ where: { orderId: order.id }, update: { userId: user?.id, observation: req.body.observation ?? null, confirmedAt: new Date() }, create: { tenantId: order.tenantId, orderId: order.id, branchId: order.branchId, userId: user?.id, observation: req.body.observation ?? null } });
    res.json(confirmation);
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

app.post('/api/orders/:orderId/deliveries', async (req, res) => {
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: Number(req.params.orderId) } });
    const user = await prisma.user.findFirst({ where: { tenantId: order.tenantId, fullName: 'Laura Méndez' } });
    const delivery = await prisma.instructionDelivery.create({ data: { tenantId: order.tenantId, orderId: order.id, userId: user?.id, channel: req.body.channel === 'email' ? 'email' : 'whatsapp' } });
    res.json(delivery);
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

app.post('/api/results/:resultId/notification', async (req, res) => {
  try {
    const result = await prisma.testResult.findUniqueOrThrow({ where: { id: Number(req.params.resultId) } });
    const user = await prisma.user.findFirst({ where: { tenantId: result.tenantId, fullName: 'Q.F.B. Andrea Ruiz' } });
    const notification = await prisma.criticalNotification.create({ data: { tenantId: result.tenantId, resultId: result.id, branchId: Number(req.body.branchId), userId: user?.id, recipient: req.body.recipient, recipientName: req.body.recipientName, contactMethod: req.body.contactMethod, notifiedAt: new Date(req.body.notifiedAt) } });
    res.json(notification);
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

app.post('/api/results/:orderItemId', async (req, res) => {
  try {
    const flag = String(req.body.flag);
    const critical = flag === 'HH' || flag === 'LL';
    if (critical && !req.body.notification) return res.status(422).json({ error: 'Registra la notificación del resultado crítico antes de guardar.' });
    const orderItem = await prisma.orderItem.findUniqueOrThrow({ where: { id: Number(req.params.orderItemId) }, include: { order: true } });
    const parameter = await prisma.testParameter.findUniqueOrThrow({ where: { id: Number(req.body.parameterId) } });
    const result = await prisma.testResult.upsert({ where: { orderItemId_parameterId: { orderItemId: orderItem.id, parameterId: parameter.id } }, update: { resultValue: String(req.body.value), flag, isAlert: !['Normal', '—'].includes(flag) }, create: { tenantId: orderItem.order.tenantId, orderItemId: orderItem.id, parameterId: parameter.id, resultValue: String(req.body.value), flag, isAlert: !['Normal', '—'].includes(flag) } });
    if (critical && req.body.notification) {
      const existingNotification = await prisma.criticalNotification.findFirst({ where: { resultId: result.id } });
      if (!existingNotification) {
        const user = await prisma.user.findFirst({ where: { tenantId: result.tenantId, fullName: 'Q.F.B. Andrea Ruiz' } });
        await prisma.criticalNotification.create({ data: { tenantId: result.tenantId, resultId: result.id, branchId: orderItem.order.branchId, userId: user?.id, recipient: req.body.notification.recipient, recipientName: req.body.notification.recipientName, contactMethod: req.body.notification.contactMethod, notifiedAt: new Date(req.body.notification.notifiedAt) } });
      }
    }
    res.json(result);
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

// Ruta de prueba para verificar Prisma + MySQL
app.get('/api/health', async (_req, res) => {
  try {
    const tenantsCount = await prisma.tenant.count();
    res.json({
      status: 'ok',
      message: 'API de Softlab conectada a MySQL con Prisma',
      tenantsRegistrados: tenantsCount
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: (error as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de Softlab corriendo en http://localhost:${PORT}`);
});
