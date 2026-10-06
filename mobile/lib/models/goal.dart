import '../core/money.dart';

class GoalProgress {
  final String id;
  final String title;
  final Money target;
  final Money saved;
  final Money remaining;
  final double ratio;
  final bool isComplete;
  final int? daysLeft;
  final Money? requiredPerMonth;

  const GoalProgress({
    required this.id,
    required this.title,
    required this.target,
    required this.saved,
    required this.remaining,
    required this.ratio,
    required this.isComplete,
    this.daysLeft,
    this.requiredPerMonth,
  });

  factory GoalProgress.fromJson(Map<String, dynamic> j) {
    final g = j['goal'] as Map<String, dynamic>;
    final perMonth = j['requiredPerMonthMinor'];
    return GoalProgress(
      id: g['id'] as String,
      title: g['title'] as String,
      target: Money.uzs(BigInt.parse(g['targetMinor'] as String)),
      saved: Money.uzs(BigInt.parse(g['savedMinor'] as String)),
      remaining: Money.uzs(BigInt.parse(j['remainingMinor'] as String)),
      ratio: (j['ratio'] as num).toDouble(),
      isComplete: j['isComplete'] as bool? ?? false,
      daysLeft: j['daysLeft'] as int?,
      requiredPerMonth:
          perMonth == null ? null : Money.uzs(BigInt.parse(perMonth as String)),
    );
  }
}

class PendingTransfer {
  final String id;
  final Money sent;
  final Money? expected;
  final DateTime declaredAt;

  const PendingTransfer({
    required this.id,
    required this.sent,
    required this.expected,
    required this.declaredAt,
  });

  factory PendingTransfer.fromJson(Map<String, dynamic> j) => PendingTransfer(
        id: j['id'] as String,
        sent: Money.krw(BigInt.parse(j['sentMinor'] as String)),
        expected: j['expectedRecvMinor'] == null
            ? null
            : Money.uzs(BigInt.parse(j['expectedRecvMinor'] as String)),
        declaredAt: DateTime.parse(j['declaredAt'] as String),
      );
}
