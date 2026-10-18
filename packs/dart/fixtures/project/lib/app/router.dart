import 'package:flutter/material.dart';

import '../screens/home_screen.dart';
import '../screens/settings_screen.dart';

class AppRouter {
  static const String home = '/';
  static const String settings = '/settings';

  static Route<dynamic> onGenerateRoute(RouteSettings route) {
    switch (route.name) {
      case settings:
        return MaterialPageRoute(builder: (_) => const SettingsScreen());
      default:
        return MaterialPageRoute(builder: (_) => const HomeScreen());
    }
  }
}
