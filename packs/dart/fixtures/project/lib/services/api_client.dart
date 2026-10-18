import 'dart:convert';

import 'package:http/http.dart' as http;

import '../mixins/loggable.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException(this.statusCode, this.message);
}

class ApiClient with Loggable {
  final String baseUrl;
  final http.Client _http;
  int requestCount = 0;

  ApiClient({required this.baseUrl, http.Client? client}) : _http = client ?? http.Client();

  String get host => Uri.parse(baseUrl).host;

  Future<Map<String, dynamic>> getJson(String path) async {
    requestCount++;
    final response = await _http.get(Uri.parse('$baseUrl$path'));
    if (response.statusCode != 200) {
      throw ApiException(response.statusCode, response.body);
    }
    log('GET $path');
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  void close() => _http.close();
}
