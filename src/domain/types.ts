import { CurrencyCode } from './currency';
import { CountryCode } from './corridor';

export type ProviderKind = 'SMALL_REMITTANCE' | 'BANK_APP' | 'BANK' | 'WALLET';
export type QuoteSource = 'SCRAPE' | 'MANUAL' | 'OFFICIAL' | 'OBSERVED';
export type RunStatus = 'OK' | 'PARSE_ERROR' | 'TIMEOUT' | 'BLOCKED' | 'UNKNOWN_ERROR';
export type PayoutMethod = 'CARD' | 'ACCOUNT' | 'CASH_PICKUP';
export type EventKind = 'CREDIT' | 'DEBIT';
export type TransferStatus = 'PENDING' | 'MATCHED' | 'UNMATCHED' | 'CANCELLED';

export interface Provider {
  id: string;
  slug: string;
  displayName: string;
  kind: ProviderKind;
  /** Qaysi davlatdan yuborish mumkin — Sentbe (Koreya) va Korona (Rossiya)
   *  bitta ro'yxatda chiqib qolmasligi uchun. */
  sendCountries: CountryCode[];
  isLicensed: boolean;
  /** Ranking'ga TA'SIR QILMAYDI. Faqat oshkoralik hisoboti uchun. */
  affiliateActive: boolean;
  isActive: boolean;
}

export interface Quote {
  id: bigint;
  providerId: string;
  /** "KR-UZ" — koridor endi yozuvning bir qismi */
  corridorId: string;
  sendCurrency: CurrencyCode;
  recvCurrency: CurrencyCode;
  sendMinor: bigint;
  feeMinor: bigint;
  rate: string;
  recvMinor: bigint;
  recvBank: string | null;
  payoutMethod: PayoutMethod | null;
  etaMinutes: number | null;
  isPromotional: boolean;
  fetchedAt: Date;
  source: QuoteSource;
}

export interface Transfer {
  id: string;
  householdId: string;
  corridorId: string;
  providerId: string | null;
  sentMinor: bigint;
  expectedRecvMinor: bigint | null;
  declaredAt: Date;
  status: TransferStatus;
}

export interface InboundEvent {
  id: string;
  householdId: string;
  /** Hodisa qaysi valyutada — qabul qiluvchi davlat bittadan ko'p bo'lishi mumkin */
  currency: CurrencyCode;
  amountMinor: bigint;
  kind: EventKind;
  bankSlug: string;
  occurredAt: Date;
  confidence: number;
  parserVersion: number;
  transferId: string | null;
}
