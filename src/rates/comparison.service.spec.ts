import { buildComparison, STALE_AFTER_MS } from './comparison.service';
import { Provider, Quote } from '../domain/types';

const NOW = new Date('2026-08-24T12:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000);

const provider = (slug: string, extra: Partial<Provider> = {}): Provider => ({
  id: `p-${slug}`, slug, displayName: slug.toUpperCase(), kind: 'SMALL_REMITTANCE',
  isLicensed: true, affiliateActive: false, isActive: true, ...extra,
});

const quote = (slug: string, recv: bigint, extra: Partial<Quote> = {}): Quote => ({
  id: 1n, providerId: `p-${slug}`, sendCurrency: 'KRW', recvCurrency: 'UZS',
  sendMinor: 1_000_000n, feeMinor: 0n, rate: '8.5', recvMinor: recv,
  recvBank: 'kapital', payoutMethod: 'CARD', etaMinutes: 120,
  isPromotional: false, fetchedAt: ago(1), source: 'MANUAL', ...extra,
});

describe('buildComparison', () => {
  it('faqat qo\'lga tekkan summa bo\'yicha tartiblaydi', () => {
    const r = buildComparison(
      [provider('a'), provider('b'), provider('c')],
      [quote('a', 8_300_000n), quote('b', 8_540_000n), quote('c', 8_460_000n)],
      NOW,
    );
    expect(r.rows.map((x) => x.providerSlug)).toEqual(['b', 'c', 'a']);
    expect(r.best!.providerSlug).toBe('b');
    expect(r.worst!.providerSlug).toBe('a');
  });

  it('affiliate provayderni yuqoriga ko\'tarmaydi', () => {
    const r = buildComparison(
      [provider('rich', { affiliateActive: true }), provider('poor')],
      [quote('rich', 8_100_000n), quote('poor', 8_500_000n)],
      NOW,
    );
    expect(r.rows[0].providerSlug).toBe('poor');
  });

  it('har xil yuborilgan summani 1 mln KRW ga normallashtiradi', () => {
    const r = buildComparison(
      [provider('a'), provider('b')],
      [
        quote('a', 4_270_000n, { sendMinor: 500_000n }), // = 8 540 000 / 1 mln
        quote('b', 8_500_000n),
      ],
      NOW,
    );
    expect(r.rows[0].providerSlug).toBe('a');
    expect(r.rows[0].recvPerMillionKrw).toBe(8_540_000n);
  });

  it('eskirgan kotirovkani o\'chirmaydi, belgilaydi', () => {
    const old = new Date(NOW.getTime() - STALE_AFTER_MS - 60_000);
    const r = buildComparison([provider('a')], [quote('a', 8_500_000n, { fetchedAt: old })], NOW);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].isStale).toBe(true);
    expect(r.rows[0].staleHours).toBeGreaterThanOrEqual(6);
  });

  it('3% dan katta farqda G\'OYA TIRIK deydi', () => {
    const r = buildComparison(
      [provider('a'), provider('b')],
      [quote('a', 8_540_000n), quote('b', 8_050_000n)],
      NOW,
    );
    expect(r.verdict).toBe('ALIVE');
    expect(r.spread).toBeCloseTo(0.0609, 3);
  });

  it('1% dan kichik farqda taqqoslashni o\'lik deb belgilaydi', () => {
    const r = buildComparison(
      [provider('a'), provider('b')],
      [quote('a', 8_540_000n), quote('b', 8_500_000n)],
      NOW,
    );
    expect(r.verdict).toBe('DEAD');
  });

  it('oraliq holatni MARGINAL deydi', () => {
    const r = buildComparison(
      [provider('a'), provider('b')],
      [quote('a', 8_540_000n), quote('b', 8_380_000n)],
      NOW,
    );
    expect(r.verdict).toBe('MARGINAL');
  });

  it('bitta kanal bo\'lsa qaror chiqarmaydi', () => {
    const r = buildComparison([provider('a')], [quote('a', 8_500_000n)], NOW);
    expect(r.verdict).toBe('INSUFFICIENT_DATA');
  });

  it('ma\'lumot yo\'q bo\'lsa yiqilmaydi', () => {
    const r = buildComparison([], [], NOW);
    expect(r.verdict).toBe('INSUFFICIENT_DATA');
    expect(r.best).toBeNull();
  });

  it('yillik yo\'qotishni 12 o\'tkazma bo\'yicha hisoblaydi', () => {
    const r = buildComparison(
      [provider('a'), provider('b')],
      [quote('a', 8_540_000n), quote('b', 8_050_000n)],
      NOW,
    );
    expect(r.annualLossMinor).toBe(5_880_000n);
  });

  it('noma\'lum provayderning kotirovkasini tashlab ketadi', () => {
    const r = buildComparison([provider('a')], [quote('a', 8_500_000n), quote('zzz', 9_000_000n)], NOW);
    expect(r.rows).toHaveLength(1);
  });
});
