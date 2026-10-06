import 'package:flutter/material.dart';
import 'core/settings.dart';
import 'features/home_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final settings = await Settings.load();
  runApp(ChiroqApp(settings: settings));
}

class ChiroqApp extends StatelessWidget {
  final Settings settings;
  const ChiroqApp({super.key, required this.settings});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Chiroq',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
        home: HomeShell(settings: settings),
      );
}
