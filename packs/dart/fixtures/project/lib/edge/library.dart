library edge;

import 'dart:async';
import 'package:shop_app/models/product.dart' show Product;
import '../models/cart.dart' as cart;

export 'src/vector.dart';

part 'parts/money.dart';

typedef Mapper<T> = T Function(Product product);

final int retries = 3;
const kTimeout = Duration(seconds: 5);
late String sessionId;
int _hidden = 0;

String get appName => 'shop';

abstract class Repository<T> {
  Future<T?> find(String id);
  int get count;
}

class CachedRepository<T> extends Repository<T> implements Disposable {
  final Map<String, T> _cache = {};
  static const int maxSize = 100, minSize = 1;
  cart.Cart? lastCart;

  CachedRepository();
  CachedRepository.named({this.lastCart});

  @override
  Future<T?> find(String id) async => _cache[id];

  @override
  int get count => _cache.length;

  set limit(int value) {}

  bool operator ==(Object other) => identical(this, other);

  @override
  void dispose() {
    final pending = <Future<void>>[];
    void local() {}
    _cache.clear();
  }

  void _evict() {}
}

abstract interface class Disposable {
  void dispose();
}

mixin class Tracked {
  int hits = 0;
}

enum Status {
  active('A'),
  inactive('I');

  final String code;
  const Status(this.code);
}

extension on int {
  int get doubled => this * 2;
}

Future<void> warmUp(Repository<Product> repo, {int times = 1}) async {
  for (var i = 0; i < times; i++) {
    await repo.find('$i');
  }
}
