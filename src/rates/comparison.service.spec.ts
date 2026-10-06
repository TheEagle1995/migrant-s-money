import { buildComparison, STALE_AFTER_MS } from './comparison.service';
import { provider, quote, KR_UZ, RU_UZ } from '../testing/fixtures';
import { toMinor } from '../domain/currency';

const NOW = new Date('2026-08-24T12:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000);

describe('buildComparison', () => {
  it('faqat qo\'lga tekkan summa bo\'yicha tartiblaydi', () => {
    const r = buildComparison(
      KR_UZ,
      [provider('a'), provider('b'), provider('c')],
      [
        quote('a', 8_300_000, { fetchedAt: ago(1) }),
        quote('b', 8_540_000, { fetchedAt: ago(1) }),
        quote('c', 8_460_000, { fetchedAt: ago(1) }),
      ],
      NOW,
    );
    expect(r.rows.map((x) => x.providerSlug)).toEqual(['b', 'c', 'a']);
    expect(r.best!.providerSlug).toBe('b');
    expect(r.worst!.providerSlug).toBe('a');
  });

  it('affiliate provayderni yuqoriga ko\'tarmaydi', () => {
    const r = buildComparison(
      KR_UZ,
      [provider('rich', { affiliateActive: true }), provider('poor')],
      [quote('rich', 8_100_000, { fetchedAt: ago(1) }), quote('poor', 8_500_000, { fetchedAt: ago(1) })],
      NOW,
    );
    expect(r.rows[0].providerSlug).toBe('poor');
  });

  it('har xil yuborilgan summani so\'ralgan summaga keltiradi', () => {
    const r = buildComparison(
      KR_UZ,
      [provider('a'), provider('b')],
      [
        // 500 000 KRW uchun 4 270 000 so'm = 1 mln uchun 8 540 000
        quote('a', 4_270_000, { sendMajor: 500_000, fetchedAt: ago(1) }),
        quote('b', 8_500_000, { sendMajor: 1_000_000, fetchedAt: ago(1) }),
      ],
      NOW,
      toMinor(1_000_000, 'KRW'),
    );
    expect(r.rows[0].providerSlug).toBe('a');
    expect(r.rows[0].recvNormalizedMinor).toBe(toMinor(8_540_000, 'UZS'));
  });

  it('foydalanuvchi kiritgan summa uchun qayta hisoblaydi', () => {
    const quotes = [
      quote('a', 8_540_000, { sendMajor: 1_000_000, fetchedAt: ago(1) }),
      quote('b', 8_100_000, { sendMajor: 1_000_000, fetchedAt: ago(1) }),
    ];
    const providers = [provider('a'), provider('b')];

    // 1 mln KRW uchun
    const one = buildComparison(KR_UZ, providers, quotes, NOW, toMinor(1_000_000, 'KRW'));
    expect(one.rows[0].recvNormalizedMinor).toBe(toMinor(8_540_000, 'UZS'));
    expect(one.isSample).toBe(false);

    // 2.5 mln KRW uchun — proporsional
    const big = buildComparison(KR_UZ, providers, quotes, NOW, toMinor(2_500_000, 'KRW'));
    expect(big.rows[0].recvNormalizedMinor).toBe(toMinor(21_350_000, 'UZS'));
    expect(big.amountSendFormatted).toBe('2,500,000');

    // Tartib o'zgarmaydi — summa hammaga bir xil ta'sir qiladi
    expect(big.rows.map((r) => r.providerSlug)).toEqual(one.rows.map((r) => r.providerSlug));
  });

  it('summa berilmasa namunaviy qiymatni ishlatadi va shunday belgilaydi', () => {
    const r = buildComparison(
      KR_UZ, [provider('a')],
      [quote('a', 854_000, { sendMajor: 100_000, fetchedAt: ago(1) })],
      NOW,
    );
    expect(r.isSample).toBe(true);
    expect(r.amountSendMinor).toBe(KR_UZ.sampleSendMinor);
  });

  it('nol yoki manfiy summani namunaviy qiymat bilan almashtiradi', () => {
    const r = buildComparison(
      KR_UZ, [provider('a')],
      [quote('a', 854_000, { sendMajor: 100_000, fetchedAt: ago(1) })],
      NOW, 0n,
    );
    expect(r.isSample).toBe(true);
  });

  it('boshqa koridorning kotirovkasini qo\'shmaydi', () => {
    const r = buildComparison(
      KR_UZ,
      [provider('korea'), provider('korona', { countries: ['RU'] })],
      [
        quote('korea', 8_540_000, { fetchedAt: ago(1) }),
        // Rossiya koridoridagi kotirovka Koreya ro'yxatida chiqmasligi kerak
        quote('korona', 7_500_000, { corridor: RU_UZ, fetchedAt: ago(1) }),
      ],
      NOW,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].providerSlug).toBe('korea');
  });

  it('eskirgan kotirovkani o\'chirmaydi, belgilaydi', () => {
    const old = new Date(NOW.getTime() - STALE_AFTER_MS - 60_000);
    const r = buildComparison(KR_UZ, [provider('a')], [quote('a', 8_500_000, { fetchedAt: old })], NOW);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].isStale).toBe(true);
    expect(r.rows[0].staleHours).toBeGreaterThanOrEqual(6);
  });

  it('3% dan katta farqda G\'OYA TIRIK deydi', () => {
    const r = buildComparison(
      KR_UZ, [provider('a'), provider('b')],
      [quote('a', 8_540_000, { fetchedAt: ago(1) }), quote('b', 8_050_000, { fetchedAt: ago(1) })],
      NOW,
    );
    expect(r.verdict).toBe('ALIVE');
    expect(r.spread).toBeCloseTo(0.0609, 3);
  });

  it('1% dan kichik farqda taqqoslashni o\'lik deb belgilaydi', () => {
    const r = buildComparison(
      KR_UZ, [provider('a'), provider('b')],
      [quote('a', 8_540_000, { fetchedAt: ago(1) }), quote('b', 8_500_000, { fetchedAt: ago(1) })],
      NOW,
    );
    expect(r.verdict).toBe('DEAD');
  });

  it('oraliq holatni MARGINAL deydi', () => {
    const r = buildComparison(
      KR_UZ, [provider('a'), provider('b')],
      [quote('a', 8_540_000, { fetchedAt: ago(1) }), quote('b', 8_380_000, { fetchedAt: ago(1) })],
      NOW,
    );
    expect(r.verdict).toBe('MARGINAL');
  });

  it('bitta kanal bo\'lsa qaror chiqarmaydi', () => {
    const r = buildComparison(KR_UZ, [provider('a')], [quote('a', 8_500_000, { fetchedAt: ago(1) })], NOW);
    expect(r.verdict).toBe('INSUFFICIENT_DATA');
  });

  it('ma\'lumot yo\'q bo\'lsa yiqilmaydi va koridorni baribir aytadi', () => {
    const r = buildComparison(KR_UZ, [], [], NOW);
    expect(r.verdict).toBe('INSUFFICIENT_DATA');
    expect(r.best).toBeNull();
    expect(r.corridorLabel).toBe("Koreya → O'zbekiston");
  });

  it('yillik yo\'qotishni 12 o\'tkazma bo\'yicha hisoblaydi', () => {
    const r = buildComparison(
      KR_UZ, [provider('a'), provider('b')],
      [quote('a', 8_540_000, { fetchedAt: ago(1) }), quote('b', 8_050_000, { fetchedAt: ago(1) })],
      NOW,
    );
    expect(r.annualLossMinor).toBe(toMinor(5_880_000, 'UZS'));
  });

  it('noma\'lum provayderning kotirovkasini tashlab ketadi', () => {
    const r = buildComparison(
      KR_UZ, [provider('a')],
      [quote('a', 8_500_000, { fetchedAt: ago(1) }), quote('zzz', 9_000_000, { fetchedAt: ago(1) })],
      NOW,
    );
    expect(r.rows).toHaveLength(1);
  });

  it('Rossiya koridorini o\'z valyutasi bilan hisoblaydi', () => {
    const r = buildComparison(
      RU_UZ,
      [provider('korona', { countries: ['RU'] }), provider('unistream', { countries: ['RU'] })],
      [
        // namunaviy 10 000 RUB -> 1 500 000 so'm
        quote('korona', 1_500_000, { corridor: RU_UZ, fetchedAt: ago(1) }),
        quote('unistream', 1_460_000, { corridor: RU_UZ, fetchedAt: ago(1) }),
      ],
      NOW,
    );
    expect(r.sendCurrency).toBe('RUB');
    expect(r.recvCurrency).toBe('UZS');
    expect(r.corridorLabel).toBe("Rossiya → O'zbekiston");
    expect(r.amountSendFormatted).toBe('10 000'); // ~100 USD ekvivalenti
    expect(r.rows[0].providerSlug).toBe('korona');
  });
});
