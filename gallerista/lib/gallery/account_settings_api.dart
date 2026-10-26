import 'dart:convert';

import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mime/mime.dart';

/// One saved account setting (`/settings/{type}` record).
class SettingRecord {
  const SettingRecord({
    required this.localId,
    required this.name,
    required this.data,
  });

  final String localId;
  final String name;
  final Map<String, dynamic> data;

  factory SettingRecord.fromJson(Map<String, dynamic> json) => SettingRecord(
    localId: '${json['localId'] ?? ''}',
    name: '${json['name'] ?? ''}',
    data: json['data'] is Map
        ? Map<String, dynamic>.from(json['data'] as Map)
        : <String, dynamic>{},
  );
}

/// Account settings, mirroring `use-dashboard-settings.ts`:
/// GET/POST `/settings/{type}`, DELETE `/settings/{type}/{localId}`.
/// Types: branding, watermark, preset, email-template, preference, …
class AccountSettingsApi {
  AccountSettingsApi._();

  static Future<List<SettingRecord>> list(String type) async {
    final res = await DioHelper.dio.get('/settings/$type');
    final items = (res.data as Map)['data'] as List? ?? const [];
    return items
        .whereType<Map>()
        .map((e) => SettingRecord.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// First record's data, or null (single-record types like branding).
  static Future<Map<String, dynamic>?> single(String type) async {
    final records = await list(type);
    return records.isEmpty ? null : records.first.data;
  }

  /// Creates or replaces the record with [localId].
  static Future<void> save(
    String type, {
    required String localId,
    required String name,
    required Map<String, dynamic> data,
  }) => DioHelper.dio.post(
    '/settings/$type',
    data: {'localId': localId, 'name': name, 'data': data},
  );

  static Future<void> delete(String type, String localId) => DioHelper.dio
      .delete('/settings/$type/${Uri.encodeComponent(localId)}');
}

/// Picks an image and returns it as a data URL, the format the web stores
/// for branding logos. Returns null if cancelled; throws if too large.
Future<String?> pickImageAsDataUrl({int maxBytes = 1536 * 1024}) async {
  final file = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    maxWidth: 1600,
    imageQuality: 90,
  );
  if (file == null) return null;
  final bytes = await file.readAsBytes();
  if (bytes.length > maxBytes) {
    throw StateError('Please choose an image under '
        '${(maxBytes / 1024 / 1024).toStringAsFixed(1)} MB.');
  }
  final mime = lookupMimeType(file.name, headerBytes: bytes) ?? 'image/png';
  return 'data:$mime;base64,${base64Encode(bytes)}';
}
