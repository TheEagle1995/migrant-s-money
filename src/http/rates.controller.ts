import { Body, Controller, Get, Headers, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import {
  liveCorridors, corridorLabel, COUNTRIES, findCorridor,
  sendCountries, recvCountriesFrom, CountryCode,
} from '../domain/corridor';
import { parseMinor } from '../domain/currency';
import { PAYOUT_LABELS, FUNDING_LABELS, PAYOUT_NOTES } from '../domain/methods';
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
      /** Ilovada oldindan yozib qo'yiladigan namunaviy summa */
      sampleSendMinor: c.sampleSendMinor.toString(),
    }));
  }

  /** Yuborish mumkin bo'lgan davlatlar — tanlagichning birinchi qadami */
  @Get('countries')
  countries() {
    return sendCountries().map((c) => ({
      code: c.code,
      name: c.nameUz,
      flag: c.flag,
      currency: c.currency,
      to: recvCountriesFrom(c.code).map((r) => ({
        code: r.code, name: r.nameUz, flag: r.flag, currency: r.currency,
      })),
    }));
  }

  /** Yuborish va olish usullari — izohlari bilan */
  @Get('methods')
  methods() {
    return {
      payouts: Object.entries(PAYOUT_LABELS).map(([code, label]) => ({
        code, label, note: PAYOUT_NOTES[code as keyof typeof PAYOUT_NOTES],
      })),
      funding: Object.entries(FUNDING_LABELS).map(([code, label]) => ({ code, label })),
    };
  }

  /**
   * Ommaviy taqqoslash.
   * `amount` — foydalanuvchi kiritgan summa, yuborish valyutasining major
   * birligida ("250000" yoki "1 250,50"). Berilmasa koridorning namunaviy
   * qiymati ishlatiladi va javobda `isSample: true` bo'ladi.
   */
  @Get('compare')
  async compare(
    @Query('corridor') corridor?: string,
    @Query('amount') amount?: string,
  ) {
    if (corridor) {
      return jsonSafe(await this.comparison.forCorridor(corridor, this.amountOf(corridor, amount)));
    }
    return jsonSafe(await this.comparison.allLive());
  }

  @Get('compare/:corridorId')
  async compareOne(
    @Param('corridorId') corridorId: string,
    @Query('amount') amount?: string,
  ) {
    return jsonSafe(
      await this.comparison.forCorridor(corridorId, this.amountOf(corridorId, amount)),
    );
  }

  /** Matndan summani koridor valyutasiga ko'ra o'qiydi */
  private amountOf(corridorId: string, amount?: string): bigint | undefined {
    if (!amount) return undefined;
    const c = findCorridor(corridorId);
    if (!c) return undefined;
    return parseMinor(amount, c.sendCurrency) ?? undefined;
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
