import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/gallery/collection_models.dart';

DateTime? _date(dynamic v) =>
    v == null ? null : DateTime.tryParse(v.toString())?.toLocal();
String _s(dynamic v) => v?.toString() ?? '';
List<Map<String, dynamic>> _maps(dynamic v) => (v is List ? v : const [])
    .whereType<Map>()
    .map((e) => Map<String, dynamic>.from(e))
    .toList();

class FavoriteImage {
  const FavoriteImage(this.imageId, this.name, this.url);

  final String imageId;
  final String name;
  final String url;

  String get imageUrl => resolveImageUrl(url);
}

class FavoriteList {
  const FavoriteList({
    required this.id,
    required this.email,
    required this.name,
    required this.photos,
    required this.filenames,
    required this.images,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String email;
  final String name;
  final int photos;
  final List<String> filenames;
  final List<FavoriteImage> images;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory FavoriteList.fromJson(Map<String, dynamic> j) => FavoriteList(
    id: _s(j['id']),
    email: _s(j['email']),
    name: _s(j['name']).isEmpty ? 'Favorites' : _s(j['name']),
    photos: int.tryParse('${j['photos'] ?? 0}') ?? 0,
    filenames: (j['filenames'] is List ? j['filenames'] as List : const [])
        .map((e) => e.toString())
        .toList(),
    images: _maps(j['images'])
        .map((e) => FavoriteImage(_s(e['imageId']), _s(e['name']), _s(e['url'])))
        .toList(),
    createdAt: _date(j['createdAt']),
    updatedAt: _date(j['updatedAt']),
  );
}

class DownloadActivity {
  const DownloadActivity({
    required this.email,
    required this.imageName,
    required this.isAll,
    required this.count,
    this.imageUrl,
    this.createdAt,
  });

  final String email;
  final String imageName;
  final String? imageUrl;
  final bool isAll;
  final int count;
  final DateTime? createdAt;

  factory DownloadActivity.fromJson(Map<String, dynamic> j) => DownloadActivity(
    email: _s(j['email']),
    imageName: _s(j['imageName']),
    imageUrl: j['imageUrl'] == null ? null : resolveImageUrl(_s(j['imageUrl'])),
    isAll: j['downloadType'] == 'all',
    count: int.tryParse('${j['count'] ?? 1}') ?? 1,
    createdAt: _date(j['createdAt']),
  );
}

class EmailRegistration {
  const EmailRegistration({
    required this.email,
    required this.sources,
    required this.marketingOptIn,
    this.createdAt,
  });

  final String email;
  final List<String> sources;
  final bool marketingOptIn;
  final DateTime? createdAt;

  factory EmailRegistration.fromJson(Map<String, dynamic> j) {
    final sources = (j['sources'] is List ? j['sources'] as List : const [])
        .map((e) => e.toString())
        .toList();
    if (sources.isEmpty && _s(j['source']).isNotEmpty) sources.add(_s(j['source']));
    return EmailRegistration(
      email: _s(j['email']),
      sources: sources,
      marketingOptIn: j['marketingOptIn'] == true,
      createdAt: _date(j['createdAt']),
    );
  }
}

class PrivatePhotoRequest {
  const PrivatePhotoRequest({
    required this.id,
    required this.email,
    required this.imageName,
    required this.status,
    this.imageUrl,
    this.createdAt,
  });

  final String id;
  final String email;
  final String imageName;
  final String? imageUrl;
  final String status; // pending | approved | declined
  final DateTime? createdAt;

  factory PrivatePhotoRequest.fromJson(Map<String, dynamic> j) =>
      PrivatePhotoRequest(
        id: _s(j['_id']),
        email: _s(j['email']),
        imageName: _s(j['imageName']),
        imageUrl: j['imageUrl'] == null ? null : resolveImageUrl(_s(j['imageUrl'])),
        status: _s(j['status']).isEmpty ? 'pending' : _s(j['status']),
        createdAt: _date(j['createdAt']),
      );
}

class CollectionActivity {
  const CollectionActivity({
    this.favorites = const [],
    this.downloads = const [],
    this.registrations = const [],
    this.privatePhotos = const [],
  });

  final List<FavoriteList> favorites;
  final List<DownloadActivity> downloads;
  final List<EmailRegistration> registrations;
  final List<PrivatePhotoRequest> privatePhotos;

  factory CollectionActivity.fromJson(Map<String, dynamic> j) =>
      CollectionActivity(
        favorites: _maps(j['favoriteLists']).map(FavoriteList.fromJson).toList(),
        downloads: _maps(j['downloads']).map(DownloadActivity.fromJson).toList(),
        registrations: _maps(j['emailRegistrations'])
            .map(EmailRegistration.fromJson)
            .toList(),
        privatePhotos: _maps(j['privatePhotos'])
            .map(PrivatePhotoRequest.fromJson)
            .toList(),
      );
}

/// Activity endpoints, mirroring `useCollectionActivity` and
/// `useCollectionActivityActions` in `use-collections.ts`.
class ActivityApi {
  ActivityApi._();

  static String _base(String id) => '/collections/$id/activity';

  static Future<CollectionActivity> load(String id) async {
    final res = await DioHelper.dio.get(_base(id));
    final data = (res.data as Map)['data'];
    return CollectionActivity.fromJson(
      data is Map ? Map<String, dynamic>.from(data) : {},
    );
  }

  static Future<void> deleteFavoriteList(String id, String favoriteUserId) =>
      DioHelper.dio.delete('${_base(id)}/favorites/$favoriteUserId');

  static Future<void> removeFavoriteImage(
    String id,
    String favoriteUserId,
    String imageId,
  ) => DioHelper.dio.delete(
    '${_base(id)}/favorites/$favoriteUserId/images/$imageId',
  );

  static Future<void> copyFavoritesToSet(
    String id,
    String favoriteUserId,
    String name,
  ) => DioHelper.dio.post(
    '${_base(id)}/favorites/$favoriteUserId/copy-to-set',
    data: {'name': name},
  );

  static Future<void> copyFavoritesToGallery(
    String id,
    String favoriteUserId,
    String name,
  ) => DioHelper.dio.post(
    '${_base(id)}/favorites/$favoriteUserId/copy-to-collection',
    data: {'name': name},
  );

  static Future<void> setPrivatePhotoStatus(
    String id,
    String requestId,
    String status,
  ) => DioHelper.dio.patch(
    '${_base(id)}/private-photos/$requestId',
    data: {'status': status},
  );

  static Future<void> deletePrivatePhoto(String id, String requestId) =>
      DioHelper.dio.delete('${_base(id)}/private-photos/$requestId');
}

/// CSV with RFC 4180 quoting and a guard against spreadsheet formula
/// injection (cells starting with = + - @ are prefixed with ').
String toCsv(List<List<String>> rows) {
  String cell(String value) {
    var v = value;
    if (v.isNotEmpty && '=+-@'.contains(v[0])) v = "'$v";
    final needsQuotes =
        v.contains(',') || v.contains('"') || v.contains('\n') || v.contains('\r');
    return needsQuotes ? '"${v.replaceAll('"', '""')}"' : v;
  }

  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
