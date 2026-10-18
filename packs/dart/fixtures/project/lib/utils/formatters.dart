extension StringCasing on String {
  String get capitalized => isEmpty ? this : '${this[0].toUpperCase()}${substring(1)}';
}

String formatPrice(double value) {
  return '\$${value.toStringAsFixed(2)}';
}

String initials(String name) => name.split(' ').map((p) => p.isEmpty ? '' : p[0]).join();
