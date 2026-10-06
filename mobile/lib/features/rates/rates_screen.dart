import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../models/comparison.dart';

/// Mahsulotning yagona asosiy ekrani:
/// "1 000 000 KRW yuborsangiz — onangiz qo'liga necha so'm tegadi?"
class RatesScreen extends StatefulWidget {
  final ApiClient api;
  final Future<void> Function(BuildContext context)? onOpenSettings;
  const RatesScreen({super.key, required this.api, this.onOpenSettings});

  @override
  State<RatesScreen> createState() => _RatesScreenState();
}

class _RatesScreenState extends State<RatesScreen> {
  late Future<Comparison> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.comparison();
  }

  Future<void> _refresh() async {
    setState(() => _future = widget.api.comparison());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kurslar'),
        actions: [
          if (widget.onOpenSettings != null)
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              tooltip: 'Sozlamalar',
              onPressed: () async {
                await widget.onOpenSettings!(context);
                if (mounted) _refresh();
              },
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<Comparison>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return _Message(
                text: 'Ma\'lumot yuklanmadi.\n\n'
                    'Server manzili to\'g\'rimi? Sozlamalardan tekshiring.\n'
                    'Hozirgi manzil: ${widget.api.baseUrl}',
                onRetry: _refresh,
              );
            }
            final c = snap.data!;
            if (c.rows.isEmpty) {
              // Soxta raqam ko'rsatilmaydi. Ma'lumot yo'q bo'lsa - shunday deyiladi.
              return const _Message(
                text: 'Hozircha o\'lchov kiritilmagan.\n\n'
                    'Kurslar qo\'lda o\'lchanadi va serverga yuklanadi.',
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  '1 000 000 KRW yuborsangiz\nqancha so\'m keladi',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 16),
                ...c.rows.map((r) => _RateCard(row: r)),
                const SizedBox(height: 16),
                if (c.rows.length > 1) _SpreadNote(c: c),
                const SizedBox(height: 24),
                const Text(
                  'Tartib faqat qo\'lga tekkan summa bo\'yicha. '
                  'Reklama uchun o\'rin sotilmaydi.',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _RateCard extends StatelessWidget {
  final ComparisonRow row;
  const _RateCard({required this.row});

  @override
  Widget build(BuildContext context) {
    final best = row.rank == 1;
    return Card(
      elevation: best ? 2 : 0,
      color: best ? Colors.green.shade50 : null,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: best ? Colors.green : Colors.grey.shade300,
          foregroundColor: best ? Colors.white : Colors.black87,
          child: Text('${row.rank}'),
        ),
        title: Text(row.displayName,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(row.recvPerMillionKrw.display,
                style: const TextStyle(fontSize: 18, color: Colors.black87)),
            if (!best)
              Text('${(row.gapFromBest * 100).toStringAsFixed(1)}%',
                  style: TextStyle(color: Colors.red.shade700, fontSize: 12)),
            Wrap(spacing: 8, children: [
              if (row.isPromotional) const _Tag('promo', Colors.orange),
              // Eskirgan ma'lumot YASHIRILMAYDI — ochiq belgilanadi
              if (row.isStale)
                _Tag('${row.staleHours} soat oldin', Colors.grey),
              if (row.etaMinutes != null)
                _Tag('${(row.etaMinutes! / 60).toStringAsFixed(0)} soatda',
                    Colors.blueGrey),
            ]),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String text;
  final Color color;
  const _Tag(this.text, this.color);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(text, style: TextStyle(fontSize: 11, color: color)),
      );
}

class _SpreadNote extends StatelessWidget {
  final Comparison c;
  const _SpreadNote({required this.c});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          'Eng yaxshi va eng yomon kanal orasidagi farq: '
          '${(c.spread * 100).toStringAsFixed(1)}%.\n'
          'Yiliga 12 o\'tkazmada — ${c.annualLoss.display}.',
          style: const TextStyle(fontSize: 13),
        ),
      );
}

class _Message extends StatelessWidget {
  final String text;
  final Future<void> Function()? onRetry;
  const _Message({required this.text, this.onRetry});
  @override
  Widget build(BuildContext context) => ListView(
        children: [
          const SizedBox(height: 120),
          Center(child: Text(text, textAlign: TextAlign.center)),
          if (onRetry != null)
            Center(
              child: TextButton(
                  onPressed: () => onRetry!(), child: const Text('Qayta urinish')),
            ),
        ],
      );
}
