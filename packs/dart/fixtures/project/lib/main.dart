import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app/router.dart';
import 'services/settings_service.dart';

void main() {
  runApp(const ShopApp());
}

class ShopApp extends StatelessWidget {
  const ShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => SettingsService.instance,
      child: MaterialApp(onGenerateRoute: AppRouter.onGenerateRoute),
    );
  }
}
