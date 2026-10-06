import 'package:flutter/material.dart';
import 'core/settings.dart';
import 'features/home_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final settings = await Settings.load();
  runApp(RemitApp(settings: settings));
}

class RemitApp extends StatelessWidget {
  final Settings settings;
  const RemitApp({super.key, required this.settings});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Remit',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
        home: HomeShell(settings: settings),
      );
}
