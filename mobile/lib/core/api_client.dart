import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/comparison.dart';
import '../models/corridor.dart';
import '../models/goal.dart';

class ApiException implements Exception {
  final int status;
  final String body;
  ApiException(this.status, this.body);
  @override
  String toString() => 'ApiException($status): $body';
}

class ApiClient {
  final String baseUrl;
  final http.Client _http;

  ApiClient(this.baseUrl, {http.Client? client})
      : _http = client ?? http.Client();

  /// Taqqoslash. `amountMajor` berilsa, shu summa uchun hisoblanadi;
  /// berilmasa server koridorning namunaviy qiymatini ishlatadi.
  Future<Comparison> comparison(String corridorId, {String? amountMajor}) async {
    final q = amountMajor != null && amountMajor.isNotEmpty
        ? '?amount=${Uri.encodeQueryComponent(amountMajor)}'
        : '';
    final r = await _http.get(Uri.parse('$baseUrl/rates/compare/$corridorId$q'));
    if (r.statusCode != 200) throw ApiException(r.statusCode, r.body);
    return Comparison.fromJson(jsonDecode(r.body) as Map<String, dynamic>);
  }

  /// Yuborish davlatlari va ularning yo'nalishlari
  Future<List<SendOption>> countries() async {
    final r = await _http.get(Uri.parse('$baseUrl/rates/countries'));
    if (r.statusCode != 200) throw ApiException(r.statusCode, r.body);
    return (jsonDecode(r.body) as List)
        .map((e) => SendOption.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<CorridorInfo>> corridors() async {
    final r = await _http.get(Uri.parse('$baseUrl/rates/corridors'));
    if (r.statusCode != 200) throw ApiException(r.statusCode, r.body);
    return (jsonDecode(r.body) as List)
        .map((e) => CorridorInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, List<MethodInfo>>> methods() async {
    final r = await _http.get(Uri.parse('$baseUrl/rates/methods'));
    if (r.statusCode != 200) throw ApiException(r.statusCode, r.body);
    final j = jsonDecode(r.body) as Map<String, dynamic>;
    List<MethodInfo> parse(String k) => (j[k] as List? ?? [])
        .map((e) => MethodInfo.fromJson(e as Map<String, dynamic>))
        .toList();
    return {'payouts': parse('payouts'), 'funding': parse('funding')};
  }

  Future<String> declareTransfer({
    required String householdId,
    required String corridorId,
    required BigInt sentMinor,
    String? providerSlug,
  }) async {
    final r = await _http.post(
      Uri.parse('$baseUrl/household/transfers'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'householdId': householdId,
        'corridorId': corridorId,
        'sentMinor': sentMinor.toString(),
        if (providerSlug != null) 'providerSlug': providerSlug,
      }),
    );
    if (r.statusCode >= 300) throw ApiException(r.statusCode, r.body);
    return (jsonDecode(r.body) as Map<String, dynamic>)['id'] as String;
  }

  /// Qurilmada parse qilingan natija. RAW SMS HECH QACHON YUBORILMAYDI.
  Future<void> sendEvent(Map<String, dynamic> parsed) async {
    final r = await _http.post(
      Uri.parse('$baseUrl/household/events'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode(parsed),
    );
    if (r.statusCode >= 300) throw ApiException(r.statusCode, r.body);
  }

  Future<List<Map<String, dynamic>>> parserTemplates(int sinceVersion) async {
    final r = await _http.get(Uri.parse('$baseUrl/parsers?since=$sinceVersion'));
    if (r.statusCode != 200) throw ApiException(r.statusCode, r.body);
    return (jsonDecode(r.body) as List).cast<Map<String, dynamic>>();
  }

  Future<List<GoalProgress>> goals(String householdId) async {
    final r = await _http.get(Uri.parse('$baseUrl/household/$householdId/goals'));
    if (r.statusCode != 200) throw ApiException(r.statusCode, r.body);
    return (jsonDecode(r.body) as List)
        .map((e) => GoalProgress.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> createGoal({
    required String householdId,
    required String title,
    required BigInt targetMinor,
    DateTime? dueDate,
  }) async {
    final r = await _http.post(
      Uri.parse('$baseUrl/household/goals'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'householdId': householdId,
        'title': title,
        'targetMinor': targetMinor.toString(),
        if (dueDate != null) 'dueDate': dueDate.toUtc().toIso8601String(),
      }),
    );
    if (r.statusCode >= 300) throw ApiException(r.statusCode, r.body);
  }

  Future<void> contribute(String goalId, BigInt amountMinor) async {
    final r = await _http.post(
      Uri.parse('$baseUrl/household/goals/contribute'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'goalId': goalId, 'amountMinor': amountMinor.toString()}),
    );
    if (r.statusCode >= 300) throw ApiException(r.statusCode, r.body);
  }

  Future<List<PendingTransfer>> pendingTransfers(String householdId) async {
    final r = await _http.get(Uri.parse('$baseUrl/household/$householdId/pending'));
    if (r.statusCode != 200) throw ApiException(r.statusCode, r.body);
    return (jsonDecode(r.body) as List)
        .map((e) => PendingTransfer.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> confirmMatch(String transferId, String eventId) async {
    final r = await _http.post(
      Uri.parse('$baseUrl/household/matches/confirm'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'transferId': transferId, 'eventId': eventId}),
    );
    if (r.statusCode >= 300) throw ApiException(r.statusCode, r.body);
  }

  Future<List<Map<String, dynamic>>> matchCandidates(String transferId) async {
    final r = await _http.get(
        Uri.parse('$baseUrl/household/transfers/$transferId/candidates'));
    if (r.statusCode != 200) throw ApiException(r.statusCode, r.body);
    return (jsonDecode(r.body) as List).cast<Map<String, dynamic>>();
  }
}
