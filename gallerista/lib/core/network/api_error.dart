import 'package:dio/dio.dart';

class UserCancelledException implements Exception {
  const UserCancelledException();
}

class ApiError {
  ApiError._();

  static String message(Object error) {
    if (error is UserCancelledException) return '';
    if (error is DioException) {
      final serverMessage = _extract(error.response?.data);
      if (serverMessage != null && serverMessage.isNotEmpty) {
        return serverMessage;
      }

      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return 'The server took too long to respond. Please try again.';
        case DioExceptionType.connectionError:
          return 'Could not connect to the server. Check your internet or API URL.';
        case DioExceptionType.cancel:
          return 'The request was cancelled.';
        default:
          return 'Something went wrong. Please try again.';
      }
    }
    return 'Something went wrong. Please try again.';
  }

  /// Reads NestJS error bodies: `message` may be a string, a list of
  /// validation messages, or a nested `{ message: [...] }` object.
  static String? _extract(dynamic value) {
    if (value == null) return null;
    if (value is String) return value.trim().isEmpty ? null : value.trim();
    if (value is List) {
      final parts = value
          .map(_extract)
          .whereType<String>()
          .where((e) => e.isNotEmpty);
      return parts.isEmpty ? null : parts.join('\n');
    }
    if (value is Map) {
      final message = _extract(value['message']);
      if (message != null) return message;
      final error = _extract(value['error']);
      if (error != null) return error;
    }
    return null;
  }
}
