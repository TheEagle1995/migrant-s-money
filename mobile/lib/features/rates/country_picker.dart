import 'package:flutter/material.dart';
import '../../models/corridor.dart';

/// Davlat tanlash — 29 davlat bo'lgani uchun qidiruv bilan.
Future<CountryInfo?> showCountryPicker(
  BuildContext context, {
  required String title,
  required List<CountryInfo> items,
  String? currentCode,
}) {
  return Navigator.of(context).push<CountryInfo>(
    MaterialPageRoute(
      builder: (_) => _CountryPickerPage(
        title: title,
        items: items,
        currentCode: currentCode,
      ),
    ),
  );
}

class _CountryPickerPage extends StatefulWidget {
  final String title;
  final List<CountryInfo> items;
  final String? currentCode;
  const _CountryPickerPage({
    required this.title,
    required this.items,
    this.currentCode,
  });

  @override
  State<_CountryPickerPage> createState() => _CountryPickerPageState();
}

class _CountryPickerPageState extends State<_CountryPickerPage> {
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  List<CountryInfo> get _filtered {
    final q = _q.text.trim().toLowerCase();
    if (q.isEmpty) return widget.items;
    return widget.items
        .where((c) =>
            c.name.toLowerCase().contains(q) ||
            c.code.toLowerCase().contains(q) ||
            c.currency.toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = _filtered;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _q,
              autofocus: true,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Davlat izlash…',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
            ),
          ),
          Expanded(
            child: list.isEmpty
                ? const Center(child: Text('Topilmadi'))
                : ListView.separated(
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final c = list[i];
                      final selected = c.code == widget.currentCode;
                      return ListTile(
                        leading: Text(c.flag, style: const TextStyle(fontSize: 22)),
                        title: Text(c.name,
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        trailing: Text(c.currency,
                            style: const TextStyle(fontSize: 12)),
                        selected: selected,
                        onTap: () => Navigator.of(context).pop(c),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
