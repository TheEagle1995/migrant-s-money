import { evaluateAlerts, AlertSubscription } from './alerts.service';
import { buildComparison } from '../rates/comparison.service';
import { Provider, Quote } from '../domain/types';

const NOW = new Date('2026-08-24T12:00:00Z');
const providers: Provider[] = [
  { id: 'p1', slug: 'toss', displayName: 'Toss', kind: 'BANK_APP', isLicensed: true, affiliateActive: false, isActive: true },
  { id: 'p2', slug: 'sentbe', displayName: 'Sentbe', kind: 'SMALL_REMITTANCE', isLicensed: true, affiliateActive: false, isActive: true },
];
const q = (pid: string, recv: bigint, extra: Partial<Quote> = {}): Quote => ({
  id: 1n, providerId: pid, sendCurrency: 'KRW', recvCurrency: 'UZS',
  sendMinor: 1_000_000n, feeMinor: 0n, rate: '8.5', recvMinor: recv, recvBank: null,
  payoutMethod: 'CARD', etaMinutes: 60, isPromotional: false,
  fetchedAt: new Date(NOW.getTime() - 3600_000), source: 'MANUAL', ...extra,
});
const sub = (o: Partial<AlertSubscription> = {}): AlertSubscription => ({
  id: 's1', chatId: '111', thresholdMinor: 8_500_000n,
  providerSlug: null, lastFiredValueMinor: null, isActive: true, ...o,
});

describe('evaluateAlerts', () => {
  it('chegaradan oshganda xabar beradi', () => {
    const c = buildComparison(providers, [q('p1', 8_600_000n), q('p2', 8_200_000n)], NOW);
    const hits = evaluateAlerts([sub()], c);
    expect(hits).toHaveLength(1);
    expect(hits[0].providerSlug).toBe('toss');
    expect(hits[0].valueMinor).toBe(8_600_000n);
  });

  it('chegaraga yetmasa jim turadi', () => {
    const c = buildComparison(providers, [q('p1', 8_400_000n)], NOW);
    expect(evaluateAlerts([sub()], c)).toHaveLength(0);
  });

  it('eskirgan kotirovka asosida xabar yubormaydi', () => {
    const old = new Date(NOW.getTime() - 9 * 3600_000);
    const c = buildComparison(providers, [q('p1', 8_900_000n, { fetchedAt: old })], NOW);
    expect(evaluateAlerts([sub()], c)).toHaveLength(0);
  });

  it('promo narxga qarab ogohlantirmaydi', () => {
    const c = buildComparison(providers, [q('p1', 8_900_000n, { isPromotional: true })], NOW);
    expect(evaluateAlerts([sub()], c)).toHaveLength(0);
  });

  it('kanal tanlangan bo\'lsa faqat o\'shani kuzatadi', () => {
    const c = buildComparison(providers, [q('p1', 8_900_000n), q('p2', 8_600_000n)], NOW);
    const hits = evaluateAlerts([sub({ providerSlug: 'sentbe' })], c);
    expect(hits).toHaveLength(1);
    expect(hits[0].providerSlug).toBe('sentbe');
  });

  it('kurs sezilarli o\'smasa takror xabar yubormaydi', () => {
    const c = buildComparison(providers, [q('p1', 8_610_000n)], NOW);
    const hits = evaluateAlerts([sub({ lastFiredValueMinor: 8_600_000n })], c);
    expect(hits).toHaveLength(0); // atigi 0.12% o'sish
  });

  it('sezilarli o\'sganda qayta xabar beradi', () => {
    const c = buildComparison(providers, [q('p1', 8_700_000n)], NOW);
    const hits = evaluateAlerts([sub({ lastFiredValueMinor: 8_600_000n })], c);
    expect(hits).toHaveLength(1); // 1.16% o'sish
  });

  it('o\'chirilgan obunani e\'tiborsiz qoldiradi', () => {
    const c = buildComparison(providers, [q('p1', 9_000_000n)], NOW);
    expect(evaluateAlerts([sub({ isActive: false })], c)).toHaveLength(0);
  });

  it('bir nechta obunani mustaqil baholaydi', () => {
    const c = buildComparison(providers, [q('p1', 8_600_000n)], NOW);
    const hits = evaluateAlerts(
      [sub({ id: 's1', thresholdMinor: 8_500_000n }),
       sub({ id: 's2', chatId: '222', thresholdMinor: 8_700_000n })],
      c,
    );
    expect(hits.map((h) => h.subscription.id)).toEqual(['s1']);
  });
});
