/// Pul — har doim BigInt minor unit. double hech qachon ishlatilmaydi.
class Money {
  final BigInt minor;
  final String currency;
  const Money(this.minor, this.currency);

  factory Money.uzs(BigInt v) => Money(v, 'UZS');
  factory Money.krw(BigInt v) => Money(v, 'KRW');

  /// 8540000 -> "8 540 000"
  String get formatted {
    final s = minor.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    return buf.toString();
  }

  String get display => "$formatted ${currency == 'UZS' ? "so'm" : currency}";
}

BigInt normalizeTo(BigInt recv, BigInt sent, {BigInt? base}) {
  final b = base ?? BigInt.from(1000000);
  if (sent <= BigInt.zero) {
    throw ArgumentError("Yuborilgan summa musbat bo'lishi kerak");
  }
  return (recv * b) ~/ sent;
}
