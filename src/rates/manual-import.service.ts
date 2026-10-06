import { Inject, Injectable, Logger } from '@nestjs/common';
import { PROVIDER_REPO, ProviderRepository, QUOTE_REPO, QuoteRepository } from './ports';
import { effectiveRate } from '../domain/money';
import { minorFactor } from '../domain/currency';
import { findCorridor, rateLooksSane } from '../domain/corridor';
import { PayoutMethod } from '../domain/types';

export interface ManualQuoteRow {
  providerSlug: string;
  /** "KR-UZ" — qaysi koridor o'lchangani */
  corridorId: string;
  sendMinor: bigint;
  feeMinor: bigint;
  recvMinor: bigint;
  recvBank?: string;
  payoutMethod?: PayoutMethod;
  etaMinutes?: number;
  isPromotional: boolean;
  measuredAt: Date;
}

export interface ImportReport {
  ok: number;
  failed: Array<{ row: number; reason: string }>;
}

/**
 * Faza 0.
 * Toss, Sentbe, Hanpass, GME — kursni faqat app ichida, login va
 * 외국인등록증 tekshiruvidan keyin ko'rsatadi. Ochiq endpoint yo'q.
 * Shuning uchun birinchi ma'lumot qo'lda o'lchanadi va shu yerdan kiradi —
 * lekin `Quote` shakli avtomatik adapterlar bilan bir xil, ya'ni Faza 1 da
 * hech narsa ko'chirilmaydi.
 */
@Injectable()
export class ManualImportService {
  private readonly log = new Logger(ManualImportService.name);

  constructor(
    @Inject(PROVIDER_REPO) private readonly providers: ProviderRepository,
    @Inject(QUOTE_REPO) private readonly quotes: QuoteRepository,
  ) {}

  async importRows(rows: ManualQuoteRow[]): Promise<ImportReport> {
    const report: ImportReport = { ok: 0, failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const problem = validateRow(row);
      if (problem) {
        report.failed.push({ row: i + 1, reason: problem });
        continue;
      }
      const provider = await this.providers.findBySlug(row.providerSlug);
      if (!provider) {
        report.failed.push({ row: i + 1, reason: `provayder topilmadi: ${row.providerSlug}` });
        continue;
      }
      const corridor = findCorridor(row.corridorId)!;
      await this.quotes.create({
        providerId: provider.id,
        corridorId: corridor.id,
        sendCurrency: corridor.sendCurrency,
        recvCurrency: corridor.recvCurrency,
        sendMinor: row.sendMinor,
        feeMinor: row.feeMinor,
        rate: effectiveRate(
          row.recvMinor, row.sendMinor,
          corridor.sendCurrency, corridor.recvCurrency,
        ),
        recvMinor: row.recvMinor,
        recvBank: row.recvBank ?? null,
        payoutMethod: row.payoutMethod ?? null,
        etaMinutes: row.etaMinutes ?? null,
        isPromotional: row.isPromotional,
        fetchedAt: row.measuredAt,
        source: 'MANUAL',
      });
      report.ok++;
    }
    this.log.log(`Import: ${report.ok} ok, ${report.failed.length} xato`);
    return report;
  }
}

export function validateRow(row: ManualQuoteRow): string | null {
  if (!row.providerSlug) return 'kanal nomi bo\'sh';
  const corridor = findCorridor(row.corridorId);
  if (!corridor) return `noma'lum koridor: ${row.corridorId}`;
  if (row.sendMinor <= 0n) return 'yuborilgan summa musbat emas';
  if (row.recvMinor <= 0n) return 'qo\'lga tekkan summa musbat emas';
  if (row.feeMinor < 0n) return 'komissiya manfiy';

  // Aqlga sig'adigan oraliq KORIDORDAN keladi. Ilgari u 4-20 deb qattiq
  // yozilgan edi — bu faqat KRW->UZS uchun to'g'ri va Rossiya koridorida
  // (RUB->UZS ~ 150) har bir to'g'ri qatorni rad etardi.
  const check = rateLooksSane(corridor, row.sendMinor, row.recvMinor, minorFactor);
  if (!check.ok) {
    return `kurs shubhali (${check.rate.toFixed(2)}), ${corridor.id} uchun kutilgan ` +
      `${corridor.sanityRateMin}-${corridor.sanityRateMax} — birlikni tekshiring`;
  }

  if (row.measuredAt.getTime() > Date.now() + 86_400_000) return 'sana kelajakda';
  return null;
}
