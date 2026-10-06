import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/settings.dart';
import 'rates/rates_screen.dart';
import 'goals/goals_screen.dart';
import 'transfers/declare_transfer_screen.dart';
import 'transfers/pending_list_screen.dart';
import 'settings/settings_screen.dart';

/// Ikki tab: Kurslar (hamma ko'radi) va Maqsadlar (oila kodi kerak).
///
/// Oila kodi kiritilmagan bo'lsa ilova baribir foydali qoladi — kurslar
/// hech qanday ro'yxatdan o'tishsiz ishlaydi. Bu ataylab: birinchi qiymat
/// darhol, ro'yxatdan o'tish keyin.
class HomeShell extends StatefulWidget {
  final Settings settings;
  const HomeShell({super.key, required this.settings});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  /// O'tkazma qo'shilgandan keyin ro'yxatni majburan qayta qurish uchun
  int _pendingEpoch = 0;
  late ApiClient _api = ApiClient(widget.settings.apiUrl);

  Future<void> _openSettings(BuildContext context) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => SettingsScreen(settings: widget.settings)),
    );
    if (changed == true) {
      setState(() => _api = ApiClient(widget.settings.apiUrl));
    }
  }

  @override
  Widget build(BuildContext context) {
    final household = widget.settings.householdId;

    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          RatesScreen(api: _api, onOpenSettings: _openSettings),
          if (household == null)
            _NeedHousehold(onOpenSettings: () => _openSettings(context))
          else
            PendingListScreen(
              key: ValueKey('pending-$_pendingEpoch'),
              api: _api,
              householdId: household,
            ),
          if (household == null)
            _NeedHousehold(onOpenSettings: () => _openSettings(context))
          else
            GoalsScreen(api: _api, householdId: household),
        ],
      ),
      floatingActionButton: (household == null || _index == 2)
          ? null
          : (FloatingActionButton.extended(
                  onPressed: () async {
                    final saved = await Navigator.of(context).push<bool>(
                      MaterialPageRoute(
                        builder: (_) => DeclareTransferScreen(
                          api: _api,
                          householdId: household,
                        ),
                      ),
                    );
                    if (saved == true && mounted) {
                      // Yangi o'tkazma darhol ro'yxatda ko'rinsin
                      setState(() {
                        _pendingEpoch++;
                        _index = 1;
                      });
                    }
                  },
                  icon: const Icon(Icons.send),
                  label: const Text('Yubordim'),
                )),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.compare_arrows), label: 'Kurslar'),
          NavigationDestination(
              icon: Icon(Icons.inbox_outlined), label: 'Kutilmoqda'),
          NavigationDestination(icon: Icon(Icons.flag_outlined), label: 'Maqsadlar'),
        ],
      ),
    );
  }
}

class _NeedHousehold extends StatelessWidget {
  final VoidCallback onOpenSettings;
  const _NeedHousehold({required this.onOpenSettings});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Maqsadlar')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Oila kodi kiritilmagan.\n\n'
                  'Maqsadlar va o\'tkazmalar oilaviy bo\'ladi — shuning uchun '
                  'avval oila kodini kiriting.',
                  textAlign: TextAlign.center,
                  style: TextStyle(height: 1.5),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: onOpenSettings,
                  child: const Text('Sozlamalarni ochish'),
                ),
              ],
            ),
          ),
        ),
      );
}
