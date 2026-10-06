import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NewQuote, ProviderRepository, QuoteRepository, FetchRunRepository } from '../../rates/ports';
import {
  ConsentRepository, InboundEventRepository, NewInboundEvent, TransferRepository,
} from '../../household/ports';
import { ParserTemplateRepository } from '../../parsers/ports';
import { ParserTemplate } from '../../parsers/sms-parser';
import { Provider, Quote, RunStatus, Transfer, InboundEvent, TransferStatus } from '../../domain/types';

@Injectable()
export class PrismaProviderRepo implements ProviderRepository {
  constructor(private readonly db: PrismaService) {}
  findBySlug(slug: string): Promise<Provider | null> {
    return this.db.provider.findUnique({ where: { slug } }) as unknown as Promise<Provider | null>;
  }
  listActive(): Promise<Provider[]> {
    return this.db.provider.findMany({ where: { isActive: true } }) as unknown as Promise<Provider[]>;
  }
}

@Injectable()
export class PrismaQuoteRepo implements QuoteRepository {
  constructor(private readonly db: PrismaService) {}

  /** Faqat INSERT. Update metodi ataylab mavjud emas. */
  async create(q: NewQuote): Promise<void> {
    await this.db.quote.create({ data: q as never });
  }

  /** Har bir provayder uchun eng oxirgi kotirovka. */
  async latestPerProvider(send: 'KRW', recv: 'UZS'): Promise<Quote[]> {
    const rows = await this.db.$queryRaw<Quote[]>`
      SELECT DISTINCT ON ("providerId") *
      FROM "quotes"
      WHERE "sendCurrency" = ${send} AND "recvCurrency" = ${recv}
      ORDER BY "providerId", "fetchedAt" DESC
    `;
    return rows;
  }

  history(providerId: string, since: Date): Promise<Quote[]> {
    return this.db.quote.findMany({
      where: { providerId, fetchedAt: { gte: since } },
      orderBy: { fetchedAt: 'asc' },
    }) as unknown as Promise<Quote[]>;
  }
}

@Injectable()
export class PrismaFetchRunRepo implements FetchRunRepository {
  constructor(private readonly db: PrismaService) {}
  async start(providerId: string, startedAt: Date): Promise<string> {
    const run = await this.db.fetchRun.create({
      data: { providerId, startedAt, status: 'UNKNOWN_ERROR' },
    });
    return run.id;
  }
  async finish(
    runId: string,
    data: { status: RunStatus; rawHash?: string; errorText?: string; durationMs: number },
  ): Promise<void> {
    await this.db.fetchRun.update({
      where: { id: runId },
      data: { ...data, finishedAt: new Date() } as never,
    });
  }
  async recentFailures(providerId: string, limit: number): Promise<RunStatus[]> {
    const rows = await this.db.fetchRun.findMany({
      where: { providerId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: { status: true },
    });
    return rows.map((r: { status: string }) => r.status as RunStatus);
  }
}

@Injectable()
export class PrismaTransferRepo implements TransferRepository {
  constructor(private readonly db: PrismaService) {}
  async create(t: Omit<Transfer, 'id' | 'status'>): Promise<Transfer> {
    return this.db.transfer.create({ data: t as never }) as unknown as Promise<Transfer>;
  }
  findById(id: string): Promise<Transfer | null> {
    return this.db.transfer.findUnique({ where: { id } }) as unknown as Promise<Transfer | null>;
  }
  findPending(householdId: string): Promise<Transfer[]> {
    return this.db.transfer.findMany({
      where: { householdId, status: 'PENDING' },
      orderBy: { declaredAt: 'desc' },
    }) as unknown as Promise<Transfer[]>;
  }
  async markMatched(transferId: string, eventId: string, confirmedBy: string): Promise<void> {
    await this.db.$transaction([
      this.db.inboundEvent.update({
        where: { id: eventId },
        data: { transferId, matchConfirmedBy: confirmedBy },
      }),
      this.db.transfer.update({ where: { id: transferId }, data: { status: 'MATCHED' } }),
    ]);
  }
  async setStatus(transferId: string, status: TransferStatus): Promise<void> {
    await this.db.transfer.update({ where: { id: transferId }, data: { status } as never });
  }
  async expireOlderThan(cutoff: Date): Promise<number> {
    const r = await this.db.transfer.updateMany({
      where: { status: 'PENDING', declaredAt: { lt: cutoff } },
      data: { status: 'UNMATCHED' },
    });
    return r.count;
  }
}

@Injectable()
export class PrismaEventRepo implements InboundEventRepository {
  constructor(private readonly db: PrismaService) {}
  async create(e: NewInboundEvent): Promise<InboundEvent> {
    return this.db.inboundEvent.create({ data: e as never }) as unknown as Promise<InboundEvent>;
  }
  findById(id: string): Promise<InboundEvent | null> {
    return this.db.inboundEvent.findUnique({ where: { id } }) as unknown as Promise<InboundEvent | null>;
  }
  recent(householdId: string, limit: number): Promise<InboundEvent[]> {
    return this.db.inboundEvent.findMany({
      where: { householdId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    }) as unknown as Promise<InboundEvent[]>;
  }
  unmatchedCredits(householdId: string, from: Date, to: Date): Promise<InboundEvent[]> {
    return this.db.inboundEvent.findMany({
      where: { householdId, kind: 'CREDIT', transferId: null, occurredAt: { gte: from, lte: to } },
      orderBy: { occurredAt: 'asc' },
    }) as unknown as Promise<InboundEvent[]>;
  }
}

@Injectable()
export class PrismaConsentRepo implements ConsentRepository {
  constructor(private readonly db: PrismaService) {}
  async hasSmsConsent(householdId: string): Promise<boolean> {
    const m = await this.db.householdMember.findFirst({
      where: { householdId, role: 'RECEIVER', smsConsentAt: { not: null } },
      select: { id: true },
    });
    return m !== null;
  }
}

@Injectable()
export class PrismaParserRepo implements ParserTemplateRepository {
  constructor(private readonly db: PrismaService) {}
  async activeSince(version: number): Promise<ParserTemplate[]> {
    const rows = await this.db.parserTemplate.findMany({
      where: { isActive: true, version: { gt: version } },
      orderBy: [{ bankSlug: 'asc' }, { version: 'desc' }],
    });
    return rows.map((r: Record<string, unknown>) => ({
      bankSlug: r.bankSlug as string,
      version: r.version as number,
      pattern: r.pattern as string,
      amountGroup: r.amountGroup as string,
      kindMap: r.kindMap as Record<string, 'CREDIT' | 'DEBIT'>,
      decimalSeparator: ',' as const,
    }));
  }
  async upsert(t: ParserTemplate): Promise<void> {
    await this.db.parserTemplate.upsert({
      where: { bankSlug_version: { bankSlug: t.bankSlug, version: t.version } },
      create: {
        bankSlug: t.bankSlug, version: t.version, pattern: t.pattern,
        amountGroup: t.amountGroup, kindMap: t.kindMap as never,
      },
      update: { pattern: t.pattern, kindMap: t.kindMap as never },
    });
  }
}
