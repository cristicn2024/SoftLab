import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { Publico } from '../auth/decoradores/publico.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Publico()
  @Get()
  async estado() {
    try {
      const tenantsRegistrados = await this.prisma.tenant.count();
      return {
        status: 'ok',
        message: 'API de Softlab conectada a MySQL con Prisma',
        tenantsRegistrados,
      };
    } catch (error) {
      throw new InternalServerErrorException({ status: 'error', error: (error as Error).message });
    }
  }
}
