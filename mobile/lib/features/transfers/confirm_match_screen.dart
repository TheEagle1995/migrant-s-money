import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/money.dart';
import '../../models/goal.dart';

class MatchCandidate {
  final String eventId;
  final Money amount;
  final DateTime occurredAt;
  final String bankSlug;
  final double deviation;
  final bool isStrong;

  const MatchCandidate({
    required this.eventId,
    required this.amount,
    required this.occurredAt,
    required this.bankSlug,
    required this.deviation,
    required this.isStrong,
  });

  factory MatchCandidate.fromJson(Map<String, dynamic> j) => MatchCandidate(
        eventId: j['eventId'] as String,
        amount: Money.uzs(BigInt.parse(j['amountMinor'] as String)),
        occurredAt: DateTime.parse(j['occurredAt'] as String),
        bankSlug: j['bankSlug'] as String,
        deviation: (j['deviation'] as num).toDouble(),
        isStrong: j['isStrong'] as bool? ?? false,
      );
}

/// "Qaysi biri?" ekrani.
///
/// Backend bir nechta nomzod topsa avtomatik bog'lamaydi — bu ataylab.
/// Noto'g'ri avtomatik moslik moliyaviy tarixni jimgina buzadi va
/// foydalanuvchi buni sezmaydi. Shubha bo'lsa — so'raymiz.
class ConfirmMatchScreen extends StatefulWidget {
  final ApiClient api;
  final PendingTransfer transfer;
  const ConfirmMatchScreen({
    super.key,
    required this.api,
    required this.transfer,
  });

  @override
  State<ConfirmMatchScreen> createState() => _ConfirmMatchScreenState();
}

class _ConfirmMatchScreenState extends State<ConfirmMatchScreen> {
  late Future<List<MatchCandidate>> _future = _load();
  bool _busy = false;

  Future<List<MatchCandidate>> _load() async {
    final raw = await widget.api.matchCandidates(widget.transfer.id);
    return raw.map(MatchCandidate.fromJson).toList();
  }

  Future<void> _choose(MatchCandidate c) async {
    setState(() => _busy = true);
    try {
      await widget.api.confirmMatch(widget.transfer.id, c.eventId);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Tasdiqlanmadi (${e.status})')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.transfer;
    return Scaffold(
      appBar: AppBar(title: const Text('Qaysi biri?')),
      body: FutureBuilder<List<MatchCandidate>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return const Center(child: Text('Yuklanmadi.'));
          }
          final items = snap.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Yuborilgan: ${t.sent.formatted} KRW'),
                    if (t.expected != null)
                      Text('Kutilgan: ${t.expected!.display}',
                          style: const TextStyle(color: Colors.black54)),
                    Text('Sana: ${_fmt(t.declaredAt)}',
                        style: const TextStyle(
                            fontSize: 12, color: Colors.black54)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Mos keladigan bank xabari topilmadi.\n\n'
                    'Pul hali yetib bormagan bo\'lishi mumkin — '
                    'odatda bir necha soat vaqt oladi.',
                    textAlign: TextAlign.center,
                    style: TextStyle(height: 1.5),
                  ),
                )
              else ...[
                const Text('Qaysi tushum shu o\'tkazma?',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                ...items.map((c) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        enabled: !_busy,
                        onTap: () => _choose(c),
                        title: Text(c.amount.display,
                            style: const TextStyle(
                                fontSize: 17, fontWeight: FontWeight.w600)),
                        subtitle: Text(
                          '${c.bankSlug} · ${_fmt(c.occurredAt)}\n'
                          'Farq: ${(c.deviation * 100).toStringAsFixed(1)}%',
                        ),
                        isThreeLine: true,
                        trailing: c.isStrong
                            ? const Icon(Icons.star, color: Colors.amber)
                            : null,
                      ),
                    )),
              ],
            ],
          );
        },
      ),
    );
  }

  static String _fmt(DateTime d) {
    final l = d.toLocal();
    String p(int v) => v.toString().padLeft(2, '0');
    return '${l.year}-${p(l.month)}-${p(l.day)} ${p(l.hour)}:${p(l.minute)}';
  }
}
