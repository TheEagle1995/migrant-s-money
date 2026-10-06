import { ForbiddenException } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { ComparisonService } from '../rates/comparison.service';
import { ManualImportService } from '../rates/manual-import.service';
import {
  MemConsentRepo, MemEventRepo, MemProviderRepo, MemQuoteRepo, MemTransferRepo,
} from '../testing/in-memory-repos';
import { provider, KR_UZ, RU_UZ } from '../testing/fixtures';
import { normalizeTo } from '../domain/money';
import { toMinor } from '../domain/currency';
import { renderDailyPost } from '../bot/message';

const HH = 'household-1';

const PROVIDERS = [
  provider('toss', { id: 'p1', displayName: 'Toss', kind: 'BANK_APP' }),
  provider('sentbe', { id: 'p2', displayName: 'Sentbe', affiliateActive: true }),
  provider('korona', { id: 'p3', displayName: 'Korona Pay', countries: ['RU'] }),
];

function makeWorld() {
  const providerRepo = new MemProviderRepo([...PROVIDERS]);
  const quoteRepo = new MemQuoteRepo();
  const eventRepo = new MemEventRepo();
  const transferRepo = new MemTransferRepo(eventRepo);
  const consentRepo = new MemConsentRepo(new Set([HH]));

  const importer = new ManualImportService(providerRepo as never, quoteRepo as never);
  const comparison = new ComparisonService(providerRepo as never, quoteRepo as never);
  const matching = new MatchingService(
    transferRepo as never, eventRepo as never, consentRepo as never, quoteRepo as never,
  );
  return { providerRepo, quoteRepo, eventRepo, transferRepo, consentRepo, importer, comparison, matching };
}

const MEASURED = new Date('2026-08-24T05:00:00Z');

/** Jadvaldan import qilingan qator */
function row(
  providerSlug: string,
  corridorId: string,
  sendMajor: number,
  recvMajor: number,
  extra: Record<string, unknown> = {},
) {
  const c = corridorId === 'RU-UZ' ? RU_UZ : KR_UZ;
  return {
    providerSlug,
    corridorId,
    sendMinor: toMinor(sendMajor, c.sendCurrency),
    feeMinor: 0n,
    recvMinor: toMinor(recvMajor, c.recvCurrency),
    isPromotional: false,
    measuredAt: MEASURED,
    ...extra,
  };
}

/** "Yubordim" tugmasi — controller mantig'ining sof ko'chirmasi */
async function declare(
  w: ReturnType<typeof makeWorld>,
  slug: string,
  corridorId: string,
  sendMajor: number,
  at: Date,
) {
  const c = corridorId === 'RU-UZ' ? RU_UZ : KR_UZ;
  const p = await w.providerRepo.findBySlug(slug);
  const latest = await w.quoteRepo.latestPerProvider(corridorId);
  const q = latest.find((x) => x.providerId === p!.id);
  const sentMinor = toMinor(sendMajor, c.sendCurrency);
  return w.transferRepo.create({
    householdId: HH,
    corridorId,
    providerId: p!.id,
    sentMinor,
    expectedRecvMinor: q ? normalizeTo(q.recvMinor, q.sendMinor, sentMinor) : null,
    declaredAt: at,
  });
}

const DECLARED = new Date('2026-08-24T06:00:00Z');

describe("to'liq oqim: import -> taqqoslash -> o'tkazma -> SMS -> OBSERVED", () => {
  it("jadvaldan yuklangan kurs asosida prognoz quriladi va SMS avtomatik bog'lanadi", async () => {
    const w = makeWorld();

    const report = await w.importer.importRows([
      row('toss', 'KR-UZ', 1_000_000, 8_540_000),
      row('sentbe', 'KR-UZ', 1_000_000, 8_465_000),
    ]);
    expect(report.ok).toBe(2);
    expect(report.failed).toHaveLength(0);

    // Affiliate'li Sentbe ikkinchi o'rinda qoladi
    const cmp = await w.comparison.forCorridor('KR-UZ');
    expect(cmp.rows.map((r) => r.providerSlug)).toEqual(['toss', 'sentbe']);

    // 500 000 KRW yuboradi — prognoz proporsional
    const t = await declare(w, 'toss', 'KR-UZ', 500_000, DECLARED);
    expect(t.expectedRecvMinor).toBe(toMinor(4_270_000, 'UZS'));

    // Oila tomonda SMS keladi, prognozdan 0.5% farq bilan
    const res = await w.matching.ingest({
      householdId: HH,
      currency: 'UZS',
      amountMinor: toMinor(4_250_000, 'UZS'),
      kind: 'CREDIT',
      bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T08:00:00Z'),
      confidence: 0.97,
      parserVersion: 2,
    });

    expect(res.outcome?.decision).toBe('AUTO');
    expect((await w.transferRepo.findById(t.id))!.status).toBe('MATCHED');

    // Eng qimmatli natija: OBSERVED kurs yozildi
    const observed = w.quoteRepo.items.filter((q) => q.source === 'OBSERVED');
    expect(observed).toHaveLength(1);
    expect(observed[0].corridorId).toBe('KR-UZ');
    expect(observed[0].rate).toBe('8.5000000000');

    // OBSERVED endi eng yangi kotirovka — taqqoslash uni ishlatadi
    const after = await w.comparison.forCorridor('KR-UZ');
    const toss = after.rows.find((r) => r.providerSlug === 'toss')!;
    expect(toss.source).toBe('OBSERVED');
    expect(toss.recvNormalizedMinor).toBe(toMinor(8_500_000, 'UZS'));
  });

  it('rozilik bo\'lmasa hodisa saqlanmaydi', async () => {
    const w = makeWorld();
    w.consentRepo.granted.clear();

    await expect(
      w.matching.ingest({
        householdId: HH, currency: 'UZS', amountMinor: toMinor(1_000_000, 'UZS'),
        kind: 'CREDIT', bankSlug: 'kapital', occurredAt: new Date(),
        confidence: 0.9, parserVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(w.eventRepo.items).toHaveLength(0);
  });

  it('ikkita o\'xshash SMS kelsa avtomatik bog\'lamaydi', async () => {
    const w = makeWorld();
    await w.importer.importRows([row('toss', 'KR-UZ', 1_000_000, 8_540_000)]);
    const t = await declare(w, 'toss', 'KR-UZ', 1_000_000, DECLARED);

    await w.eventRepo.create({
      householdId: HH, currency: 'UZS', amountMinor: toMinor(8_530_000, 'UZS'),
      kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T07:00:00Z'), confidence: 0.97, parserVersion: 2,
    });
    const res = await w.matching.ingest({
      householdId: HH, currency: 'UZS', amountMinor: toMinor(8_550_000, 'UZS'),
      kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T09:00:00Z'), confidence: 0.97, parserVersion: 2,
    });

    expect(res.outcome).toMatchObject({ decision: 'ASK_USER', reason: 'MULTIPLE_CANDIDATES' });
    expect((await w.transferRepo.findById(t.id))!.status).toBe('PENDING');
    expect(w.quoteRepo.items.some((q) => q.source === 'OBSERVED')).toBe(false);
  });

  it('qo\'lda tasdiqlash ham OBSERVED kurs yozadi', async () => {
    const w = makeWorld();
    await w.importer.importRows([row('toss', 'KR-UZ', 1_000_000, 8_540_000)]);
    const t = await declare(w, 'toss', 'KR-UZ', 1_000_000, DECLARED);
    const e = await w.eventRepo.create({
      householdId: HH, currency: 'UZS', amountMinor: toMinor(8_200_000, 'UZS'),
      kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T07:00:00Z'), confidence: 0.6, parserVersion: 1,
    });

    await w.matching.confirm(t.id, e.id, 'user');

    expect((await w.transferRepo.findById(t.id))!.status).toBe('MATCHED');
    expect(w.quoteRepo.items.filter((q) => q.source === 'OBSERVED')).toHaveLength(1);
  });

  it('boshqa oilaning hodisasini bog\'lashga yo\'l qo\'ymaydi', async () => {
    const w = makeWorld();
    const t = await declare(w, 'toss', 'KR-UZ', 1_000_000, new Date());
    const foreign = await w.eventRepo.create({
      householdId: 'boshqa-oila', currency: 'UZS', amountMinor: toMinor(8_500_000, 'UZS'),
      kind: 'CREDIT', bankSlug: 'kapital', occurredAt: new Date(),
      confidence: 0.9, parserVersion: 1,
    });
    await expect(w.matching.confirm(t.id, foreign.id, 'user')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('72 soatdan keyin o\'tkazma UNMATCHED bo\'ladi', async () => {
    const w = makeWorld();
    const old = new Date(Date.now() - 100 * 3600_000);
    const t = await declare(w, 'toss', 'KR-UZ', 1_000_000, old);
    expect(await w.matching.expireStale()).toBe(1);
    expect((await w.transferRepo.findById(t.id))!.status).toBe('UNMATCHED');
  });

  it('DEBIT hodisa hech qanday o\'tkazmani yopmaydi', async () => {
    const w = makeWorld();
    const t = await declare(w, 'toss', 'KR-UZ', 1_000_000, new Date());
    const res = await w.matching.ingest({
      householdId: HH, currency: 'UZS', amountMinor: toMinor(8_500_000, 'UZS'),
      kind: 'DEBIT', bankSlug: 'kapital', occurredAt: new Date(),
      confidence: 0.97, parserVersion: 2,
    });
    expect(res.outcome).toBeNull();
    expect((await w.transferRepo.findById(t.id))!.status).toBe('PENDING');
  });

  it('import->taqqoslash->Telegram post zanjiri to\'liq ishlaydi', async () => {
    const w = makeWorld();
    await w.importer.importRows([
      { ...row('toss', 'KR-UZ', 1_000_000, 8_540_000), measuredAt: new Date(Date.now() - 3600_000) },
      { ...row('sentbe', 'KR-UZ', 1_000_000, 8_100_000), measuredAt: new Date(Date.now() - 3600_000) },
    ]);
    const cmp = await w.comparison.forCorridor('KR-UZ');
    const post = renderDailyPost(cmp);

    expect(cmp.verdict).toBe('ALIVE');
    expect(post).toContain('🥇 *Toss*');
    expect(post).toContain('8 540 000');
    expect(post).toContain("Reklama o'rni sotilmaydi");
  });

  it('birlik xatosi bo\'lgan qatorni import rad etadi, qolganini yuklaydi', async () => {
    const w = makeWorld();
    const r = await w.importer.importRows([
      row('toss', 'KR-UZ', 1_000_000, 8_540_000),
      row('sentbe', 'KR-UZ', 1_000_000, 8_465), // ming so'm bilan adashtirilgan
    ]);
    expect(r.ok).toBe(1);
    expect(r.failed[0].reason).toMatch(/kurs shubhali/);
    expect(w.quoteRepo.items).toHaveLength(1);
  });

  it('nomzodlarni chetlanish bo\'yicha tartiblab qaytaradi', async () => {
    const w = makeWorld();
    await w.importer.importRows([row('toss', 'KR-UZ', 1_000_000, 8_540_000)]);
    const t = await declare(w, 'toss', 'KR-UZ', 1_000_000, DECLARED);

    for (const amt of [9_600_000, 8_545_000, 8_800_000]) {
      await w.eventRepo.create({
        householdId: HH, currency: 'UZS', amountMinor: toMinor(amt, 'UZS'),
        kind: 'CREDIT', bankSlug: 'kapital',
        occurredAt: new Date('2026-08-24T07:00:00Z'), confidence: 0.9, parserVersion: 2,
      });
    }

    const cands = await w.matching.candidatesFor(t.id);
    expect(cands.map((c) => c.amountMinor)).toEqual([
      toMinor(8_545_000, 'UZS'), toMinor(8_800_000, 'UZS'),
    ]);
    expect(cands[0].isStrong).toBe(true);  // 0.06%
    expect(cands[1].isStrong).toBe(false); // 3.0%
    expect(cands).toHaveLength(2);         // 9 600 000 — 12.4%, nomzod emas
  });

  it('prognozi yo\'q o\'tkazma uchun nomzod ko\'rsatmaydi', async () => {
    const w = makeWorld();
    const t = await declare(w, 'toss', 'KR-UZ', 1_000_000, new Date());
    expect(t.expectedRecvMinor).toBeNull();
    await expect(w.matching.candidatesFor(t.id)).resolves.toEqual([]);
  });

  it('allaqachon bog\'langan hodisa nomzodlar orasida chiqmaydi', async () => {
    const w = makeWorld();
    await w.importer.importRows([row('toss', 'KR-UZ', 1_000_000, 8_540_000)]);
    const t1 = await declare(w, 'toss', 'KR-UZ', 1_000_000, DECLARED);
    const e = await w.eventRepo.create({
      householdId: HH, currency: 'UZS', amountMinor: toMinor(8_540_000, 'UZS'),
      kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T07:00:00Z'), confidence: 0.9, parserVersion: 2,
    });
    await w.matching.confirm(t1.id, e.id, 'user');

    const t2 = await declare(w, 'toss', 'KR-UZ', 1_000_000, new Date('2026-08-24T06:30:00Z'));
    await expect(w.matching.candidatesFor(t2.id)).resolves.toHaveLength(0);
  });
});

describe("ko'p koridor: Koreya va Rossiya aralashmaydi", () => {
  it('har bir koridor o\'z ro\'yxatini beradi', async () => {
    const w = makeWorld();
    await w.importer.importRows([
      row('toss', 'KR-UZ', 1_000_000, 8_540_000),
      row('korona', 'RU-UZ', 50_000, 7_500_000),
    ]);

    const kr = await w.comparison.forCorridor('KR-UZ');
    const ru = await w.comparison.forCorridor('RU-UZ');

    expect(kr.rows.map((r) => r.providerSlug)).toEqual(['toss']);
    expect(ru.rows.map((r) => r.providerSlug)).toEqual(['korona']);
    expect(kr.sendCurrency).toBe('KRW');
    expect(ru.sendCurrency).toBe('RUB');
  });

  it('Rossiya o\'tkazmasi RUB prognozini to\'g\'ri hisoblaydi', async () => {
    const w = makeWorld();
    await w.importer.importRows([row('korona', 'RU-UZ', 50_000, 7_500_000)]);

    // 10 000 RUB yuboradi -> 1 500 000 so'm kutiladi
    const t = await declare(w, 'korona', 'RU-UZ', 10_000, DECLARED);
    expect(t.expectedRecvMinor).toBe(toMinor(1_500_000, 'UZS'));
  });

  it('Rossiya o\'tkazmasi OBSERVED kursni RUB bazasida yozadi', async () => {
    const w = makeWorld();
    await w.importer.importRows([row('korona', 'RU-UZ', 50_000, 7_500_000)]);
    const t = await declare(w, 'korona', 'RU-UZ', 50_000, DECLARED);

    const res = await w.matching.ingest({
      householdId: HH, currency: 'UZS', amountMinor: toMinor(7_480_000, 'UZS'),
      kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T08:00:00Z'), confidence: 0.97, parserVersion: 2,
    });
    expect(res.outcome?.decision).toBe('AUTO');

    const observed = w.quoteRepo.items.find((q) => q.source === 'OBSERVED')!;
    expect(observed.corridorId).toBe('RU-UZ');
    // 7 480 000 so'm / 50 000 RUB = 149.6
    expect(observed.rate).toBe('149.6000000000');
    expect((await w.transferRepo.findById(t.id))!.status).toBe('MATCHED');
  });
});
