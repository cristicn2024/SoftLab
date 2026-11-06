import type { NestExpressApplication } from '@nestjs/platform-express';
import templateRoutes from '../routes/template.routes';
import paymentRoutes from '../routes/payment.routes';
import reportRoutes from '../routes/report.routes';
import cashCutRoutes from '../routes/cashCut.routes';
import orderCaptureRoutes from '../routes/orderCapture.routes';
import featureRoutes from '../routes/feature.routes';
import { errorHandler } from '../middleware/error-handler';

export function montarLegacy(app: NestExpressApplication) {
  app.use('/api', templateRoutes);
  app.use('/api', paymentRoutes);
  app.use('/api', reportRoutes);
  app.use('/api', cashCutRoutes);
  app.use('/api', orderCaptureRoutes);
  app.use('/api', featureRoutes);
  app.use(errorHandler);
}
