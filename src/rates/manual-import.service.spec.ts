import { validateRow, ManualQuoteRow } from './manual-import.service';
import { toMinor } from '../domain/currency';

const base: ManualQuoteRow = {
  providerSlug: 'toss', corridorId: 'KR-UZ',
  sendMinor: toMinor(1_000_000, 'KRW'), feeMinor: 0n,
  recvMinor: toMinor(8_540_000, 'UZS'),
  isPromotional: false, measuredAt: new Date('2026-08-24T05:00:00Z'),
};

describe('validateRow', () => {
  it('to\'g\'ri qatorni qabul qiladi', () => {
    expect(validateRow(base)).toBeNull();
  });
  it('birlik xatosini tutadi (so\'m o\'rniga ming so\'m yozilgan)', () => {
    expect(validateRow({ ...base, recvMinor: toMinor(8_540, 'UZS') })).toMatch(/kurs shubhali/);
  });

  // ASOSIY TUZATISH: ilgari oraliq 4-20 deb qattiq yozilgan edi va bu
  // Rossiya koridorining HAR BIR to'g'ri qatorini rad etardi.
  it('Rossiya koridorini o\'z oralig\'i bilan tekshiradi', () => {
    const ru: ManualQuoteRow = {
      ...base, corridorId: 'RU-UZ',
      sendMinor: toMinor(50_000, 'RUB'),
      recvMinor: toMinor(7_500_000, 'UZS'), // kurs ~150
    };
    expect(validateRow(ru)).toBeNull();
  });

  it('Rossiya koridorida ham birlik xatosini tutadi', () => {
    const ru: ManualQuoteRow = {
      ...base, corridorId: 'RU-UZ',
      sendMinor: toMinor(50_000, 'RUB'),
      recvMinor: toMinor(7_500, 'UZS'), // kurs ~0.15, juda past
    };
    expect(validateRow(ru)).toMatch(/kurs shubhali/);
  });

  it('noma\'lum koridorni rad etadi', () => {
    expect(validateRow({ ...base, corridorId: 'XX-YY' })).toMatch(/noma'lum koridor/);
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
