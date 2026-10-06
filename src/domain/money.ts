/**
 * Pul arifmetikasi.
 *
 * Formatlash va matndan o'qish `currency.ts` ga ko'chdi, chunki ular valyuta
 * kasrini bilishi kerak. Bu yerda faqat valyutadan mustaqil amallar qoldi:
 * normallashtirish va kurs hisobi — ikkalasi ham minor unitlar ustida ishlaydi.
 */

import { CurrencyCode, currency, formatMinor as fmt, displayMinor } from './currency';

export interface Money {
  readonly minor: bigint;
  readonly currency: CurrencyCode;
}

export const money = (minor: bigint | number, code: CurrencyCode): Money => ({
  minor: typeof minor === 'number' ? BigInt(Math.round(minor)) : minor,
  currency: code,
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

export const formatMoney = (m: Money): string => fmt(m.minor, m.currency);
export const displayMoney = (m: Money): string => displayMinor(m.minor, m.currency);

/**
 * Har xil summadagi kotirovkalarni bitta bazaga keltirish — taqqoslash faqat
 * shundan keyin adolatli bo'ladi. Baza koridordan keladi (`Corridor.baseSendMinor`),
 * bu yerda qattiq yozilmaydi.
 */
export function normalizeTo(recvMinor: bigint, sentMinor: bigint, baseSendMinor: bigint): bigint {
  if (sentMinor <= 0n) throw new Error("Yuborilgan summa musbat bo'lishi kerak");
  if (baseSendMinor <= 0n) throw new Error("Baza summa musbat bo'lishi kerak");
  return (recvMinor * baseSendMinor) / sentMinor;
}

/**
 * Effektiv kurs — major birliklarda, satr sifatida (float saqlanmaydi).
 * Valyuta kasrlari hisobga olinadi: KRW kasrsiz, UZS ikki kasrli, shuning
 * uchun xom minor nisbatini olish 100 barobar xato beradi.
 */
export function effectiveRate(
  recvMinor: bigint,
  sentMinor: bigint,
  sendCode: CurrencyCode,
  recvCode: CurrencyCode,
  dp = 10,
): string {
  if (sentMinor <= 0n) return '0';
  const sendDigits = currency(sendCode).minorDigits;
  const recvDigits = currency(recvCode).minorDigits;

  // rate = (recvMinor / 10^recvDigits) / (sendMinor / 10^sendDigits)
  //      = recvMinor * 10^sendDigits / (sendMinor * 10^recvDigits)
  const scale = 10n ** BigInt(dp);
  const numerator = recvMinor * 10n ** BigInt(sendDigits) * scale;
  const denominator = sentMinor * 10n ** BigInt(recvDigits);
  const scaled = numerator / denominator;

  const int = scaled / scale;
  const frac = (scaled % scale).toString().padStart(dp, '0');
  return `${int}.${frac}`;
}
