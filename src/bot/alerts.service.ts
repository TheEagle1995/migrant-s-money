import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ComparisonResult } from '../rates/comparison.service';

export interface AlertSubscription {
  id: string;
  chatId: string;
  /** Chegara: 1 mln KRW uchun so'm. Shundan oshsa xabar yuboriladi. */
  thresholdMinor: bigint;
  /** Faqat shu kanal uchun. null = har qanday kanal. */
  providerSlug: string | null;
  lastFiredValueMinor: bigint | null;
  isActive: boolean;
}

export interface AlertRepository {
  create(s: Omit<AlertSubscription, 'id' | 'lastFiredValueMinor' | 'isActive'>): Promise<AlertSubscription>;
  listActive(): Promise<AlertSubscription[]>;
  markFired(id: string, value: bigint): Promise<void>;
  deactivateForChat(chatId: string): Promise<number>;
}

export const ALERT_REPO = Symbol('ALERT_REPO');

export interface AlertHit {
  subscription: AlertSubscription;
  providerSlug: string;
  displayName: string;
  valueMinor: bigint;
}

/**
 * Takroriy xabar yubormaslik uchun: kurs chegaradan oshgan bo'lsa ham,
 * oxirgi yuborilgan qiymatdan sezilarli o'smagan bo'lsa — jim turamiz.
 * Aks holda kurs chegara atrofida tebranganda bot spam qiladi.
 */
export const RE_ALERT_MIN_GAIN = 0.005; // 0.5%

/** Sof funksiya — testlanadi. */
export function evaluateAlerts(
  subs: AlertSubscription[],
  comparison: ComparisonResult,
): AlertHit[] {
  const hits: AlertHit[] = [];

  for (const sub of subs) {
    if (!sub.isActive) continue;

    const candidates = comparison.rows.filter((r) => {
      if (sub.providerSlug && r.providerSlug !== sub.providerSlug) return false;
      // Eskirgan ma'lumot asosida xabar yubormaymiz
      if (r.isStale) return false;
      // Promo narx doimiy emas — unga qarab ogohlantirish aldamchi
      if (r.isPromotional) return false;
      return r.recvPerMillionKrw >= sub.thresholdMinor;
    });

    if (candidates.length === 0) continue;

    const best = candidates.reduce((a, b) =>
      a.recvPerMillionKrw >= b.recvPerMillionKrw ? a : b,
    );

    if (sub.lastFiredValueMinor !== null) {
      const gain =
        Number(best.recvPerMillionKrw - sub.lastFiredValueMinor) /
        Number(sub.lastFiredValueMinor);
      if (gain < RE_ALERT_MIN_GAIN) continue;
    }

    hits.push({
      subscription: sub,
      providerSlug: best.providerSlug,
      displayName: best.displayName,
      valueMinor: best.recvPerMillionKrw,
    });
  }

  return hits;
}

@Injectable()
export class AlertsService {
  constructor(@Inject(ALERT_REPO) private readonly repo: AlertRepository) {}

  async subscribe(chatId: string, thresholdMinor: bigint, providerSlug?: string) {
    if (thresholdMinor <= 0n) {
      throw new BadRequestException('Chegara musbat bo\'lishi kerak');
    }
    // Aqlga sig'adigan oraliq: 1 mln KRW ~ 8-9 mln so'm
    if (thresholdMinor < 4_000_000n || thresholdMinor > 20_000_000n) {
      throw new BadRequestException(
        'Chegara 1 mln KRW uchun so\'mda bo\'lishi kerak, masalan 8600000',
      );
    }
    return this.repo.create({
      chatId,
      thresholdMinor,
      providerSlug: providerSlug ?? null,
    });
  }

  async unsubscribe(chatId: string): Promise<number> {
    return this.repo.deactivateForChat(chatId);
  }

  async due(comparison: ComparisonResult): Promise<AlertHit[]> {
    return evaluateAlerts(await this.repo.listActive(), comparison);
  }

  async recordFired(hit: AlertHit): Promise<void> {
    await this.repo.markFired(hit.subscription.id, hit.valueMinor);
  }
}
