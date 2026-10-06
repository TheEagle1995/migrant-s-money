import { Inject, Injectable, Logger } from '@nestjs/common';
import { PROVIDER_REPO, ProviderRepository, QUOTE_REPO, QuoteRepository } from './ports';
import { effectiveRate } from '../domain/money';
import { PayoutMethod } from '../domain/types';

export interface ManualQuoteRow {
  providerSlug: string;
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
      await this.quotes.create({
        providerId: provider.id,
        sendCurrency: 'KRW',
        recvCurrency: 'UZS',
        sendMinor: row.sendMinor,
        feeMinor: row.feeMinor,
        rate: effectiveRate(row.recvMinor, row.sendMinor),
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
  if (row.sendMinor <= 0n) return 'yuborilgan summa musbat emas';
  if (row.recvMinor <= 0n) return 'qo\'lga tekkan summa musbat emas';
  if (row.feeMinor < 0n) return 'komissiya manfiy';
  const rate = Number(row.recvMinor) / Number(row.sendMinor);
  // Aqlga sig'adigan oraliq: 1 KRW ~ 8-9 so'm. Bundan uzoq bo'lsa - kiritish xatosi.
  if (rate < 4 || rate > 20) return `kurs shubhali (${rate.toFixed(2)}) — birlikni tekshiring`;
  if (row.measuredAt.getTime() > Date.now() + 86_400_000) return 'sana kelajakda';
  return null;
}
