/**
 * Test fixtura'lari. Bir joyda, chunki koridor qo'shilgandan keyin har bir
 * spec faylda bir xil obyektlarni qo'lda qurish takrorga aylanadi.
 */

import { Provider, Quote, ProviderKind } from '../domain/types';
import { CountryCode, findCorridor } from '../domain/corridor';
import { toMinor } from '../domain/currency';

export const KR_UZ = findCorridor('KR-UZ')!;
export const RU_UZ = findCorridor('RU-UZ')!;

export function provider(
  slug: string,
  opts: Partial<Provider> & { kind?: ProviderKind; countries?: CountryCode[] } = {},
): Provider {
  return {
    id: opts.id ?? `p-${slug}`,
    slug,
    displayName: opts.displayName ?? slug.toUpperCase(),
    kind: opts.kind ?? 'SMALL_REMITTANCE',
    sendCountries: opts.countries ?? ['KR'],
    isLicensed: opts.isLicensed ?? true,
    affiliateActive: opts.affiliateActive ?? false,
    isActive: opts.isActive ?? true,
  };
}

/**
 * Kotirovka. `recvMajor` qulaylik uchun major birlikda beriladi
 * (8_540_000 so'm), ichida minorga aylantiriladi.
 */
export function quote(
  slug: string,
  recvMajor: number,
  opts: Partial<Quote> & { corridor?: typeof KR_UZ; sendMajor?: number } = {},
): Quote {
  const c = opts.corridor ?? KR_UZ;
  const sendMinor =
    opts.sendMinor ??
    (opts.sendMajor !== undefined ? toMinor(opts.sendMajor, c.sendCurrency) : c.baseSendMinor);
  return {
    id: opts.id ?? 1n,
    providerId: opts.providerId ?? `p-${slug}`,
    corridorId: opts.corridorId ?? c.id,
    sendCurrency: c.sendCurrency,
    recvCurrency: c.recvCurrency,
    sendMinor,
    feeMinor: opts.feeMinor ?? 0n,
    rate: opts.rate ?? '8.5',
    recvMinor: opts.recvMinor ?? toMinor(recvMajor, c.recvCurrency),
    recvBank: opts.recvBank ?? null,
    payoutMethod: opts.payoutMethod ?? 'CARD',
    etaMinutes: opts.etaMinutes ?? 120,
    isPromotional: opts.isPromotional ?? false,
    fetchedAt: opts.fetchedAt ?? new Date(),
    source: opts.source ?? 'MANUAL',
  };
}
