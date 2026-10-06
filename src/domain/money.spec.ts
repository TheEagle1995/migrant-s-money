import { normalizeTo, effectiveRate, addMoney, money, formatMoney, displayMoney } from './money';
import { toMinor } from './currency';

describe('normalizeTo', () => {
  it('bazaga keltiradi', () => {
    expect(normalizeTo(4_270_000n, 500_000n, 1_000_000n)).toBe(8_540_000n);
    expect(normalizeTo(8_540_000n, 1_000_000n, 1_000_000n)).toBe(8_540_000n);
  });

  it('Rossiya bazasida ham ishlaydi', () => {
    // 10 000 RUB uchun 1 500 000 so'm -> 50 000 RUB uchun 7 500 000
    const recv = toMinor(1_500_000, 'UZS');
    const sent = toMinor(10_000, 'RUB');
    const base = toMinor(50_000, 'RUB');
    expect(normalizeTo(recv, sent, base)).toBe(toMinor(7_500_000, 'UZS'));
  });

  it('nol yoki manfiy qiymatda xato beradi', () => {
    expect(() => normalizeTo(1n, 0n, 1n)).toThrow();
    expect(() => normalizeTo(1n, 1n, 0n)).toThrow();
  });
});

describe('effectiveRate — valyuta kasrlarini hisobga oladi', () => {
  it('KRW -> UZS kursini to\'g\'ri beradi', () => {
    // 1 000 000 KRW (kasrsiz) -> 8 520 000 so'm (ikki kasrli)
    const r = effectiveRate(toMinor(8_520_000, 'UZS'), toMinor(1_000_000, 'KRW'), 'KRW', 'UZS');
    expect(r).toBe('8.5200000000');
  });

  it('RUB -> UZS kursini to\'g\'ri beradi', () => {
    // Ikki valyuta ham ikki kasrli
    const r = effectiveRate(toMinor(7_500_000, 'UZS'), toMinor(50_000, 'RUB'), 'RUB', 'UZS');
    expect(r).toBe('150.0000000000');
  });

  it('USD -> UZS kursini to\'g\'ri beradi', () => {
    const r = effectiveRate(toMinor(12_034_000, 'UZS'), toMinor(1_000, 'USD'), 'USD', 'UZS');
    expect(r).toBe('12034.0000000000');
  });

  it('nol yuborishda nol qaytaradi', () => {
    expect(effectiveRate(1n, 0n, 'KRW', 'UZS')).toBe('0');
  });
});

describe('Money', () => {
  it('turli valyutalarni qo\'shishga yo\'l qo\'ymaydi', () => {
    expect(() => addMoney(money(1, 'KRW'), money(1, 'UZS'))).toThrow();
  });
  it('bir xil valyutani qo\'shadi', () => {
    expect(addMoney(money(100, 'UZS'), money(50, 'UZS')).minor).toBe(150n);
  });
  it('formatlaydi', () => {
    expect(formatMoney(money(854_000_000n, 'UZS'))).toBe('8 540 000');
    expect(displayMoney(money(854_000_000n, 'UZS'))).toBe("8 540 000 so'm");
  });
});
