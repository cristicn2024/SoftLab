import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { enteroEntorno } from './config';

@Injectable()
export class IntentosService {
  private readonly limite = enteroEntorno('LOGIN_MAX_INTENTOS', 5, 1000);
  private readonly ventana = enteroEntorno('LOGIN_BLOQUEO_MINUTOS', 15, 1440) * 60000;

  private proximaLimpieza = 0;

  constructor(private readonly prisma: PrismaService) {}

  async reservar(correo: string, ip: string) {
    const ahora = Date.now();
    if (ahora >= this.proximaLimpieza) {
      this.proximaLimpieza = ahora + this.ventana;
      const caducadas = { expiresAt: { lte: new Date(ahora) } };
      await this.prisma.loginAttempt.deleteMany({ where: caducadas });
      await this.prisma.authSession.deleteMany({ where: caducadas });
    }
    const inicio = Math.floor(ahora / this.ventana) * this.ventana;
    const expiresAt = new Date(inicio + this.ventana);
    const claves = ['usuario:' + correo, 'ip:' + ip].map(tipo =>
      createHash('sha256').update(inicio + ':' + tipo).digest('hex'));
    // Reservar antes de verificar el hash limita también los intentos concurrentes.
    return this.prisma.$transaction(async tx => {
      for (const key of claves) {
        await tx.$executeRaw`INSERT INTO login_attempts (\`key\`, count, expires_at)
          VALUES (${key}, 0, ${expiresAt}) ON DUPLICATE KEY UPDATE count = count`;
      }
      const filas = await tx.loginAttempt.findMany({ where: { key: { in: claves } } });
      if (filas.some(fila => fila.count >= this.limite)) return null;
      await tx.loginAttempt.updateMany({ where: { key: { in: claves } }, data: { count: { increment: 1 } } });
      return claves;
    });
  }

  async liberar(claves: string[]) {
    await this.prisma.loginAttempt.updateMany({ where: { key: { in: claves }, count: { gt: 0 } }, data: { count: { decrement: 1 } } });
  }
}
