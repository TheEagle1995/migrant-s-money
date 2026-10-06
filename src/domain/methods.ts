/**
 * Pul yuborish va olish usullari.
 *
 * Nega muhim: bir xil operator turli usullar uchun turli kurs beradi.
 * Naqd olish odatda kartaga tushirishdan qimmatroq, lekin qishloqda
 * karta ishlamasligi mumkin — ya'ni "eng yaxshi kurs" usuldan ajralmaydi.
 * Shuning uchun usul kotirovkaning bir qismi, qo'shimcha izoh emas.
 */

/** Qabul qiluvchi pulni QANDAY oladi */
export type PayoutMethod =
  | 'CARD'           // Uzcard / Humo / Visa kartaga
  | 'BANK_ACCOUNT'   // bank hisobiga
  | 'CASH_PICKUP'    // filialdan naqd
  | 'CASH_DELIVERY'  // uyga yetkazib berish
  | 'WALLET'         // Payme, Click, Alipay kabi hamyon
  | 'MOBILE_TOPUP';  // telefon hisobiga

/** Yuboruvchi pulni QANDAY to'laydi */
export type FundingMethod =
  | 'BANK_TRANSFER'  // bank o'tkazmasi
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'CASH_AGENT'     // agent/filialda naqd topshirish
  | 'WALLET_BALANCE' // ilova hamyonidagi qoldiq
  | 'APPLE_GOOGLE_PAY';

export const PAYOUT_LABELS: Record<PayoutMethod, string> = {
  CARD: 'Kartaga',
  BANK_ACCOUNT: 'Bank hisobiga',
  CASH_PICKUP: 'Filialdan naqd',
  CASH_DELIVERY: 'Uyga yetkazib berish',
  WALLET: 'Mobil hamyonga',
  MOBILE_TOPUP: 'Telefon hisobiga',
};

export const FUNDING_LABELS: Record<FundingMethod, string> = {
  BANK_TRANSFER: 'Bank o\'tkazmasi',
  DEBIT_CARD: 'Debet karta',
  CREDIT_CARD: 'Kredit karta',
  CASH_AGENT: 'Agentda naqd',
  WALLET_BALANCE: 'Ilova hamyoni',
  APPLE_GOOGLE_PAY: 'Apple / Google Pay',
};

/** Qisqa izoh — ilovada usul yonida ko'rsatiladi */
export const PAYOUT_NOTES: Record<PayoutMethod, string> = {
  CARD: 'Eng tez va odatda eng arzon',
  BANK_ACCOUNT: 'Katta summalar uchun qulay',
  CASH_PICKUP: 'Karta kerak emas, lekin filialga borish kerak',
  CASH_DELIVERY: 'Qishloq uchun qulay, komissiya yuqori',
  WALLET: 'Darhol tushadi, limit bo\'lishi mumkin',
  MOBILE_TOPUP: 'Faqat kichik summalar',
};

export const ALL_PAYOUTS: PayoutMethod[] = [
  'CARD', 'BANK_ACCOUNT', 'CASH_PICKUP', 'CASH_DELIVERY', 'WALLET', 'MOBILE_TOPUP',
];

export const ALL_FUNDING: FundingMethod[] = [
  'BANK_TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH_AGENT',
  'WALLET_BALANCE', 'APPLE_GOOGLE_PAY',
];

export const isPayoutMethod = (v: string): v is PayoutMethod =>
  (ALL_PAYOUTS as string[]).includes(v);

export const isFundingMethod = (v: string): v is FundingMethod =>
  (ALL_FUNDING as string[]).includes(v);
