import 'package:flutter_test/flutter_test.dart';
import 'package:chiroq/core/money.dart';

void main() {
  group('Money — valyuta kasri', () {
    test('UZS ikki kasrli: tiyindan so\'mga', () {
      expect(Money(BigInt.from(854000000), 'UZS').formatted, '8 540 000');
      expect(Money(BigInt.from(854000050), 'UZS').formatted, '8 540 000,50');
    });

    test('KRW kasrsiz', () {
      expect(Money(BigInt.from(1000000), 'KRW').formatted, '1 000 000');
    });

    test('RUB kopeykasini ko\'rsatadi', () {
      expect(Money(BigInt.from(125050), 'RUB').formatted, '1 250,50');
    });

    test('KWD uch kasrli', () {
      expect(Money(BigInt.from(1250), 'KWD').decimals, 3);
      expect(Money(BigInt.from(1250), 'KWD').formatted, '1,250');
    });

    test('valyuta belgisini qo\'shadi', () {
      expect(Money(BigInt.from(854000000), 'UZS').display, "8 540 000 so'm");
      expect(Money(BigInt.from(1000000), 'KRW').display, '1 000 000 ₩');
    });

    test('noma\'lum valyutada kodni ko\'rsatadi', () {
      expect(Money(BigInt.from(100), 'XYZ').symbol, 'XYZ');
    });

    test('manfiy summani belgilaydi', () {
      expect(Money(BigInt.from(-125050), 'RUB').formatted, '-1 250,50');
    });
  });

  group('parseMajor — kiritilgan matndan minor unit', () {
    test('probel va belgilarni tashlaydi', () {
      expect(Money.parseMajor('8 540 000', 'UZS'), BigInt.from(854000000));
      expect(Money.parseMajor('1 000 000', 'KRW'), BigInt.from(1000000));
    });

    test('kasrsiz valyutada ko\'paytmaydi', () {
      expect(Money.parseMajor('100000', 'KRW'), BigInt.from(100000));
    });

    test('bo\'sh va nolni rad etadi', () {
      expect(Money.parseMajor('', 'UZS'), isNull);
      expect(Money.parseMajor('0', 'UZS'), isNull);
      expect(Money.parseMajor('abc', 'UZS'), isNull);
    });

    test('katta summada aniqlikni yo\'qotmaydi', () {
      final v = Money.parseMajor('99 999 999 999', 'UZS');
      expect(v, BigInt.parse('9999999999900'));
    });
  });

  group('normalizeTo', () {
    test('bazaga keltiradi', () {
      expect(normalizeTo(BigInt.from(4270000), BigInt.from(500000), BigInt.from(1000000)),
          BigInt.from(8540000));
    });
    test('nol yuborishda xato', () {
      expect(() => normalizeTo(BigInt.one, BigInt.zero, BigInt.one), throwsArgumentError);
    });
  });
}
