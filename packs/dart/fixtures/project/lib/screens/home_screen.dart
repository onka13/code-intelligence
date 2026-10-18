import 'package:flutter/material.dart';

import '../models/product.dart';
import '../services/api_client.dart';
import '../utils/formatters.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiClient _client = ApiClient(baseUrl: 'https://api.example.com');
  List<Product> products = [];
  bool isLoading = false;

  @override
  void initState() {
    super.initState();
    loadProducts();
  }

  Future<void> loadProducts() async {
    setState(() => isLoading = true);
    final data = await _client.getJson('/products');
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    setState(() {
      products = items.map(Product.fromJson).toList();
      isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) return const Center(child: CircularProgressIndicator());
    return ListView(
      children: [for (final p in products) ListTile(title: Text(p.name), subtitle: Text(formatPrice(p.price)))],
    );
  }
}
