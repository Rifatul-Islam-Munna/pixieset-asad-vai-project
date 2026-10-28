import 'package:flutter/foundation.dart';
import 'package:gallerista/core/cms/home_cms.dart';
import 'package:gallerista/gallery/collection_models.dart' show resolveImageUrl;
import 'package:gallerista/main.dart' show getIt;
import 'package:shared_preferences/shared_preferences.dart';

/// The platform's own brand as uploaded by the admin on the website:
/// Admin → SEO "Favicon" (the square icon) and Brand "Logo" (the wordmark),
/// served by the public `GET /home-cms`.
///
/// The last known brand is kept on the phone, so it shows instantly on the
/// next launch (even offline), then is refreshed in the background — a new
/// logo uploaded in the admin appears the next time the app opens.
@immutable
class SiteBrand {
  const SiteBrand({
    this.name = defaultName,
    this.iconUrl = '',
    this.logoUrl = '',
  });

  static const defaultName = 'Gallerista';

  /// Site title, e.g. "Gallerista".
  final String name;

  /// Square mark (the website's favicon); empty when none is uploaded.
  final String iconUrl;

  /// Wide wordmark logo; empty when none is uploaded.
  final String logoUrl;

  /// The brand currently shown; widgets rebuild when it changes.
  static final current = ValueNotifier<SiteBrand>(const SiteBrand());

  static const _nameKey = 'siteBrand.name';
  static const _iconKey = 'siteBrand.iconUrl';
  static const _logoKey = 'siteBrand.logoUrl';

  factory SiteBrand.fromCms(Map<String, dynamic> cms) {
    String read(Object? section, String key) =>
        section is Map ? '${section[key] ?? ''}'.trim() : '';
    final title = read(cms['seo'], 'siteTitle');
    return SiteBrand(
      name: title.isEmpty ? defaultName : title,
      iconUrl: resolveImageUrl(read(cms['seo'], 'faviconUrl')),
      logoUrl: resolveImageUrl(read(cms['brand'], 'logoUrl')),
    );
  }

  /// Shows the brand saved last time right away, then fetches the latest
  /// from the website and saves it for next time. Safe to call without
  /// awaiting at startup; offline it simply keeps the saved brand.
  static Future<void> load() async {
    final prefs = getIt<SharedPreferences>();
    current.value = SiteBrand(
      name: prefs.getString(_nameKey) ?? defaultName,
      iconUrl: prefs.getString(_iconKey) ?? '',
      logoUrl: prefs.getString(_logoKey) ?? '',
    );
    final cms = await HomeCms.fetch();
    if (cms == null) return;
    final latest = SiteBrand.fromCms(cms);
    if (latest == current.value) return;
    current.value = latest;
    await Future.wait([
      prefs.setString(_nameKey, latest.name),
      prefs.setString(_iconKey, latest.iconUrl),
      prefs.setString(_logoKey, latest.logoUrl),
    ]);
  }

  @override
  bool operator ==(Object other) =>
      other is SiteBrand &&
      other.name == name &&
      other.iconUrl == iconUrl &&
      other.logoUrl == logoUrl;

  @override
  int get hashCode => Object.hash(name, iconUrl, logoUrl);
}
