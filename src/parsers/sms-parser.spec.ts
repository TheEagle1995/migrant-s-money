import { SmsParser, Bank, ParserTemplate } from './sms-parser';
import banksSeed from './banks.seed.json';
import templatesSeed from './parsers.seed.json';

const BANKS = banksSeed as unknown as Bank[];
const TEMPLATES = templatesSeed as unknown as ParserTemplate[];

const AT = new Date('2026-08-24T09:30:00Z');
const parser = () => new SmsParser(BANKS, TEMPLATES);

describe('resolveBank — banklar ma\'lumotdan keladi, koddan emas', () => {
  it('o\'zbek bankini topadi', () => {
    expect(parser().resolveBank('KAPITALBANK')?.slug).toBe('kapital');
    expect(parser().resolveBank('Humo-info')?.slug).toBe('humo');
  });

  it('rus bankini qisqa raqamdan topadi', () => {
    // Sberbank 900 raqamidan yuboradi — raqamli jo'natuvchi ham qo'llanadi
    expect(parser().resolveBank('900')?.slug).toBe('sber');
  });

  it('qozoq bankini topadi', () => {
    expect(parser().resolveBank('KASPI BANK')?.slug).toBe('kaspi');
  });

  it('uzunroq moslikni ustun qo\'yadi', () => {
    // "kapitalbank" va "kapital" ikkisi ham ro'yxatda; noto'g'ri bankka
    // tegishli bo'lib qolmasligi kerak
    expect(parser().resolveBank('kapitalbank')?.slug).toBe('kapital');
  });

  it('notanish jo\'natuvchiga null qaytaradi', () => {
    expect(parser().resolveBank('SPAM-SENDER')).toBeNull();
    expect(parser().resolveBank('+998901234567')).toBeNull();
  });
});

describe('allowedSenders — Kotlin tomoni uchun ro\'yxat', () => {
  it('barcha jo\'natuvchilarni takrorsiz beradi', () => {
    const list = parser().allowedSenders();
    expect(list).toContain('kapitalbank');
    expect(list).toContain('900');
    expect(list).toContain('kaspi');
    expect(new Set(list).size).toBe(list.length);
  });
});

describe('parse — O\'zbekiston', () => {
  it('kirim SMS ni to\'g\'ri o\'qiydi va tiyinni saqlaydi', () => {
    const r = parser().parse('KAPITALBANK', '8712 Popolnenie: 8 540 000,00 UZS', AT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // UZS ikki kasrli: 8 540 000 so'm = 854 000 000 tiyin
      expect(r.value.amountMinor).toBe(854_000_000n);
      expect(r.value.kind).toBe('CREDIT');
      expect(r.value.currency).toBe('UZS');
      expect(r.value.country).toBe('UZ');
      expect(r.value.cardLast4).toBe('8712');
      expect(r.value.confidence).toBeGreaterThan(0.9);
    }
  });

  it('chiqim SMS ni DEBIT deb belgilaydi', () => {
    const r = parser().parse('KAPITALBANK', '8712 Oplata 125 000,00 UZS', AT);
    expect(r.ok && r.value.kind).toBe('DEBIT');
  });
});

describe('parse — Rossiya (kirill yozuvi)', () => {
  // ASOSIY TUZATISH: ilgari kopeyka yaxlitlanib yo'qolardi
  it('rubl kopeykasini saqlaydi', () => {
    const r = parser().parse('900', 'VISA1234 15:30 зачисление 50 000,50 р', AT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.amountMinor).toBe(5_000_050n); // 50 000,50 RUB
      expect(r.value.currency).toBe('RUB');
      expect(r.value.kind).toBe('CREDIT');
    }
  });

  it('T-Bank kirim xabarini o\'qiydi', () => {
    const r = parser().parse('TBANK', 'Пополнение. 12 500,00 руб', AT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.amountMinor).toBe(1_250_000n);
  });

  it('chiqim xabarini DEBIT deb belgilaydi', () => {
    const r = parser().parse('900', 'VISA1234 оплата 1 200,00 р', AT);
    expect(r.ok && r.value.kind).toBe('DEBIT');
  });
});

describe('parse — Qozog\'iston', () => {
  it('tenge kirimini o\'qiydi', () => {
    const r = parser().parse('KASPI', 'Пополнение 150 000,00 тг', AT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.currency).toBe('KZT');
      expect(r.value.amountMinor).toBe(15_000_000n);
    }
  });
});

describe('parse — xatolar', () => {
  it('notanish jo\'natuvchini NO_BANK deydi', () => {
    const r = parser().parse('SPAM', 'Popolnenie 1 000 000 UZS', AT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reason).toBe('NO_BANK');
  });

  it('shabloni yo\'q bankni NO_TEMPLATE deydi', () => {
    const r = parser().parse('AGROBANK', 'Popolnenie 1 000 000 UZS', AT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reason).toBe('NO_TEMPLATE');
  });

  it('mos kelmagan matnni NO_MATCH deydi', () => {
    const r = parser().parse('KAPITALBANK', 'Vash kod podtverzhdeniya: 4821', AT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reason).toBe('NO_MATCH');
  });

  it('buzuq shablon butun parsingni yiqitmaydi', () => {
    const broken: ParserTemplate = {
      bankSlug: 'kapital', version: 99,
      pattern: '(?<amt>[unclosed', amountGroup: 'amt',
      kindMap: { popolnenie: 'CREDIT' },
    };
    const p = new SmsParser(BANKS, [broken, ...TEMPLATES]);
    const r = p.parse('KAPITALBANK', '8712 Popolnenie: 1 000,00 UZS', AT);
    // Buzuq shablon o'tkazib yuborilib, ishlaydigani topiladi
    expect(r.ok).toBe(true);
  });
});

describe('versiyalash', () => {
  it('eski shablon ishlasa ishonchni pasaytiradi', () => {
    const older: ParserTemplate = {
      bankSlug: 'kapital', version: 0,
      pattern: '(?<kind>Popolnenie)\\s+(?<amt>[\\d\\s]+)\\s*sum',
      amountGroup: 'amt', kindMap: { popolnenie: 'CREDIT' },
    };
    const p = new SmsParser(BANKS, [...TEMPLATES, older]);
    const r = p.parse('KAPITALBANK', 'Popolnenie 500 000 sum', AT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.parserVersion).toBe(0);
      expect(r.value.confidence).toBeLessThan(0.8); // tasdiq so'raladi
    }
  });

  it('yangi ro\'yxat yuklanganda darhol ishlatadi', () => {
    const p = new SmsParser([], []);
    const msg: [string, string, Date] = ['KAPITALBANK', '8712 Popolnenie: 1 000,00 UZS', AT];
    expect(p.parse(...msg).ok).toBe(false);
    p.update({ banks: BANKS, templates: TEMPLATES });
    expect(p.parse(...msg).ok).toBe(true);
  });
});

describe('seed ma\'lumoti', () => {
  it('bir nechta davlatni qoplaydi', () => {
    const countries = new Set(BANKS.map((b) => b.country));
    expect(countries).toContain('UZ');
    expect(countries).toContain('RU');
    expect(countries).toContain('KZ');
    expect(countries.size).toBeGreaterThanOrEqual(4);
  });

  it('bank slug\'lari takrorlanmaydi', () => {
    const slugs = BANKS.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('har bir shablon mavjud bankka tegishli', () => {
    const slugs = new Set(BANKS.map((b) => b.slug));
    for (const t of TEMPLATES) {
      expect(slugs.has(t.bankSlug)).toBe(true);
    }
  });

  it('har bir shablon regex sifatida yaroqli', () => {
    for (const t of TEMPLATES) {
      expect(() => new RegExp(t.pattern, 'iu')).not.toThrow();
    }
  });
});
