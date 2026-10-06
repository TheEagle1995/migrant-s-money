import { Body, Controller, Get, Headers, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { liveCorridors, corridorLabel, COUNTRIES } from '../domain/corridor';
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

  /** Qaysi koridorlar mavjud — ilova shu ro'yxatdan boshlanadi */
  @Get('corridors')
  corridors() {
    return liveCorridors().map((c) => ({
      id: c.id,
      label: corridorLabel(c),
      sendCountry: c.send,
      recvCountry: c.recv,
      sendCurrency: c.sendCurrency,
      recvCurrency: c.recvCurrency,
      sendFlag: COUNTRIES[c.send].flag,
      recvFlag: COUNTRIES[c.recv].flag,
      baseSendMinor: c.baseSendMinor.toString(),
    }));
  }

  /** Ommaviy taqqoslash. Eskirgan kotirovkalar `isStale` bilan ko'rsatiladi. */
  @Get('compare')
  async compare(@Query('corridor') corridor?: string) {
    if (corridor) return jsonSafe(await this.comparison.forCorridor(corridor));
    return jsonSafe(await this.comparison.allLive());
  }

  @Get('compare/:corridorId')
  async compareOne(@Param('corridorId') corridorId: string) {
    return jsonSafe(await this.comparison.forCorridor(corridorId));
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
