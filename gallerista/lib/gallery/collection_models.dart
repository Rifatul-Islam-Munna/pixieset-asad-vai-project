import 'package:gallerista/api-hooks/dio_helper.dart';

/// Turns backend image paths into absolute URLs (same as the web `imageSrc`).
String resolveImageUrl(String? url) {
  if (url == null || url.isEmpty) return '';
  if (RegExp(r'^(https?:|data:)', caseSensitive: false).hasMatch(url)) {
    return url;
  }
  return url.startsWith('/') ? '${DioHelper.baseUrl}$url' : url;
}

String? _text(dynamic value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

DateTime? _date(dynamic value) =>
    value == null ? null : DateTime.tryParse(value.toString())?.toLocal();

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

class CollectionSet {
  const CollectionSet({required this.id, required this.name, this.watermarkId});

  final String id;
  final String name;
  final String? watermarkId;

  factory CollectionSet.fromJson(Map<String, dynamic> json) => CollectionSet(
    id: (json['id'] ?? '').toString(),
    name: _text(json['name']) ?? 'Untitled set',
    watermarkId: _text(json['watermarkId']),
  );
}

class Collection {
  const Collection({
    required this.id,
    required this.name,
    this.slug,
    this.coverImage,
    this.imageCount = 0,
    this.setImageCounts = const {},
    this.sets = const [],
    this.tags = const [],
    this.status,
    this.eventDate,
    this.expiresAt,
    this.createdAt,
    this.settings = const {},
    this.clientEmails = const [],
  });

  final String id;
  final String name;
  final String? slug;
  final String? coverImage;
  final int imageCount;
  final Map<String, int> setImageCounts;
  final List<CollectionSet> sets;
  final List<String> tags;
  final String? status;
  final DateTime? eventDate;
  final DateTime? expiresAt;
  final DateTime? createdAt;
  final Map<String, dynamic> settings;
  final List<String> clientEmails;

  bool get isPublished => status == 'published';
  bool get isStarred => settings['starred'] == true;

  /// General â†’ "Mobile only": viewable only in the app via the QR code.
  bool get isMobileOnly => _map(settings['general'])['mobileOnly'] == true;
  bool get isExpired =>
      expiresAt != null && expiresAt!.isBefore(DateTime.now());
  String get coverUrl => resolveImageUrl(coverImage);

  /// Watermark the web applies to new uploads: the set's own watermark, else
  /// the gallery default (unless it is "No watermark").
  String? uploadWatermarkFor(CollectionSet? set) {
    if (set?.watermarkId != null) return set!.watermarkId;
    final general = _map(settings['general']);
    final fallback = _text(general['defaultWatermark']);
    return fallback == null || fallback == 'No watermark' ? null : fallback;
  }

  factory Collection.fromJson(Map<String, dynamic> json) {
    final counts = _map(json['setImageCounts']).map(
      (key, value) => MapEntry(key, int.tryParse('$value') ?? 0),
    );
    return Collection(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      name: _text(json['name']) ?? 'Untitled gallery',
      slug: _text(json['slug']),
      coverImage: _text(json['coverImage']),
      imageCount: int.tryParse('${json['imageCount'] ?? 0}') ?? 0,
      setImageCounts: counts,
      sets: (json['sets'] is List ? json['sets'] as List : const [])
          .whereType<Map>()
          .map((e) => CollectionSet.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      tags: (json['tags'] is List ? json['tags'] as List : const [])
          .map((e) => e.toString())
          .toList(),
      status: _text(json['status']),
      eventDate: _date(json['eventDate']),
      expiresAt: _date(json['expiresAt']),
      createdAt: _date(json['createdAt']),
      settings: _map(json['settings']),
      clientEmails:
          (json['clientEmails'] is List ? json['clientEmails'] as List : const [])
              .map((e) => e.toString())
              .where((e) => e.contains('@'))
              .toList(),
    );
  }
}

class CollectionImage {
  const CollectionImage({
    required this.id,
    required this.url,
    this.setId,
    this.thumbnailUrl,
    this.small,
    this.medium,
    this.large,
    this.originalName,
    this.mediaType = 'image',
    this.width,
    this.height,
    this.collectionId,
    this.collectionName,
    this.setName,
    this.metadata = const {},
  });

  final String id;
  final String url;
  final String? setId;
  final String? thumbnailUrl;
  final String? small;
  final String? medium;
  final String? large;
  final String? originalName;
  final String mediaType;
  final int? width;
  final int? height;
  final String? collectionId;
  final String? collectionName;
  final String? setName;
  final Map<String, dynamic> metadata;

  bool get isVideo => mediaType == 'video';
  bool get isStarred => metadata['starred'] == true;

  String get displayName =>
      originalName ?? _text(metadata['filename']) ?? 'Image';

  /// Lower-cased text the Photo Library searches, same fields as the web.
  String get searchText => [
    originalName,
    collectionName,
    setName,
    for (final key in const [
      'filename', 'fileTitle', 'title', 'description', 'caption', 'headline',
      'objectName', 'genre', 'keyword', 'keywords', 'photographer', 'credit',
      'source', 'cityCountry', 'city', 'country', 'transmissionRef',
      'itemNumber', 'camera', 'lens', 'make', 'model', 'artist', 'copyright',
    ])
      metadata[key],
  ].where((v) => v != null && '$v'.isNotEmpty).join(' ').toLowerCase();

  CollectionImage withStarred(bool starred) => CollectionImage(
    id: id,
    url: url,
    setId: setId,
    thumbnailUrl: thumbnailUrl,
    small: small,
    medium: medium,
    large: large,
    originalName: originalName,
    mediaType: mediaType,
    width: width,
    height: height,
    collectionId: collectionId,
    collectionName: collectionName,
    setName: setName,
    metadata: {...metadata, 'starred': starred},
  );

  /// Small image for grids.
  String get gridUrl =>
      resolveImageUrl(thumbnailUrl ?? small ?? medium ?? url);

  /// Large image for the full-screen viewer.
  String get viewerUrl => resolveImageUrl(large ?? medium ?? url);

  /// Playable file for a video (videos are served as-is, never resized).
  String get videoUrl => resolveImageUrl(url);

  /// Whether a real still image exists for the grid. The backend makes no
  /// poster frame for videos, so their "thumbnail" is the video file itself,
  /// which can't be drawn as a picture.
  bool get hasPoster => !isVideo || gridUrl != videoUrl;

  factory CollectionImage.fromJson(Map<String, dynamic> json) {
    final responsive = _map(json['responsive']);
    return CollectionImage(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      url: (json['url'] ?? '').toString(),
      setId: _text(json['setId']),
      thumbnailUrl: _text(json['thumbnailUrl']),
      small: _text(responsive['small']),
      medium: _text(responsive['medium']),
      large: _text(responsive['large']),
      originalName: _text(json['originalName']),
      mediaType: _text(json['mediaType']) ?? 'image',
      width: int.tryParse('${json['width'] ?? ''}'),
      height: int.tryParse('${json['height'] ?? ''}'),
      collectionId: _text(json['collectionId']),
      collectionName: _text(json['collectionName']),
      setName: _text(json['setName']),
      metadata: _map(json['metadata']),
    );
  }
}

class ImagesPage {
  const ImagesPage({
    required this.items,
    required this.total,
    required this.hasMore,
  });

  final List<CollectionImage> items;
  final int total;
  final bool hasMore;

  factory ImagesPage.fromJson(Map<String, dynamic> json) => ImagesPage(
    items: (json['items'] is List ? json['items'] as List : const [])
        .whereType<Map>()
        .map((e) => CollectionImage.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
    total: int.tryParse('${json['total'] ?? 0}') ?? 0,
    hasMore: json['hasMore'] == true,
  );
}
