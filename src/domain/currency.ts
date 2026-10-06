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
  | 'UZS' | 'KRW' | 'RUB' | 'KZT' | 'USD' | 'EUR' | 'TRY' | 'KGS' | 'TJS'
  | 'AED' | 'SAR' | 'QAR' | 'KWD' | 'ILS' | 'PLN' | 'CZK' | 'GBP' | 'JPY'
  | 'CNY' | 'MYR' | 'CAD' | 'AZN' | 'GEL' | 'BYN' | 'THB' | 'SEK';

export interface CurrencySpec {
  code: CurrencyCode;
  /** ISO 4217 ko'rsatkichi: minor unitdagi kasr raqamlari soni */
  minorDigits: number;
  symbol: string;
  nameUz: string;
  groupSeparator: ' ' | ',' | '.';
  decimalSeparator: ',' | '.';
  /**
   * 1 USD taxminan necha birlik. FAQAT sanity oraliqlarini va namunaviy
   * summani hisoblash uchun — bu kurs emas va hech qachon narx sifatida
   * ko'rsatilmaydi. Taxminiy 2026 qiymatlari.
   */
  perUsd: number;
}

/**
 * UZS rasmiy ravishda 2 kasrli (tiyin). Tiyin muomalada yo'q, lekin o'zbek
 * banklari SMS'da "1 250 000,00" shaklida yuboradi — shuning uchun 2 raqam
 * bilan ishlash parsing uchun ham to'g'riroq.
 */
export const CURRENCIES: Record<CurrencyCode, CurrencySpec> = {
  UZS: { code: 'UZS', minorDigits: 2, symbol: "so'm", nameUz: "so'm",             groupSeparator: ' ', decimalSeparator: ',', perUsd: 12034 },
  KRW: { code: 'KRW', minorDigits: 0, symbol: '₩',    nameUz: 'Koreya voni',      groupSeparator: ',', decimalSeparator: '.', perUsd: 1400 },
  RUB: { code: 'RUB', minorDigits: 2, symbol: '₽',    nameUz: 'Rossiya rubli',    groupSeparator: ' ', decimalSeparator: ',', perUsd: 80 },
  KZT: { code: 'KZT', minorDigits: 2, symbol: '₸',    nameUz: 'Qozoq tengesi',    groupSeparator: ' ', decimalSeparator: ',', perUsd: 500 },
  USD: { code: 'USD', minorDigits: 2, symbol: '$',    nameUz: 'AQSh dollari',     groupSeparator: ',', decimalSeparator: '.', perUsd: 1 },
  EUR: { code: 'EUR', minorDigits: 2, symbol: '€',    nameUz: 'Yevro',            groupSeparator: ' ', decimalSeparator: ',', perUsd: 0.92 },
  TRY: { code: 'TRY', minorDigits: 2, symbol: '₺',    nameUz: 'Turk lirasi',      groupSeparator: '.', decimalSeparator: ',', perUsd: 40 },
  KGS: { code: 'KGS', minorDigits: 2, symbol: 'som',  nameUz: "Qirg'iz somi",     groupSeparator: ' ', decimalSeparator: ',', perUsd: 87 },
  TJS: { code: 'TJS', minorDigits: 2, symbol: 'SM',   nameUz: 'Tojik somoniysi',  groupSeparator: ' ', decimalSeparator: ',', perUsd: 10.9 },
  AED: { code: 'AED', minorDigits: 2, symbol: 'AED',  nameUz: 'BAA dirhami',      groupSeparator: ',', decimalSeparator: '.', perUsd: 3.67 },
  SAR: { code: 'SAR', minorDigits: 2, symbol: 'SAR',  nameUz: 'Saudiya riyoli',   groupSeparator: ',', decimalSeparator: '.', perUsd: 3.75 },
  QAR: { code: 'QAR', minorDigits: 2, symbol: 'QAR',  nameUz: 'Qatar riyoli',     groupSeparator: ',', decimalSeparator: '.', perUsd: 3.64 },
  KWD: { code: 'KWD', minorDigits: 3, symbol: 'KWD',  nameUz: 'Kuvayt dinori',    groupSeparator: ',', decimalSeparator: '.', perUsd: 0.31 },
  ILS: { code: 'ILS', minorDigits: 2, symbol: '₪',    nameUz: 'Isroil shekeli',   groupSeparator: ',', decimalSeparator: '.', perUsd: 3.7 },
  PLN: { code: 'PLN', minorDigits: 2, symbol: 'zł',   nameUz: 'Polsha zlotiysi',  groupSeparator: ' ', decimalSeparator: ',', perUsd: 4 },
  CZK: { code: 'CZK', minorDigits: 2, symbol: 'Kč',   nameUz: 'Chex kronasi',     groupSeparator: ' ', decimalSeparator: ',', perUsd: 23 },
  GBP: { code: 'GBP', minorDigits: 2, symbol: '£',    nameUz: 'Funt sterling',    groupSeparator: ',', decimalSeparator: '.', perUsd: 0.79 },
  JPY: { code: 'JPY', minorDigits: 0, symbol: '¥',    nameUz: 'Yaponiya yeni',    groupSeparator: ',', decimalSeparator: '.', perUsd: 150 },
  CNY: { code: 'CNY', minorDigits: 2, symbol: '¥',    nameUz: 'Xitoy yuani',      groupSeparator: ',', decimalSeparator: '.', perUsd: 7.1 },
  MYR: { code: 'MYR', minorDigits: 2, symbol: 'RM',   nameUz: 'Malayziya ringgiti',groupSeparator: ',', decimalSeparator: '.', perUsd: 4.2 },
  CAD: { code: 'CAD', minorDigits: 2, symbol: 'C$',   nameUz: 'Kanada dollari',   groupSeparator: ',', decimalSeparator: '.', perUsd: 1.36 },
  AZN: { code: 'AZN', minorDigits: 2, symbol: '₼',    nameUz: 'Ozarbayjon manati',groupSeparator: ' ', decimalSeparator: ',', perUsd: 1.7 },
  GEL: { code: 'GEL', minorDigits: 2, symbol: '₾',    nameUz: 'Gruziya larisi',   groupSeparator: ' ', decimalSeparator: ',', perUsd: 2.7 },
  BYN: { code: 'BYN', minorDigits: 2, symbol: 'Br',   nameUz: 'Belarus rubli',    groupSeparator: ' ', decimalSeparator: ',', perUsd: 3.3 },
  THB: { code: 'THB', minorDigits: 2, symbol: '฿',    nameUz: 'Tailand bati',     groupSeparator: ',', decimalSeparator: '.', perUsd: 34 },
  SEK: { code: 'SEK', minorDigits: 2, symbol: 'kr',   nameUz: 'Shvetsiya kronasi',groupSeparator: ' ', decimalSeparator: ',', perUsd: 10.5 },
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

  let s = String(raw).trim().replace(/[\s  ']/g, '');
  if (s === '') return null;
  if (/[^\d.,]/.test(s)) return null;

  let intPart = s;
  let fracPart = '';
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const sepPos = Math.max(lastComma, lastDot);

  if (sepPos !== -1) {
    const sepChar = s[sepPos];
    const tail = s.slice(sepPos + 1);
    const headHasDigits = s.slice(0, sepPos).replace(/[.,]/g, '').length > 0;
    if (!/^\d+$/.test(tail) || !headHasDigits) return null;

    // Ajratgichni valyuta odati bo'yicha talqin qilamiz. Uzunlik bo'yicha
    // taxmin qilish yetarli emas: KWD da "1.250" — 250 fils, "1,250" — 1250
    // dinor, ikkisi ham uch raqamli dum.
    const isDecimalChar = sepChar === spec.decimalSeparator;
    const isGroupChar = sepChar === spec.groupSeparator;

    if (spec.minorDigits === 0) {
      // Kasrsiz valyuta. Dum 1-2 raqamli bo'lsa, bu minglik guruhi emas —
      // demak kasr yozilgan va bu parsing xatosi. Jimgina yaxlitlamaymiz.
      if (tail.length <= 2) return null;
    } else if (isDecimalChar && tail.length <= spec.minorDigits) {
      intPart = s.slice(0, sepPos);
      fracPart = tail;
    } else if (!isGroupChar && tail.length <= 2) {
      // Boshqa odatdagi ajratgich (masalan rus matnida nuqta) — kasr deb olamiz
      intPart = s.slice(0, sepPos);
      fracPart = tail;
    } else if (isDecimalChar && tail.length > spec.minorDigits) {
      // Kasr juda uzun: "100,1234" — ishonchsiz, rad etamiz
      if (tail.length !== 3) return null;
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
  const value = BigInt(intPart + frac);
  return value > 0n ? value : null;
}

/** Minor unitni o'qiladigan matnga: 854000000n, UZS -> "8 540 000" */
export function formatMinor(
  minor: bigint,
  code: CurrencyCode,
  opts: { decimals?: boolean } = {},
): string {
  const spec = currency(code);
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const factor = minorFactor(code);
  const whole = abs / factor;
  const frac = abs % factor;

  let out = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, spec.groupSeparator);

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

/** Major birliklardan minorga — test va seed uchun qulaylik */
export function toMinor(major: number | string, code: CurrencyCode): bigint {
  const spec = currency(code);
  const text = String(major).replace('.', spec.decimalSeparator);
  const parsed = parseMinor(text, code);
  if (parsed === null) throw new Error(`"${major}" ${code} uchun o'qilmadi`);
  return parsed;
}

/**
 * Taxminan 100 USD ga teng, "chiroyli" yumaloq summa.
 * Ilovada namunaviy qiymat sifatida ko'rsatiladi — foydalanuvchi uni
 * o'chirib o'z summasini kiritadi.
 */
export function niceSampleMinor(code: CurrencyCode, targetUsd = 100): bigint {
  const spec = currency(code);
  const raw = targetUsd * spec.perUsd;
  // 1, 2 yoki 5 × 10^n ko'rinishidagi eng yaqin qiymat
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const candidates = [base, base * 2, base * 5, base * 10];
  const nice = candidates.reduce((a, b) =>
    Math.abs(b - raw) < Math.abs(a - raw) ? b : a,
  );
  return BigInt(Math.round(nice)) * minorFactor(code);
}
