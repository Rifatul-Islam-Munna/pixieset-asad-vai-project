import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/gallery/collection_models.dart';

/// Client Gallery endpoints, mirroring `frontend/api-hooks/use-collections.ts`.
class CollectionsApi {
  CollectionsApi._();

  static Map<String, dynamic> _data(dynamic body) {
    final map = Map<String, dynamic>.from(body as Map);
    return Map<String, dynamic>.from(map['data'] as Map);
  }

  static Future<List<Collection>> list() async {
    final res = await DioHelper.dio.get('/collections');
    final items = (res.data as Map)['data'] as List? ?? const [];
    return items
        .whereType<Map>()
        .map((e) => Collection.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<Collection> detail(String id) async {
    final res = await DioHelper.dio.get(
      '/collections/$id',
      queryParameters: {'limit': 1, 'offset': 0},
    );
    return Collection.fromJson(_data(res.data));
  }

  static Future<ImagesPage> images(
    String id, {
    int offset = 0,
    int limit = 60,
    String? setId,
  }) async {
    final res = await DioHelper.dio.get(
      '/collections/$id/images',
      queryParameters: {
        'limit': limit,
        'offset': offset,
        'setId': ?setId,
      },
    );
    return ImagesPage.fromJson(_data(res.data));
  }

  static Future<Collection> create({
    required String name,
    DateTime? eventDate,
    String status = 'draft',
  }) async {
    final res = await DioHelper.dio.post(
      '/collections',
      data: {
        'name': name.trim(),
        if (eventDate != null) 'eventDate': _day(eventDate),
        'status': status,
      },
    );
    return Collection.fromJson(_data(res.data));
  }

  static Future<Collection> update(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final res = await DioHelper.dio.patch('/collections/$id', data: payload);
    return Collection.fromJson(_data(res.data));
  }

  static Future<Collection> setStarred(Collection collection, bool starred) =>
      update(collection.id, {
        'settings': {...collection.settings, 'starred': starred},
      });

  static Future<void> delete(String id) =>
      DioHelper.dio.delete('/collections/$id');

  static Future<void> duplicate(String id) =>
      DioHelper.dio.post('/collections/$id/duplicate', data: const {});

  static Future<void> addSet(String id, String name) => DioHelper.dio.post(
    '/collections/$id/sets',
    data: {'name': name.trim()},
  );

  static Future<void> renameSet(String id, String setId, String name) =>
      DioHelper.dio.patch(
        '/collections/$id/sets/${Uri.encodeComponent(setId)}',
        data: {'name': name.trim()},
      );

  static Future<void> deleteSet(String id, String setId) => DioHelper.dio
      .delete('/collections/$id/sets/${Uri.encodeComponent(setId)}');

  static Future<void> deleteImages(String id, List<String> imageIds) =>
      DioHelper.dio.post(
        '/collections/$id/images/delete',
        data: {'imageIds': imageIds},
      );

  static Future<void> moveImagesToSet(
    String id,
    List<String> imageIds,
    String setId,
  ) => DioHelper.dio.post(
    '/collections/$id/images/move',
    data: {
      'imageIds': imageIds,
      'targetCollectionId': id,
      'targetSetId': setId,
    },
  );

  static Future<void> setCover(String id, CollectionImage image) =>
      update(id, {'coverImage': image.url});

  /// Every photo across all galleries (Photo Library / Starred photos).
  static Future<List<CollectionImage>> allImages() async {
    final res = await DioHelper.dio.get('/collections/images');
    final items = (res.data as Map)['data'] as List? ?? const [];
    return items
        .whereType<Map>()
        .map((e) => CollectionImage.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<void> starImage(CollectionImage image, bool starred) =>
      DioHelper.dio.patch(
        '/collections/${image.collectionId}/images/${image.id}/star',
        data: {'starred': starred},
      );

  /// App key for a "Mobile only" gallery (owner-only endpoint).
  static Future<String> mobileKey(String id) async {
    final res = await DioHelper.dio.get('/collections/$id/mobile-key');
    final data = (res.data as Map)['data'];
    final key = data is Map ? '${data['key'] ?? ''}' : '';
    if (key.isEmpty) throw StateError('Mobile key is not available.');
    return key;
  }

  static String _day(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  static String dayString(DateTime date) => _day(date);
}
