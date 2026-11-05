import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './config/db';
import templateRoutes from './routes/template.routes';
import orderCaptureRoutes from './routes/orderCapture.routes';
import paymentRoutes from './routes/payment.routes';
import reportRoutes from './routes/report.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

app.use('/api', templateRoutes);
app.use('/api', paymentRoutes);
app.use('/api', reportRoutes);

app.use('/api', orderCaptureRoutes);

app.listen(PORT, () => {
  console.log(`Servidor de Softlab corriendo en http://localhost:${PORT}`);
});
