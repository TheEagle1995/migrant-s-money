import 'dart:async';
import '../core/api_client.dart';
import '../platform/sms_channel.dart';

/// Serverdan kelgan shablon. `GET /parsers?since=<v>` bilan yangilanadi.
class ParserTemplate {
  final String bankSlug;
  final int version;
  final RegExp pattern;
  final String amountGroup;
  final Map<String, String> kindMap;

  ParserTemplate({
    required this.bankSlug,
    required this.version,
    required this.pattern,
    required this.amountGroup,
    required this.kindMap,
  });

  factory ParserTemplate.fromJson(Map<String, dynamic> j) => ParserTemplate(
        bankSlug: j['bankSlug'] as String,
        version: j['version'] as int,
        pattern: RegExp(j['pattern'] as String, caseSensitive: false),
        amountGroup: j['amountGroup'] as String? ?? 'amt',
        kindMap: (j['kindMap'] as Map).map(
          (k, v) => MapEntry(k.toString().toLowerCase(), v.toString()),
        ),
      );
}

class ParsedSms {
  final String bankSlug;
  final String currency;
  final BigInt amountMinor;
  final String kind;
  final DateTime occurredAt;
  final double confidence;
  final int parserVersion;

  const ParsedSms({
    required this.bankSlug,
    required this.currency,
    required this.amountMinor,
    required this.kind,
    required this.occurredAt,
    required this.confidence,
    required this.parserVersion,
  });

  Map<String, dynamic> toPayload(String householdId) => {
        'householdId': householdId,
        'currency': currency,
        'amountMinor': amountMinor.toString(),
        'kind': kind,
        'bankSlug': bankSlug,
        'occurredAt': occurredAt.toUtc().toIso8601String(),
        'confidence': confidence,
        'parserVersion': parserVersion,
      };
}

/// Bank qaysi valyutada ishlaydi. Serverdan kelgan bank ro'yxatida bo'ladi;
/// bu yerda faqat zaxira qiymatlar.
const _bankCurrency = {
  'kapital': 'UZS', 'ipoteka': 'UZS', 'humo': 'UZS', 'uzcard': 'UZS',
  'sber': 'RUB', 'tbank': 'RUB', 'alfa': 'RUB',
  'kaspi': 'KZT', 'halyk': 'KZT',
};

const _senderMap = {
  'kapitalbank': 'kapital',
  'ipotekabank': 'ipoteka',
  'uzcard': 'uzcard',
  'humo': 'humo',
  'aab': 'asia-alliance',
};

String? resolveBank(String sender) {
  final key = sender.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
  for (final e in _senderMap.entries) {
    if (key.contains(e.key)) return e.value;
  }
  return null;
}

/// So'mda tiyin yo'q — butun songa yaxlitlanadi.
BigInt? parseAmount(String? raw) {
  if (raw == null || raw.trim().isEmpty) return null;
  var s = raw.replaceAll(RegExp(r"[\s\u00A0']"), '');
  s = s.replaceAll('.', '').replaceAll(',', '.');
  final n = double.tryParse(s);
  if (n == null || n <= 0) return null;
  return BigInt.from(n.round());
}

/// Backend'dagi `SmsParser` bilan bir xil mantiq — qurilmada bajariladi.
class DeviceSmsParser {
  List<ParserTemplate> _templates;
  DeviceSmsParser(this._templates);

  int get maxVersion =>
      _templates.isEmpty ? 0 : _templates.map((t) => t.version).reduce((a, b) => a > b ? a : b);

  void update(List<ParserTemplate> t) => _templates = t;

  ParsedSms? parse(SmsMessage msg) {
    final bank = resolveBank(msg.sender);
    if (bank == null) return null;

    final candidates = _templates.where((t) => t.bankSlug == bank).toList()
      ..sort((a, b) => b.version.compareTo(a.version));

    for (var i = 0; i < candidates.length; i++) {
      final tpl = candidates[i];
      final m = tpl.pattern.firstMatch(msg.body);
      if (m == null) continue;

      final amount = parseAmount(_group(m, tpl.amountGroup));
      if (amount == null) return null;

      final kindToken = _group(m, 'kind')?.toLowerCase();
      final kind = kindToken == null ? null : tpl.kindMap[kindToken];
      if (kind == null) return null;

      // Eski shablon ishlasa ishonch pasayadi -> foydalanuvchidan tasdiq so'raladi
      final confidence = i == 0 ? 0.97 : (0.97 - i * 0.2).clamp(0.5, 0.97);

      return ParsedSms(
        bankSlug: bank,
        currency: _bankCurrency[bank] ?? 'UZS',
        amountMinor: amount,
        kind: kind,
        occurredAt: msg.receivedAt,
        confidence: confidence.toDouble(),
        parserVersion: tpl.version,
      );
    }
    return null;
  }

  String? _group(RegExpMatch m, String name) {
    try {
      return m.namedGroup(name);
    } catch (_) {
      return null;
    }
  }
}

/// SMS oqimini ulab, parse qilib, serverga strukturalangan natijani yuboradi.
///
/// XOM MATN HECH QACHON TARMOQQA CHIQMAYDI.
class SmsPipeline {
  final ApiClient api;
  final String householdId;
  final DeviceSmsParser parser;
  final EventQueue queue;
  StreamSubscription<SmsMessage>? _sub;

  SmsPipeline({
    required this.api,
    required this.householdId,
    required this.parser,
    required this.queue,
  });

  /// Rozilik berilgandan keyingina chaqiriladi.
  Future<bool> start() async {
    if (!await SmsChannel.requestPermission()) return false;
    await refreshTemplates();
    // Ilgari yuborilmay qolganlarni birinchi navbatda jo'natamiz
    await queue.flush();
    _sub = SmsChannel.stream().listen(_onMessage, onError: (_) {});
    return true;
  }

  Future<void> refreshTemplates() async {
    try {
      final raw = await api.parserTemplates(parser.maxVersion);
      if (raw.isNotEmpty) {
        parser.update(raw.map(ParserTemplate.fromJson).toList());
      }
    } catch (_) {
      // Tarmoq yo'q bo'lsa mavjud shablonlar bilan davom etadi
    }
  }

  Future<void> _onMessage(SmsMessage msg) async {
    final parsed = parser.parse(msg);
    if (parsed == null) return;
    // Avval diskka, keyin tarmoqqa. SMS bir marta keladi — yo'qotib bo'lmaydi.
    await queue.enqueue(parsed.toPayload(householdId));
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    await SmsChannel.stop();
  }
}
