import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/settings_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsService>();
    return SwitchListTile(
      title: const Text('Dark mode'),
      value: settings.darkMode,
      onChanged: settings.setDarkMode,
    );
  }
}
