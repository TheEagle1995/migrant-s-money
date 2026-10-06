import { validateRow, ManualQuoteRow } from './manual-import.service';

const base: ManualQuoteRow = {
  providerSlug: 'toss', sendMinor: 1_000_000n, feeMinor: 0n,
  recvMinor: 8_540_000n, isPromotional: false, measuredAt: new Date('2026-08-24T05:00:00Z'),
};

describe('validateRow', () => {
  it('to\'g\'ri qatorni qabul qiladi', () => {
    expect(validateRow(base)).toBeNull();
  });
  it('birlik xatosini tutadi (so\'m o\'rniga ming so\'m yozilgan)', () => {
    expect(validateRow({ ...base, recvMinor: 8_540n })).toMatch(/kurs shubhali/);
  });
  it('nol summani rad etadi', () => {
    expect(validateRow({ ...base, sendMinor: 0n })).toMatch(/musbat emas/);
  });
  it('manfiy komissiyani rad etadi', () => {
    expect(validateRow({ ...base, feeMinor: -1n })).toMatch(/manfiy/);
  });
  it('kelajakdagi sanani rad etadi', () => {
    expect(validateRow({ ...base, measuredAt: new Date(Date.now() + 5 * 86_400_000) }))
      .toMatch(/kelajakda/);
  });
});
