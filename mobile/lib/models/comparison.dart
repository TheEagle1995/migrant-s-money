import '../core/money.dart';

enum Verdict { alive, marginal, dead, insufficientData }

class ComparisonRow {
  final String providerSlug;
  final String displayName;
  final Money recvPerMillionKrw;
  final int? etaMinutes;
  final bool isPromotional;
  final bool isStale;
  final int staleHours;
  final int rank;
  final double gapFromBest;

  const ComparisonRow({
    required this.providerSlug,
    required this.displayName,
    required this.recvPerMillionKrw,
    required this.etaMinutes,
    required this.isPromotional,
    required this.isStale,
    required this.staleHours,
    required this.rank,
    required this.gapFromBest,
  });

  factory ComparisonRow.fromJson(Map<String, dynamic> j) => ComparisonRow(
        providerSlug: j['providerSlug'] as String,
        displayName: j['displayName'] as String,
        // Backend BigInt'ni string qilib yuboradi — JSON'da BigInt yo'q
        recvPerMillionKrw:
            Money.uzs(BigInt.parse(j['recvPerMillionKrw'] as String)),
        etaMinutes: j['etaMinutes'] as int?,
        isPromotional: j['isPromotional'] as bool? ?? false,
        isStale: j['isStale'] as bool? ?? false,
        staleHours: j['staleHours'] as int? ?? 0,
        rank: j['rank'] as int? ?? 0,
        gapFromBest: (j['gapFromBest'] as num?)?.toDouble() ?? 0,
      );
}

class Comparison {
  final List<ComparisonRow> rows;
  final double spread;
  final Money annualLoss;
  final Verdict verdict;
  final DateTime measuredAt;

  const Comparison({
    required this.rows,
    required this.spread,
    required this.annualLoss,
    required this.verdict,
    required this.measuredAt,
  });

  factory Comparison.fromJson(Map<String, dynamic> j) => Comparison(
        rows: (j['rows'] as List)
            .map((e) => ComparisonRow.fromJson(e as Map<String, dynamic>))
            .toList(),
        spread: (j['spread'] as num?)?.toDouble() ?? 0,
        annualLoss:
            Money.uzs(BigInt.parse((j['annualLossMinor'] ?? '0') as String)),
        verdict: _verdict(j['verdict'] as String?),
        measuredAt: DateTime.parse(j['measuredAt'] as String),
      );

  static Verdict _verdict(String? v) {
    switch (v) {
      case 'ALIVE':
        return Verdict.alive;
      case 'MARGINAL':
        return Verdict.marginal;
      case 'DEAD':
        return Verdict.dead;
      default:
        return Verdict.insufficientData;
    }
  }
}
