import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api_client.dart';

/// Offline navbat.
///
/// Muammo: bank SMS'i keladi, lekin telefonda internet yo'q. Xabar bir marta
/// keladi va qaytarib bo'lmaydi — yo'qotsak, o'sha tranzaksiya butunlay
/// yo'qoladi. Shuning uchun parse natijasi avval diskka yoziladi, keyin
/// yuborishga urinamiz.
class EventQueue {
  static const _key = 'pending_events';
  static const maxItems = 200;

  final SharedPreferences _prefs;
  final ApiClient _api;

  EventQueue(this._prefs, this._api);

  List<Map<String, dynamic>> _read() {
    final raw = _prefs.getStringList(_key) ?? const [];
    return raw
        .map((s) {
          try {
            return jsonDecode(s) as Map<String, dynamic>;
          } catch (_) {
            return <String, dynamic>{};
          }
        })
        .where((m) => m.isNotEmpty)
        .toList();
  }

  Future<void> _write(List<Map<String, dynamic>> items) async {
    // Eng eskilarini tashlab, oxirgi maxItems ni saqlaymiz
    final trimmed =
        items.length > maxItems ? items.sublist(items.length - maxItems) : items;
    await _prefs.setStringList(
        _key, trimmed.map((m) => jsonEncode(m)).toList());
  }

  int get pendingCount => _read().length;

  /// Avval saqlaymiz, keyin yuboramiz. Tartib muhim.
  Future<void> enqueue(Map<String, dynamic> payload) async {
    final items = _read()..add(payload);
    await _write(items);
    await flush();
  }

  /// Navbatni yuborishga urinish. Muvaffaqiyatsizlarni saqlab qoladi.
  Future<int> flush() async {
    final items = _read();
    if (items.isEmpty) return 0;

    final remaining = <Map<String, dynamic>>[];
    var sent = 0;

    for (final item in items) {
      try {
        await _api.sendEvent(item);
        sent++;
      } on ApiException catch (e) {
        // 4xx — server bu ma'lumotni hech qachon qabul qilmaydi (masalan
        // rozilik yo'q yoki format buzuq). Qayta urinish befoyda, tashlaymiz.
        if (e.status >= 400 && e.status < 500) continue;
        remaining.add(item);
      } catch (_) {
        // Tarmoq xatosi — keyinroq qayta urinamiz
        remaining.add(item);
      }
    }

    await _write(remaining);
    return sent;
  }

  Future<void> clear() => _prefs.remove(_key);
}
