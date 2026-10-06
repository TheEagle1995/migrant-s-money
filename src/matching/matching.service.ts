import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CONSENT_REPO, ConsentRepository, EVENT_REPO, InboundEventRepository,
  NewInboundEvent, TRANSFER_REPO, TransferRepository,
} from '../household/ports';
import { QUOTE_REPO, QuoteRepository } from '../rates/ports';
import { findCorridor } from '../domain/corridor';
import {
  matchTransfer, MATCH_WINDOW_MS, MatchOutcome, observedRate,
  deviationOf, STRONG_DEVIATION, MAX_DEVIATION,
} from './match.engine';

@Injectable()
export class MatchingService {
  private readonly log = new Logger(MatchingService.name);

  constructor(
    @Inject(TRANSFER_REPO) private readonly transfers: TransferRepository,
    @Inject(EVENT_REPO) private readonly events: InboundEventRepository,
    @Inject(CONSENT_REPO) private readonly consent: ConsentRepository,
    @Inject(QUOTE_REPO) private readonly quotes: QuoteRepository,
  ) {}

  /**
   * Qurilmadan kelgan parse natijasi. RAW SMS BU YERGA HECH QACHON KELMAYDI.
   * Rozilik bo'lmasa — rad etiladi, saqlanmaydi.
   */
  async ingest(evt: NewInboundEvent): Promise<{ eventId: string; outcome: MatchOutcome | null }> {
    if (!(await this.consent.hasSmsConsent(evt.householdId))) {
      throw new ForbiddenException('SMS uchun rozilik berilmagan');
    }
    const saved = await this.events.create(evt);
    if (evt.kind !== 'CREDIT') return { eventId: saved.id, outcome: null };

    const pending = await this.transfers.findPending(evt.householdId);
    for (const t of pending) {
      const from = t.declaredAt;
      const to = new Date(from.getTime() + MATCH_WINDOW_MS);
      const candidates = await this.events.unmatchedCredits(evt.householdId, from, to);
      const outcome = matchTransfer(t, candidates);
      if (outcome.decision === 'AUTO') {
        await this.confirm(outcome.transferId, outcome.eventId, 'system');
        return { eventId: saved.id, outcome };
      }
      if (outcome.decision === 'ASK_USER') {
        // Bog'lamaymiz — foydalanuvchi tanlaydi
        return { eventId: saved.id, outcome };
      }
    }
    return { eventId: saved.id, outcome: null };
  }

  /**
   * Moslikni tasdiqlash. Har bir tasdiq — `OBSERVED` manbali haqiqiy kurs nuqtasi.
   * Bu ma'lumot scraping bilan takrorlanmaydi va moat aynan shu.
   */
  async confirm(transferId: string, eventId: string, confirmedBy: string): Promise<void> {
    const [transfer, event] = await Promise.all([
      this.transfers.findById(transferId),
      this.events.findById(eventId),
    ]);
    if (!transfer) throw new NotFoundException('O\'tkazma topilmadi');
    if (!event) throw new NotFoundException('Hodisa topilmadi');
    if (event.householdId !== transfer.householdId) {
      throw new ForbiddenException('Hodisa boshqa oilaga tegishli');
    }

    await this.transfers.markMatched(transferId, eventId, confirmedBy);

    const corridor = findCorridor(transfer.corridorId);
    if (transfer.providerId && corridor) {
      await this.quotes.create({
        providerId: transfer.providerId,
        corridorId: corridor.id,
        sendCurrency: corridor.sendCurrency,
        recvCurrency: corridor.recvCurrency,
        sendMinor: transfer.sentMinor,
        feeMinor: 0n,
        rate: observedRate(
          transfer.sentMinor, event.amountMinor,
          corridor.sendCurrency, corridor.recvCurrency,
        ),
        recvMinor: event.amountMinor,
        isPromotional: false,
        fetchedAt: event.occurredAt,
        source: 'OBSERVED',
      });
      this.log.log(`OBSERVED kurs yozildi: transfer=${transferId}`);
    }
  }

  /**
   * Foydalanuvchiga ko'rsatiladigan nomzodlar ro'yxati.
   * `ASK_USER` holatida ilova shu ro'yxatdan tanlashni so'raydi.
   */
  async candidatesFor(transferId: string): Promise<CandidateView[]> {
    const transfer = await this.transfers.findById(transferId);
    if (!transfer) throw new NotFoundException('O\'tkazma topilmadi');
    if (transfer.expectedRecvMinor === null) return [];

    const from = transfer.declaredAt;
    const to = new Date(from.getTime() + MATCH_WINDOW_MS);
    const events = await this.events.unmatchedCredits(transfer.householdId, from, to);

    return events
      .map((e) => {
        const deviation = deviationOf(e.amountMinor, transfer.expectedRecvMinor!);
        return {
          eventId: e.id,
          amountMinor: e.amountMinor,
          occurredAt: e.occurredAt,
          bankSlug: e.bankSlug,
          confidence: e.confidence,
          deviation,
          isStrong: deviation <= STRONG_DEVIATION,
        };
      })
      .filter((c) => c.deviation <= MAX_DEVIATION)
      .sort((a, b) => a.deviation - b.deviation);
  }

  /** 72 soatdan keyin moslik topilmasa — UNMATCHED. */
  async expireStale(): Promise<number> {
    return this.transfers.expireOlderThan(new Date(Date.now() - MATCH_WINDOW_MS));
  }
}

/** Bitta o'tkazma uchun nomzodlar, chetlanish bo'yicha tartiblangan. */
export interface CandidateView {
  eventId: string;
  amountMinor: bigint;
  occurredAt: Date;
  bankSlug: string;
  confidence: number;
  /** Prognozdan chetlanish, fraksiya. 0.02 = 2% */
  deviation: number;
  isStrong: boolean;
}
