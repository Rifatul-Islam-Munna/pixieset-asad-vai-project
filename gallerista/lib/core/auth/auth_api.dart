import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/core/storage/session_storage.dart';
import 'package:gallerista/model/app_user.dart';

/// Auth endpoints, mirroring `frontend/actions/auth.ts`.
class AuthApi {
  AuthApi._();

  /// `login` is an email or phone number (the web sends it as `phoneNumber`).
  static Future<AppUser> login({
    required String login,
    required String password,
  }) => _signIn('/user/login-user', {
    'phoneNumber': login.trim(),
    'password': password,
  });

  /// One-time PIN from the login email.
  static Future<AppUser> loginWithPin({
    required String login,
    required String pin,
  }) => _signIn('/user/login-with-pin', {'login': login.trim(), 'pin': pin});

  /// Emails a one-time PIN and direct login link.
  static Future<String> requestPin(String email) async {
    final res = await DioHelper.dio.post(
      '/user/forgot-password',
      data: {'email': email.trim().toLowerCase()},
    );
    final data = res.data is Map ? res.data as Map : const {};
    return (data['message'] ?? 'Check your email for the PIN.').toString();
  }

  static Future<void> logout() => SessionStorage.clear();

  /// Creates an account (`POST /user`, like the web `registerUser`) and
  /// signs in. Empty optional fields are left out, as on the web.
  static Future<AppUser> register({
    required String name,
    required String phoneNumber,
    required String password,
    String email = '',
    String gender = '',
  }) => _signIn('/user', {
    'name': name.trim(),
    'phoneNumber': phoneNumber.trim(),
    'password': password,
    if (email.trim().isNotEmpty) 'email': email.trim().toLowerCase(),
    if (gender.trim().isNotEmpty) 'gender': gender.trim(),
  });

  /// Same rules as the backend CreateUserDto; returns the first problem.
  static String? validateRegistration({
    required String name,
    required String phoneNumber,
    required String password,
    String email = '',
  }) {
    final trimmedName = name.trim();
    if (trimmedName.length < 2) return 'Enter your full name.';
    if (trimmedName.length > 100) return 'Name must be 100 characters or less.';
    if (phoneNumber.trim().isEmpty) return 'Enter your phone number.';
    final mail = email.trim();
    if (mail.isNotEmpty &&
        !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(mail)) {
      return 'Enter a valid email address.';
    }
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password.length > 80) return 'Password must be 80 characters or less.';
    return null;
  }

  static Future<AppUser> _signIn(
    String path,
    Map<String, dynamic> body,
  ) async {
    final res = await DioHelper.dio.post(path, data: body);
    final data = Map<String, dynamic>.from(res.data as Map);
    final token = (data['access_token'] ?? '').toString();
    final rawUser = data['user'] ?? data['data'];
    if (token.isEmpty || rawUser is! Map) {
      throw const FormatException('Login response was incomplete.');
    }
    final user = AppUser.fromJson(Map<String, dynamic>.from(rawUser));
    await SessionStorage.saveSession(token: token, user: user);
    return user;
  }
}
