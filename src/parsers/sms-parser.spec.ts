import { SmsParser, parseAmount, ParserTemplate } from './sms-parser';

const kapital: ParserTemplate = {
  bankSlug: 'kapital',
  version: 2,
  pattern:
    "(?<card>\\d{4})\\s*[:.]?\\s*(?<kind>Popolnenie|Oplata|Snyatie)\\s*[:.]?\\s*(?<amt>[\\d\\s.,]+)\\s*(?:UZS|sum)",
  amountGroup: 'amt',
  decimalSeparator: ',',
  kindMap: { popolnenie: 'CREDIT', oplata: 'DEBIT', snyatie: 'DEBIT' },
};
const older: ParserTemplate = { ...kapital, version: 1, pattern: "(?<kind>Popolnenie)\\s+(?<amt>[\\d\\s]+)\\s*sum" };

const AT = new Date('2026-08-24T09:30:00Z');

describe('SmsParser', () => {
  const parser = new SmsParser([kapital, older]);

  it('kirim SMS ni to\'g\'ri o\'qiydi', () => {
    const r = parser.parse('KAPITALBANK', '8712 Popolnenie: 8 540 000,00 UZS', AT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.amountMinor).toBe(8_540_000n);
      expect(r.value.kind).toBe('CREDIT');
      expect(r.value.cardLast4).toBe('8712');
      expect(r.value.confidence).toBeGreaterThan(0.9);
      expect(r.value.parserVersion).toBe(2);
    }
  });

  it('chiqim SMS ni DEBIT deb belgilaydi', () => {
    const r = parser.parse('KAPITALBANK', '8712 Oplata 125 000,00 UZS', AT);
    expect(r.ok && r.value.kind).toBe('DEBIT');
  });

  it('eski shablon ishlasa ishonchni pasaytiradi', () => {
    const r = parser.parse('KAPITALBANK', 'Popolnenie 500 000 sum', AT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.parserVersion).toBe(1);
      expect(r.value.confidence).toBeLessThan(0.8); // -> foydalanuvchidan tasdiq so'raladi
    }
  });

  it('noma\'lum jo\'natuvchini rad etadi', () => {
    const r = parser.parse('SPAM-SENDER', 'Popolnenie 1 000 000 UZS', AT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reason).toBe('NO_TEMPLATE');
  });

  it('mos kelmagan matnni NO_MATCH deydi', () => {
    const r = parser.parse('KAPITALBANK', 'Vash kod podtverzhdeniya: 4821', AT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reason).toBe('NO_MATCH');
  });

  it('yangi shablon yuklanganda darhol ishlatadi', () => {
    const p = new SmsParser([]);
    expect(p.parse('KAPITALBANK', '8712 Popolnenie: 1 000 UZS', AT).ok).toBe(false);
    p.update([kapital]);
    expect(p.parse('KAPITALBANK', '8712 Popolnenie: 1 000 UZS', AT).ok).toBe(true);
  });
});

describe('parseAmount', () => {
  it('vergul o\'nlik ajratgichini o\'qiydi', () => {
    expect(parseAmount('8 540 000,00', ',')).toBe(8_540_000n);
    expect(parseAmount('1.250.000,50', ',')).toBe(1_250_001n); // yaxlitlanadi
  });
  it('nuqta o\'nlik ajratgichini o\'qiydi', () => {
    expect(parseAmount('8,540,000.00', '.')).toBe(8_540_000n);
  });
  it('nol va manfiyni rad etadi', () => {
    expect(parseAmount('0', ',')).toBeNull();
    expect(parseAmount(undefined, ',')).toBeNull();
  });
});
