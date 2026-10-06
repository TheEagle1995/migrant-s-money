import 'package:flutter/services.dart';

/// Android SMS oqimi. iOS'da bu umuman mumkin emas — Android-first qarori
/// shundan kelib chiqadi (O'zbekiston bozoriga mos kelishi qo'shimcha foyda).
///
/// Kanal FAQAT xom matnni Dart tomoniga uzatadi. Parsing shu yerda, qurilmada
/// bajariladi va serverga faqat strukturalangan natija ketadi.
class SmsChannel {
  static const _events = EventChannel('uz.chiroq/sms');
  static const _methods = MethodChannel('uz.chiroq/sms_control');

  /// Har bir element: {sender, body, receivedAt}
  static Stream<SmsMessage> stream() => _events
      .receiveBroadcastStream()
      .map((e) => SmsMessage.fromMap(Map<String, dynamic>.from(e as Map)));

  static Future<bool> requestPermission() async =>
      await _methods.invokeMethod<bool>('requestPermission') ?? false;

  static Future<bool> hasPermission() async =>
      await _methods.invokeMethod<bool>('hasPermission') ?? false;

  /// Foydalanuvchi rozilikni qaytarib olganda — tinglashni to'xtatish
  static Future<void> stop() => _methods.invokeMethod('stop');
}

class SmsMessage {
  final String sender;
  final String body;
  final DateTime receivedAt;
  const SmsMessage(this.sender, this.body, this.receivedAt);

  factory SmsMessage.fromMap(Map<String, dynamic> m) => SmsMessage(
        m['sender'] as String? ?? '',
        m['body'] as String? ?? '',
        DateTime.fromMillisecondsSinceEpoch(
            (m['receivedAt'] as num?)?.toInt() ?? 0),
      );
}
