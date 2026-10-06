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
    // Maqsadlar qabul qiluvchi valyutasida; hozircha so'm
    const cur = 'UZS';
    return GoalProgress(
      id: g['id'] as String,
      title: g['title'] as String,
      target: Money(BigInt.parse(g['targetMinor'] as String), cur),
      saved: Money(BigInt.parse(g['savedMinor'] as String), cur),
      remaining: Money(BigInt.parse(j['remainingMinor'] as String), cur),
      ratio: (j['ratio'] as num).toDouble(),
      isComplete: j['isComplete'] as bool? ?? false,
      daysLeft: j['daysLeft'] as int?,
      requiredPerMonth:
          perMonth == null ? null : Money(BigInt.parse(perMonth as String), cur),
    );
  }
}

class PendingTransfer {
  final String id;
  final String corridorId;
  final Money sent;
  final Money? expected;
  final DateTime declaredAt;

  const PendingTransfer({
    required this.id,
    required this.corridorId,
    required this.sent,
    required this.expected,
    required this.declaredAt,
  });

  factory PendingTransfer.fromJson(Map<String, dynamic> j) {
    // Koridor IDsidan valyutalarni aniqlaymiz: "KR-UZ"
    final id = (j['corridorId'] as String? ?? 'KR-UZ').toUpperCase();
    final parts = id.split('-');
    final sendCur = _currencyOf(parts.isNotEmpty ? parts[0] : 'KR');
    final recvCur = _currencyOf(parts.length > 1 ? parts[1] : 'UZ');
    return PendingTransfer(
      id: j['id'] as String,
      corridorId: id,
      sent: Money(BigInt.parse(j['sentMinor'] as String), sendCur),
      expected: j['expectedRecvMinor'] == null
          ? null
          : Money(BigInt.parse(j['expectedRecvMinor'] as String), recvCur),
      declaredAt: DateTime.parse(j['declaredAt'] as String),
    );
  }

  static const Map<String, String> _countryCurrency = {
    'UZ': 'UZS', 'KR': 'KRW', 'RU': 'RUB', 'KZ': 'KZT', 'KG': 'KGS',
    'TJ': 'TJS', 'US': 'USD', 'TR': 'TRY', 'AE': 'AED', 'SA': 'SAR',
    'QA': 'QAR', 'KW': 'KWD', 'IL': 'ILS', 'PL': 'PLN', 'CZ': 'CZK',
    'GB': 'GBP', 'DE': 'EUR', 'IT': 'EUR', 'FR': 'EUR', 'LT': 'EUR',
    'LV': 'EUR', 'JP': 'JPY', 'CN': 'CNY', 'MY': 'MYR', 'CA': 'CAD',
    'AZ': 'AZN', 'GE': 'GEL', 'BY': 'BYN', 'TH': 'THB', 'SE': 'SEK',
  };

  static String _currencyOf(String country) =>
      _countryCurrency[country] ?? 'USD';
}
