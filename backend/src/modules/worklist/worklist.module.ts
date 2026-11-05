import type { Router } from 'express';
import { createWorklistController } from './worklist.controller';
import { PrismaWorklistRepository } from './worklist.prisma-repository';
import { createWorklistRouter } from './worklist.routes';
import { WorklistService } from './worklist.service';

export function buildWorklistRouter(): Router {
  const repository = new PrismaWorklistRepository();
  const service = new WorklistService(repository);
  return createWorklistRouter(createWorklistController(service));
}
