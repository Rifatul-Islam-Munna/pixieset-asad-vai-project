import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/public_gallery_api.dart';
import 'package:gallerista/main.dart' show getIt;

/// A gallery opened by scanning its QR code.
class ScanEntry {
  const ScanEntry({
    required this.site,
    required this.slug,
    required this.name,
    required this.coverUrl,
    required this.scannedAt,
    this.key,
  });

  final String site;
  final String slug;
  final String? key;
  final String name;
  final String coverUrl;
  final DateTime scannedAt;

  GalleryLink get link => GalleryLink(site: site, slug: slug, key: key);
  String get id => '$site/$slug';

  Map<String, dynamic> toJson() => {
    'site': site,
    'slug': slug,
    'key': ?key,
    'name': name,
    'coverUrl': coverUrl,
    'scannedAt': scannedAt.toIso8601String(),
  };

  static ScanEntry? fromJson(Object? json) {
    if (json is! Map) return null;
    final site = '${json['site'] ?? ''}';
    final slug = '${json['slug'] ?? ''}';
    if (site.isEmpty || slug.isEmpty) return null;
    final key = json['key']?.toString();
    return ScanEntry(
      site: site,
      slug: slug,
      key: (key == null || key.isEmpty) ? null : key,
      name: '${json['name'] ?? slug}',
      coverUrl: '${json['coverUrl'] ?? ''}',
      scannedAt:
          DateTime.tryParse('${json['scannedAt'] ?? ''}') ?? DateTime(2000),
    );
  }
}

/// Newest first, one entry per gallery, at most [max].
List<ScanEntry> mergeScan(List<ScanEntry> current, ScanEntry entry, {int max = 8}) {
  return [
    entry,
    ...current.where((e) => e.id != entry.id),
  ].take(max).toList();
}

/// Recently scanned galleries. Kept in secure storage because entries for
/// "Mobile only" galleries include the gallery's access key.
class ScanHistory {
  ScanHistory._();

  static const _storageKey = 'scan_history_v1';
  static final entries = ValueNotifier<List<ScanEntry>>(const []);

  static FlutterSecureStorage get _store => getIt<FlutterSecureStorage>();

  static Future<void> load() async {
    try {
      final raw = await _store.read(key: _storageKey);
      if (raw == null || raw.isEmpty) return;
      final list = jsonDecode(raw);
      entries.value = (list is List ? list : const [])
          .map(ScanEntry.fromJson)
          .whereType<ScanEntry>()
          .toList();
    } catch (e) {
      debugPrint('ScanHistory: could not load: $e');
    }
  }

  static Future<void> record(GalleryLink link, Collection collection) async {
    entries.value = mergeScan(
      entries.value,
      ScanEntry(
        site: link.site,
        slug: link.slug,
        key: link.key,
        name: collection.name,
        coverUrl: collection.coverUrl,
        scannedAt: DateTime.now(),
      ),
    );
    await _persist();
  }

  static Future<void> remove(ScanEntry entry) async {
    entries.value = entries.value.where((e) => e.id != entry.id).toList();
    await _persist();
  }

  static Future<void> clear() async {
    entries.value = const [];
    await _persist();
  }

  static Future<void> _persist() async {
    try {
      await _store.write(
        key: _storageKey,
        value: jsonEncode([for (final e in entries.value) e.toJson()]),
      );
    } catch (e) {
      debugPrint('ScanHistory: could not save: $e');
    }
  }
}
