import 'package:gallerista/api-hooks/dio_helper.dart';

/// The public website CMS (`GET /home-cms` → `data`), edited by the admin on
/// the website. Fetched once per app run and shared by everything that reads
/// it (login copy, the site's logo and icon).
abstract final class HomeCms {
  static Future<Map<String, dynamic>?>? _pending;

  /// The CMS data, or null when it can't be reached (offline, server down);
  /// a failed fetch is not cached, so the next call tries again.
  static Future<Map<String, dynamic>?> fetch() => _pending ??= _load();

  static Future<Map<String, dynamic>?> _load() async {
    try {
      final res = await DioHelper.dio.get('/home-cms');
      final data = (res.data as Map)['data'];
      return data is Map ? Map<String, dynamic>.from(data) : null;
    } catch (_) {
      // Callers fall back to built-in defaults; nothing for the user to do.
      _pending = null;
      return null;
    }
  }
}
