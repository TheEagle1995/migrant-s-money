import { renderDailyPost, renderMultiCorridorPost, renderAlert } from './message';
import { buildComparison } from '../rates/comparison.service';
import { provider, quote, KR_UZ, RU_UZ } from '../testing/fixtures';
import { toMinor } from '../domain/currency';

const NOW = new Date('2026-08-24T12:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000);

const korea = () => buildComparison(
  KR_UZ,
  [provider('toss', { displayName: 'Toss' }), provider('sentbe', { displayName: 'Sentbe' }), provider('gme', { displayName: 'GME' })],
  [
    quote('toss', 8_540_000, { fetchedAt: ago(1) }),
    quote('sentbe', 8_465_000, { fetchedAt: ago(1) }),
    quote('gme', 8_310_000, { fetchedAt: ago(1) }),
  ],
  NOW,
);

const russia = () => buildComparison(
  RU_UZ,
  [provider('korona', { displayName: 'Korona Pay', countries: ['RU'] }), provider('unistream', { displayName: 'Unistream', countries: ['RU'] })],
  [
    quote('korona', 1_500_000, { corridor: RU_UZ, fetchedAt: ago(1) }),
    quote('unistream', 1_460_000, { corridor: RU_UZ, fetchedAt: ago(1) }),
  ],
  NOW,
);

describe('renderDailyPost', () => {
  it('kanallarni tartibda va farq foizi bilan chiqaradi', () => {
    const out = renderDailyPost(korea(), NOW);
    expect(out).toContain('🥇 *Toss* — 8 540 000');
    expect(out).toContain('🥈 *Sentbe*');
    expect(out.indexOf('Toss')).toBeLessThan(out.indexOf('GME'));
    expect(out).toContain('2.7%');
  });

  it('koridorni sarlavhada aytadi', () => {
    const out = renderDailyPost(korea(), NOW);
    expect(out).toContain("Koreya → O'zbekiston");
    expect(out).toContain('🇰🇷🇺🇿');
    expect(out).toContain('100,000 ₩');
  });

  it('Rossiya koridorini o\'z valyutasi bilan chiqaradi', () => {
    const out = renderDailyPost(russia(), NOW);
    expect(out).toContain("Rossiya → O'zbekiston");
    expect(out).toContain('10 000 ₽');
    expect(out).toContain('🥇 *Korona Pay*');
  });

  it('promo va eskirgan belgilarni ko\'rsatadi', () => {
    const r = buildComparison(
      KR_UZ, [provider('a'), provider('b')],
      [
        quote('a', 8_500_000, { isPromotional: true, fetchedAt: ago(1) }),
        quote('b', 8_100_000, { fetchedAt: ago(9) }),
      ],
      NOW,
    );
    const out = renderDailyPost(r, NOW);
    expect(out).toContain('promo');
    expect(out).toContain('soat oldin');
  });

  it('ma\'lumot bo\'lmasa koridorni baribir aytadi', () => {
    const out = renderDailyPost(buildComparison(KR_UZ, [], [], NOW), NOW);
    expect(out).toContain("o'lchov kiritilmagan");
    expect(out).toContain("Koreya → O'zbekiston");
  });

  it('neytrallik izohini har doim qo\'shadi', () => {
    expect(renderDailyPost(korea(), NOW)).toContain("Reklama o'rni sotilmaydi");
  });
});

describe('renderMultiCorridorPost', () => {
  it('bir nechta koridorni bitta postda beradi', () => {
    const out = renderMultiCorridorPost([korea(), russia()], NOW);
    expect(out).toContain('🇰🇷🇺🇿');
    expect(out).toContain('🇷🇺🇺🇿');
    expect(out).toContain('Toss');
    expect(out).toContain('Korona Pay');
  });

  it('bo\'sh koridorlarni tashlab ketadi', () => {
    const out = renderMultiCorridorPost([korea(), buildComparison(RU_UZ, [], [], NOW)], NOW);
    expect(out).toContain('🇰🇷🇺🇿');
    expect(out).not.toContain('🇷🇺🇺🇿');
  });

  it('hech narsa bo\'lmasa yiqilmaydi', () => {
    expect(renderMultiCorridorPost([], NOW)).toContain("ma'lumot yig'ilmadi");
  });
});

describe('renderAlert', () => {
  it('koridorni va summani ko\'rsatadi', () => {
    const out = renderAlert('Toss', toMinor(8_600_000, 'UZS'), toMinor(8_500_000, 'UZS'), 'KR-UZ');
    expect(out).toContain('Toss');
    expect(out).toContain('8 600 000');
    expect(out).toContain('KR-UZ');
  });
});
