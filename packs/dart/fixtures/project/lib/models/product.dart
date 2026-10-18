enum Category { food, clothing, toys }

class Product {
  final String id;
  final String name;
  final double price;
  final Category category;

  const Product({required this.id, required this.name, required this.price, this.category = Category.food});

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(id: json['id'] as String, name: json['name'] as String, price: (json['price'] as num).toDouble());
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'price': price};
}
