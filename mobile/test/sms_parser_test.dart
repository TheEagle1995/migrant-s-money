import 'package:flutter_test/flutter_test.dart';
import 'package:remit/features/consent/sms_pipeline.dart';
import 'package:remit/platform/sms_channel.dart';

ParserTemplate kapital({int version = 2}) => ParserTemplate.fromJson({
      'bankSlug': 'kapital',
      'version': version,
      'pattern':
          r'(?<card>\d{4})\s*[:.]?\s*(?<kind>Popolnenie|Oplata|Snyatie)\s*[:.]?\s*(?<amt>[\d\s.,]+)\s*(?:UZS|sum)',
      'amountGroup': 'amt',
      'kindMap': {'Popolnenie': 'CREDIT', 'Oplata': 'DEBIT', 'Snyatie': 'DEBIT'},
    });

final at = DateTime.utc(2026, 8, 24, 9, 30);

void main() {
  group('resolveBank', () {
    test('tanish jo\'natuvchini aniqlaydi', () {
      expect(resolveBank('KAPITALBANK'), 'kapital');
      expect(resolveBank('Humo-info'), 'humo');
    });

    test('notanish jo\'natuvchiga null qaytaradi', () {
      expect(resolveBank('SPAM-SENDER'), isNull);
      expect(resolveBank('+998901234567'), isNull);
    });
  });

  group('parseAmount', () {
    test('probel va vergul bilan yozilgan summani o\'qiydi', () {
      expect(parseAmount('8 540 000,00'), BigInt.from(8540000));
    });

    test('nuqtali minglik ajratgichni o\'qiydi', () {
      expect(parseAmount('1.250.000,50'), BigInt.from(1250001));
    });

    test('nol va bo\'shni rad etadi', () {
      expect(parseAmount('0'), isNull);
      expect(parseAmount(''), isNull);
      expect(parseAmount(null), isNull);
    });
  });

  group('DeviceSmsParser', () {
    test('kirim xabarini to\'g\'ri o\'qiydi', () {
      final p = DeviceSmsParser([kapital()]);
      final r = p.parse(
          SmsMessage('KAPITALBANK', '8712 Popolnenie: 8 540 000,00 UZS', at));
      expect(r, isNotNull);
      expect(r!.amountMinor, BigInt.from(8540000));
      expect(r.kind, 'CREDIT');
      expect(r.confidence, greaterThan(0.9));
      expect(r.parserVersion, 2);
    });

    test('chiqim xabarini DEBIT deb belgilaydi', () {
      final p = DeviceSmsParser([kapital()]);
      final r = p.parse(SmsMessage('KAPITALBANK', '8712 Oplata 125 000,00 UZS', at));
      expect(r!.kind, 'DEBIT');
    });

    test('notanish jo\'natuvchini butunlay o\'tkazib yuboradi', () {
      final p = DeviceSmsParser([kapital()]);
      expect(p.parse(SmsMessage('SPAM', 'Popolnenie 1 000 000 UZS', at)), isNull);
    });

    test('mos kelmagan matnga null qaytaradi', () {
      final p = DeviceSmsParser([kapital()]);
      expect(
          p.parse(SmsMessage('KAPITALBANK', 'Kod: 4821', at)), isNull);
    });

    test('maxVersion eng yuqori versiyani qaytaradi', () {
      final p = DeviceSmsParser([kapital(version: 1), kapital(version: 5)]);
      expect(p.maxVersion, 5);
    });

    test('bo\'sh ro\'yxatda maxVersion nol', () {
      expect(DeviceSmsParser([]).maxVersion, 0);
    });

    test('yangi shablon yuklanganda darhol ishlatadi', () {
      final p = DeviceSmsParser([]);
      final msg = SmsMessage('KAPITALBANK', '8712 Popolnenie: 1 000 UZS', at);
      expect(p.parse(msg), isNull);
      p.update([kapital()]);
      expect(p.parse(msg), isNotNull);
    });

    test('payload xom matnni o\'z ichiga olmaydi', () {
      final p = DeviceSmsParser([kapital()]);
      final r = p.parse(
          SmsMessage('KAPITALBANK', '8712 Popolnenie: 8 540 000,00 UZS', at))!;
      final payload = r.toPayload('h1');
      expect(payload.containsKey('body'), isFalse);
      expect(payload.containsKey('sender'), isFalse);
      expect(payload['amountMinor'], '8540000');
      expect(payload['householdId'], 'h1');
    });
  });
}
