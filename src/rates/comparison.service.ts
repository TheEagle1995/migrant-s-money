import { Inject, Injectable } from '@nestjs/common';
import { Quote, Provider } from '../domain/types';
import { normalizeTo, formatMinor } from '../domain/money';
import { PROVIDER_REPO, QUOTE_REPO, ProviderRepository, QuoteRepository } from './ports';

/** Shundan eski kotirovka "eskirgan" deb BELGILANADI — yashirilmaydi. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
export const BASE_SEND_KRW = 1_000_000n;

export interface ComparisonRow {
  providerSlug: string;
  displayName: string;
  /** 1 000 000 KRW uchun normallashtirilgan so'm — yagona tartiblash mezoni */
  recvPerMillionKrw: bigint;
  recvFormatted: string;
  feeMinor: bigint;
  etaMinutes: number | null;
  isPromotional: boolean;
  fetchedAt: Date;
  isStale: boolean;
  staleHours: number;
  source: Quote['source'];
  rank: number;
  /** Eng yaxshiga nisbatan farq, manfiy fraksiya (-0.031 = 3.1% kam) */
  gapFromBest: number;
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  best: ComparisonRow | null;
  worst: ComparisonRow | null;
  /** Eng yaxshi va eng yomon orasidagi farq */
  spread: number;
  /** Yiliga 12 o'tkazmada yo'qotish (UZS) */
  annualLossMinor: bigint;
  verdict: Verdict;
  measuredAt: Date;
}

export type Verdict = 'ALIVE' | 'MARGINAL' | 'DEAD' | 'INSUFFICIENT_DATA';

export const VERDICT_ALIVE_THRESHOLD = 0.03;
export const VERDICT_DEAD_THRESHOLD = 0.01;

/** Sof funksiya — testlanadi, DB kerak emas. */
export function buildComparison(
  providers: Provider[],
  quotes: Quote[],
  now: Date = new Date(),
): ComparisonResult {
  const byId = new Map(providers.map((p) => [p.id, p]));

  const rows: ComparisonRow[] = quotes
    .filter((q) => byId.has(q.providerId) && q.sendMinor > 0n)
    .map((q) => {
      const p = byId.get(q.providerId)!;
      const normalized = normalizeTo(q.recvMinor, q.sendMinor, BASE_SEND_KRW);
      const ageMs = now.getTime() - q.fetchedAt.getTime();
      return {
        providerSlug: p.slug,
        displayName: p.displayName,
        recvPerMillionKrw: normalized,
        recvFormatted: formatMinor(normalized),
        feeMinor: q.feeMinor,
        etaMinutes: q.etaMinutes,
        isPromotional: q.isPromotional,
        fetchedAt: q.fetchedAt,
        isStale: ageMs > STALE_AFTER_MS,
        staleHours: Math.floor(ageMs / 3_600_000),
        source: q.source,
        rank: 0,
        gapFromBest: 0,
      };
    });

  // YAGONA tartiblash mezoni: qo'lga tekkan summa.
  // affiliateActive bu yerda ataylab ishlatilmaydi.
  rows.sort((a, b) =>
    a.recvPerMillionKrw === b.recvPerMillionKrw
      ? a.providerSlug.localeCompare(b.providerSlug)
      : a.recvPerMillionKrw > b.recvPerMillionKrw
        ? -1
        : 1,
  );

  if (rows.length === 0) {
    return {
      rows, best: null, worst: null, spread: 0,
      annualLossMinor: 0n, verdict: 'INSUFFICIENT_DATA', measuredAt: now,
    };
  }

  const best = rows[0];
  const worst = rows[rows.length - 1];
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.gapFromBest =
      Number(r.recvPerMillionKrw) / Number(best.recvPerMillionKrw) - 1;
  });

  const spread =
    Number(best.recvPerMillionKrw) / Number(worst.recvPerMillionKrw) - 1;
  const annualLossMinor =
    (best.recvPerMillionKrw - worst.recvPerMillionKrw) * 12n;

  let verdict: Verdict;
  if (rows.length < 2) verdict = 'INSUFFICIENT_DATA';
  else if (spread >= VERDICT_ALIVE_THRESHOLD) verdict = 'ALIVE';
  else if (spread <= VERDICT_DEAD_THRESHOLD) verdict = 'DEAD';
  else verdict = 'MARGINAL';

  return { rows, best, worst, spread, annualLossMinor, verdict, measuredAt: now };
}

@Injectable()
export class ComparisonService {
  constructor(
    @Inject(PROVIDER_REPO) private readonly providers: ProviderRepository,
    @Inject(QUOTE_REPO) private readonly quotes: QuoteRepository,
  ) {}

  async current(): Promise<ComparisonResult> {
    const [providers, quotes] = await Promise.all([
      this.providers.listActive(),
      this.quotes.latestPerProvider('KRW', 'UZS'),
    ]);
    return buildComparison(providers, quotes);
  }
}
