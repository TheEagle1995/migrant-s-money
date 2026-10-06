import 'package:flutter_test/flutter_test.dart';
import 'package:remit/core/money.dart';

void main() {
  group('Money', () {
    test('katta summani probel bilan formatlaydi', () {
      expect(Money.uzs(BigInt.from(8540000)).formatted, '8 540 000');
      expect(Money.uzs(BigInt.from(500)).formatted, '500');
      expect(Money.uzs(BigInt.from(1000)).formatted, '1 000');
    });

    test('so\'m uchun valyuta nomini qo\'shadi', () {
      expect(Money.uzs(BigInt.from(1000)).display, "1 000 so'm");
      expect(Money.krw(BigInt.from(1000)).display, '1 000 KRW');
    });

    test('nolni to\'g\'ri ko\'rsatadi', () {
      expect(Money.uzs(BigInt.zero).formatted, '0');
    });
  });

  group('normalizeTo', () {
    test('yarim million KRW ni bir millionga keltiradi', () {
      final r = normalizeTo(BigInt.from(4270000), BigInt.from(500000));
      expect(r, BigInt.from(8540000));
    });

    test('bir millionni o\'zgartirmaydi', () {
      final r = normalizeTo(BigInt.from(8540000), BigInt.from(1000000));
      expect(r, BigInt.from(8540000));
    });

    test('nol yuborishda xato beradi', () {
      expect(() => normalizeTo(BigInt.one, BigInt.zero), throwsArgumentError);
    });

    test('BigInt ishlatgani uchun aniqlik yo\'qolmaydi', () {
      // double bo'lganida bu yerda xato paydo bo'lardi
      final huge = BigInt.parse('123456789012345678');
      final r = normalizeTo(huge, BigInt.from(1000000));
      expect(r, huge);
    });
  });
}
