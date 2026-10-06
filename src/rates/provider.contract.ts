import { CurrencyCode } from '../domain/currency';
/**
 * Har bir provider uchun bitta adapter. Adapter faqat bitta ish qiladi:
 * berilgan summa uchun kotirovka olib keladi. Saqlash, retry, health —
 * hammasi runner'ning ishi.
 */

export interface QuoteRequest {
  /** "KR-UZ" */
  corridorId: string;
  sendCurrency: CurrencyCode;
  recvCurrency: CurrencyCode;
  /** Minor unit. 1_000_000 KRW = 1000000n */
  sendMinor: bigint;
  recvBank?: string;
}

export interface RawQuote {
  sendMinor: bigint;
  feeMinor: bigint;
  /** Yakuniy summa. Adapter uni provider ekranidan OLADI, o'zi hisoblamaydi. */
  recvMinor: bigint;
  rate: string; // Decimal string — float ishlatilmaydi
  recvBank?: string;
  payoutMethod?: 'CARD' | 'ACCOUNT' | 'CASH_PICKUP';
  etaMinutes?: number;
  isPromotional: boolean;
  /** Javob body hash'i — sahifa o'zgarganini aniqlash uchun */
  rawHash?: string;
}

export class AdapterError extends Error {
  constructor(
    readonly kind: 'PARSE_ERROR' | 'TIMEOUT' | 'BLOCKED' | 'UNKNOWN_ERROR',
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export interface ProviderAdapter {
  readonly slug: string;
  /** Ba'zi providerlar faqat qo'lda o'lchanadi (login ortida) */
  readonly automated: boolean;
  supports(req: QuoteRequest): boolean;
  fetchQuote(req: QuoteRequest): Promise<RawQuote>;
}

export const PROVIDER_ADAPTERS = Symbol('PROVIDER_ADAPTERS');
