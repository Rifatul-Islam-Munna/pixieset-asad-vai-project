import 'package:dio/dio.dart';
import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/gallery/collection_models.dart';

/// A scanned gallery link: `…/collection/{site}/{gallery}` from the web,
/// plus `#gallerista-key=…` for "Mobile only" galleries. The key sits in
/// the URL fragment, which browsers never send to the server, so a phone
/// camera that opens the link in a browser still can't unlock the gallery.
class GalleryLink {
  const GalleryLink({required this.site, required this.slug, this.key});

  final String site;
  final String slug;
  final String? key;

  static const keyParam = 'gallerista-key';

  static GalleryLink? tryParse(String? raw) {
    final uri = Uri.tryParse(raw?.trim() ?? '');
    if (uri == null) return null;
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    final at = segments.indexOf('collection');
    if (at < 0 || segments.length < at + 3) return null;
    String? key;
    if (uri.fragment.isNotEmpty) {
      key = Uri.splitQueryString(uri.fragment)[keyParam];
    }
    return GalleryLink(
      site: segments[at + 1],
      slug: segments[at + 2],
      key: (key == null || key.isEmpty) ? null : key,
    );
  }

  /// QR / share URL for a gallery; [key] only for mobile-only galleries.
  static String build(String webOrigin, String site, String slug, {String? key}) {
    final base = '${webOrigin.replaceFirst(RegExp(r'/$'), '')}'
        '/collection/${Uri.encodeComponent(site)}/${Uri.encodeComponent(slug)}';
    return key == null ? base : '$base#$keyParam=${Uri.encodeComponent(key)}';
  }
}

/// Thrown when the gallery is mobile-only and the key is missing/invalid.
class MobileOnlyException implements Exception {
  const MobileOnlyException();
}

/// A gallery as a client sees it (public endpoint).
class PublicGallery {
  const PublicGallery({
    required this.collection,
    required this.images,
    required this.hasMore,
    required this.pinRequired,
    required this.emailRequired,
    required this.raw,
  });

  final Collection collection;
  final List<CollectionImage> images;
  final bool hasMore;
  final bool pinRequired;
  final bool emailRequired;
  final Map<String, dynamic> raw;

  Map<String, dynamic> get design => raw['design'] is Map
      ? Map<String, dynamic>.from(raw['design'] as Map)
      : {};

  bool get locked => pinRequired || emailRequired;
}

/// Public gallery endpoints (`/public/collections/:identifier`), sending
/// the app key header for mobile-only galleries.
class PublicGalleryApi {
  PublicGalleryApi._();

  static const pageSize = 60;

  static Options _options(GalleryLink link) => Options(
    headers: {
      if (link.key != null) 'x-gallerista-mobile-key': link.key,
    },
  );

  static Map<String, dynamic> _query(
    GalleryLink link, {
    String? pin,
    String? email,
    String? setId,
    int offset = 0,
  }) => {
    'siteSlug': link.site,
    'limit': pageSize,
    'offset': offset,
    if (pin != null && pin.isNotEmpty) 'pin': pin,
    if (email != null && email.isNotEmpty) 'email': email,
    'setId': ?setId,
  };

  static Future<PublicGallery> load(
    GalleryLink link, {
    String? pin,
    String? email,
    String? setId,
  }) async {
    try {
      final res = await DioHelper.dio.get(
        '/public/collections/${Uri.encodeComponent(link.slug)}',
        queryParameters: _query(link, pin: pin, email: email, setId: setId),
        options: _options(link),
      );
      final data = Map<String, dynamic>.from((res.data as Map)['data'] as Map);
      final access = (data['settings'] is Map
              ? (data['settings'] as Map)['access']
              : null) as Map? ??
          const {};
      final page = data['imagesPage'] is Map
          ? ImagesPage.fromJson(Map<String, dynamic>.from(data['imagesPage'] as Map))
          : null;
      return PublicGallery(
        collection: Collection.fromJson(data),
        images: page?.items ?? const [],
        hasMore: page?.hasMore ?? false,
        pinRequired: access['pinRequired'] == true && access['pinAuthorized'] != true,
        emailRequired:
            access['emailRequired'] == true && access['emailAuthorized'] != true,
        raw: data,
      );
    } on DioException catch (e) {
      if (_isMobileOnly(e)) throw const MobileOnlyException();
      rethrow;
    }
  }

  static Future<ImagesPage> images(
    GalleryLink link, {
    required int offset,
    String? pin,
    String? email,
    String? setId,
  }) async {
    try {
      final res = await DioHelper.dio.get(
        '/public/collections/${Uri.encodeComponent(link.slug)}/images',
        queryParameters: _query(
          link,
          pin: pin,
          email: email,
          setId: setId,
          offset: offset,
        ),
        options: _options(link),
      );
      final data = (res.data as Map)['data'];
      final page = data is Map && data['items'] == null && data['imagesPage'] is Map
          ? data['imagesPage']
          : data;
      return ImagesPage.fromJson(
        page is Map ? Map<String, dynamic>.from(page) : {},
      );
    } on DioException catch (e) {
      if (_isMobileOnly(e)) throw const MobileOnlyException();
      rethrow;
    }
  }

  static bool _isMobileOnly(DioException e) {
    final body = e.response?.data;
    return e.response?.statusCode == 403 &&
        body is Map &&
        body['code'] == 'MOBILE_ONLY';
  }
}
