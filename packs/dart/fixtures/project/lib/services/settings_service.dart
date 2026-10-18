import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsService extends ChangeNotifier {
  SettingsService._();

  static final SettingsService _instance = SettingsService._();
  static SettingsService get instance => _instance;

  late SharedPreferences _prefs;
  bool _darkMode = false;

  bool get darkMode => _darkMode;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    _darkMode = _prefs.getBool('darkMode') ?? false;
    notifyListeners();
  }

  Future<void> setDarkMode(bool value) async {
    _darkMode = value;
    await _prefs.setBool('darkMode', value);
    notifyListeners();
  }
}
