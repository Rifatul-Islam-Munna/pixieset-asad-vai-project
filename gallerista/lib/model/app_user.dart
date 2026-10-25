/// The signed-in user, matching the backend `User` schema
/// (`backend/src/user/entities/user.entity.ts`). Only the fields the app
/// needs are kept; add more as screens need them.
class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    this.username,
    this.email,
    this.phoneNumber,
    this.avatar,
    this.role = 'user',
    this.businessName,
    this.planName = 'Free',
  });

  final String id;
  final String name;
  final String? username;
  final String? email;
  final String? phoneNumber;
  final String? avatar;

  /// `admin`, `editor` or `user` (backend `UserType`).
  final String role;
  final String? businessName;
  final String planName;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    String? text(String key) {
      final value = json[key]?.toString().trim();
      return value == null || value.isEmpty ? null : value;
    }

    return AppUser(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      name: text('name') ?? '',
      username: text('username'),
      email: text('email'),
      phoneNumber: text('phoneNumber'),
      avatar: text('avatar'),
      role: text('role') ?? 'user',
      businessName: text('businessName'),
      planName: text('planName') ?? 'Free',
    );
  }

  Map<String, dynamic> toJson() => {
    '_id': id,
    'name': name,
    'username': ?username,
    'email': ?email,
    'phoneNumber': ?phoneNumber,
    'avatar': ?avatar,
    'role': role,
    'businessName': ?businessName,
    'planName': planName,
  };
}
