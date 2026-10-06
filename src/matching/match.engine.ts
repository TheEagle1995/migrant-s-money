/**
 * Transfer <-> InboundEvent moslashtirish.
 *
 * Deterministik, ML emas. Sababi: noto'g'ri avtomatik moslik foydalanuvchining
 * moliyaviy tarixini buzadi va buni u sezmaydi. Shubha bo'lsa — so'raymiz.
 *
 * Har bir qo'lda tasdiq — bu `OBSERVED` manbali haqiqiy kurs nuqtasi.
 * Aynan shu ma'lumot scraping bilan takrorlanmaydi.
 */

export interface MatchCandidateTransfer {
  id: string;
  declaredAt: Date;
  /** Quote asosidagi prognoz (UZS). Bo'lmasa moslashtirish ishlamaydi. */
  expectedRecvMinor: bigint | null;
}

export interface MatchCandidateEvent {
  id: string;
  amountMinor: bigint; // UZS
  kind: 'CREDIT' | 'DEBIT';
  occurredAt: Date;
  confidence: number;
}

export type MatchOutcome =
  | { decision: 'AUTO'; transferId: string; eventId: string; deviation: number }
  | { decision: 'ASK_USER'; transferId: string; candidateIds: string[]; reason: AskReason }
  | { decision: 'NONE'; transferId: string; reason: 'NO_CANDIDATE' | 'NO_EXPECTATION' };

export type AskReason = 'MULTIPLE_CANDIDATES' | 'WEAK_DEVIATION' | 'LOW_PARSE_CONFIDENCE';

export const MATCH_WINDOW_MS = 72 * 60 * 60 * 1000;
/** Prognozdan 2% ichida — kuchli nomzod. Kurs siljishi shu oraliqda. */
export const STRONG_DEVIATION = 0.02;
/** 8% dan tashqarisi umuman nomzod emas. */
export const MAX_DEVIATION = 0.08;
export const MIN_PARSE_CONFIDENCE = 0.8;

export function matchTransfer(
  transfer: MatchCandidateTransfer,
  events: MatchCandidateEvent[],
): MatchOutcome {
  if (transfer.expectedRecvMinor === null || transfer.expectedRecvMinor === 0n) {
    return { decision: 'NONE', transferId: transfer.id, reason: 'NO_EXPECTATION' };
  }

  const from = transfer.declaredAt.getTime();
  const to = from + MATCH_WINDOW_MS;

  const scored = events
    .filter(
      (e) =>
        e.kind === 'CREDIT' &&
        e.occurredAt.getTime() >= from &&
        e.occurredAt.getTime() <= to,
    )
    .map((e) => ({ event: e, deviation: deviationOf(e.amountMinor, transfer.expectedRecvMinor!) }))
    .filter((s) => s.deviation <= MAX_DEVIATION)
    .sort((a, b) => a.deviation - b.deviation);

  if (scored.length === 0) {
    return { decision: 'NONE', transferId: transfer.id, reason: 'NO_CANDIDATE' };
  }

  const strong = scored.filter((s) => s.deviation <= STRONG_DEVIATION);

  // Bir nechta kuchli nomzod — o'zimiz tanlamaymiz
  if (strong.length > 1) {
    return {
      decision: 'ASK_USER',
      transferId: transfer.id,
      candidateIds: strong.map((s) => s.event.id),
      reason: 'MULTIPLE_CANDIDATES',
    };
  }

  if (strong.length === 1) {
    const best = strong[0];
    // Parser o'zi ishonchsiz bo'lsa, avtomatik bog'lash xavfli
    if (best.event.confidence < MIN_PARSE_CONFIDENCE) {
      return {
        decision: 'ASK_USER',
        transferId: transfer.id,
        candidateIds: [best.event.id],
        reason: 'LOW_PARSE_CONFIDENCE',
      };
    }
    return {
      decision: 'AUTO',
      transferId: transfer.id,
      eventId: best.event.id,
      deviation: best.deviation,
    };
  }

  // Faqat kuchsiz nomzodlar bor — ko'rsatamiz, lekin bog'lamaymiz
  return {
    decision: 'ASK_USER',
    transferId: transfer.id,
    candidateIds: scored.slice(0, 3).map((s) => s.event.id),
    reason: 'WEAK_DEVIATION',
  };
}

export function deviationOf(actual: bigint, expected: bigint): number {
  if (expected === 0n) return Number.POSITIVE_INFINITY;
  const diff = actual > expected ? actual - expected : expected - actual;
  return Number(diff) / Number(expected);
}

/**
 * Tasdiqlangan moslikdan haqiqiy kurs. Bu `OBSERVED` Quote bo'lib yoziladi —
 * reklama qilingan emas, real qo'lga tekkan kurs.
 */
export function observedRate(sentMinorKrw: bigint, recvMinorUzs: bigint): string {
  if (sentMinorKrw === 0n) return '0';
  return (Number(recvMinorUzs) / Number(sentMinorKrw)).toFixed(10);
}
