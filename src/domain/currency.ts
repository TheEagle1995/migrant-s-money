/**
 * Valyuta registri.
 *
 * NIMA UCHUN KERAK: ilgari butun kod har bir valyutani kasrsiz deb hisoblardi
 * (`BigInt(Math.round(n))`). KRW va amalda UZS uchun bu ishlaydi, lekin Rossiya
 * koridorini qo'shgan zahoti buziladi: 1250,50 RUB → 1251 RUB bo'lib qoladi va
 * kopeyka jimgina yo'qoladi. Byudjet ilovasida bu eng yomon turdagi xato —
 * foydalanuvchi sezmaydi, lekin hisob asta-sekin chalkashadi.
 *
 * Shuning uchun har bir valyuta o'z `minorDigits` qiymati bilan saqlanadi va
 * barcha arifmetika shu orqali o'tadi. ISO 4217 ko'rsatkichlari ishlatiladi.
 */

export type CurrencyCode =
  | 'UZS' | 'KRW' | 'RUB' | 'KZT' | 'USD' | 'TRY' | 'KGS' | 'TJS' | 'AED' | 'PLN';

export interface CurrencySpec {
  code: CurrencyCode;
  /** ISO 4217 ko'rsatkichi: minor unitdagi kasr raqamlari soni */
  minorDigits: number;
  /** Ko'rsatish uchun belgi yoki qisqartma */
  symbol: string;
  /** Mahalliy nomi — ilovada shu ko'rinadi */
  nameUz: string;
  /** Minglik ajratgich odati: probel, vergul yoki nuqta (turk odati) */
  groupSeparator: ' ' | ',' | '.';
  /** O'nlik ajratgich odati */
  decimalSeparator: ',' | '.';
}

/**
 * UZS rasmiy ravishda 2 kasrli (tiyin). Tiyin muomalada yo'q, lekin o'zbek
 * banklari SMS'da "1 250 000,00" shaklida yuboradi — shuning uchun 2 raqam
 * bilan ishlash parsing uchun ham to'g'riroq.
 */
export const CURRENCIES: Record<CurrencyCode, CurrencySpec> = {
  UZS: { code: 'UZS', minorDigits: 2, symbol: "so'm", nameUz: "so'm",            groupSeparator: ' ', decimalSeparator: ',' },
  KRW: { code: 'KRW', minorDigits: 0, symbol: '₩',     nameUz: 'Koreya voni',    groupSeparator: ',', decimalSeparator: '.' },
  RUB: { code: 'RUB', minorDigits: 2, symbol: '₽',     nameUz: 'Rossiya rubli',  groupSeparator: ' ', decimalSeparator: ',' },
  KZT: { code: 'KZT', minorDigits: 2, symbol: '₸',     nameUz: 'Qozoq tengesi',  groupSeparator: ' ', decimalSeparator: ',' },
  USD: { code: 'USD', minorDigits: 2, symbol: '$',     nameUz: 'AQSh dollari',   groupSeparator: ',', decimalSeparator: '.' },
  TRY: { code: 'TRY', minorDigits: 2, symbol: '₺',     nameUz: 'Turk lirasi',    groupSeparator: '.', decimalSeparator: ',' },
  KGS: { code: 'KGS', minorDigits: 2, symbol: 'som',   nameUz: "Qirg'iz somi",   groupSeparator: ' ', decimalSeparator: ',' },
  TJS: { code: 'TJS', minorDigits: 2, symbol: 'SM',    nameUz: 'Tojik somoniysi',groupSeparator: ' ', decimalSeparator: ',' },
  AED: { code: 'AED', minorDigits: 2, symbol: 'AED',   nameUz: 'BAA dirhami',    groupSeparator: ',', decimalSeparator: '.' },
  PLN: { code: 'PLN', minorDigits: 2, symbol: 'zł',    nameUz: 'Polsha zlotiysi',groupSeparator: ' ', decimalSeparator: ',' },
};

export function currency(code: CurrencyCode): CurrencySpec {
  const spec = CURRENCIES[code];
  if (!spec) throw new Error(`Noma'lum valyuta: ${code}`);
  return spec;
}

export const isCurrencyCode = (v: string): v is CurrencyCode =>
  Object.prototype.hasOwnProperty.call(CURRENCIES, v);

/** 10^minorDigits — major birlikdan minorga o'tish koeffitsienti */
export function minorFactor(code: CurrencyCode): bigint {
  return 10n ** BigInt(currency(code).minorDigits);
}

/**
 * Matndan minor unit o'qish. Valyuta kasrini HISOBGA OLADI.
 *
 *   parseMinor('1 250,50', 'RUB') -> 125050n   (kopeyka saqlanadi)
 *   parseMinor('1 250,50', 'KRW') -> null      (KRW da kasr bo'lmaydi)
 *   parseMinor('8 540 000', 'UZS') -> 854000000n
 *
 * Float orqali o'tmaydi: katta summalarda `Number` aniqlikni yo'qotadi, shuning
 * uchun butun va kasr qismlar alohida, satr sifatida ishlanadi.
 */
export function parseMinor(raw: string | undefined | null, code: CurrencyCode): bigint | null {
  if (raw === undefined || raw === null) return null;
  const spec = currency(code);

  // Probel, uzilmas probel, apostrof — minglik ajratgichlari
  let s = String(raw).trim().replace(/[\s  ']/g, '');
  if (s === '') return null;
  if (/[^\d.,]/.test(s)) return null;

  // Qaysi belgi o'nlik ajratgich ekanini aniqlaymiz: oxirgi uchragan va
  // undan keyin 1-2 raqam bo'lgani.
  let intPart = s;
  let fracPart = '';
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const sepPos = Math.max(lastComma, lastDot);

  if (sepPos !== -1) {
    const tail = s.slice(sepPos + 1);
    const looksDecimal = /^\d{1,2}$/.test(tail) && s.slice(0, sepPos).replace(/[.,]/g, '').length > 0;
    if (looksDecimal) {
      intPart = s.slice(0, sepPos);
      fracPart = tail;
    }
  }

  intPart = intPart.replace(/[.,]/g, '');
  if (!/^\d+$/.test(intPart)) return null;

  if (fracPart !== '') {
    // Kasr berilgan, lekin valyutada kasr yo'q — bu parsing xatosi,
    // jimgina yaxlitlamaymiz.
    if (spec.minorDigits === 0) return null;
    if (fracPart.length > spec.minorDigits) return null;
  }

  const frac = fracPart.padEnd(spec.minorDigits, '0');
  const combined = intPart + frac;
  const value = BigInt(combined);
  return value > 0n ? value : null;
}

/** Minor unitni o'qiladigan matnga: 854000000n, UZS -> "8 540 000" */
export function formatMinor(minor: bigint, code: CurrencyCode, opts: { decimals?: boolean } = {}): string {
  const spec = currency(code);
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const factor = minorFactor(code);
  const whole = abs / factor;
  const frac = abs % factor;

  let out = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, spec.groupSeparator);

  // Kasr qismni faqat so'ralganda yoki nolga teng bo'lmaganda ko'rsatamiz —
  // "8 540 000,00 so'm" ekranni keraksiz to'ldiradi.
  const showDecimals = opts.decimals ?? frac !== 0n;
  if (spec.minorDigits > 0 && showDecimals) {
    out += spec.decimalSeparator + frac.toString().padStart(spec.minorDigits, '0');
  }
  return (neg ? '-' : '') + out;
}

/** To'liq ko'rsatish: "8 540 000 so'm" */
export function displayMinor(minor: bigint, code: CurrencyCode): string {
  return `${formatMinor(minor, code)} ${currency(code).symbol}`;
}

/** Major birliklardan minorga — faqat test va seed uchun qulaylik */
export function toMinor(major: number | string, code: CurrencyCode): bigint {
  const parsed = parseMinor(String(major).replace('.', currency(code).decimalSeparator), code);
  if (parsed === null) throw new Error(`"${major}" ${code} uchun o'qilmadi`);
  return parsed;
}
