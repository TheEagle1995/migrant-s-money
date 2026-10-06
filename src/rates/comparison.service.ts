import { Inject, Injectable } from '@nestjs/common';
import { Quote, Provider } from '../domain/types';
import { normalizeTo } from '../domain/money';
import { formatMinor, CurrencyCode } from '../domain/currency';
import { Corridor, corridorLabel, findCorridor, liveCorridors } from '../domain/corridor';
import { PROVIDER_REPO, QUOTE_REPO, ProviderRepository, QuoteRepository } from './ports';

/** Shundan eski kotirovka "eskirgan" deb BELGILANADI — yashirilmaydi. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export interface ComparisonRow {
  providerSlug: string;
  displayName: string;
  /** Koridor bazasiga keltirilgan summa — yagona tartiblash mezoni */
  recvNormalizedMinor: bigint;
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
  corridorId: string;
  corridorLabel: string;
  sendCurrency: CurrencyCode;
  recvCurrency: CurrencyCode;
  /** Taqqoslash qaysi summa uchun — ilovada sarlavhada ko'rsatiladi */
  baseSendMinor: bigint;
  baseSendFormatted: string;
  rows: ComparisonRow[];
  best: ComparisonRow | null;
  worst: ComparisonRow | null;
  spread: number;
  /** Yiliga 12 o'tkazmada yo'qotish, qabul valyutasida */
  annualLossMinor: bigint;
  verdict: Verdict;
  measuredAt: Date;
}

export type Verdict = 'ALIVE' | 'MARGINAL' | 'DEAD' | 'INSUFFICIENT_DATA';

export const VERDICT_ALIVE_THRESHOLD = 0.03;
export const VERDICT_DEAD_THRESHOLD = 0.01;

/** Sof funksiya — testlanadi, DB kerak emas. */
export function buildComparison(
  corridor: Corridor,
  providers: Provider[],
  quotes: Quote[],
  now: Date = new Date(),
): ComparisonResult {
  const byId = new Map(providers.map((p) => [p.id, p]));

  const rows: ComparisonRow[] = quotes
    .filter(
      (q) =>
        q.corridorId === corridor.id &&
        byId.has(q.providerId) &&
        q.sendMinor > 0n,
    )
    .map((q) => {
      const p = byId.get(q.providerId)!;
      const normalized = normalizeTo(q.recvMinor, q.sendMinor, corridor.baseSendMinor);
      const ageMs = now.getTime() - q.fetchedAt.getTime();
      return {
        providerSlug: p.slug,
        displayName: p.displayName,
        recvNormalizedMinor: normalized,
        recvFormatted: formatMinor(normalized, corridor.recvCurrency),
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
    a.recvNormalizedMinor === b.recvNormalizedMinor
      ? a.providerSlug.localeCompare(b.providerSlug)
      : a.recvNormalizedMinor > b.recvNormalizedMinor
        ? -1
        : 1,
  );

  const shell = {
    corridorId: corridor.id,
    corridorLabel: corridorLabel(corridor),
    sendCurrency: corridor.sendCurrency,
    recvCurrency: corridor.recvCurrency,
    baseSendMinor: corridor.baseSendMinor,
    baseSendFormatted: formatMinor(corridor.baseSendMinor, corridor.sendCurrency),
    measuredAt: now,
  };

  if (rows.length === 0) {
    return {
      ...shell, rows, best: null, worst: null, spread: 0,
      annualLossMinor: 0n, verdict: 'INSUFFICIENT_DATA',
    };
  }

  const best = rows[0];
  const worst = rows[rows.length - 1];
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.gapFromBest =
      Number(r.recvNormalizedMinor) / Number(best.recvNormalizedMinor) - 1;
  });

  const spread =
    Number(best.recvNormalizedMinor) / Number(worst.recvNormalizedMinor) - 1;
  const annualLossMinor =
    (best.recvNormalizedMinor - worst.recvNormalizedMinor) * 12n;

  let verdict: Verdict;
  if (rows.length < 2) verdict = 'INSUFFICIENT_DATA';
  else if (spread >= VERDICT_ALIVE_THRESHOLD) verdict = 'ALIVE';
  else if (spread <= VERDICT_DEAD_THRESHOLD) verdict = 'DEAD';
  else verdict = 'MARGINAL';

  return { ...shell, rows, best, worst, spread, annualLossMinor, verdict };
}

@Injectable()
export class ComparisonService {
  constructor(
    @Inject(PROVIDER_REPO) private readonly providers: ProviderRepository,
    @Inject(QUOTE_REPO) private readonly quotes: QuoteRepository,
  ) {}

  async forCorridor(corridorId: string): Promise<ComparisonResult> {
    const corridor = findCorridor(corridorId);
    if (!corridor) throw new Error(`Noma'lum koridor: ${corridorId}`);
    const [providers, quotes] = await Promise.all([
      this.providers.listActive(),
      this.quotes.latestPerProvider(corridorId),
    ]);
    return buildComparison(corridor, providers, quotes);
  }

  /** Barcha faol koridorlar — bot kunlik postida va ilova boshida ishlatiladi */
  async allLive(): Promise<ComparisonResult[]> {
    return Promise.all(liveCorridors().map((c) => this.forCorridor(c.id)));
  }
}
