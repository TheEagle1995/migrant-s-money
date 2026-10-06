import {
  CORRIDORS, COUNTRIES, findCorridor, corridorOf, liveCorridors, reverseOf,
  corridorLabel, rateLooksSane, approxRate, sendCountries, recvCountriesFrom,
  CountryCode,
} from './corridor';
import { toMinor, currency, minorFactor } from './currency';
import banksSeed from '../parsers/banks.seed.json';
import providersSeed from '../../prisma/providers.seed.json';
import { isPayoutMethod, isFundingMethod } from './methods';

describe('koridor registri', () => {
  it('ko\'p davlatni qoplaydi', () => {
    const countries = new Set(CORRIDORS.flatMap((c) => [c.send, c.recv]));
    expect(countries.size).toBeGreaterThanOrEqual(20);
    expect(CORRIDORS.length).toBeGreaterThanOrEqual(40);
  });

  it('ID larda takror yo\'q', () => {
    const ids = CORRIDORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ID ni katta-kichik harfga qaramay topadi', () => {
    expect(findCorridor('kr-uz')?.id).toBe('KR-UZ');
    expect(findCorridor('KR-UZ')?.id).toBe('KR-UZ');
  });

  it('noma\'lum koridorda undefined', () => {
    expect(findCorridor('XX-YY')).toBeUndefined();
  });

  it('har bir koridorning valyutasi davlatiga mos', () => {
    for (const c of CORRIDORS) {
      expect(c.sendCurrency).toBe(COUNTRIES[c.send].currency);
      expect(c.recvCurrency).toBe(COUNTRIES[c.recv].currency);
    }
  });

  it('o\'ziga o\'zi yuboradigan koridor yo\'q', () => {
    for (const c of CORRIDORS) expect(c.send).not.toBe(c.recv);
  });
});

describe('ikki tomonlama koridorlar', () => {
  it('O\'zbekistonga ham, O\'zbekistondan ham yuborish mumkin', () => {
    expect(corridorOf('RU', 'UZ')?.isLive).toBe(true);
    expect(corridorOf('UZ', 'RU')?.isLive).toBe(true);
    expect(corridorOf('KR', 'UZ')?.isLive).toBe(true);
    expect(corridorOf('UZ', 'KR')?.isLive).toBe(true);
  });

  it('teskari koridorni topadi', () => {
    const kr = findCorridor('KR-UZ')!;
    const rev = reverseOf(kr)!;
    expect(rev.id).toBe('UZ-KR');
    expect(rev.sendCurrency).toBe(kr.recvCurrency);
    expect(rev.recvCurrency).toBe(kr.sendCurrency);
  });

  it('teskari koridorning kursi teskari tartibda', () => {
    const a = approxRate('KRW', 'UZS');
    const b = approxRate('UZS', 'KRW');
    expect(a * b).toBeCloseTo(1, 5);
  });
});

describe('namunaviy summa', () => {
  it('har bir koridorda musbat', () => {
    for (const c of CORRIDORS) expect(c.sampleSendMinor).toBeGreaterThan(0n);
  });

  it('~100 USD ekvivalentiga yaqin', () => {
    for (const c of CORRIDORS) {
      const major = Number(c.sampleSendMinor) / Number(minorFactor(c.sendCurrency));
      const usd = major / currency(c.sendCurrency).perUsd;
      // Yumaloqlash tufayli keng oraliq, lekin tartib to'g'ri bo'lishi kerak
      expect(usd).toBeGreaterThan(20);
      expect(usd).toBeLessThan(400);
    }
  });
});

describe('sanity oraliqlari', () => {
  it('har bir koridorda min < max va ikkisi ham musbat', () => {
    for (const c of CORRIDORS) {
      expect(c.sanityRateMin).toBeGreaterThan(0);
      expect(c.sanityRateMin).toBeLessThan(c.sanityRateMax);
    }
  });

  it('taxminiy kurs oraliq ichida', () => {
    for (const c of CORRIDORS) {
      const mid = approxRate(c.sendCurrency, c.recvCurrency);
      expect(mid).toBeGreaterThanOrEqual(c.sanityRateMin);
      expect(mid).toBeLessThanOrEqual(c.sanityRateMax);
    }
  });

  it('to\'g\'ri kursni qabul qiladi, birlik xatosini rad etadi', () => {
    const kr = findCorridor('KR-UZ')!;
    // 100 000 KRW -> 854 000 so'm (kurs 8.54)
    expect(rateLooksSane(kr, toMinor(100_000, 'KRW'), toMinor(854_000, 'UZS')).ok).toBe(true);
    // ming barobar kichik
    expect(rateLooksSane(kr, toMinor(100_000, 'KRW'), toMinor(854, 'UZS')).ok).toBe(false);
  });

  it('teskari koridorda ham ishlaydi', () => {
    const uzRu = findCorridor('UZ-RU')!;
    // 1 000 000 so'm -> ~6 650 rubl
    expect(rateLooksSane(uzRu, toMinor(1_000_000, 'UZS'), toMinor(6_650, 'RUB')).ok).toBe(true);
    expect(rateLooksSane(uzRu, toMinor(1_000_000, 'UZS'), toMinor(6_650_000, 'RUB')).ok).toBe(false);
  });
});

describe('tanlagich uchun ro\'yxatlar', () => {
  it('yuborish davlatlari alifbo tartibida va takrorsiz', () => {
    const list = sendCountries();
    expect(list.length).toBeGreaterThanOrEqual(15);
    expect(new Set(list.map((c) => c.code)).size).toBe(list.length);
    const names = list.map((c) => c.nameUz);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('har bir yuborish davlati uchun kamida bitta qabul davlati bor', () => {
    for (const c of sendCountries()) {
      expect(recvCountriesFrom(c.code).length).toBeGreaterThan(0);
    }
  });

  it('O\'zbekistondan bir nechta davlatga yuborish mumkin', () => {
    const out = recvCountriesFrom('UZ').map((c) => c.code);
    expect(out).toContain('RU');
    expect(out).toContain('KR');
    expect(out.length).toBeGreaterThanOrEqual(5);
  });
});

describe('corridorLabel', () => {
  it('o\'zbekcha nom beradi', () => {
    expect(corridorLabel(findCorridor('KR-UZ')!)).toBe("Koreya → O'zbekiston");
    expect(corridorLabel(findCorridor('UZ-RU')!)).toBe("O'zbekiston → Rossiya");
  });
});

// --- seed ma'lumoti registrdan ajralib ketmasligi kerak ---

describe('seed izchilligi: banklar', () => {
  const banks = banksSeed as Array<{ country: string; slug: string; smsSenders: string[] }>;

  it('ko\'p davlatni qoplaydi', () => {
    const countries = new Set(banks.map((b) => b.country));
    expect(banks.length).toBeGreaterThanOrEqual(60);
    expect(countries.size).toBeGreaterThanOrEqual(15);
  });

  it('har bir bankning davlati registrda bor', () => {
    for (const b of banks) {
      expect(COUNTRIES[b.country as CountryCode]).toBeDefined();
    }
  });

  it('slug va jo\'natuvchi nomlari takrorlanmaydi', () => {
    const slugs = banks.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const senders = banks.flatMap((b) => b.smsSenders);
    expect(new Set(senders).size).toBe(senders.length);
  });

  it('har bir bankda kamida bitta jo\'natuvchi nomi bor', () => {
    for (const b of banks) expect(b.smsSenders.length).toBeGreaterThan(0);
  });
});

describe('seed izchilligi: provayderlar', () => {
  const providers = providersSeed as Array<{
    slug: string; sendCountries: string[]; payouts: string[]; funding: string[];
  }>;

  it('ko\'p provayder va davlat', () => {
    expect(providers.length).toBeGreaterThanOrEqual(40);
    const countries = new Set(providers.flatMap((p) => p.sendCountries));
    expect(countries.size).toBeGreaterThanOrEqual(15);
  });

  it('slug lar takrorlanmaydi', () => {
    const slugs = providers.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('har bir provayderning davlatidan faol koridor chiqadi', () => {
    const liveSenders = new Set(liveCorridors().map((c) => c.send));
    for (const p of providers) {
      for (const country of p.sendCountries) {
        expect(COUNTRIES[country as CountryCode]).toBeDefined();
        // Provayder faqat faol koridori bor davlatdan yuborishi kerak,
        // aks holda ilovada ro'yxatga hech qachon tushmaydi.
        expect(liveSenders.has(country as CountryCode)).toBe(true);
      }
    }
  });

  it('usullar ro\'yxatdagi qiymatlar', () => {
    for (const p of providers) {
      expect(p.payouts.length).toBeGreaterThan(0);
      expect(p.funding.length).toBeGreaterThan(0);
      for (const m of p.payouts) expect(isPayoutMethod(m)).toBe(true);
      for (const m of p.funding) expect(isFundingMethod(m)).toBe(true);
    }
  });

  it('har bir faol koridorda kamida bitta provayder bor', () => {
    for (const c of liveCorridors()) {
      const has = providers.some((p) => p.sendCountries.includes(c.send));
      expect(has).toBe(true);
    }
  });
});
