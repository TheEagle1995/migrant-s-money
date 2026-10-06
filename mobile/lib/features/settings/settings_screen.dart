import 'package:flutter/material.dart';
import '../../core/settings.dart';

class SettingsScreen extends StatefulWidget {
  final Settings settings;
  const SettingsScreen({super.key, required this.settings});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _url =
      TextEditingController(text: widget.settings.apiUrl);
  late final TextEditingController _household =
      TextEditingController(text: widget.settings.householdId ?? '');
  String? _error;

  @override
  void dispose() {
    _url.dispose();
    _household.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final u = _url.text.trim();
    final parsed = Uri.tryParse(u);
    if (parsed == null || !parsed.hasScheme || !parsed.hasAuthority) {
      setState(() => _error = 'Manzil noto\'g\'ri. Masalan: https://api.misol.uz');
      return;
    }
    await widget.settings.setApiUrl(u);
    if (_household.text.trim().isNotEmpty) {
      await widget.settings.setHouseholdId(_household.text.trim());
    }
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sozlamalar')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Server manzili',
              helperText: 'Emulyator uchun: http://10.0.2.2:3000',
              errorText: _error,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _household,
            decoration: const InputDecoration(
              labelText: 'Oila kodi',
              helperText: 'O\'tkazma va byudjet uchun. Kurslarni ko\'rishga shart emas.',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(onPressed: _save, child: const Text('Saqlash')),
        ],
      ),
    );
  }
}
