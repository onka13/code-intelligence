import 'package:flutter_test/flutter_test.dart';
import 'package:shop_app/utils/formatters.dart';

void main() {
  test('formats a price', () {
    expect(formatPrice(2), '\$2.00');
  });
}
