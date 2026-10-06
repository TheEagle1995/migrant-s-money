/**
 * SMS parsing — QURILMADA ishlaydi.
 *
 * Ikki qat'iy qoida:
 *  1. Raw SMS matni serverga HECH QACHON yuborilmaydi. Faqat strukturalangan natija.
 *     Bu ham privacy, ham Google Play'ning READ_SMS siyosati uchun zarur.
 *  2. Shablonlar serverda saqlanadi va `GET /parsers?since=<v>` orqali yangilanadi.
 *     Bank format o'zgartirsa — app update'siz tuzatiladi.
 */

export interface ParserTemplate {
  bankSlug: string;
  version: number;
  /** Named group'lar: (?<amt>...), ixtiyoriy (?<kind>...), (?<card>...), (?<merchant>...) */
  pattern: string;
  amountGroup: string;
  kindMap: Record<string, 'CREDIT' | 'DEBIT'>;
  /** So'm formati: "1 250 000,00" yoki "1,250,000.00" */
  decimalSeparator: ',' | '.';
}

export interface ParsedSms {
  bankSlug: string;
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
  reason: 'NO_TEMPLATE' | 'NO_MATCH' | 'BAD_AMOUNT' | 'UNKNOWN_KIND';
}

export type ParseResult =
  | { ok: true; value: ParsedSms }
  | { ok: false; error: ParseFailure };

export class SmsParser {
  constructor(private templates: ParserTemplate[]) {}

  /** Serverdan kelgan yangi shablonlar bilan almashtirish */
  update(templates: ParserTemplate[]): void {
    this.templates = templates;
  }

  parse(sender: string, body: string, receivedAt: Date): ParseResult {
    const bankSlug = resolveBank(sender);
    if (!bankSlug) return fail(null, 'NO_TEMPLATE');

    // Eng yangi versiyadan boshlab sinaymiz — eskilari fallback bo'lib qoladi
    const candidates = this.templates
      .filter((t) => t.bankSlug === bankSlug)
      .sort((a, b) => b.version - a.version);

    if (candidates.length === 0) return fail(bankSlug, 'NO_TEMPLATE');

    for (let i = 0; i < candidates.length; i++) {
      const tpl = candidates[i];
      const m = new RegExp(tpl.pattern, 'iu').exec(body);
      if (!m?.groups) continue;

      const amount = parseAmount(m.groups[tpl.amountGroup], tpl.decimalSeparator);
      if (amount === null) return fail(bankSlug, 'BAD_AMOUNT');

      const kindToken = m.groups['kind'];
      const kind = kindToken ? tpl.kindMap[normalize(kindToken)] : undefined;
      if (!kind) return fail(bankSlug, 'UNKNOWN_KIND');

      return {
        ok: true,
        value: {
          bankSlug,
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
    return fail(bankSlug, 'NO_MATCH');
  }
}

function fail(bankSlug: string | null, reason: ParseFailure['reason']): ParseResult {
  return { ok: false, error: { bankSlug, reason } };
}

const SENDER_MAP: Record<string, string> = {
  kapitalbank: 'kapital',
  ipotekabank: 'ipoteka',
  uzcard: 'uzcard',
  humo: 'humo',
  aab: 'asia-alliance',
};

function resolveBank(sender: string): string | null {
  const key = normalize(sender).replace(/[^a-z]/g, '');
  for (const [k, v] of Object.entries(SENDER_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
}

/** So'mda tiyin yo'q — butun songa yaxlitlanadi */
export function parseAmount(raw: string | undefined, sep: ',' | '.'): bigint | null {
  if (!raw) return null;
  let s = raw.replace(/[\s\u00A0']/g, '');
  s = sep === ','
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return BigInt(Math.round(n));
}

const normalize = (s: string) => s.toLowerCase().trim();
