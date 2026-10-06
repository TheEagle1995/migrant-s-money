import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AdapterError, PROVIDER_ADAPTERS, ProviderAdapter, QuoteRequest,
} from './provider.contract';
import {
  FETCH_RUN_REPO, FetchRunRepository, PROVIDER_REPO, ProviderRepository,
  QUOTE_REPO, QuoteRepository,
} from './ports';
import { RunStatus } from '../domain/types';

export const DEFAULT_REQUEST: QuoteRequest = {
  sendCurrency: 'KRW',
  recvCurrency: 'UZS',
  sendMinor: 1_000_000n,
};

@Injectable()
export class RatesRunner {
  private readonly log = new Logger(RatesRunner.name);

  constructor(
    @Inject(PROVIDER_ADAPTERS) private readonly adapters: ProviderAdapter[],
    @Inject(PROVIDER_REPO) private readonly providers: ProviderRepository,
    @Inject(QUOTE_REPO) private readonly quotes: QuoteRepository,
    @Inject(FETCH_RUN_REPO) private readonly runs: FetchRunRepository,
  ) {}

  /** Bittasi yiqilsa qolganlari davom etadi — har biri o'z FetchRun'iga ega. */
  async runAll(req: QuoteRequest = DEFAULT_REQUEST): Promise<void> {
    const targets = this.adapters.filter((a) => a.automated && a.supports(req));
    for (const adapter of targets) {
      try {
        await this.runOne(adapter, req);
      } catch (e) {
        this.log.error(`${adapter.slug} kutilmagan xato`, e as Error);
      }
      // Jitter: bir vaqtda urish blok bo'lish ehtimolini oshiradi
      await sleep(300 + Math.random() * 700);
    }
  }

  async runOne(adapter: ProviderAdapter, req: QuoteRequest): Promise<void> {
    const provider = await this.providers.findBySlug(adapter.slug);
    if (!provider || !provider.isActive) return;

    const startedAt = new Date();
    const runId = await this.runs.start(provider.id, startedAt);

    try {
      const raw = await withRetry(() => adapter.fetchQuote(req), 3);
      await this.quotes.create({
        providerId: provider.id,
        sendCurrency: req.sendCurrency,
        recvCurrency: req.recvCurrency,
        sendMinor: raw.sendMinor,
        feeMinor: raw.feeMinor,
        rate: raw.rate,
        recvMinor: raw.recvMinor,
        recvBank: raw.recvBank ?? null,
        payoutMethod: raw.payoutMethod ?? null,
        etaMinutes: raw.etaMinutes ?? null,
        isPromotional: raw.isPromotional,
        fetchedAt: new Date(),
        source: 'SCRAPE',
        runId,
      });
      await this.runs.finish(runId, {
        status: 'OK',
        rawHash: raw.rawHash,
        durationMs: Date.now() - startedAt.getTime(),
      });
    } catch (err) {
      const status: RunStatus =
        err instanceof AdapterError ? err.kind : 'UNKNOWN_ERROR';
      await this.runs.finish(runId, {
        status,
        errorText: String(err instanceof Error ? err.message : err).slice(0, 500),
        durationMs: Date.now() - startedAt.getTime(),
      });
      this.log.warn(`${adapter.slug}: ${status}`);
    }
  }

  /** Adapter salomatligi — ketma-ket 3 xato bo'lsa e'tibor talab qilinadi. */
  async health(): Promise<Array<{ slug: string; healthy: boolean; recent: RunStatus[] }>> {
    const providers = await this.providers.listActive();
    return Promise.all(
      providers.map(async (p) => {
        const recent = await this.runs.recentFailures(p.id, 3);
        return {
          slug: p.slug,
          healthy: recent.length < 3 || recent.some((s) => s === 'OK'),
          recent,
        };
      }),
    );
  }
}

export async function withRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      // BLOCKED — qayta urinish faqat ahvolni yomonlashtiradi
      if (e instanceof AdapterError && e.kind === 'BLOCKED') throw e;
      if (i < attempts - 1) await sleep(2 ** i * 50);
    }
  }
  throw last;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
