import 'package:shared_preferences/shared_preferences.dart';

/// APK bir marta quriladi, lekin server manzili har kimda boshqacha bo'lishi
/// mumkin (lokal test, staging, prod). Shuning uchun URL build vaqtida emas,
/// ish vaqtida sozlanadi.
class Settings {
  static const _kApiUrl = 'api_url';
  static const _kHousehold = 'household_id';
  static const _kSmsConsent = 'sms_consent';

  static const defaultApiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  final SharedPreferences _prefs;
  Settings(this._prefs);

  static Future<Settings> load() async =>
      Settings(await SharedPreferences.getInstance());

  String get apiUrl => _prefs.getString(_kApiUrl) ?? defaultApiUrl;
  Future<void> setApiUrl(String v) => _prefs.setString(_kApiUrl, v.trim());

  String? get householdId => _prefs.getString(_kHousehold);
  Future<void> setHouseholdId(String v) => _prefs.setString(_kHousehold, v);

  bool get smsConsent => _prefs.getBool(_kSmsConsent) ?? false;
  Future<void> setSmsConsent(bool v) => _prefs.setBool(_kSmsConsent, v);

  bool get isConfigured => apiUrl.isNotEmpty;
}
