import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kDebugMode, kIsWeb;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:gallerista/core/storage/session_storage.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/main.dart' show logger;
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

class DioHelper {
  DioHelper._();

  static Dio? _dio;
  static bool _clearingExpiredSession = false;
  static Future<void> Function()? _onUnauthorized;

  static Dio get dio {
    final value = _dio;
    if (value == null) {
      throw StateError('DioHelper.init() must be called before using the API.');
    }
    return value;
  }

  static String get baseUrl => _resolveBaseUrl();

  static String _resolveBaseUrl() {
    final configured = dotenv
        .get('API_URL', fallback: '')
        .split('#')
        .first
        .trim();
    if (configured.isEmpty) {
      throw StateError('API_URL is missing from .env');
    }

    var normalized = configured;
    if (!normalized.contains('://')) {
      final lower = normalized.toLowerCase();
      final local =
          lower.startsWith('localhost') ||
          lower.startsWith('127.0.0.1') ||
          lower.startsWith('10.0.2.2');
      normalized = '${local ? 'http' : 'https'}://$normalized';
    }

    normalized = normalized.replaceFirst(RegExp(r'/$'), '');
    final uri = Uri.tryParse(normalized);
    if (uri == null || uri.host.isEmpty) {
      throw StateError('API_URL must be a valid URL.');
    }

    final localHost =
        uri.host == 'localhost' ||
        uri.host == '127.0.0.1' ||
        uri.host == '10.0.2.2';
    if (uri.scheme != 'https' && !(uri.scheme == 'http' && localHost)) {
      throw StateError(
        'Use HTTPS for remote API URLs. HTTP is allowed only locally.',
      );
    }

    // The Android emulator reaches the host machine through 10.0.2.2.
    if (!kIsWeb &&
        Platform.isAndroid &&
        (uri.host == 'localhost' || uri.host == '127.0.0.1')) {
      normalized = uri.replace(host: '10.0.2.2').toString();
    }
    return normalized;
  }

  static void init({Future<void> Function()? onUnauthorized}) {
    _onUnauthorized = onUnauthorized;
    final url = _resolveBaseUrl();
    logger.i('API base URL: $url');
    _dio = Dio(
      BaseOptions(
        baseUrl: url,
        receiveDataWhenStatusError: true,
        connectTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 60),
        contentType: Headers.jsonContentType,
        headers: const {Headers.acceptHeader: Headers.jsonContentType},
      ),
    );

    _dio!.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // The backend AuthGuard reads the JWT from the `access_token`
          // header (same as the web frontend).
          final token = await SessionStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['access_token'] = token;
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          logger.e(
            'API request failed: ${error.requestOptions.method} ${error.requestOptions.uri}',
            error: error.error ?? error,
            stackTrace: error.stackTrace,
          );

          if (error.response?.statusCode == 401 && !_clearingExpiredSession) {
            _clearingExpiredSession = true;
            try {
              await SessionStorage.clear();
              AppToast.info('Your session expired. Please log in again.');
              final onUnauthorized = _onUnauthorized;
              if (onUnauthorized != null) {
                await onUnauthorized();
              }
            } finally {
              _clearingExpiredSession = false;
            }
          }
          handler.next(error);
        },
      ),
    );

    // Request/response bodies are only printed in debug builds.
    if (kDebugMode) {
      _dio!.interceptors.add(
        PrettyDioLogger(
          requestHeader: false,
          requestBody: true,
          responseHeader: false,
          responseBody: true,
          compact: true,
          maxWidth: 90,
        ),
      );
    }
  }
}
