import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/money.dart';
import '../../models/goal.dart';

/// Oilaviy maqsadlar.
///
/// Bu ekran ataylab "hisobot" emas, "maqsad" atrofida qurilgan. Farqi katta:
/// "onam nimaga sarfladi" — audit, oilaviy nizo manbai;
/// "uy ta'miriga qancha yig'ildi" — umumiy ish, ikkala tomon uchun ham qulay.
class GoalsScreen extends StatefulWidget {
  final ApiClient api;
  final String householdId;
  const GoalsScreen({super.key, required this.api, required this.householdId});

  @override
  State<GoalsScreen> createState() => _GoalsScreenState();
}

class _GoalsScreenState extends State<GoalsScreen> {
  late Future<List<GoalProgress>> _future = widget.api.goals(widget.householdId);

  Future<void> _refresh() async {
    setState(() => _future = widget.api.goals(widget.householdId));
    await _future;
  }

  Future<void> _addGoal() async {
    final result = await showModalBottomSheet<_NewGoal>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _NewGoalSheet(),
    );
    if (result == null) return;
    await widget.api.createGoal(
      householdId: widget.householdId,
      title: result.title,
      targetMinor: result.target,
    );
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Maqsadlar')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addGoal,
        icon: const Icon(Icons.add),
        label: const Text('Maqsad'),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<GoalProgress>>(
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
            final goals = snap.data!;
            if (goals.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 100),
                Padding(
                  padding: EdgeInsets.all(32),
                  child: Text(
                    'Hali maqsad yo\'q.\n\n'
                    'Oila bilan bitta narsani tanlang — uy ta\'miri, to\'y, '
                    'o\'qish puli — va unga qancha yig\'ilganini birga kuzating.',
                    textAlign: TextAlign.center,
                    style: TextStyle(height: 1.5),
                  ),
                ),
              ]);
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: goals.map((g) => _GoalCard(goal: g)).toList(),
            );
          },
        ),
      ),
    );
  }
}

class _GoalCard extends StatelessWidget {
  final GoalProgress goal;
  const _GoalCard({required this.goal});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(goal.title,
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w600)),
                ),
                if (goal.isComplete)
                  const Icon(Icons.check_circle, color: Colors.green),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: goal.ratio,
                minHeight: 8,
                backgroundColor: Colors.grey.shade200,
              ),
            ),
            const SizedBox(height: 8),
            Text('${goal.saved.formatted} / ${goal.target.display}',
                style: const TextStyle(fontSize: 13)),
            if (!goal.isComplete) ...[
              const SizedBox(height: 4),
              Text('Qoldi: ${goal.remaining.display}',
                  style: const TextStyle(fontSize: 12, color: Colors.black54)),
            ],
            if (goal.requiredPerMonth != null) ...[
              const SizedBox(height: 4),
              Text(
                'Muddatga yetish uchun oyiga ${goal.requiredPerMonth!.display}',
                style: TextStyle(fontSize: 12, color: Colors.orange.shade800),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _NewGoal {
  final String title;
  final BigInt target;
  const _NewGoal(this.title, this.target);
}

class _NewGoalSheet extends StatefulWidget {
  const _NewGoalSheet();
  @override
  State<_NewGoalSheet> createState() => _NewGoalSheetState();
}

class _NewGoalSheetState extends State<_NewGoalSheet> {
  final _title = TextEditingController();
  final _target = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _target.dispose();
    super.dispose();
  }

  void _save() {
    final raw = _target.text.replaceAll(RegExp(r'[^0-9]'), '');
    final v = BigInt.tryParse(raw);
    if (_title.text.trim().isEmpty) {
      setState(() => _error = 'Nom kiriting');
      return;
    }
    if (v == null || v <= BigInt.zero) {
      setState(() => _error = 'Summani kiriting');
      return;
    }
    Navigator.of(context).pop(_NewGoal(_title.text.trim(), v));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _title,
            decoration: const InputDecoration(
              labelText: 'Maqsad',
              hintText: 'Uy ta\'miri',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _target,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Kerakli summa (so\'m)',
              errorText: _error,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton(onPressed: _save, child: const Text('Qo\'shish')),
          ),
        ],
      ),
    );
  }
}
