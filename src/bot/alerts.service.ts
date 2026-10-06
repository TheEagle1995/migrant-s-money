import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ComparisonResult } from '../rates/comparison.service';
import { findCorridor } from '../domain/corridor';
import { minorFactor, formatMinor } from '../domain/currency';

export interface AlertSubscription {
  id: string;
  chatId: string;
  /** Qaysi koridor kuzatilmoqda */
  corridorId: string;
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
  corridorId: string;
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
      return r.recvNormalizedMinor >= sub.thresholdMinor;
    });

    if (candidates.length === 0) continue;

    const best = candidates.reduce((a, b) =>
      a.recvNormalizedMinor >= b.recvNormalizedMinor ? a : b,
    );

    if (sub.lastFiredValueMinor !== null) {
      const gain =
        Number(best.recvNormalizedMinor - sub.lastFiredValueMinor) /
        Number(sub.lastFiredValueMinor);
      if (gain < RE_ALERT_MIN_GAIN) continue;
    }

    hits.push({
      subscription: sub,
      corridorId: comparison.corridorId,
      providerSlug: best.providerSlug,
      displayName: best.displayName,
      valueMinor: best.recvNormalizedMinor,
    });
  }

  return hits;
}

@Injectable()
export class AlertsService {
  constructor(@Inject(ALERT_REPO) private readonly repo: AlertRepository) {}

  async subscribe(
    chatId: string,
    corridorId: string,
    thresholdMinor: bigint,
    providerSlug?: string,
  ) {
    const corridor = findCorridor(corridorId);
    if (!corridor) throw new BadRequestException(`Noma'lum koridor: ${corridorId}`);
    if (thresholdMinor <= 0n) {
      throw new BadRequestException('Chegara musbat bo\'lishi kerak');
    }

    // Aqlga sig'adigan oraliq KORIDORDAN hisoblanadi. Ilgari 4-20 mln so'm
    // deb qattiq yozilgan edi — bu faqat Koreya koridoriga mos edi.
    const bounds = thresholdBounds(corridorId);
    if (!bounds) throw new BadRequestException(`Noma'lum koridor: ${corridorId}`);
    if (thresholdMinor < bounds.min || thresholdMinor > bounds.max) {
      throw new BadRequestException(
        `Chegara ${formatMinor(corridor.sampleSendMinor, corridor.sendCurrency)} ` +
        `${corridor.sendCurrency} uchun ${corridor.recvCurrency} da bo'lishi kerak: ` +
        `${formatMinor(bounds.min, corridor.recvCurrency)} - ` +
        `${formatMinor(bounds.max, corridor.recvCurrency)}`,
      );
    }

    return this.repo.create({
      chatId,
      corridorId,
      thresholdMinor,
      providerSlug: providerSlug ?? null,
    });
  }

  async unsubscribe(chatId: string): Promise<number> {
    return this.repo.deactivateForChat(chatId);
  }

  async due(comparison: ComparisonResult): Promise<AlertHit[]> {
    const subs = await this.repo.listActive();
    return evaluateAlerts(
      subs.filter((s) => s.corridorId === comparison.corridorId),
      comparison,
    );
  }

  async recordFired(hit: AlertHit): Promise<void> {
    await this.repo.markFired(hit.subscription.id, hit.valueMinor);
  }
}

/**
 * Chegara uchun aqlga sig'adigan oraliq — koridorning sanity kursidan
 * hisoblanadi, ya'ni har bir koridor uchun avtomatik to'g'ri bo'ladi.
 */
export function thresholdBounds(
  corridorId: string,
): { min: bigint; max: bigint } | null {
  const c = findCorridor(corridorId);
  if (!c) return null;
  const sendMajor = Number(c.sampleSendMinor) / Number(minorFactor(c.sendCurrency));
  const recvFactor = Number(minorFactor(c.recvCurrency));
  return {
    min: BigInt(Math.floor(sendMajor * c.sanityRateMin * recvFactor)),
    max: BigInt(Math.ceil(sendMajor * c.sanityRateMax * recvFactor)),
  };
}
