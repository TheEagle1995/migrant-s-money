import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/money.dart';
import '../../models/comparison.dart';

/// "Yubordim" ekrani.
///
/// Bu yerda prognoz hisoblanadi — keyinchalik bank SMS'i shu prognozga qarab
/// avtomatik bog'lanadi. Prognozsiz moslashtirish umuman ishlamaydi.
class DeclareTransferScreen extends StatefulWidget {
  final ApiClient api;
  final String householdId;
  /// Qaysi koridor uchun — kurslar ekranidan uzatiladi
  final String corridorId;
  const DeclareTransferScreen({
    super.key,
    required this.api,
    required this.householdId,
    required this.corridorId,
  });

  @override
  State<DeclareTransferScreen> createState() => _DeclareTransferScreenState();
}

class _DeclareTransferScreenState extends State<DeclareTransferScreen> {
  final _amount = TextEditingController();
  Comparison? _comparison;
  String? _slug;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.api.comparison(widget.corridorId).then((c) {
      if (!mounted) return;
      setState(() {
        _comparison = c;
        _slug = c.rows.isNotEmpty ? c.rows.first.providerSlug : null;
        if (_amount.text.isEmpty) _amount.text = c.amountSend.formatted;
      });
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  String get _sendCurrency => _comparison?.sendCurrency ?? 'USD';

  BigInt? get _sentMinor => Money.parseMajor(_amount.text, _sendCurrency);

  /// Tanlangan kanal kotirovkasidan proporsional prognoz
  Money? get _expected {
    final sent = _sentMinor;
    final c = _comparison;
    if (sent == null || c == null || _slug == null) return null;
    final row = c.rows.where((r) => r.providerSlug == _slug).firstOrNull;
    if (row == null || c.amountSend.minor == BigInt.zero) return null;
    final value = row.recvNormalized.minor * sent ~/ c.amountSend.minor;
    return Money(value, c.recvCurrency);
  }

  Future<void> _submit() async {
    final sent = _sentMinor;
    if (sent == null) {
      setState(() => _error = 'Summani kiriting');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.declareTransfer(
        householdId: widget.householdId,
        corridorId: widget.corridorId,
        sentMinor: sent,
        providerSlug: _slug,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = 'Saqlanmadi (${e.status})');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final expected = _expected;
    return Scaffold(
      appBar: AppBar(title: const Text('Pul yubordim')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_comparison != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Text(_comparison!.corridorLabel,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Qancha yubordingiz',
              suffixText: _sendCurrency,
              errorText: _error,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          if (_comparison == null)
            const LinearProgressIndicator()
          else if (_comparison!.rows.isEmpty)
            const Text('Bu koridor uchun kurs yuklanmagan.')
          else
            DropdownButtonFormField<String>(
              value: _slug,
              decoration: const InputDecoration(
                labelText: 'Qaysi kanal orqali',
                border: OutlineInputBorder(),
              ),
              items: _comparison!.rows
                  .map((r) => DropdownMenuItem(
                        value: r.providerSlug,
                        child: Text(r.displayName),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => _slug = v),
            ),
          const SizedBox(height: 22),
          if (expected != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withOpacity(.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Taxminan yetib boradi', style: TextStyle(fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(expected.display,
                      style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  const Text(
                    'Aniq summa bank xabari kelganda ma\'lum bo\'ladi.',
                    style: TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 22),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(
                    height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Saqlash'),
          ),
        ],
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
