import {
  parseMinor, formatMinor, displayMinor, minorFactor, toMinor, currency,
} from './currency';

describe('parseMinor — valyuta kasrini hisobga oladi', () => {
  it('UZS da tiyinni saqlaydi', () => {
    expect(parseMinor('8 540 000,00', 'UZS')).toBe(854_000_000n);
    expect(parseMinor('8 540 000,50', 'UZS')).toBe(854_000_050n);
  });

  it('kasrsiz berilgan summani to\'ldiradi', () => {
    expect(parseMinor('8 540 000', 'UZS')).toBe(854_000_000n);
  });

  // ASOSIY TUZATISH: ilgari bu 1251 RUB bo'lib, 50 kopeyka yo'qolardi
  it('RUB kopeykasini yo\'qotmaydi', () => {
    expect(parseMinor('1 250,50', 'RUB')).toBe(125_050n);
    expect(parseMinor('1250,50', 'RUB')).toBe(125_050n);
    expect(parseMinor('50 000,00', 'RUB')).toBe(5_000_000n);
  });

  it('KRW da kasr bo\'lmaydi — kasrli matnni rad etadi', () => {
    expect(parseMinor('1 000 000', 'KRW')).toBe(1_000_000n);
    // Kasr kelgan bo'lsa, bu parsing xatosi. Jimgina yaxlitlamaymiz.
    expect(parseMinor('1 000 000,50', 'KRW')).toBeNull();
  });

  it('nuqtali minglik ajratgichni to\'g\'ri o\'qiydi (turk odati)', () => {
    expect(parseMinor('1.250.000,75', 'TRY')).toBe(125_000_075n);
  });

  it('vergulli minglik ajratgichni to\'g\'ri o\'qiydi (amerika odati)', () => {
    expect(parseMinor('1,250,000.75', 'USD')).toBe(125_000_075n);
  });

  it('bitta ajratgichni to\'g\'ri talqin qiladi', () => {
    // "1,250" — minglik ajratgich, kasr emas (3 raqam)
    expect(parseMinor('1,250', 'USD')).toBe(125_000n);
    // "1,25" — kasr (2 raqam)
    expect(parseMinor('1,25', 'RUB')).toBe(125n);
  });

  it('ajratgich ortida 3 raqam bo\'lsa — minglik, kasr emas', () => {
    // "100,123" rus yozuvida ikki xil o'qilishi mumkin, lekin vergul ortida
    // uch raqam bo'lishi minglik guruhlashga ishora qiladi: 100 123 rubl.
    expect(parseMinor('100,123', 'RUB')).toBe(10_012_300n);
  });

  it('nol, bo\'sh va axlatni rad etadi', () => {
    expect(parseMinor('0', 'UZS')).toBeNull();
    expect(parseMinor('', 'UZS')).toBeNull();
    expect(parseMinor('   ', 'UZS')).toBeNull();
    expect(parseMinor(null, 'UZS')).toBeNull();
    expect(parseMinor('abc', 'UZS')).toBeNull();
    expect(parseMinor('12abc', 'UZS')).toBeNull();
  });

  it('katta summada aniqlikni yo\'qotmaydi', () => {
    // Number orqali o'tsa bu yerda aniqlik buzilardi
    const huge = '99 999 999 999 999,99';
    expect(parseMinor(huge, 'UZS')).toBe(9_999_999_999_999_999n);
  });
});

describe('formatMinor', () => {
  it('UZS ni probel bilan guruhlaydi va butun bo\'lsa kasr ko\'rsatmaydi', () => {
    expect(formatMinor(854_000_000n, 'UZS')).toBe('8 540 000');
  });

  it('kasr nolga teng bo\'lmasa ko\'rsatadi', () => {
    expect(formatMinor(854_000_050n, 'UZS')).toBe('8 540 000,50');
  });

  it('KRW ni vergul bilan guruhlaydi', () => {
    expect(formatMinor(1_000_000n, 'KRW')).toBe('1,000,000');
  });

  it('RUB kopeykasini ko\'rsatadi', () => {
    expect(formatMinor(125_050n, 'RUB')).toBe('1 250,50');
  });

  it('kasrni majburan ko\'rsatish mumkin', () => {
    expect(formatMinor(854_000_000n, 'UZS', { decimals: true })).toBe('8 540 000,00');
  });

  it('kichik summani ham to\'g\'ri chiqaradi', () => {
    expect(formatMinor(5n, 'RUB')).toBe('0,05');
    expect(formatMinor(100n, 'KRW')).toBe('100');
  });

  it('manfiy summani belgilaydi', () => {
    expect(formatMinor(-125_050n, 'RUB')).toBe('-1 250,50');
  });
});

describe('displayMinor', () => {
  it('valyuta belgisini qo\'shadi', () => {
    expect(displayMinor(854_000_000n, 'UZS')).toBe("8 540 000 so'm");
    expect(displayMinor(1_000_000n, 'KRW')).toBe('1,000,000 ₩');
  });
});

describe('minorFactor', () => {
  it('kasr soniga mos koeffitsient beradi', () => {
    expect(minorFactor('KRW')).toBe(1n);
    expect(minorFactor('UZS')).toBe(100n);
    expect(minorFactor('RUB')).toBe(100n);
  });
});

describe('aylanma: parse -> format', () => {
  it('har bir valyuta uchun qiymat o\'zgarmaydi', () => {
    const cases: Array<[string, Parameters<typeof parseMinor>[1]]> = [
      ['8 540 000,50', 'UZS'],
      ['1 250,50', 'RUB'],
      ['1,000,000', 'KRW'],
      ['1.250.000,75', 'TRY'],
      ['1,250,000.75', 'USD'],
    ];
    for (const [text, code] of cases) {
      const minor = parseMinor(text, code)!;
      expect(minor).not.toBeNull();
      expect(parseMinor(formatMinor(minor, code, { decimals: true }), code)).toBe(minor);
    }
  });
});

describe('toMinor (seed va test qulayligi)', () => {
  it('major qiymatni minorga o\'tkazadi', () => {
    expect(toMinor(8_540_000, 'UZS')).toBe(854_000_000n);
    expect(toMinor(1_000_000, 'KRW')).toBe(1_000_000n);
  });
  it('noto\'g\'ri qiymatda xato beradi', () => {
    expect(() => toMinor('salom', 'UZS')).toThrow();
  });
});

describe('currency', () => {
  it('noma\'lum valyutada xato beradi', () => {
    expect(() => currency('XXX' as never)).toThrow(/Noma'lum valyuta/);
  });
});
