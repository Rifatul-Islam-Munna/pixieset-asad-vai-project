import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Bundled free stock photos (Unsplash License, downloaded via
/// picsum.photos) that stand in for photos the app cannot load.
///
/// The gallery-wide fallback is switched on with `SAMPLE_IMAGES=true` in
/// `.env`. Keep it off for release builds, so a client photo that fails to
/// load is never silently replaced by a stock photo.
abstract final class SampleImages {
  static const all = <String>[
    'assets/samples/sample_01.jpg',
    'assets/samples/sample_02.jpg',
    'assets/samples/sample_03.jpg',
    'assets/samples/sample_04.jpg',
    'assets/samples/sample_05.jpg',
    'assets/samples/sample_06.jpg',
    'assets/samples/sample_07.jpg',
    'assets/samples/sample_08.jpg',
  ];

  /// Photo behind the watermark editor when no account photo can be shown.
  static const watermarkPreview = 'assets/samples/sample_03.jpg';

  /// Whether broken or missing gallery photos show a sample instead.
  /// Read once, after `.env` has been loaded at startup.
  static final bool isEnabled = _readFlag();

  static bool _readFlag() {
    if (!dotenv.isInitialized) return false;
    final raw = dotenv.get('SAMPLE_IMAGES', fallback: '').split('#').first;
    return raw.trim().toLowerCase() == 'true';
  }

  /// Picks a sample for [key]. The same key always gets the same photo,
  /// so a grid keeps a stable look across rebuilds and restarts.
  static String forKey(String key) {
    var hash = 0;
    for (final unit in key.codeUnits) {
      hash = (hash * 31 + unit) & 0x7fffffff;
    }
    return all[hash % all.length];
  }
}
