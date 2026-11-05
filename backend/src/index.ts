import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './config/db';
import templateRoutes from './routes/template.routes';
import orderCaptureRoutes from './routes/orderCapture.routes';
import paymentRoutes from './routes/payment.routes';
import reportRoutes from './routes/report.routes';
import cashCutRoutes from './routes/cashCut.routes';
import featureRoutes from './routes/feature.routes';
import { buildWorklistRouter } from './modules/worklist/worklist.module';
import { errorHandler } from './middleware/error-handler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

app.use('/api', templateRoutes);
app.use('/api', paymentRoutes);
app.use('/api', reportRoutes);

app.use('/api', cashCutRoutes);
app.use('/api', orderCaptureRoutes);
app.use('/api', featureRoutes);
app.use('/api/worklist', buildWorklistRouter());

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor de Softlab corriendo en http://localhost:${PORT}`);
});
