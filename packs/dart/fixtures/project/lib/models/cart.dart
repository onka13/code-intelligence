import 'product.dart';

sealed class CartEvent {}

class ItemAdded extends CartEvent {
  final Product product;
  ItemAdded(this.product);
}

class Cart {
  final List<Product> items = [];

  double get total => items.fold(0, (sum, p) => sum + p.price);

  void add(Product product) {
    final existing = items.where((p) => p.id == product.id);
    if (existing.isEmpty) items.add(product);
  }
}
