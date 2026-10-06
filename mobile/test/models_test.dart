import 'package:flutter_test/flutter_test.dart';
import 'package:remit/models/comparison.dart';
import 'package:remit/models/goal.dart';

void main() {
  group('Comparison.fromJson', () {
    test('backend javobini to\'liq o\'qiydi', () {
      final c = Comparison.fromJson({
        'rows': [
          {
            'providerSlug': 'toss',
            'displayName': 'Toss',
            // BigInt JSON'da string bo'lib keladi
            'recvPerMillionKrw': '8540000',
            'etaMinutes': 120,
            'isPromotional': false,
            'isStale': false,
            'staleHours': 1,
            'rank': 1,
            'gapFromBest': 0,
          },
        ],
        'spread': 0.0609,
        'annualLossMinor': '5880000',
        'verdict': 'ALIVE',
        'measuredAt': '2026-08-24T12:00:00.000Z',
      });

      expect(c.rows, hasLength(1));
      expect(c.rows.first.recvPerMillionKrw.minor, BigInt.from(8540000));
      expect(c.rows.first.recvPerMillionKrw.formatted, '8 540 000');
      expect(c.annualLoss.minor, BigInt.from(5880000));
      expect(c.verdict, Verdict.alive);
    });

    test('noma\'lum verdict qiymatini xavfsiz o\'qiydi', () {
      final c = Comparison.fromJson({
        'rows': [],
        'spread': 0,
        'annualLossMinor': '0',
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
          'targetMinor': '100000000',
          'savedMinor': '25000000',
        },
        'ratio': 0.25,
        'remainingMinor': '75000000',
        'isComplete': false,
        'daysLeft': 90,
        'requiredPerMonthMinor': '25000000',
      });

      expect(g.title, 'Uy ta\'miri');
      expect(g.ratio, 0.25);
      expect(g.remaining.formatted, '75 000 000');
      expect(g.requiredPerMonth!.minor, BigInt.from(25000000));
      expect(g.isComplete, isFalse);
    });

    test('muddatsiz maqsadda oylik hisob null', () {
      final g = GoalProgress.fromJson({
        'goal': {
          'id': 'g2',
          'title': 'To\'y',
          'targetMinor': '50000000',
          'savedMinor': '50000000',
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
        'sentMinor': '1000000',
        'expectedRecvMinor': null,
        'declaredAt': '2026-08-24T06:00:00.000Z',
      });
      expect(t.sent.minor, BigInt.from(1000000));
      expect(t.expected, isNull);
    });
  });
}
