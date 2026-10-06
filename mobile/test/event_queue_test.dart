import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:remit/core/api_client.dart';
import 'package:remit/features/consent/event_queue.dart';

class _FakeClient extends http.BaseClient {
  final List<http.BaseRequest> sent = [];
  int status;
  _FakeClient(this.status);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    sent.add(request);
    return http.StreamedResponse(
      Stream.value(utf8.encode('{}')),
      status,
    );
  }
}

Map<String, dynamic> payload(String amount) => {
      'householdId': 'h1',
      'amountMinor': amount,
      'kind': 'CREDIT',
      'bankSlug': 'kapital',
      'occurredAt': '2026-08-24T09:30:00.000Z',
      'confidence': 0.97,
      'parserVersion': 2,
    };

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('tarmoq yo\'q bo\'lsa hodisani saqlab qoladi', () async {
    final prefs = await SharedPreferences.getInstance();
    final api = ApiClient('http://x', client: _FakeClient(500));
    final q = EventQueue(prefs, api);

    await q.enqueue(payload('8540000'));
    expect(q.pendingCount, 1);
  });

  test('tarmoq tiklanganda navbatni bo\'shatadi', () async {
    final prefs = await SharedPreferences.getInstance();
    final failing = _FakeClient(500);
    var q = EventQueue(prefs, ApiClient('http://x', client: failing));

    await q.enqueue(payload('1'));
    await q.enqueue(payload('2'));
    expect(q.pendingCount, 2);

    q = EventQueue(prefs, ApiClient('http://x', client: _FakeClient(201)));
    final sent = await q.flush();

    expect(sent, 2);
    expect(q.pendingCount, 0);
  });

  test('4xx javobda qayta urinmaydi — hodisani tashlaydi', () async {
    final prefs = await SharedPreferences.getInstance();
    final q = EventQueue(prefs, ApiClient('http://x', client: _FakeClient(403)));

    await q.enqueue(payload('8540000'));
    // Rozilik yo'q — server buni hech qachon qabul qilmaydi
    expect(q.pendingCount, 0);
  });

  test('bo\'sh navbatni bo\'shatish xavfsiz', () async {
    final prefs = await SharedPreferences.getInstance();
    final q = EventQueue(prefs, ApiClient('http://x', client: _FakeClient(201)));
    expect(await q.flush(), 0);
  });

  test('navbat cheksiz o\'smaydi', () async {
    final prefs = await SharedPreferences.getInstance();
    final q = EventQueue(prefs, ApiClient('http://x', client: _FakeClient(500)));
    for (var i = 0; i < EventQueue.maxItems + 20; i++) {
      await q.enqueue(payload('$i'));
    }
    expect(q.pendingCount, EventQueue.maxItems);
  });
}
