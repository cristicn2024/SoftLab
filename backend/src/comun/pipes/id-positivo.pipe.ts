import { BadRequestException, PipeTransform } from '@nestjs/common';

export class IdPositivoPipe implements PipeTransform<unknown, number> {
  constructor(private readonly mensaje: string) {}

  transform(valor: unknown): number {
    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException(this.mensaje);
    }
    return id;
  }
}
