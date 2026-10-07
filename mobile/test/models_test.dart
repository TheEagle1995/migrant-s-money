import 'package:flutter_test/flutter_test.dart';
import 'package:chiroq/models/comparison.dart';
import 'package:chiroq/models/goal.dart';

void main() {
  group('Comparison.fromJson', () {
    test('backend javobini to\'liq o\'qiydi', () {
      final c = Comparison.fromJson({
        'rows': [
          {
            'providerSlug': 'toss',
            'displayName': 'Toss',
            // BigInt JSON'da string bo'lib keladi
            'recvNormalizedMinor': '854000000',
            'payoutMethod': 'CARD',
            'etaMinutes': 120,
            'isPromotional': false,
            'isStale': false,
            'staleHours': 1,
            'rank': 1,
            'gapFromBest': 0,
          },
        ],
        'spread': 0.0609,
        'annualLossMinor': '588000000',
        'corridorId': 'KR-UZ',
        'corridorLabel': "Koreya → O'zbekiston",
        'sendCurrency': 'KRW',
        'recvCurrency': 'UZS',
        'amountSendMinor': '1000000',
        'isSample': false,
        'verdict': 'ALIVE',
        'measuredAt': '2026-08-24T12:00:00.000Z',
      });

      expect(c.rows, hasLength(1));
      expect(c.rows.first.recvNormalized.formatted, '8 540 000');
      expect(c.rows.first.payoutMethod, 'CARD');
      expect(c.annualLoss.minor, BigInt.parse('588000000'));
      expect(c.sendCurrency, 'KRW');
      expect(c.isSample, isFalse);
      expect(c.verdict, Verdict.alive);
    });

    test('noma\'lum verdict qiymatini xavfsiz o\'qiydi', () {
      final c = Comparison.fromJson({
        'rows': [],
        'spread': 0,
        'annualLossMinor': '0',
        'amountSendMinor': '0',
        'verdict': 'SOMETHING_NEW',
        'measuredAt': '2026-08-24T12:00:00.000Z',
      });
      expect(c.verdict, Verdict.insufficientData);
    });

    test('bo\'sh ro\'yxatda yiqilmaydi', () {
      final c = Comparison.fromJson({
        'rows': [],
        'spread': 0,
        'annualLossMinor': '0',
        'amountSendMinor': '0',
        'verdict': 'INSUFFICIENT_DATA',
        'measuredAt': '2026-08-24T12:00:00.000Z',
      });
      expect(c.rows, isEmpty);
    });
  });

  group('GoalProgress.fromJson', () {
    test('progress maydonlarini o\'qiydi', () {
      final g = GoalProgress.fromJson({
        'goal': {
          'id': 'g1',
          'title': 'Uy ta\'miri',
          // UZS ikki kasrli: 100 000 000 so'm = 10 000 000 000 tiyin
          'targetMinor': '10000000000',
          'savedMinor': '2500000000',
        },
        'ratio': 0.25,
        'remainingMinor': '7500000000',
        'isComplete': false,
        'daysLeft': 90,
        'requiredPerMonthMinor': '2500000000',
      });

      expect(g.title, 'Uy ta\'miri');
      expect(g.ratio, 0.25);
      expect(g.remaining.formatted, '75 000 000');
      expect(g.requiredPerMonth!.formatted, '25 000 000');
      expect(g.isComplete, isFalse);
    });

    test('muddatsiz maqsadda oylik hisob null', () {
      final g = GoalProgress.fromJson({
        'goal': {
          'id': 'g2',
          'title': 'To\'y',
          'targetMinor': '5000000000',
          'savedMinor': '5000000000',
        },
        'ratio': 1.0,
        'remainingMinor': '0',
        'isComplete': true,
        'daysLeft': null,
        'requiredPerMonthMinor': null,
      });
      expect(g.requiredPerMonth, isNull);
      expect(g.daysLeft, isNull);
      expect(g.isComplete, isTrue);
    });
  });

  group('PendingTransfer.fromJson', () {
    test('prognozsiz o\'tkazmani o\'qiydi', () {
      final t = PendingTransfer.fromJson({
        'id': 't1',
        'corridorId': 'KR-UZ',
        'sentMinor': '1000000',
        'expectedRecvMinor': null,
        'declaredAt': '2026-08-24T06:00:00.000Z',
      });
      expect(t.sent.minor, BigInt.from(1000000));
      expect(t.sent.currency, 'KRW');
      expect(t.expected, isNull);
    });

    test('koridor IDsidan valyutalarni aniqlaydi', () {
      final ru = PendingTransfer.fromJson({
        'id': 't2',
        'corridorId': 'RU-UZ',
        'sentMinor': '5000000',
        'expectedRecvMinor': '150000000',
        'declaredAt': '2026-08-24T06:00:00.000Z',
      });
      expect(ru.sent.currency, 'RUB');
      expect(ru.expected!.currency, 'UZS');
      expect(ru.sent.formatted, '50 000');
    });
  });
}
