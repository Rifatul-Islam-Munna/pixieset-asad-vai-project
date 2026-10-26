import 'package:gallerista/api-hooks/dio_helper.dart';

/// Login / register headings from the public CMS (`GET /home-cms`,
/// `data.auth`), with the web defaults from `frontend/lib/home-cms.ts`.
class AuthCopy {
  const AuthCopy({
    this.brand = 'Gallerista',
    this.loginTitle = 'Log in to your workspace',
    this.loginSubtitle = 'Client Gallery',
    this.registerTitle = 'Create your account',
    this.registerSubtitle = 'Start workspace',
  });

  final String brand;
  final String loginTitle;
  final String loginSubtitle;
  final String registerTitle;
  final String registerSubtitle;

  factory AuthCopy.fromJson(Map<String, dynamic> json) {
    const d = AuthCopy();
    String pick(String key, String fallback) {
      final value = json[key]?.toString().trim() ?? '';
      return value.isEmpty ? fallback : value;
    }

    return AuthCopy(
      brand: pick('brand', d.brand),
      loginTitle: pick('loginTitle', d.loginTitle),
      loginSubtitle: pick('loginSubtitle', d.loginSubtitle),
      registerTitle: pick('registerTitle', d.registerTitle),
      registerSubtitle: pick('registerSubtitle', d.registerSubtitle),
    );
  }

  static AuthCopy? _cached;

  /// Loads once per app run; falls back to the defaults when offline.
  static Future<AuthCopy> load() async {
    final cached = _cached;
    if (cached != null) return cached;
    try {
      final res = await DioHelper.dio.get('/home-cms');
      final data = (res.data as Map)['data'];
      final auth = data is Map ? data['auth'] : null;
      return _cached = auth is Map
          ? AuthCopy.fromJson(Map<String, dynamic>.from(auth))
          : const AuthCopy();
    } catch (_) {
      return const AuthCopy();
    }
  }
}
