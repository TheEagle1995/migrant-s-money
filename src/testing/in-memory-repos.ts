import { randomUUID } from 'crypto';
import {
  FetchRunRepository, NewQuote, ProviderRepository, QuoteRepository,
} from '../rates/ports';
import {
  ConsentRepository, InboundEventRepository, NewInboundEvent, TransferRepository,
} from '../household/ports';
import {
  InboundEvent, Provider, Quote, RunStatus, Transfer, TransferStatus,
} from '../domain/types';

/**
 * Xotiradagi repozitoriylar — integratsiya testlari uchun.
 * Postgres kerak emas, lekin portlarning aynan o'zi implementatsiya qilinadi,
 * ya'ni test qanday o'tsa, Prisma versiyasi ham shunday ishlashi kerak.
 */
export class MemProviderRepo implements ProviderRepository {
  constructor(public items: Provider[] = []) {}
  async findBySlug(slug: string) {
    return this.items.find((p) => p.slug === slug) ?? null;
  }
  async listActive() {
    return this.items.filter((p) => p.isActive);
  }
}

export class MemQuoteRepo implements QuoteRepository {
  public items: Quote[] = [];
  private seq = 1n;

  /** Faqat INSERT — Prisma versiyasidagi kabi update yo'q */
  async create(q: NewQuote): Promise<void> {
    this.items.push({
      id: this.seq++,
      providerId: q.providerId,
      sendCurrency: q.sendCurrency,
      recvCurrency: q.recvCurrency,
      sendMinor: q.sendMinor,
      feeMinor: q.feeMinor,
      rate: q.rate,
      recvMinor: q.recvMinor,
      recvBank: q.recvBank ?? null,
      payoutMethod: q.payoutMethod ?? null,
      etaMinutes: q.etaMinutes ?? null,
      isPromotional: q.isPromotional,
      fetchedAt: q.fetchedAt,
      source: q.source,
    });
  }

  async latestPerProvider(send: 'KRW', recv: 'UZS'): Promise<Quote[]> {
    const best = new Map<string, Quote>();
    for (const q of this.items) {
      if (q.sendCurrency !== send || q.recvCurrency !== recv) continue;
      const cur = best.get(q.providerId);
      if (!cur || q.fetchedAt > cur.fetchedAt) best.set(q.providerId, q);
    }
    return [...best.values()];
  }

  async history(providerId: string, since: Date): Promise<Quote[]> {
    return this.items
      .filter((q) => q.providerId === providerId && q.fetchedAt >= since)
      .sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime());
  }
}

export class MemFetchRunRepo implements FetchRunRepository {
  public runs: Array<{ id: string; providerId: string; status: RunStatus; startedAt: Date }> = [];
  async start(providerId: string, startedAt: Date) {
    const id = randomUUID();
    this.runs.push({ id, providerId, status: 'UNKNOWN_ERROR', startedAt });
    return id;
  }
  async finish(runId: string, data: { status: RunStatus }) {
    const r = this.runs.find((x) => x.id === runId);
    if (r) r.status = data.status;
  }
  async recentFailures(providerId: string, limit: number) {
    return this.runs
      .filter((r) => r.providerId === providerId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit)
      .map((r) => r.status);
  }
}

export class MemTransferRepo implements TransferRepository {
  public items: Transfer[] = [];
  constructor(private readonly events: MemEventRepo) {}

  async create(t: Omit<Transfer, 'id' | 'status'>): Promise<Transfer> {
    const created: Transfer = { ...t, id: randomUUID(), status: 'PENDING' };
    this.items.push(created);
    return created;
  }
  async findById(id: string) {
    return this.items.find((t) => t.id === id) ?? null;
  }
  async findPending(householdId: string) {
    return this.items
      .filter((t) => t.householdId === householdId && t.status === 'PENDING')
      .sort((a, b) => b.declaredAt.getTime() - a.declaredAt.getTime());
  }
  async markMatched(transferId: string, eventId: string, confirmedBy: string) {
    const t = this.items.find((x) => x.id === transferId);
    const e = this.events.items.find((x) => x.id === eventId);
    if (t) t.status = 'MATCHED';
    if (e) e.transferId = transferId;
    void confirmedBy;
  }
  async setStatus(transferId: string, status: TransferStatus) {
    const t = this.items.find((x) => x.id === transferId);
    if (t) t.status = status;
  }
  async expireOlderThan(cutoff: Date) {
    let n = 0;
    for (const t of this.items) {
      if (t.status === 'PENDING' && t.declaredAt < cutoff) {
        t.status = 'UNMATCHED';
        n++;
      }
    }
    return n;
  }
}

export class MemEventRepo implements InboundEventRepository {
  public items: InboundEvent[] = [];
  async create(e: NewInboundEvent): Promise<InboundEvent> {
    const created: InboundEvent = {
      id: randomUUID(),
      householdId: e.householdId,
      amountMinor: e.amountMinor,
      kind: e.kind,
      bankSlug: e.bankSlug,
      occurredAt: e.occurredAt,
      confidence: e.confidence,
      parserVersion: e.parserVersion,
      transferId: null,
    };
    this.items.push(created);
    return created;
  }
  async findById(id: string) {
    return this.items.find((e) => e.id === id) ?? null;
  }
  async recent(householdId: string, limit: number) {
    return this.items
      .filter((e) => e.householdId === householdId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }
  async unmatchedCredits(householdId: string, from: Date, to: Date) {
    return this.items
      .filter(
        (e) =>
          e.householdId === householdId &&
          e.kind === 'CREDIT' &&
          e.transferId === null &&
          e.occurredAt >= from &&
          e.occurredAt <= to,
      )
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
}

export class MemConsentRepo implements ConsentRepository {
  constructor(public granted = new Set<string>()) {}
  async hasSmsConsent(householdId: string) {
    return this.granted.has(householdId);
  }
}
