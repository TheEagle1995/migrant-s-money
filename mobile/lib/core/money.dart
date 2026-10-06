/// Pul — har doim BigInt minor unit + valyuta kodi. double hech qachon.
///
/// Valyuta kasri hisobga olinadi: KRW kasrsiz, UZS va RUB ikki kasrli.
/// Shuning uchun 854000000 (tiyin) "8 540 000 so'm" bo'lib ko'rinadi.
class Money {
  final BigInt minor;
  final String currency;
  const Money(this.minor, this.currency);

  factory Money.uzs(BigInt v) => Money(v, 'UZS');
  factory Money.krw(BigInt v) => Money(v, 'KRW');

  static const Map<String, int> _digits = {
    'KRW': 0, 'JPY': 0, 'KWD': 3,
  };
  static const Map<String, String> _symbols = {
    'UZS': "so'm", 'KRW': '\u20A9', 'RUB': '\u20BD', 'KZT': '\u20B8',
    'USD': '\u0024', 'EUR': '\u20AC', 'TRY': '\u20BA', 'KGS': 'som',
    'TJS': 'SM', 'AED': 'AED', 'SAR': 'SAR', 'QAR': 'QAR', 'KWD': 'KWD',
    'ILS': '\u20AA', 'PLN': 'z\u0142', 'CZK': 'K\u010D', 'GBP': '\u00A3',
    'JPY': '\u00A5', 'CNY': '\u00A5', 'MYR': 'RM', 'CAD': 'C\u0024',
    'AZN': '\u20BC', 'GEL': '\u20BE', 'BYN': 'Br', 'THB': '\u0E3F', 'SEK': 'kr',
  };

  int get decimals => _digits[currency] ?? 2;
  String get symbol => _symbols[currency] ?? currency;

  BigInt get _factor => BigInt.from(10).pow(decimals);

  /// 854000000 UZS -> "8 540 000"
  String get formatted {
    final neg = minor.isNegative;
    final abs = neg ? -minor : minor;
    final whole = (abs ~/ _factor).toString();
    final buf = StringBuffer();
    for (var i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buf.write(' ');
      buf.write(whole[i]);
    }
    var out = buf.toString();
    final frac = abs % _factor;
    if (decimals > 0 && frac != BigInt.zero) {
      out += ',' + frac.toString().padLeft(decimals, '0');
    }
    return (neg ? '-' : '') + out;
  }

  String get display => '$formatted $symbol';

  /// Matndan o'qish — faqat raqamlar, valyuta kasriga ko'ra minorga o'tkaziladi
  static BigInt? parseMajor(String text, String currency) {
    final digits = text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return null;
    final v = BigInt.tryParse(digits);
    if (v == null || v <= BigInt.zero) return null;
    final d = _digits[currency] ?? 2;
    return v * BigInt.from(10).pow(d);
  }
}

BigInt normalizeTo(BigInt recv, BigInt sent, BigInt base) {
  if (sent <= BigInt.zero) {
    throw ArgumentError("Yuborilgan summa musbat bo'lishi kerak");
  }
  return (recv * base) ~/ sent;
}
