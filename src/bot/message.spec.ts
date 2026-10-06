import { renderDailyPost } from './message';
import { buildComparison } from '../rates/comparison.service';
import { Provider, Quote } from '../domain/types';

const NOW = new Date('2026-08-24T12:00:00Z');
const p = (slug: string, name: string): Provider => ({
  id: `p-${slug}`, slug, displayName: name, kind: 'BANK_APP',
  isLicensed: true, affiliateActive: false, isActive: true,
});
const q = (slug: string, recv: bigint, extra: Partial<Quote> = {}): Quote => ({
  id: 1n, providerId: `p-${slug}`, sendCurrency: 'KRW', recvCurrency: 'UZS',
  sendMinor: 1_000_000n, feeMinor: 0n, rate: '8.5', recvMinor: recv, recvBank: null,
  payoutMethod: 'CARD', etaMinutes: 60, isPromotional: false,
  fetchedAt: new Date(NOW.getTime() - 3600_000), source: 'MANUAL', ...extra,
});

describe('renderDailyPost', () => {
  it('kanallarni tartibda va farq foizi bilan chiqaradi', () => {
    const r = buildComparison(
      [p('toss', 'Toss'), p('sentbe', 'Sentbe'), p('gme', 'GME')],
      [q('toss', 8_540_000n), q('sentbe', 8_465_000n), q('gme', 8_310_000n)],
      NOW,
    );
    const out = renderDailyPost(r, NOW);
    expect(out).toContain('🥇 *Toss* — 8 540 000');
    expect(out).toContain('🥈 *Sentbe*');
    expect(out.indexOf('Toss')).toBeLessThan(out.indexOf('GME'));
    expect(out).toContain('2.7%'); // GME farqi
    expect(out).toContain('Yiliga 12 o\'tkazmada');
  });

  it('promo va eskirgan belgilarni ko\'rsatadi', () => {
    const old = new Date(NOW.getTime() - 9 * 3600_000);
    const r = buildComparison(
      [p('a', 'A'), p('b', 'B')],
      [q('a', 8_500_000n, { isPromotional: true }), q('b', 8_100_000n, { fetchedAt: old })],
      NOW,
    );
    const out = renderDailyPost(r, NOW);
    expect(out).toContain('promo');
    expect(out).toContain('soat oldin');
  });

  it('ma\'lumot bo\'lmasa yiqilmaydi', () => {
    const r = buildComparison([], [], NOW);
    expect(renderDailyPost(r, NOW)).toContain("ma'lumot yig'ilmadi");
  });

  it('neytrallik izohini har doim qo\'shadi', () => {
    const r = buildComparison([p('a', 'A')], [q('a', 8_500_000n)], NOW);
    expect(renderDailyPost(r, NOW)).toContain('Reklama o\'rni sotilmaydi');
  });
});
