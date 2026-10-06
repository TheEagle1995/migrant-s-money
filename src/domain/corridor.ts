/**
 * Koridor — "qaysi davlatdan qaysi davlatga".
 *
 * NIMA UCHUN KERAK: ilgari koridor kodda qattiq yozilgan edi (`'KRW'` va
 * `'UZS'` literal tiplar sifatida, 24 joyda), va uchta sozlama bitta
 * koridorga moslangan edi — boshqa koridorda jimgina buzilardi:
 *
 *   1. Taqqoslash bazasi 1 000 000 KRW — Rossiya uchun ma'nosiz raqam.
 *   2. Import tekshiruvi "kurs 4-20 oralig'ida" — RUB→UZS ≈ 150, ya'ni
 *      har bir to'g'ri qator rad etilardi.
 *   3. Ogohlantirish chegarasi 4-20 mln so'm — xuddi shu muammo.
 *
 * Endi koridorlar QO'LDA YOZILMAYDI. Juftliklar ro'yxatidan generatsiya
 * qilinadi, sanity oraliqlari esa valyutalarning taxminiy USD kursidan
 * hisoblanadi. Shu sababli yangi davlat qo'shish bitta qator.
 */

import { CurrencyCode, currency, niceSampleMinor, minorFactor } from './currency';

export type CountryCode =
  | 'UZ' | 'KR' | 'RU' | 'KZ' | 'KG' | 'TJ' | 'US' | 'TR' | 'AE' | 'SA'
  | 'QA' | 'KW' | 'IL' | 'PL' | 'CZ' | 'GB' | 'DE' | 'JP' | 'CN' | 'MY'
  | 'CA' | 'AZ' | 'GE' | 'BY' | 'TH' | 'SE' | 'LT' | 'LV' | 'IT' | 'FR';

export interface Country {
  code: CountryCode;
  nameUz: string;
  currency: CurrencyCode;
  flag: string;
}

export const COUNTRIES: Record<CountryCode, Country> = {
  UZ: { code: 'UZ', nameUz: "O'zbekiston",  currency: 'UZS', flag: '🇺🇿' },
  KR: { code: 'KR', nameUz: 'Koreya',       currency: 'KRW', flag: '🇰🇷' },
  RU: { code: 'RU', nameUz: 'Rossiya',      currency: 'RUB', flag: '🇷🇺' },
  KZ: { code: 'KZ', nameUz: "Qozog'iston",  currency: 'KZT', flag: '🇰🇿' },
  KG: { code: 'KG', nameUz: "Qirg'iziston", currency: 'KGS', flag: '🇰🇬' },
  TJ: { code: 'TJ', nameUz: 'Tojikiston',   currency: 'TJS', flag: '🇹🇯' },
  US: { code: 'US', nameUz: 'AQSh',         currency: 'USD', flag: '🇺🇸' },
  TR: { code: 'TR', nameUz: 'Turkiya',      currency: 'TRY', flag: '🇹🇷' },
  AE: { code: 'AE', nameUz: 'BAA',          currency: 'AED', flag: '🇦🇪' },
  SA: { code: 'SA', nameUz: 'Saudiya',      currency: 'SAR', flag: '🇸🇦' },
  QA: { code: 'QA', nameUz: 'Qatar',        currency: 'QAR', flag: '🇶🇦' },
  KW: { code: 'KW', nameUz: 'Kuvayt',       currency: 'KWD', flag: '🇰🇼' },
  IL: { code: 'IL', nameUz: 'Isroil',       currency: 'ILS', flag: '🇮🇱' },
  PL: { code: 'PL', nameUz: 'Polsha',       currency: 'PLN', flag: '🇵🇱' },
  CZ: { code: 'CZ', nameUz: 'Chexiya',      currency: 'CZK', flag: '🇨🇿' },
  GB: { code: 'GB', nameUz: 'Buyuk Britaniya', currency: 'GBP', flag: '🇬🇧' },
  DE: { code: 'DE', nameUz: 'Germaniya',    currency: 'EUR', flag: '🇩🇪' },
  IT: { code: 'IT', nameUz: 'Italiya',      currency: 'EUR', flag: '🇮🇹' },
  FR: { code: 'FR', nameUz: 'Fransiya',     currency: 'EUR', flag: '🇫🇷' },
  LT: { code: 'LT', nameUz: 'Litva',        currency: 'EUR', flag: '🇱🇹' },
  LV: { code: 'LV', nameUz: 'Latviya',      currency: 'EUR', flag: '🇱🇻' },
  JP: { code: 'JP', nameUz: 'Yaponiya',     currency: 'JPY', flag: '🇯🇵' },
  CN: { code: 'CN', nameUz: 'Xitoy',        currency: 'CNY', flag: '🇨🇳' },
  MY: { code: 'MY', nameUz: 'Malayziya',    currency: 'MYR', flag: '🇲🇾' },
  CA: { code: 'CA', nameUz: 'Kanada',       currency: 'CAD', flag: '🇨🇦' },
  AZ: { code: 'AZ', nameUz: 'Ozarbayjon',   currency: 'AZN', flag: '🇦🇿' },
  GE: { code: 'GE', nameUz: 'Gruziya',      currency: 'GEL', flag: '🇬🇪' },
  BY: { code: 'BY', nameUz: 'Belarus',      currency: 'BYN', flag: '🇧🇾' },
  TH: { code: 'TH', nameUz: 'Tailand',      currency: 'THB', flag: '🇹🇭' },
  SE: { code: 'SE', nameUz: 'Shvetsiya',    currency: 'SEK', flag: '🇸🇪' },
};

export interface Corridor {
  /** "KR-UZ" */
  id: string;
  send: CountryCode;
  recv: CountryCode;
  sendCurrency: CurrencyCode;
  recvCurrency: CurrencyCode;
  /**
   * Ilovada oldindan yozilgan namunaviy summa (~100 USD ekvivalenti).
   * Foydalanuvchi uni o'chirib o'z summasini kiritadi — taqqoslash
   * istalgan summa uchun qayta hisoblanadi.
   */
  sampleSendMinor: bigint;
  /**
   * Aqlga sig'adigan kurs oralig'i (major birliklarda: 1 send → N recv).
   * Bu kotirovka emas, faqat kiritish xatosini tutish uchun keng to'siq:
   * taxminiy kursning yarmidan ikki barobarigacha.
   */
  sanityRateMin: number;
  sanityRateMax: number;
  /** Faol koridormi — provayder va bank ma'lumoti yig'ilganmi */
  isLive: boolean;
}

/** Taxminiy o'rta kurs: 1 send birligi necha recv birligi */
export function approxRate(send: CurrencyCode, recv: CurrencyCode): number {
  return currency(recv).perUsd / currency(send).perUsd;
}

function build(send: CountryCode, recv: CountryCode, isLive: boolean): Corridor {
  const sendCurrency = COUNTRIES[send].currency;
  const recvCurrency = COUNTRIES[recv].currency;
  const mid = approxRate(sendCurrency, recvCurrency);
  return {
    id: `${send}-${recv}`,
    send,
    recv,
    sendCurrency,
    recvCurrency,
    sampleSendMinor: niceSampleMinor(sendCurrency),
    // Ataylab keng: tor to'siq to'g'ri qatorni rad etadi, keng to'siq esa
    // faqat birlik xatosini (ming barobar farq) tutadi.
    sanityRateMin: mid * 0.4,
    sanityRateMax: mid * 2.5,
    isLive,
  };
}

/**
 * Faol koridorlar — provayder ro'yxati va banklar ma'lum.
 * O'zbekistonga kiruvchi va O'zbekistondan chiquvchi, ikki tomonlama.
 */
const LIVE_SEND_TO_UZ: CountryCode[] = [
  'RU', 'KR', 'KZ', 'TR', 'US', 'AE', 'SA', 'QA', 'KW', 'IL',
  'PL', 'CZ', 'GB', 'DE', 'JP', 'KG', 'TJ', 'AZ', 'GE', 'MY',
  'IT', 'FR', 'CA', 'SE', 'LT', 'LV', 'CN',
];

/** O'zbekistondan chiqish — talabalar, biznes, oilaga qaytarish */
const LIVE_FROM_UZ: CountryCode[] = [
  'RU', 'KR', 'KZ', 'TR', 'US', 'AE', 'DE', 'GB', 'CN', 'JP',
];

/** O'zbekistonsiz, lekin mintaqada katta: Rossiya → Markaziy Osiyo */
const EXTRA_PAIRS: Array<[CountryCode, CountryCode, boolean]> = [
  ['RU', 'KG', true],
  ['RU', 'TJ', true],
  ['KZ', 'KG', true],
  ['KZ', 'TJ', false],
  ['KR', 'KG', false],
  ['TR', 'KG', false],
  ['RU', 'AZ', false],
  ['RU', 'BY', false],
  ['US', 'KG', false],
  ['US', 'TJ', false],
];

export const CORRIDORS: Corridor[] = [
  ...LIVE_SEND_TO_UZ.map((c) => build(c, 'UZ', true)),
  ...LIVE_FROM_UZ.map((c) => build('UZ', c, true)),
  ...EXTRA_PAIRS.map(([a, b, live]) => build(a, b, live)),
];

const BY_ID = new Map(CORRIDORS.map((c) => [c.id, c]));

export function findCorridor(id: string): Corridor | undefined {
  return BY_ID.get(id.toUpperCase());
}

export function corridorOf(send: CountryCode, recv: CountryCode): Corridor | undefined {
  return BY_ID.get(`${send}-${recv}`);
}

export const liveCorridors = (): Corridor[] => CORRIDORS.filter((c) => c.isLive);

/** Koridorning o'qiladigan nomi: "Koreya → O'zbekiston" */
export function corridorLabel(c: Corridor): string {
  return `${COUNTRIES[c.send].nameUz} → ${COUNTRIES[c.recv].nameUz}`;
}

/** Teskari koridor, agar mavjud bo'lsa */
export function reverseOf(c: Corridor): Corridor | undefined {
  return corridorOf(c.recv, c.send);
}

/** Yuborish mumkin bo'lgan davlatlar — ilovadagi tanlagich uchun */
export function sendCountries(): Country[] {
  const set = new Set(liveCorridors().map((c) => c.send));
  return [...set].map((c) => COUNTRIES[c]).sort((a, b) => a.nameUz.localeCompare(b.nameUz));
}

/** Tanlangan davlatdan qaysi davlatlarga yuborish mumkin */
export function recvCountriesFrom(send: CountryCode): Country[] {
  return liveCorridors()
    .filter((c) => c.send === send)
    .map((c) => COUNTRIES[c.recv])
    .sort((a, b) => a.nameUz.localeCompare(b.nameUz));
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
  minorFactorOf: (code: CurrencyCode) => bigint = minorFactor,
): { ok: boolean; rate: number } {
  const sendMajor = Number(sendMinor) / Number(minorFactorOf(c.sendCurrency));
  const recvMajor = Number(recvMinor) / Number(minorFactorOf(c.recvCurrency));
  const rate = sendMajor === 0 ? 0 : recvMajor / sendMajor;
  return { ok: rate >= c.sanityRateMin && rate <= c.sanityRateMax, rate };
}
