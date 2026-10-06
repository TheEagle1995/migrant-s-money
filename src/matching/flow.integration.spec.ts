import { ForbiddenException } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { ComparisonService, buildComparison } from '../rates/comparison.service';
import { ManualImportService } from '../rates/manual-import.service';
import {
  MemConsentRepo, MemEventRepo, MemProviderRepo, MemQuoteRepo, MemTransferRepo,
} from '../testing/in-memory-repos';
import { Provider } from '../domain/types';
import { normalizeTo } from '../domain/money';
import { renderDailyPost } from '../bot/message';

const HH = 'household-1';

const providers: Provider[] = [
  { id: 'p1', slug: 'toss', displayName: 'Toss', kind: 'BANK_APP', isLicensed: true, affiliateActive: false, isActive: true },
  { id: 'p2', slug: 'sentbe', displayName: 'Sentbe', kind: 'SMALL_REMITTANCE', isLicensed: true, affiliateActive: true, isActive: true },
];

function makeWorld() {
  const providerRepo = new MemProviderRepo([...providers]);
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

/** "Yubordim" tugmasi — controller mantig'ining sof ko'chirmasi */
async function declare(
  w: ReturnType<typeof makeWorld>,
  slug: string,
  sentKrw: bigint,
  at: Date,
) {
  const p = await w.providerRepo.findBySlug(slug);
  const latest = await w.quoteRepo.latestPerProvider('KRW', 'UZS');
  const q = latest.find((x) => x.providerId === p!.id);
  return w.transferRepo.create({
    householdId: HH,
    providerId: p!.id,
    sentMinor: sentKrw,
    expectedRecvMinor: q ? normalizeTo(q.recvMinor, q.sendMinor, sentKrw) : null,
    declaredAt: at,
  });
}

describe('to\'liq oqim: import -> taqqoslash -> o\'tkazma -> SMS -> OBSERVED', () => {
  it('jadvaldan yuklangan kurs asosida prognoz quriladi va SMS avtomatik bog\'lanadi', async () => {
    const w = makeWorld();
    const measuredAt = new Date('2026-08-24T05:00:00Z');

    // 1. O'lchov jadvalidan import
    const report = await w.importer.importRows([
      { providerSlug: 'toss', sendMinor: 1_000_000n, feeMinor: 0n, recvMinor: 8_540_000n, isPromotional: false, measuredAt },
      { providerSlug: 'sentbe', sendMinor: 1_000_000n, feeMinor: 3_000n, recvMinor: 8_465_000n, isPromotional: false, measuredAt },
    ]);
    expect(report.ok).toBe(2);
    expect(report.failed).toHaveLength(0);

    // 2. Taqqoslash — affiliate'li Sentbe ikkinchi o'rinda qoladi
    const cmp = await w.comparison.current();
    expect(cmp.rows[0].providerSlug).toBe('toss');
    expect(cmp.rows[1].providerSlug).toBe('sentbe');

    // 3. Foydalanuvchi 500 000 KRW yuboradi — prognoz proporsional
    const declaredAt = new Date('2026-08-24T06:00:00Z');
    const t = await declare(w, 'toss', 500_000n, declaredAt);
    expect(t.expectedRecvMinor).toBe(4_270_000n);

    // 4. Oila tomonda SMS keladi, prognozdan 0.5% farq bilan
    const res = await w.matching.ingest({
      householdId: HH,
      amountMinor: 4_250_000n,
      kind: 'CREDIT',
      bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T08:00:00Z'),
      confidence: 0.97,
      parserVersion: 2,
    });

    expect(res.outcome?.decision).toBe('AUTO');
    expect((await w.transferRepo.findById(t.id))!.status).toBe('MATCHED');

    // 5. Eng qimmatli natija: OBSERVED kurs yozildi
    const observed = w.quoteRepo.items.filter((q) => q.source === 'OBSERVED');
    expect(observed).toHaveLength(1);
    expect(observed[0].recvMinor).toBe(4_250_000n);
    expect(observed[0].sendMinor).toBe(500_000n);
    expect(observed[0].rate).toBe('8.5000000000');

    // 6. OBSERVED endi eng yangi kotirovka — taqqoslash uni ishlatadi
    const after = buildComparison(providers, await w.quoteRepo.latestPerProvider('KRW', 'UZS'));
    const toss = after.rows.find((r) => r.providerSlug === 'toss')!;
    expect(toss.source).toBe('OBSERVED');
    expect(toss.recvPerMillionKrw).toBe(8_500_000n); // 500k dan normallashtirilgan
  });

  it('rozilik bo\'lmasa hodisa saqlanmaydi', async () => {
    const w = makeWorld();
    w.consentRepo.granted.clear();

    await expect(
      w.matching.ingest({
        householdId: HH, amountMinor: 1_000_000n, kind: 'CREDIT',
        bankSlug: 'kapital', occurredAt: new Date(), confidence: 0.9, parserVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(w.eventRepo.items).toHaveLength(0);
  });

  it('ikkita o\'xshash SMS kelsa avtomatik bog\'lamaydi', async () => {
    const w = makeWorld();
    const measuredAt = new Date('2026-08-24T05:00:00Z');
    await w.importer.importRows([
      { providerSlug: 'toss', sendMinor: 1_000_000n, feeMinor: 0n, recvMinor: 8_540_000n, isPromotional: false, measuredAt },
    ]);
    const t = await declare(w, 'toss', 1_000_000n, new Date('2026-08-24T06:00:00Z'));

    await w.eventRepo.create({
      householdId: HH, amountMinor: 8_530_000n, kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T07:00:00Z'), confidence: 0.97, parserVersion: 2,
    });
    const res = await w.matching.ingest({
      householdId: HH, amountMinor: 8_550_000n, kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T09:00:00Z'), confidence: 0.97, parserVersion: 2,
    });

    expect(res.outcome).toMatchObject({ decision: 'ASK_USER', reason: 'MULTIPLE_CANDIDATES' });
    expect((await w.transferRepo.findById(t.id))!.status).toBe('PENDING');
    expect(w.quoteRepo.items.some((q) => q.source === 'OBSERVED')).toBe(false);
  });

  it('qo\'lda tasdiqlash ham OBSERVED kurs yozadi', async () => {
    const w = makeWorld();
    const measuredAt = new Date('2026-08-24T05:00:00Z');
    await w.importer.importRows([
      { providerSlug: 'toss', sendMinor: 1_000_000n, feeMinor: 0n, recvMinor: 8_540_000n, isPromotional: false, measuredAt },
    ]);
    const t = await declare(w, 'toss', 1_000_000n, new Date('2026-08-24T06:00:00Z'));
    const e = await w.eventRepo.create({
      householdId: HH, amountMinor: 8_200_000n, kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T07:00:00Z'), confidence: 0.6, parserVersion: 1,
    });

    await w.matching.confirm(t.id, e.id, 'user');

    expect((await w.transferRepo.findById(t.id))!.status).toBe('MATCHED');
    expect(w.quoteRepo.items.filter((q) => q.source === 'OBSERVED')).toHaveLength(1);
  });

  it('boshqa oilaning hodisasini bog\'lashga yo\'l qo\'ymaydi', async () => {
    const w = makeWorld();
    const t = await declare(w, 'toss', 1_000_000n, new Date());
    const foreign = await w.eventRepo.create({
      householdId: 'boshqa-oila', amountMinor: 8_500_000n, kind: 'CREDIT',
      bankSlug: 'kapital', occurredAt: new Date(), confidence: 0.9, parserVersion: 1,
    });
    await expect(w.matching.confirm(t.id, foreign.id, 'user')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('72 soatdan keyin o\'tkazma UNMATCHED bo\'ladi', async () => {
    const w = makeWorld();
    const old = new Date(Date.now() - 100 * 3600_000);
    const t = await declare(w, 'toss', 1_000_000n, old);
    const n = await w.matching.expireStale();
    expect(n).toBe(1);
    expect((await w.transferRepo.findById(t.id))!.status).toBe('UNMATCHED');
  });

  it('DEBIT hodisa hech qanday o\'tkazmani yopmaydi', async () => {
    const w = makeWorld();
    const t = await declare(w, 'toss', 1_000_000n, new Date());
    const res = await w.matching.ingest({
      householdId: HH, amountMinor: 8_500_000n, kind: 'DEBIT', bankSlug: 'kapital',
      occurredAt: new Date(), confidence: 0.97, parserVersion: 2,
    });
    expect(res.outcome).toBeNull();
    expect((await w.transferRepo.findById(t.id))!.status).toBe('PENDING');
  });

  it('import->taqqoslash->Telegram post zanjiri to\'liq ishlaydi', async () => {
    const w = makeWorld();
    const measuredAt = new Date(Date.now() - 3600_000);
    await w.importer.importRows([
      { providerSlug: 'toss', sendMinor: 1_000_000n, feeMinor: 0n, recvMinor: 8_540_000n, isPromotional: false, measuredAt },
      { providerSlug: 'sentbe', sendMinor: 1_000_000n, feeMinor: 3_000n, recvMinor: 8_100_000n, isPromotional: false, measuredAt },
    ]);
    const cmp = await w.comparison.current();
    const post = renderDailyPost(cmp);

    expect(cmp.verdict).toBe('ALIVE');
    expect(post).toContain('🥇 *Toss*');
    expect(post).toContain('8 540 000');
    expect(post).toContain('Reklama o\'rni sotilmaydi');
  });

  it('birlik xatosi bo\'lgan qatorni import rad etadi, qolganini yuklaydi', async () => {
    const w = makeWorld();
    const measuredAt = new Date('2026-08-24T05:00:00Z');
    const r = await w.importer.importRows([
      { providerSlug: 'toss', sendMinor: 1_000_000n, feeMinor: 0n, recvMinor: 8_540_000n, isPromotional: false, measuredAt },
      { providerSlug: 'sentbe', sendMinor: 1_000_000n, feeMinor: 0n, recvMinor: 8_465n, isPromotional: false, measuredAt },
    ]);
    expect(r.ok).toBe(1);
    expect(r.failed[0].reason).toMatch(/kurs shubhali/);
    expect(w.quoteRepo.items).toHaveLength(1);
  });

  it('nomzodlarni chetlanish bo\'yicha tartiblab qaytaradi', async () => {
    const w = makeWorld();
    const measuredAt = new Date('2026-08-24T05:00:00Z');
    await w.importer.importRows([
      { providerSlug: 'toss', sendMinor: 1_000_000n, feeMinor: 0n, recvMinor: 8_540_000n, isPromotional: false, measuredAt },
    ]);
    const t = await declare(w, 'toss', 1_000_000n, new Date('2026-08-24T06:00:00Z'));

    // uzoq, yaqin, o'rtacha — tartibsiz kiritamiz
    for (const amt of [9_600_000n, 8_545_000n, 8_800_000n]) {
      await w.eventRepo.create({
        householdId: HH, amountMinor: amt, kind: 'CREDIT', bankSlug: 'kapital',
        occurredAt: new Date('2026-08-24T07:00:00Z'), confidence: 0.9, parserVersion: 2,
      });
    }

    const cands = await w.matching.candidatesFor(t.id);
    expect(cands.map((c) => c.amountMinor)).toEqual([8_545_000n, 8_800_000n]);
    expect(cands[0].isStrong).toBe(true); // 0.06% — 2% ichida
    expect(cands[1].isStrong).toBe(false); // 3.0% — nomzod, lekin kuchsiz
    // 9 600 000 — prognozdan 12.4% uzoq, nomzod emas
    expect(cands).toHaveLength(2);
  });

  it('prognozi yo\'q o\'tkazma uchun nomzod ko\'rsatmaydi', async () => {
    const w = makeWorld();
    const t = await declare(w, 'toss', 1_000_000n, new Date()); // kotirovka yo'q
    expect(t.expectedRecvMinor).toBeNull();
    await expect(w.matching.candidatesFor(t.id)).resolves.toEqual([]);
  });

  it('allaqachon bog\'langan hodisa nomzodlar orasida chiqmaydi', async () => {
    const w = makeWorld();
    const measuredAt = new Date('2026-08-24T05:00:00Z');
    await w.importer.importRows([
      { providerSlug: 'toss', sendMinor: 1_000_000n, feeMinor: 0n, recvMinor: 8_540_000n, isPromotional: false, measuredAt },
    ]);
    const t1 = await declare(w, 'toss', 1_000_000n, new Date('2026-08-24T06:00:00Z'));
    const e = await w.eventRepo.create({
      householdId: HH, amountMinor: 8_540_000n, kind: 'CREDIT', bankSlug: 'kapital',
      occurredAt: new Date('2026-08-24T07:00:00Z'), confidence: 0.9, parserVersion: 2,
    });
    await w.matching.confirm(t1.id, e.id, 'user');

    const t2 = await declare(w, 'toss', 1_000_000n, new Date('2026-08-24T06:30:00Z'));
    await expect(w.matching.candidatesFor(t2.id)).resolves.toHaveLength(0);
  });
});
