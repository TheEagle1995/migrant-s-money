import 'package:flutter/material.dart';
import 'dart:async';
import '../../core/api_client.dart';
import '../../core/money.dart';
import '../../models/comparison.dart';
import '../../models/corridor.dart';
import 'country_picker.dart';

/// Asosiy ekran.
///
/// Yuqorida yo'nalish va summa: summa oldindan namunaviy qiymat bilan
/// to'ldirilgan (~100 USD ekvivalenti), foydalanuvchi uni o'chirib o'z
/// summasini kiritadi va ro'yxat darhol qayta hisoblanadi.
class RatesScreen extends StatefulWidget {
  final ApiClient api;
  final Future<void> Function(BuildContext context)? onOpenSettings;
  /// Tanlangan yo'nalish o'zgarganda — "Yubordim" ekrani shuni oladi
  final void Function(String corridorId)? onCorridorChanged;
  const RatesScreen({
    super.key,
    required this.api,
    this.onOpenSettings,
    this.onCorridorChanged,
  });

  @override
  State<RatesScreen> createState() => _RatesScreenState();
}

class _RatesScreenState extends State<RatesScreen> {
  final _amount = TextEditingController();
  Timer? _debounce;

  List<SendOption> _options = [];
  SendOption? _from;
  CountryInfo? _to;
  Comparison? _result;
  String? _error;
  bool _loading = true;
  bool _userTyped = false;
  String _method = 'ALL';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final opts = await widget.api.countries();
      if (opts.isEmpty) throw ApiException(200, 'koridor yo\'q');
      // Koreyadan boshlaymiz, bo'lmasa birinchisidan
      final start = opts.firstWhere(
        (o) => o.country.code == 'KR',
        orElse: () => opts.first,
      );
      final to = start.to.firstWhere(
        (c) => c.code == 'UZ',
        orElse: () => start.to.first,
      );
      setState(() {
        _options = opts;
        _from = start;
        _to = to;
      });
      await _load(resetAmount: true);
    } on ApiException catch (e) {
      setState(() {
        _error = 'Server javob bermadi (${e.status})';
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Serverga ulanmadi';
        _loading = false;
      });
    }
  }

  String get _corridorId => '${_from!.country.code}-${_to!.code}';

  Future<void> _load({bool resetAmount = false}) async {
    if (_from == null || _to == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await widget.api.comparison(
        _corridorId,
        amountMajor: resetAmount || !_userTyped ? null : _amount.text,
      );
      if (!mounted) return;
      widget.onCorridorChanged?.call(_corridorId);
      setState(() {
        _result = r;
        _loading = false;
        if (resetAmount || !_userTyped) {
          // Server qaytargan namunaviy qiymatni maydonga yozamiz
          _amount.text = r.amountSend.formatted;
          _userTyped = false;
        }
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Yuklanmadi (${e.status})';
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Serverga ulanmadi';
        _loading = false;
      });
    }
  }

  void _onAmountChanged(String _) {
    _userTyped = true;
    _debounce?.cancel();
    // Har bir harfda so'rov yubormaslik uchun kechiktirib yuboramiz
    _debounce = Timer(const Duration(milliseconds: 350), () => _load());
  }

  Future<void> _pick({required bool isFrom}) async {
    final items = isFrom
        ? _options.map((o) => o.country).toList()
        : (_from?.to ?? const <CountryInfo>[]);
    final selected = await showCountryPicker(
      context,
      title: isFrom ? 'Qayerdan' : 'Qayerga',
      items: items,
      currentCode: isFrom ? _from?.country.code : _to?.code,
    );
    if (selected == null) return;

    setState(() {
      if (isFrom) {
        _from = _options.firstWhere((o) => o.country.code == selected.code);
        if (!_from!.to.any((c) => c.code == _to?.code)) _to = _from!.to.first;
      } else {
        _to = selected;
      }
      _method = 'ALL';
    });
    await _load(resetAmount: true);
  }

  Future<void> _swap() async {
    final target = _options.where((o) => o.country.code == _to?.code);
    if (target.isEmpty ||
        !target.first.to.any((c) => c.code == _from?.country.code)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Teskari yo\'nalish hali qo\'shilmagan.')),
      );
      return;
    }
    final newTo = _from!.country;
    setState(() {
      _from = target.first;
      _to = newTo;
      _method = 'ALL';
    });
    await _load(resetAmount: true);
  }

  List<ComparisonRow> get _rows {
    final all = _result?.rows ?? const <ComparisonRow>[];
    if (_method == 'ALL') return all;
    return all.where((r) => r.payoutMethod == _method).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chiroq'),
        actions: [
          if (widget.onOpenSettings != null)
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              tooltip: 'Sozlamalar',
              onPressed: () async {
                await widget.onOpenSettings!(context);
                if (mounted) _bootstrap();
              },
            ),
        ],
      ),
      body: Column(
        children: [
          if (_from != null && _to != null) _entry(),
          Expanded(child: _results()),
        ],
      ),
    );
  }

  Widget _entry() {
    final cur = _from!.country.currency;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _leg(_from!.country, 'Qayerdan', () => _pick(isFrom: true))),
              IconButton(
                onPressed: _swap,
                icon: const Icon(Icons.swap_horiz),
                tooltip: 'Teskari',
              ),
              Expanded(child: _leg(_to!, 'Qayerga', () => _pick(isFrom: false))),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  onChanged: _onAmountChanged,
                  onTap: () {
                    // Namunaviy qiymat bosilganda butunlay tanlanadi
                    if (!_userTyped) {
                      _amount.selection = TextSelection(
                        baseOffset: 0,
                        extentOffset: _amount.text.length,
                      );
                    }
                  },
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: _userTyped
                        ? null
                        : Theme.of(context).textTheme.bodySmall?.color,
                  ),
                  decoration: InputDecoration(
                    labelText: 'Qancha yuborasiz',
                    suffixText: cur,
                    border: const OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.outlined(
                onPressed: () {
                  _amount.clear();
                  _userTyped = true;
                  setState(() {});
                },
                icon: const Icon(Icons.close),
                tooltip: 'Tozalash',
              ),
            ],
          ),
          const SizedBox(height: 7),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              _userTyped
                  ? '${_rows.length} kanal taqqoslandi'
                  : 'Namunaviy summa — o\'chirib o\'z summangizni kiriting',
              style: TextStyle(
                fontSize: 12,
                color: _userTyped
                    ? Theme.of(context).textTheme.bodySmall?.color
                    : Theme.of(context).colorScheme.primary,
                fontWeight: _userTyped ? null : FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _leg(CountryInfo c, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: Theme.of(context).dividerColor),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Text(c.flag, style: const TextStyle(fontSize: 19)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 10)),
                  Text(
                    c.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _results() {
    if (_loading && _result == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  Text(
                    'Server manzili: ${widget.api.baseUrl}',
                    style: const TextStyle(fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _bootstrap, child: const Text('Qayta urinish')),
                ],
              ),
            ),
          ),
        ],
      );
    }

    final rows = _rows;
    final r = _result;
    if (r == null || rows.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 80),
          Padding(
            padding: EdgeInsets.all(28),
            child: Text(
              'Bu yo\'nalish uchun hali o\'lchov kiritilmagan.\n\n'
              'Kurslar qo\'lda o\'lchanadi va serverga yuklanadi.',
              textAlign: TextAlign.center,
              style: TextStyle(height: 1.6),
            ),
          ),
        ],
      );
    }

    final best = rows.first;
    return RefreshIndicator(
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Eng ko\'p yetkazadi',
              style: TextStyle(
                  fontSize: 11,
                  letterSpacing: .5,
                  color: Theme.of(context).textTheme.bodySmall?.color)),
          const SizedBox(height: 2),
          Text(
            best.recvNormalized.display,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          Text('${best.displayName} · ${_methodLabel(best.payoutMethod)}',
              style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 14),
          _methodFilter(),
          if (rows.length > 1) ...[
            const SizedBox(height: 14),
            _spreadNote(r, rows),
          ],
          const SizedBox(height: 14),
          ...rows.asMap().entries.map((e) => _row(e.key, e.value, best)),
          const SizedBox(height: 16),
          Text(
            'Tartib faqat qo\'lga tekkan summa bo\'yicha. Reklama uchun o\'rin '
            'sotilmaydi — eng yuqoridagi kanal eng ko\'p to\'laydigan emas, '
            'eng ko\'p pul yetkazadigan.',
            style: TextStyle(
                fontSize: 11.5,
                height: 1.5,
                color: Theme.of(context).textTheme.bodySmall?.color),
          ),
        ],
      ),
    );
  }

  Widget _methodFilter() {
    final avail = {
      for (final r in _result?.rows ?? const <ComparisonRow>[])
        if (r.payoutMethod != null) r.payoutMethod!
    };
    if (avail.length < 2) return const SizedBox.shrink();
    final keys = ['ALL', ...avail];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: keys
            .map((k) => Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(_methodLabel(k == 'ALL' ? null : k)),
                    selected: _method == k,
                    onSelected: (_) => setState(() => _method = k),
                  ),
                ))
            .toList(),
      ),
    );
  }

  Widget _spreadNote(Comparison r, List<ComparisonRow> rows) {
    final worst = rows.last;
    final diff = Money(
      best(rows).recvNormalized.minor - worst.recvNormalized.minor,
      r.recvCurrency,
    );
    final annual = Money(diff.minor * BigInt.from(12), r.recvCurrency);
    final pct = worst.recvNormalized.minor == BigInt.zero
        ? 0.0
        : (best(rows).recvNormalized.minor / worst.recvNormalized.minor - 1) * 100;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withOpacity(.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        'Eng yaxshi va eng yomon orasidagi farq: ${pct.toStringAsFixed(1)}%.\n'
        'Yiliga 12 o\'tkazmada — ${annual.display}.',
        style: const TextStyle(fontSize: 12.5, height: 1.5),
      ),
    );
  }

  ComparisonRow best(List<ComparisonRow> rows) => rows.first;

  Widget _row(int i, ComparisonRow row, ComparisonRow best) {
    final isFirst = i == 0;
    final gap = best.recvNormalized.minor == BigInt.zero
        ? 0.0
        : (row.recvNormalized.minor / best.recvNormalized.minor - 1) * 100;
    return Card(
      elevation: isFirst ? 1 : 0,
      color: isFirst
          ? Theme.of(context).colorScheme.primary.withOpacity(.10)
          : null,
      margin: const EdgeInsets.only(bottom: 7),
      child: ListTile(
        leading: CircleAvatar(
          radius: 14,
          backgroundColor: isFirst
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).dividerColor,
          child: Text('${i + 1}', style: const TextStyle(fontSize: 11)),
        ),
        title: Text(row.displayName,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Wrap(spacing: 8, children: [
          Text(_methodLabel(row.payoutMethod), style: const TextStyle(fontSize: 11)),
          if (row.isPromotional)
            const Text('promo', style: TextStyle(fontSize: 11)),
          if (row.isStale)
            Text('${row.staleHours} soat oldin', style: const TextStyle(fontSize: 11)),
          if (row.etaMinutes != null)
            Text(_eta(row.etaMinutes!), style: const TextStyle(fontSize: 11)),
        ]),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(row.recvNormalized.formatted,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: isFirst ? FontWeight.w700 : FontWeight.w500,
                  color: isFirst ? Theme.of(context).colorScheme.primary : null,
                )),
            if (!isFirst)
              Text('${gap.toStringAsFixed(1)}%',
                  style: const TextStyle(fontSize: 10.5)),
          ],
        ),
      ),
    );
  }

  static String _methodLabel(String? code) {
    switch (code) {
      case 'CARD':
        return 'Kartaga';
      case 'BANK_ACCOUNT':
        return 'Bank hisobiga';
      case 'CASH_PICKUP':
        return 'Naqd olish';
      case 'CASH_DELIVERY':
        return 'Uyga yetkazish';
      case 'WALLET':
        return 'Mobil hamyon';
      case 'MOBILE_TOPUP':
        return 'Telefon hisobiga';
      case null:
        return 'Hammasi';
      default:
        return code;
    }
  }

  static String _eta(int minutes) {
    if (minutes < 60) return '$minutes daqiqa';
    if (minutes < 1440) return '${(minutes / 60).round()} soat';
    return '${(minutes / 1440).round()} kun';
  }
}
