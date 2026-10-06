/**
 * SMS parsing — QURILMADA ishlaydi.
 *
 * Uch qat'iy qoida:
 *  1. Raw SMS matni serverga HECH QACHON yuborilmaydi. Faqat strukturalangan natija.
 *  2. Shablonlar serverda saqlanadi va `GET /parsers` orqali yangilanadi.
 *     Bank format o'zgartirsa — app update'siz tuzatiladi.
 *  3. Banklar ro'yxati ham serverdan keladi. Ilgari u uch joyda (TypeScript,
 *     Dart, Kotlin) qattiq yozilgan edi — Rossiya bankini qo'shish uchun uchta
 *     faylni tahrirlab, ilovani qaytadan chiqarish kerak bo'lardi.
 *
 * Summa `parseMinor` orqali o'qiladi, ya'ni valyuta kasri hisobga olinadi:
 * rubl kopeykasi yo'qolmaydi.
 */

import { CurrencyCode, parseMinor } from '../domain/currency';
import { CountryCode, COUNTRIES } from '../domain/corridor';

export interface Bank {
  country: CountryCode;
  slug: string;
  name: string;
  /** SMS jo'natuvchi nomlari, kichik harfda. Raqamli jo'natuvchi ham bo'ladi (Sber: "900") */
  smsSenders: string[];
}

export interface ParserTemplate {
  bankSlug: string;
  version: number;
  /** Named group'lar: (?<amt>...), (?<kind>...), ixtiyoriy (?<card>...), (?<merchant>...) */
  pattern: string;
  amountGroup: string;
  kindMap: Record<string, 'CREDIT' | 'DEBIT'>;
}

export interface ParsedSms {
  bankSlug: string;
  country: CountryCode;
  currency: CurrencyCode;
  amountMinor: bigint;
  kind: 'CREDIT' | 'DEBIT';
  cardLast4?: string;
  merchant?: string;
  occurredAt: Date;
  confidence: number;
  parserVersion: number;
}

export interface ParseFailure {
  bankSlug: string | null;
  reason: 'NO_BANK' | 'NO_TEMPLATE' | 'NO_MATCH' | 'BAD_AMOUNT' | 'UNKNOWN_KIND';
}

export type ParseResult =
  | { ok: true; value: ParsedSms }
  | { ok: false; error: ParseFailure };


export class SmsParser {
  private banks: Bank[];
  private templates: ParserTemplate[];

  constructor(banks: Bank[] = [], templates: ParserTemplate[] = []) {
    this.banks = banks;
    this.templates = templates;
  }

  /** Serverdan kelgan yangi ro'yxatlar bilan almashtirish */
  update(opts: { banks?: Bank[]; templates?: ParserTemplate[] }): void {
    if (opts.banks) this.banks = opts.banks;
    if (opts.templates) this.templates = opts.templates;
  }

  /**
   * Kotlin tomoni qaysi jo'natuvchilarni umuman o'tkazishini biladigan ro'yxat.
   * Shaxsiy yozishmalar hech qachon o'qilmaydi.
   */
  allowedSenders(): string[] {
    return [...new Set(this.banks.flatMap((b) => b.smsSenders))].sort();
  }

  resolveBank(sender: string): Bank | null {
    const key = normalizeSender(sender);
    if (!key) return null;
    // Uzunroq moslik ustun: "kapitalbank" "kapital" dan oldin tekshirilsin,
    // aks holda noto'g'ri bankka tegishli bo'lib qolishi mumkin.
    const candidates = this.banks
      .flatMap((b) => b.smsSenders.map((s) => ({ bank: b, token: s.toLowerCase() })))
      .sort((a, b) => b.token.length - a.token.length);
    for (const c of candidates) {
      if (key.includes(c.token)) return c.bank;
    }
    return null;
  }

  parse(sender: string, body: string, receivedAt: Date): ParseResult {
    const bank = this.resolveBank(sender);
    if (!bank) return fail(null, 'NO_BANK');

    // Eng yangi versiyadan boshlab sinaymiz — eskilari fallback bo'lib qoladi
    const candidates = this.templates
      .filter((t) => t.bankSlug === bank.slug)
      .sort((a, b) => b.version - a.version);

    if (candidates.length === 0) return fail(bank.slug, 'NO_TEMPLATE');

    const code = COUNTRIES[bank.country].currency;

    for (let i = 0; i < candidates.length; i++) {
      const tpl = candidates[i];
      let m: RegExpExecArray | null;
      try {
        m = new RegExp(tpl.pattern, 'iu').exec(body);
      } catch {
        // Shablon serverda buzuq yozilgan — keyingisiga o'tamiz
        continue;
      }
      if (!m?.groups) continue;

      const amount = parseMinor(m.groups[tpl.amountGroup], code);
      if (amount === null) return fail(bank.slug, 'BAD_AMOUNT');

      const kindToken = m.groups['kind'];
      // DIQQAT: `normalizeSender` ishlatilmaydi — u lotin bo'lmagan harflarni
      // o'chiradi, ya'ni "зачисление" bo'sh satrga aylanib ketadi.
      const kind = kindToken ? tpl.kindMap[kindToken.toLowerCase().trim()] : undefined;
      if (!kind) return fail(bank.slug, 'UNKNOWN_KIND');

      return {
        ok: true,
        value: {
          bankSlug: bank.slug,
          country: bank.country,
          currency: code,
          amountMinor: amount,
          kind,
          cardLast4: m.groups['card'],
          merchant: m.groups['merchant']?.trim(),
          occurredAt: receivedAt,
          // Eski versiya ishlagan bo'lsa ishonch pasayadi -> foydalanuvchidan
          // tasdiq so'raladi va bu keyingi shablon uchun test case bo'ladi
          confidence: i === 0 ? 0.97 : Math.max(0.5, 0.97 - i * 0.2),
          parserVersion: tpl.version,
        },
      };
    }
    return fail(bank.slug, 'NO_MATCH');
  }
}

function fail(bankSlug: string | null, reason: ParseFailure['reason']): ParseResult {
  return { ok: false, error: { bankSlug, reason } };
}

/**
 * Jo'natuvchi nomini solishtirishga tayyorlash. Raqamlar saqlanadi, chunki
 * ba'zi banklar qisqa raqamdan yuboradi (Sberbank: "900").
 */
function normalizeSender(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}
