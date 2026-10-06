import { normalizeTo, effectiveRate, formatMinor, addMoney, money } from './money';

describe('money', () => {
  it('normalizatsiya bazaga keltiradi', () => {
    expect(normalizeTo(4_270_000n, 500_000n)).toBe(8_540_000n);
    expect(normalizeTo(8_540_000n, 1_000_000n)).toBe(8_540_000n);
  });

  it('nol yoki manfiy yuborishda xato beradi', () => {
    expect(() => normalizeTo(1n, 0n)).toThrow();
  });

  it('effektiv kursni float\'siz hisoblaydi', () => {
    expect(effectiveRate(8_520_000n, 1_000_000n)).toBe('8.5200000000');
  });

  it('katta summani formatlaydi', () => {
    expect(formatMinor(8_540_000n)).toBe('8 540 000');
  });

  it('turli valyutalarni qo\'shishga yo\'l qo\'ymaydi', () => {
    expect(() => addMoney(money(1, 'KRW'), money(1, 'UZS'))).toThrow();
  });
});
