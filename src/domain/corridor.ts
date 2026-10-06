/**
 * Koridor — "qaysi davlatdan qaysi davlatga".
 *
 * NIMA UCHUN KERAK: ilgari koridor kodda qattiq yozilgan edi (`'KRW'` va
 * `'UZS'` literal tiplar sifatida, 24 joyda). Shu bilan birga uchta sozlama
 * ham bitta koridorga moslangan edi va boshqa koridorda jimgina buziladi:
 *
 *   1. Taqqoslash bazasi 1 000 000 KRW — Rossiya uchun ma'nosiz raqam.
 *   2. Import tekshiruvi "kurs 4-20 oralig'ida" — RUB→UZS ≈ 150, ya'ni
 *      har bir to'g'ri qator rad etilardi.
 *   3. Ogohlantirish chegarasi 4-20 mln so'm — xuddi shu muammo.
 *
 * Endi bu uchtasi koridorning o'zida yashaydi.
 */

import { CurrencyCode } from './currency';

export type CountryCode = 'KR' | 'RU' | 'KZ' | 'US' | 'TR' | 'UZ' | 'KG' | 'TJ' | 'AE' | 'PL';

export interface Country {
  code: CountryCode;
  nameUz: string;
  currency: CurrencyCode;
  flag: string;
}

export const COUNTRIES: Record<CountryCode, Country> = {
  KR: { code: 'KR', nameUz: 'Koreya',       currency: 'KRW', flag: '🇰🇷' },
  RU: { code: 'RU', nameUz: 'Rossiya',      currency: 'RUB', flag: '🇷🇺' },
  KZ: { code: 'KZ', nameUz: "Qozog'iston",  currency: 'KZT', flag: '🇰🇿' },
  US: { code: 'US', nameUz: 'AQSh',         currency: 'USD', flag: '🇺🇸' },
  TR: { code: 'TR', nameUz: 'Turkiya',      currency: 'TRY', flag: '🇹🇷' },
  AE: { code: 'AE', nameUz: 'BAA',          currency: 'AED', flag: '🇦🇪' },
  PL: { code: 'PL', nameUz: 'Polsha',       currency: 'PLN', flag: '🇵🇱' },
  UZ: { code: 'UZ', nameUz: "O'zbekiston",  currency: 'UZS', flag: '🇺🇿' },
  KG: { code: 'KG', nameUz: "Qirg'iziston", currency: 'KGS', flag: '🇰🇬' },
  TJ: { code: 'TJ', nameUz: 'Tojikiston',   currency: 'TJS', flag: '🇹🇯' },
};

export interface Corridor {
  /** "KR-UZ" */
  id: string;
  send: CountryCode;
  recv: CountryCode;
  sendCurrency: CurrencyCode;
  recvCurrency: CurrencyCode;
  /**
   * Taqqoslash uchun standart summa, minor unitda. Barcha kanallar shunga
   * keltiriladi — aks holda taqqoslash adolatli bo'lmaydi.
   * Odamlar odatda yuboradigan miqdorga yaqin bo'lsin.
   */
  baseSendMinor: bigint;
  /**
   * Aqlga sig'adigan kurs oralig'i (major birliklarda: 1 send → N recv).
   * Bu kotirovka emas, faqat kiritish xatosini tutish uchun keng to'siq.
   * Masalan so'm o'rniga ming so'm yozilsa, darhol ushlanadi.
   */
  sanityRateMin: number;
  sanityRateMax: number;
  /** Faol koridormi — yangi koridor avval o'lchanadi, keyin yoqiladi */
  isLive: boolean;
}

function corridor(
  send: CountryCode,
  recv: CountryCode,
  baseSendMinor: bigint,
  sanityRateMin: number,
  sanityRateMax: number,
  isLive = true,
): Corridor {
  return {
    id: `${send}-${recv}`,
    send,
    recv,
    sendCurrency: COUNTRIES[send].currency,
    recvCurrency: COUNTRIES[recv].currency,
    baseSendMinor,
    sanityRateMin,
    sanityRateMax,
    isLive,
  };
}

/**
 * Koridorlar. Oraliqlar ataylab keng — ular narx emas, xato to'sig'i.
 * Birinchi o'lchovlardan keyin toraytirish mumkin.
 */
export const CORRIDORS: Corridor[] = [
  // 1 000 000 KRW — Koreyada eng ko'p yuboriladigan summa
  corridor('KR', 'UZ', 1_000_000n, 4, 20),
  // 50 000 RUB
  corridor('RU', 'UZ', 5_000_000n, 60, 400),
  // 500 000 KZT
  corridor('KZ', 'UZ', 50_000_000n, 8, 60),
  // 1 000 USD
  corridor('US', 'UZ', 100_000n, 7_000, 20_000),
  // 10 000 TRY
  corridor('TR', 'UZ', 1_000_000n, 100, 900),
  // 5 000 AED
  corridor('AE', 'UZ', 500_000n, 1_800, 5_500),
  // 10 000 PLN
  corridor('PL', 'UZ', 1_000_000n, 1_500, 5_000, false),
  // Qirg'iziston va Tojikistonga ham migrantlar pul yuboradi
  corridor('RU', 'KG', 5_000_000n, 0.5, 3, false),
  corridor('RU', 'TJ', 5_000_000n, 0.05, 0.4, false),
  corridor('KR', 'KG', 1_000_000n, 0.03, 0.2, false),
];

const BY_ID = new Map(CORRIDORS.map((c) => [c.id, c]));

export function findCorridor(id: string): Corridor | undefined {
  return BY_ID.get(id);
}

export function corridorOf(send: CountryCode, recv: CountryCode): Corridor | undefined {
  return BY_ID.get(`${send}-${recv}`);
}

export const liveCorridors = (): Corridor[] => CORRIDORS.filter((c) => c.isLive);

/** Koridorning o'qiladigan nomi: "Koreya → O'zbekiston" */
export function corridorLabel(c: Corridor): string {
  return `${COUNTRIES[c.send].nameUz} → ${COUNTRIES[c.recv].nameUz}`;
}

/**
 * Kurs koridor uchun aqlga sig'adimi.
 * `sendMinor` va `recvMinor` — minor unitlarda, shuning uchun major
 * kursga o'tish uchun valyuta kasrlarini hisobga olamiz.
 */
export function rateLooksSane(
  c: Corridor,
  sendMinor: bigint,
  recvMinor: bigint,
  minorFactorOf: (code: CurrencyCode) => bigint,
): { ok: true; rate: number } | { ok: false; rate: number } {
  const sendMajor = Number(sendMinor) / Number(minorFactorOf(c.sendCurrency));
  const recvMajor = Number(recvMinor) / Number(minorFactorOf(c.recvCurrency));
  const rate = sendMajor === 0 ? 0 : recvMajor / sendMajor;
  const ok = rate >= c.sanityRateMin && rate <= c.sanityRateMax;
  return ok ? { ok: true, rate } : { ok: false, rate };
}
