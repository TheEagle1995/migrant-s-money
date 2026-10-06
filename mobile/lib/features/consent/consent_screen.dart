import 'package:flutter/material.dart';

/// Qabul qiluvchi tomon ekrani.
///
/// Freyming ataylab shunday: NAZORAT emas, UMUMIY MAQSAD.
/// "Pul qayerga ketayotganini bilish" degan matn ota-onaga audit bo'lib
/// tuyuladi va oilaviy nizoga sabab bo'ladi. Shuning uchun bu yerda
/// tekshiruv haqida emas, birgalikda yig'ish haqida gapiriladi.
class ConsentScreen extends StatefulWidget {
  final Future<void> Function(bool granted) onDecision;
  const ConsentScreen({super.key, required this.onDecision});

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 32),
              const Text('Birgalikda maqsadga',
                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              const Text(
                'Oilangiz bilan bitta maqsad qo\'yasiz — masalan uy ta\'miri yoki '
                'o\'qish puli. Ilova bankdan keladigan xabarlarni o\'qib, maqsadga '
                'qancha yig\'ilganini ko\'rsatadi.',
                style: TextStyle(fontSize: 15, height: 1.5),
              ),
              const SizedBox(height: 24),
              const _Point('Xabarlar faqat shu telefonda o\'qiladi.'),
              const _Point('Xabar matni hech qayerga yuborilmaydi.'),
              const _Point('Faqat summa va sana saqlanadi.'),
              const _Point('Istalgan vaqtda o\'chirib qo\'yishingiz mumkin.'),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _busy ? null : () => _decide(true),
                  child: const Text('Roziman'),
                ),
              ),
              TextButton(
                onPressed: _busy ? null : () => _decide(false),
                child: const Text('Hozir emas'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _decide(bool granted) async {
    setState(() => _busy = true);
    await widget.onDecision(granted);
    if (mounted) setState(() => _busy = false);
  }
}

class _Point extends StatelessWidget {
  final String text;
  const _Point(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.check, size: 18, color: Colors.green),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
        ]),
      );
}
