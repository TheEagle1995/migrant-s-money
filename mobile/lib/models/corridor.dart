/// Koridor va davlat ma'lumotlari — serverdagi registrning ko'chirmasi.
class CountryInfo {
  final String code;
  final String name;
  final String flag;
  final String currency;
  const CountryInfo({
    required this.code,
    required this.name,
    required this.flag,
    required this.currency,
  });

  factory CountryInfo.fromJson(Map<String, dynamic> j) => CountryInfo(
        code: j['code'] as String,
        name: j['name'] as String,
        flag: j['flag'] as String? ?? '',
        currency: j['currency'] as String,
      );
}

/// Yuborish davlati va undan qaysi davlatlarga yuborish mumkinligi
class SendOption {
  final CountryInfo country;
  final List<CountryInfo> to;
  const SendOption({required this.country, required this.to});

  factory SendOption.fromJson(Map<String, dynamic> j) => SendOption(
        country: CountryInfo.fromJson(j),
        to: (j['to'] as List)
            .map((e) => CountryInfo.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class CorridorInfo {
  final String id;
  final String label;
  final String sendCountry;
  final String recvCountry;
  final String sendCurrency;
  final String recvCurrency;
  final String sendFlag;
  final String recvFlag;
  /// Ilovada oldindan yozib qo'yiladigan namunaviy summa (minor unit)
  final BigInt sampleSendMinor;

  const CorridorInfo({
    required this.id,
    required this.label,
    required this.sendCountry,
    required this.recvCountry,
    required this.sendCurrency,
    required this.recvCurrency,
    required this.sendFlag,
    required this.recvFlag,
    required this.sampleSendMinor,
  });

  factory CorridorInfo.fromJson(Map<String, dynamic> j) => CorridorInfo(
        id: j['id'] as String,
        label: j['label'] as String,
        sendCountry: j['sendCountry'] as String,
        recvCountry: j['recvCountry'] as String,
        sendCurrency: j['sendCurrency'] as String,
        recvCurrency: j['recvCurrency'] as String,
        sendFlag: j['sendFlag'] as String? ?? '',
        recvFlag: j['recvFlag'] as String? ?? '',
        sampleSendMinor: BigInt.parse(j['sampleSendMinor'] as String),
      );
}

/// Yuborish / olish usuli
class MethodInfo {
  final String code;
  final String label;
  final String? note;
  const MethodInfo({required this.code, required this.label, this.note});

  factory MethodInfo.fromJson(Map<String, dynamic> j) => MethodInfo(
        code: j['code'] as String,
        label: j['label'] as String,
        note: j['note'] as String?,
      );
}
