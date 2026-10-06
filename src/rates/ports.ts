import { Provider, Quote, QuoteSource, RunStatus, PayoutMethod } from '../domain/types';
import { CurrencyCode } from '../domain/currency';

export interface NewQuote {
  providerId: string;
  corridorId: string;
  sendCurrency: CurrencyCode;
  recvCurrency: CurrencyCode;
  sendMinor: bigint;
  feeMinor: bigint;
  rate: string;
  recvMinor: bigint;
  recvBank?: string | null;
  payoutMethod?: PayoutMethod | null;
  etaMinutes?: number | null;
  isPromotional: boolean;
  fetchedAt: Date;
  source: QuoteSource;
  runId?: string | null;
}

export interface ProviderRepository {
  findBySlug(slug: string): Promise<Provider | null>;
  listActive(): Promise<Provider[]>;
}

export interface QuoteRepository {
  /** Faqat INSERT. Update metodi ataylab yo'q. */
  create(q: NewQuote): Promise<void>;
  latestPerProvider(corridorId: string): Promise<Quote[]>;
  history(providerId: string, since: Date): Promise<Quote[]>;
}

export interface FetchRunRepository {
  start(providerId: string, startedAt: Date): Promise<string>;
  finish(
    runId: string,
    data: { status: RunStatus; rawHash?: string; errorText?: string; durationMs: number },
  ): Promise<void>;
  recentFailures(providerId: string, limit: number): Promise<RunStatus[]>;
}

export const PROVIDER_REPO = Symbol('PROVIDER_REPO');
export const QUOTE_REPO = Symbol('QUOTE_REPO');
export const FETCH_RUN_REPO = Symbol('FETCH_RUN_REPO');
