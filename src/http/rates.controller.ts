import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ComparisonService } from '../rates/comparison.service';
import { ManualImportService } from '../rates/manual-import.service';
import { RatesRunner } from '../rates/rates.runner';
import { jsonSafe, manualImportSchema } from './dto';
import { ZodPipe } from './zod.pipe';

@Controller('rates')
export class RatesController {
  constructor(
    private readonly comparison: ComparisonService,
    private readonly importer: ManualImportService,
    private readonly runner: RatesRunner,
  ) {}

  /** Ommaviy taqqoslash. Eskirgan kotirovkalar `isStale` bilan ko'rsatiladi. */
  @Get('compare')
  async compare() {
    return jsonSafe(await this.comparison.current());
  }

  @Get('health')
  async health() {
    return this.runner.health();
  }

  @Post('import')
  async import(
    @Headers('x-api-key') key: string,
    @Body(new ZodPipe(manualImportSchema)) body: { rows: any[] },
  ) {
    requireAdmin(key);
    return this.importer.importRows(body.rows as any);
  }
}

export function requireAdmin(key: string | undefined): void {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || key !== expected) throw new UnauthorizedException();
}
