import 'dart:convert';
import 'package:http/http.dart' as http;
import 'dart:io' show Platform, NetworkInterface, InternetAddressType;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:typed_data';
import 'package:http_parser/http_parser.dart';
import '../models/task.dart';

/// Serviço de comunicação com API REST do servidor
class ApiService {
  static String? _resolvedHost;

  static String get baseUrl {
    // Web runs on the browser host
    if (kIsWeb) return 'http://localhost:3000/api';

    // Android emulator accesses host machine at 10.0.2.2
    if (Platform.isAndroid) return 'http://10.0.2.2:3000/api';

    // If we've resolved a working host (health-check), prefer it
    // Prefer explicit IPv4 loopback on macOS to avoid IPv6 (::1) permission issues
    if (Platform.isMacOS) return 'http://127.0.0.1:3000/api';

    final host = _resolvedHost ?? 'localhost';
    return 'http://$host:3000/api';
  }
  
  final String userId;

  ApiService({this.userId = 'user1'});

  // ==================== OPERAÇÕES DE TAREFAS ====================

  /// Buscar todas as tarefas (com sync incremental)
  Future<Map<String, dynamic>> getTasks({int? modifiedSince}) async {
    try {
      final uri = Uri.parse('$baseUrl/tasks').replace(
        queryParameters: {
          'userId': userId,
          if (modifiedSince != null) 'modifiedSince': modifiedSince.toString(),
        },
      );
      print('➡️ GET $uri');

      final response = await http.get(uri).timeout(
        const Duration(seconds: 10),
      );

      print('⬅️ GET $uri status=${response.statusCode}');
      // print body for debugging (may be large)
      print('   body: ${response.body}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        // Support different response shapes: { tasks: [...] } or { ok:true, data: [...] }
        final rawTasks = data['tasks'] ?? data['data'] ?? [];
        return {
          'success': true,
          'tasks': (rawTasks as List).map((json) => Task.fromJson(json)).toList(),
          'lastSync': data['lastSync'] ?? data['last_sync'] ?? null,
          'serverTime': data['serverTime'] ?? data['server_time'] ?? null,
        };
      } else {
        throw Exception('Erro ao buscar tarefas: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Erro na requisição getTasks: $e');
      rethrow;
    }
  }

  /// Criar tarefa no servidor
  Future<Task> createTask(Task task) async {
    try {
      final uri = Uri.parse('$baseUrl/tasks');
      print('➡️ POST $uri body=${json.encode(task.toJson())}');
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: json.encode(task.toJson()),
      ).timeout(const Duration(seconds: 10));

      print('⬅️ POST $uri status=${response.statusCode} body=${response.body}');

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        // Support { task: {...} } or { ok:true, data: {...} }
        final raw = data['task'] ?? data['data'] ?? data;
        return Task.fromJson(raw);
      } else {
        throw Exception('Erro ao criar tarefa: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Erro na requisição createTask: $e');
      rethrow;
    }
  }

  

  /// Atualizar tarefa no servidor
  Future<Map<String, dynamic>> updateTask(Task task) async {
    try {
      final uri = Uri.parse('$baseUrl/tasks/${task.id}');
      final payload = json.encode({
        ...task.toJson(),
        'version': task.version,
      });
      print('➡️ PUT $uri body=$payload');
      final response = await http.put(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: payload,
      ).timeout(const Duration(seconds: 10));

      print('⬅️ PUT $uri status=${response.statusCode} body=${response.body}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final raw = data['task'] ?? data['data'] ?? data;
        return {
          'success': true,
          'task': Task.fromJson(raw),
        };
      } else if (response.statusCode == 409) {
        // Conflito detectado
        final data = json.decode(response.body);
        return {
          'success': false,
          'conflict': true,
          'serverTask': Task.fromJson(data['serverTask'] ?? data['server_task'] ?? data['data']),
        };
      } else {
        throw Exception('Erro ao atualizar tarefa: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Erro na requisição updateTask: $e');
      rethrow;
    }
  }

  /// Deletar tarefa no servidor
  Future<bool> deleteTask(String id, int version) async {
    try {
      final uri = Uri.parse('$baseUrl/tasks/$id?version=$version');
      print('➡️ DELETE $uri');
      final response = await http.delete(
        uri,
      ).timeout(const Duration(seconds: 10));

      print('⬅️ DELETE $uri status=${response.statusCode} body=${response.body}');
      return response.statusCode == 200 || response.statusCode == 404;
    } catch (e) {
      print('❌ Erro na requisição deleteTask: $e');
      rethrow;
    }
  }

  /// Sincronização em lote
  Future<List<Map<String, dynamic>>> syncBatch(
    List<Map<String, dynamic>> operations,
  ) async {
    try {
      final uri = Uri.parse('$baseUrl/sync/batch');
      final payload = json.encode({'operations': operations});
      print('➡️ POST $uri body=$payload');
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: payload,
      ).timeout(const Duration(seconds: 30));

      print('⬅️ POST $uri status=${response.statusCode} body=${response.body}');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return List<Map<String, dynamic>>.from(data['results']);
      } else {
        throw Exception('Erro no sync em lote: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Erro na requisição syncBatch: $e');
      rethrow;
    }
  }

  /// Verificar conectividade com servidor
  Future<bool> checkConnectivity() async {
    // Try resolving health using a list of candidate hosts to handle platform differences
    final hosts = <String>['localhost', '127.0.0.1'];

    // Add local network IPs as candidates
    try {
      for (final iface in await NetworkInterface.list()) {
        for (final addr in iface.addresses) {
          if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
            hosts.add(addr.address);
          }
        }
      }
    } catch (_) {
      // ignore if interface listing fails
    }

    for (final host in hosts) {
      try {
        final healthUri = Uri.parse('http://$host:3000/api/health');
        print('➡️ GET $healthUri (connectivity check)');
        final response = await http.get(healthUri).timeout(const Duration(seconds: 3));
        print('⬅️ GET $healthUri status=${response.statusCode} body=${response.body}');
        if (response.statusCode == 200) {
          _resolvedHost = host;
          print('✅ ApiService: resolved host = $host');
          return true;
        }
      } catch (e) {
        print('⚠️ connectivity check failed for host $host: $e');
      }
    }

    return false;
  }

  // ==================== UPLOAD DE FOTO ====================

  /// Enviar foto (multipart) para backend e receber `photoKey`
  Future<Map<String, dynamic>> uploadPhoto({
    required Uint8List bytes,
    String? filename,
    String? contentType,
  }) async {
    final uri = Uri.parse('$baseUrl/upload');
    final request = http.MultipartRequest('POST', uri);

    final mediaType = MediaType.parse(contentType ?? 'image/jpeg');
    request.files.add(
      http.MultipartFile.fromBytes(
        'photo',
        bytes,
        filename: filename ?? 'photo.jpg',
        contentType: mediaType,
      ),
    );

    final streamed = await request.send().timeout(const Duration(seconds: 20));
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode == 201) {
      return Map<String, dynamic>.from(json.decode(response.body));
    }
    throw Exception('Erro no upload da foto: ${response.statusCode} ${response.body}');
  }
}