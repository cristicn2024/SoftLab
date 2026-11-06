import type { NestExpressApplication } from '@nestjs/platform-express';
import featureRoutes from '../routes/feature.routes';
import { errorHandler } from '../middleware/error-handler';

export function montarLegacy(app: NestExpressApplication) {
  app.use('/api', featureRoutes);
  app.use(errorHandler);
}
