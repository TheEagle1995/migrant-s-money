import { evaluateAlerts, AlertSubscription, thresholdBounds } from './alerts.service';
import { buildComparison } from '../rates/comparison.service';
import { provider, quote, KR_UZ, RU_UZ } from '../testing/fixtures';
import { toMinor } from '../domain/currency';

const NOW = new Date('2026-08-24T12:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000);

const providers = [
  provider('toss', { displayName: 'Toss', kind: 'BANK_APP' }),
  provider('sentbe', { displayName: 'Sentbe' }),
];

const compare = (tossMajor: number, sentbeMajor?: number, extra = {}) =>
  buildComparison(
    KR_UZ, providers,
    [
      quote('toss', tossMajor, { fetchedAt: ago(1), ...extra }),
      ...(sentbeMajor ? [quote('sentbe', sentbeMajor, { fetchedAt: ago(1) })] : []),
    ],
    NOW,
  );

const sub = (o: Partial<AlertSubscription> = {}): AlertSubscription => ({
  id: 's1', chatId: '111', corridorId: 'KR-UZ',
  thresholdMinor: toMinor(8_500_000, 'UZS'),
  providerSlug: null, lastFiredValueMinor: null, isActive: true, ...o,
});

describe('evaluateAlerts', () => {
  it('chegaradan oshganda xabar beradi', () => {
    const hits = evaluateAlerts([sub()], compare(8_600_000, 8_200_000));
    expect(hits).toHaveLength(1);
    expect(hits[0].providerSlug).toBe('toss');
    expect(hits[0].corridorId).toBe('KR-UZ');
  });

  it('chegaraga yetmasa jim turadi', () => {
    expect(evaluateAlerts([sub()], compare(8_400_000))).toHaveLength(0);
  });

  it('eskirgan kotirovka asosida xabar yubormaydi', () => {
    const c = buildComparison(KR_UZ, providers, [quote('toss', 8_900_000, { fetchedAt: ago(9) })], NOW);
    expect(evaluateAlerts([sub()], c)).toHaveLength(0);
  });

  it('promo narxga qarab ogohlantirmaydi', () => {
    expect(evaluateAlerts([sub()], compare(8_900_000, undefined, { isPromotional: true }))).toHaveLength(0);
  });

  it('kanal tanlangan bo\'lsa faqat o\'shani kuzatadi', () => {
    const hits = evaluateAlerts([sub({ providerSlug: 'sentbe' })], compare(8_900_000, 8_600_000));
    expect(hits).toHaveLength(1);
    expect(hits[0].providerSlug).toBe('sentbe');
  });

  it('kurs sezilarli o\'smasa takror xabar yubormaydi', () => {
    const hits = evaluateAlerts(
      [sub({ lastFiredValueMinor: toMinor(8_600_000, 'UZS') })],
      compare(8_610_000),
    );
    expect(hits).toHaveLength(0); // 0.12% o'sish
  });

  it('sezilarli o\'sganda qayta xabar beradi', () => {
    const hits = evaluateAlerts(
      [sub({ lastFiredValueMinor: toMinor(8_600_000, 'UZS') })],
      compare(8_700_000),
    );
    expect(hits).toHaveLength(1); // 1.16% o'sish
  });

  it('o\'chirilgan obunani e\'tiborsiz qoldiradi', () => {
    expect(evaluateAlerts([sub({ isActive: false })], compare(9_000_000))).toHaveLength(0);
  });

  it('bir nechta obunani mustaqil baholaydi', () => {
    const hits = evaluateAlerts(
      [sub({ id: 's1', thresholdMinor: toMinor(8_500_000, 'UZS') }),
       sub({ id: 's2', chatId: '222', thresholdMinor: toMinor(8_700_000, 'UZS') })],
      compare(8_600_000),
    );
    expect(hits.map((h) => h.subscription.id)).toEqual(['s1']);
  });
});

describe('thresholdBounds — koridordan hisoblanadi', () => {
  it('Koreya koridori uchun so\'mda oraliq beradi', () => {
    const b = thresholdBounds('KR-UZ')!;
    // 1 mln KRW x 4..20 so'm
    expect(b.min).toBe(toMinor(4_000_000, 'UZS'));
    expect(b.max).toBe(toMinor(20_000_000, 'UZS'));
  });

  // ASOSIY TUZATISH: ilgari oraliq 4-20 mln so'm deb qattiq yozilgan edi,
  // ya'ni Rossiya koridorining to'g'ri chegarasi ham rad etilardi.
  it('Rossiya koridori uchun boshqa oraliq beradi', () => {
    const b = thresholdBounds('RU-UZ')!;
    // 50 000 RUB x 60..400 so'm
    expect(b.min).toBe(toMinor(3_000_000, 'UZS'));
    expect(b.max).toBe(toMinor(20_000_000, 'UZS'));
    expect(b.min).not.toBe(thresholdBounds('KR-UZ')!.min);
  });

  it('noma\'lum koridorda null', () => {
    expect(thresholdBounds('XX-YY')).toBeNull();
  });
});

describe('koridorlar aralashmaydi', () => {
  it('Rossiya obunasi Koreya taqqoslashida ishlamaydi', () => {
    const ruSub = sub({ corridorId: 'RU-UZ', thresholdMinor: toMinor(7_000_000, 'UZS') });
    // evaluateAlerts koridorni filtrlamaydi — bu `AlertsService.due` ning ishi,
    // lekin natijada koridor ID to'g'ri yozilishi kerak
    const hits = evaluateAlerts([ruSub], compare(8_600_000));
    expect(hits[0]?.corridorId).toBe('KR-UZ');
  });

  it('Rossiya koridorida ham ishlaydi', () => {
    const c = buildComparison(
      RU_UZ,
      [provider('korona', { displayName: 'Korona Pay', countries: ['RU'] })],
      [quote('korona', 7_500_000, { corridor: RU_UZ, fetchedAt: ago(1) })],
      NOW,
    );
    const hits = evaluateAlerts(
      [sub({ corridorId: 'RU-UZ', thresholdMinor: toMinor(7_000_000, 'UZS') })],
      c,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].displayName).toBe('Korona Pay');
  });
});
