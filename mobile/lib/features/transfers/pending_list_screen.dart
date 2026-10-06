import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../models/goal.dart';
import 'confirm_match_screen.dart';

/// Kutilayotgan o'tkazmalar — hali bank xabari bilan bog'lanmaganlari.
class PendingListScreen extends StatefulWidget {
  final ApiClient api;
  final String householdId;
  const PendingListScreen({
    super.key,
    required this.api,
    required this.householdId,
  });

  @override
  State<PendingListScreen> createState() => _PendingListScreenState();
}

class _PendingListScreenState extends State<PendingListScreen> {
  late Future<List<PendingTransfer>> _future =
      widget.api.pendingTransfers(widget.householdId);

  Future<void> _refresh() async {
    setState(() => _future = widget.api.pendingTransfers(widget.householdId));
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kutilayotgan o\'tkazmalar')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<PendingTransfer>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(children: const [
                SizedBox(height: 120),
                Center(child: Text('Yuklanmadi. Pastga torting.')),
              ]);
            }
            final items = snap.data!;
            if (items.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Padding(
                  padding: EdgeInsets.all(32),
                  child: Text(
                    'Kutilayotgan o\'tkazma yo\'q.\n\n'
                    'Hammasi bank xabarlari bilan bog\'langan.',
                    textAlign: TextAlign.center,
                    style: TextStyle(height: 1.5),
                  ),
                ),
              ]);
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: items
                  .map((t) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text('${t.sent.formatted} KRW'),
                          subtitle: Text(
                            t.expected != null
                                ? 'Kutilmoqda: ${t.expected!.display}'
                                : 'Prognoz yo\'q',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () async {
                            final done = await Navigator.of(context).push<bool>(
                              MaterialPageRoute(
                                builder: (_) => ConfirmMatchScreen(
                                    api: widget.api, transfer: t),
                              ),
                            );
                            if (done == true) await _refresh();
                          },
                        ),
                      ))
                  .toList(),
            );
          },
        ),
      ),
    );
  }
}
