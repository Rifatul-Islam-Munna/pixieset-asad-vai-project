import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:gallerista/main.dart' show getIt;
import 'package:gallerista/model/app_user.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SessionStorage {
  SessionStorage._();

  static const _tokenKey = 'auth_token';
  static const _userKey = 'current_user';
  static const _expiryKey = 'session_expires_at';
  static const sessionDays = 100;

  static SharedPreferences get _prefs => getIt<SharedPreferences>();
  static FlutterSecureStorage get _secure => getIt<FlutterSecureStorage>();

  static Future<void> saveSession({
    required String token,
    required AppUser user,
  }) async {
    final expiresAt = DateTime.now().add(const Duration(days: sessionDays));
    await _secure.write(key: _tokenKey, value: token);
    await _secure.write(key: _expiryKey, value: expiresAt.toIso8601String());
    await _prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  static Future<String?> getToken() async {
    final token = await _secure.read(key: _tokenKey);
    if (token == null || token.isEmpty) return null;

    final rawExpiry = await _secure.read(key: _expiryKey);
    final expiresAt = rawExpiry == null ? null : DateTime.tryParse(rawExpiry);
    if (expiresAt != null && DateTime.now().isAfter(expiresAt)) {
      await clear();
      return null;
    }
    return token;
  }

  static Future<bool> get isLoggedIn async => (await getToken()) != null;

  static AppUser? getUser() {
    final raw = _prefs.getString(_userKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return AppUser.fromJson(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } catch (_) {
      return null;
    }
  }

  static Future<void> updateCachedUser(AppUser user) async {
    await _prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  static Future<void> clear() async {
    await _secure.delete(key: _tokenKey);
    await _secure.delete(key: _expiryKey);
    await _prefs.remove(_userKey);
  }
}
