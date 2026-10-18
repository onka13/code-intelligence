import 'package:flutter/foundation.dart';

mixin Loggable {
  String get logTag => runtimeType.toString();

  void log(String message) {
    debugPrint('[$logTag] $message');
  }
}
