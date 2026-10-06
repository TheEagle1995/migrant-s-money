/**
 * Pul — har doim BigInt minor unit + valyuta kodi. Float hech qachon.
 * KRW: butun won. UZS: butun so'm (tiyin muomalada yo'q).
 */
export type Currency = 'KRW' | 'UZS' | 'USD';

export interface Money {
  readonly minor: bigint;
  readonly currency: Currency;
}

export const money = (minor: bigint | number, currency: Currency): Money => ({
  minor: typeof minor === 'number' ? BigInt(Math.round(minor)) : minor,
  currency,
});

export function assertSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Valyuta mos emas: ${a.currency} vs ${b.currency}`);
  }
}

export const addMoney = (a: Money, b: Money): Money => {
  assertSame(a, b);
  return { minor: a.minor + b.minor, currency: a.currency };
};

export const subMoney = (a: Money, b: Money): Money => {
  assertSame(a, b);
  return { minor: a.minor - b.minor, currency: a.currency };
};

/**
 * Har xil summadagi kotirovkalarni bir bazaga keltirish.
 * Taqqoslash faqat shundan keyin adolatli bo'ladi.
 */
export function normalizeTo(
  recv: bigint,
  sent: bigint,
  base: bigint = 1_000_000n,
): bigint {
  if (sent <= 0n) throw new Error('Yuborilgan summa musbat bo\'lishi kerak');
  return (recv * base) / sent;
}

/** Ko'rsatish uchun: 8_520_000n UZS -> "8 520 000" */
export function formatMinor(minor: bigint): string {
  const s = minor.toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Effektiv kurs, string Decimal sifatida (float saqlanmaydi) */
export function effectiveRate(recv: bigint, sent: bigint, dp = 10): string {
  if (sent <= 0n) return '0';
  const scale = 10n ** BigInt(dp);
  const scaled = (recv * scale) / sent;
  const int = scaled / scale;
  const frac = (scaled % scale).toString().padStart(dp, '0');
  return `${int}.${frac}`;
}
