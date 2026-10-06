import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/money.dart';
import '../../models/comparison.dart';

/// "Yubordim" ekrani.
///
/// Bu yerda prognoz hisoblanadi — keyinchalik SMS shu prognozga qarab
/// avtomatik bog'lanadi. Prognozsiz moslashtirish umuman ishlamaydi.
class DeclareTransferScreen extends StatefulWidget {
  final ApiClient api;
  final String householdId;
  const DeclareTransferScreen({
    super.key,
    required this.api,
    required this.householdId,
  });

  @override
  State<DeclareTransferScreen> createState() => _DeclareTransferScreenState();
}

class _DeclareTransferScreenState extends State<DeclareTransferScreen> {
  final _amount = TextEditingController(text: '1000000');
  Comparison? _comparison;
  String? _slug;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.api.comparison().then((c) {
      if (!mounted) return;
      setState(() {
        _comparison = c;
        _slug = c.rows.isNotEmpty ? c.rows.first.providerSlug : null;
      });
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  BigInt? get _krw {
    final raw = _amount.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (raw.isEmpty) return null;
    final v = BigInt.tryParse(raw);
    return (v == null || v <= BigInt.zero) ? null : v;
  }

  /// Tanlangan kanal kotirovkasidan proporsional prognoz
  Money? get _expected {
    final krw = _krw;
    final c = _comparison;
    if (krw == null || c == null || _slug == null) return null;
    final row = c.rows.where((r) => r.providerSlug == _slug).firstOrNull;
    if (row == null) return null;
    final perMillion = row.recvPerMillionKrw.minor;
    return Money.uzs(perMillion * krw ~/ BigInt.from(1000000));
  }

  Future<void> _submit() async {
    final krw = _krw;
    if (krw == null) {
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
        sentMinorKrw: krw,
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
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Qancha yubordingiz (KRW)',
              errorText: _error,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          if (_comparison == null)
            const LinearProgressIndicator()
          else if (_comparison!.rows.isEmpty)
            const Text('Kanallar ro\'yxati bo\'sh — kurs yuklanmagan.')
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
          const SizedBox(height: 24),
          if (expected != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.teal.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Taxminan yetib boradi',
                      style: TextStyle(fontSize: 12, color: Colors.black54)),
                  const SizedBox(height: 4),
                  Text(expected.display,
                      style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  const Text(
                    'Aniq summa bank xabari kelganda ma\'lum bo\'ladi.',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 24),
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
