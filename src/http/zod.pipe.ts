import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z, ZodTypeAny } from 'zod';

export class ZodPipe<S extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException(
        r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      );
    }
    return r.data;
  }
}
