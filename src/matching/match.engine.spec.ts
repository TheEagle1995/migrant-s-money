import {
  matchTransfer,
  deviationOf,
  observedRate,
  MatchCandidateEvent,
  MatchCandidateTransfer,
} from './match.engine';

const T0 = new Date('2026-08-24T10:00:00Z');
const hours = (n: number) => new Date(T0.getTime() + n * 3600_000);

const transfer: MatchCandidateTransfer = {
  id: 't1',
  declaredAt: T0,
  expectedRecvMinor: 8_500_000n, // ~1 mln KRW
};

const evt = (o: Partial<MatchCandidateEvent> & { id: string }): MatchCandidateEvent => ({
  amountMinor: 8_500_000n,
  kind: 'CREDIT',
  occurredAt: hours(3),
  confidence: 0.95,
  ...o,
});

describe('matchTransfer', () => {
  it('bitta aniq nomzodni avtomatik bog\'laydi', () => {
    const r = matchTransfer(transfer, [evt({ id: 'e1', amountMinor: 8_480_000n })]);
    expect(r.decision).toBe('AUTO');
  });

  it('ikkita kuchli nomzod bo\'lsa foydalanuvchidan so\'raydi', () => {
    const r = matchTransfer(transfer, [
      evt({ id: 'e1', amountMinor: 8_490_000n }),
      evt({ id: 'e2', amountMinor: 8_510_000n, occurredAt: hours(5) }),
    ]);
    expect(r).toMatchObject({ decision: 'ASK_USER', reason: 'MULTIPLE_CANDIDATES' });
  });

  it('DEBIT hodisalarini butunlay e\'tiborsiz qoldiradi', () => {
    const r = matchTransfer(transfer, [evt({ id: 'e1', kind: 'DEBIT' })]);
    expect(r).toMatchObject({ decision: 'NONE', reason: 'NO_CANDIDATE' });
  });

  it('72 soatdan keyingi hodisani olmaydi', () => {
    const r = matchTransfer(transfer, [evt({ id: 'e1', occurredAt: hours(80) })]);
    expect(r).toMatchObject({ decision: 'NONE', reason: 'NO_CANDIDATE' });
  });

  it('o\'tkazmadan oldingi hodisani olmaydi', () => {
    const r = matchTransfer(transfer, [evt({ id: 'e1', occurredAt: hours(-2) })]);
    expect(r).toMatchObject({ decision: 'NONE', reason: 'NO_CANDIDATE' });
  });

  it('parser ishonchi past bo\'lsa avtomatik bog\'lamaydi', () => {
    const r = matchTransfer(transfer, [evt({ id: 'e1', confidence: 0.55 })]);
    expect(r).toMatchObject({ decision: 'ASK_USER', reason: 'LOW_PARSE_CONFIDENCE' });
  });

  it('faqat kuchsiz nomzod bo\'lsa taklif qiladi, bog\'lamaydi', () => {
    const r = matchTransfer(transfer, [evt({ id: 'e1', amountMinor: 8_100_000n })]);
    expect(r).toMatchObject({ decision: 'ASK_USER', reason: 'WEAK_DEVIATION' });
  });

  it('8% dan uzoq summani nomzod deb hisoblamaydi', () => {
    const r = matchTransfer(transfer, [evt({ id: 'e1', amountMinor: 5_000_000n })]);
    expect(r).toMatchObject({ decision: 'NONE', reason: 'NO_CANDIDATE' });
  });

  it('prognoz bo\'lmasa moslashtirmaydi', () => {
    const r = matchTransfer({ ...transfer, expectedRecvMinor: null }, [evt({ id: 'e1' })]);
    expect(r).toMatchObject({ decision: 'NONE', reason: 'NO_EXPECTATION' });
  });
});

describe('deviationOf', () => {
  it('ikki tomonlama farqni bir xil hisoblaydi', () => {
    expect(deviationOf(102n, 100n)).toBeCloseTo(0.02);
    expect(deviationOf(98n, 100n)).toBeCloseTo(0.02);
  });
});

describe('observedRate', () => {
  it('haqiqiy kursni hisoblaydi', () => {
    // Valyuta kasrlari hisobga olinadi: KRW kasrsiz, UZS ikki kasrli
    expect(observedRate(1_000_000n, 852_000_000n, 'KRW', 'UZS')).toBe('8.5200000000');
  });

  it('RUB -> UZS kursini to\'g\'ri beradi', () => {
    expect(observedRate(5_000_000n, 750_000_000n, 'RUB', 'UZS')).toBe('150.0000000000');
  });
});
