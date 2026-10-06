import { progressOf, Goal } from './goals.service';

const NOW = new Date('2026-08-24T00:00:00Z');
const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g1', householdId: 'h1', title: 'Uy ta\'miri',
  targetMinor: 100_000_000n, savedMinor: 25_000_000n,
  dueDate: null, createdAt: NOW, ...o,
});

describe('progressOf', () => {
  it('nisbat va qoldiqni hisoblaydi', () => {
    const p = progressOf(goal(), NOW);
    expect(p.ratio).toBeCloseTo(0.25);
    expect(p.remainingMinor).toBe(75_000_000n);
    expect(p.isComplete).toBe(false);
  });

  it('maqsad oshib ketsa 100% dan oshmaydi', () => {
    const p = progressOf(goal({ savedMinor: 140_000_000n }), NOW);
    expect(p.ratio).toBe(1);
    expect(p.remainingMinor).toBe(0n);
    expect(p.isComplete).toBe(true);
  });

  it('muddat bo\'lsa oyiga qancha kerakligini aytadi', () => {
    const due = new Date('2026-11-22T00:00:00Z'); // ~90 kun
    const p = progressOf(goal({ dueDate: due }), NOW);
    expect(p.daysLeft).toBe(90);
    expect(p.requiredPerMonthMinor).toBe(25_000_000n); // 75 mln / 3 oy
  });

  it('muddat o\'tgan bo\'lsa oylik hisob bermaydi', () => {
    const p = progressOf(goal({ dueDate: new Date('2026-08-01T00:00:00Z') }), NOW);
    expect(p.daysLeft).toBeLessThan(0);
    expect(p.requiredPerMonthMinor).toBeNull();
  });

  it('nol maqsadda yiqilmaydi', () => {
    const p = progressOf(goal({ targetMinor: 0n, savedMinor: 0n }), NOW);
    expect(p.ratio).toBe(0);
    expect(p.isComplete).toBe(false);
  });

  it('manfiy jamg\'armani nol deb oladi', () => {
    const p = progressOf(goal({ savedMinor: -5n }), NOW);
    expect(p.ratio).toBe(0);
    expect(p.remainingMinor).toBe(100_000_000n);
  });
});
