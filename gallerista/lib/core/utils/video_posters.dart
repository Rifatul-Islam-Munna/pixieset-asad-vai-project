import 'dart:async';
import 'dart:collection';

import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:gallerista/main.dart' show logger;
import 'package:get_thumbnail_video/index.dart';
import 'package:get_thumbnail_video/video_thumbnail.dart';

/// Still "poster" images for videos, which the backend doesn't create (the
/// website shows a frame by loading the video itself, like this does).
///
/// Each video is decoded once on the phone, the JPEG is kept in a disk cache
/// for 60 days, and every later view loads it instantly. At most two videos
/// are decoded at a time, so a grid full of videos never stalls the phone.
abstract final class VideoPosters {
  static final _cache = CacheManager(
    Config(
      'videoPosters',
      stalePeriod: const Duration(days: 60),
      maxNrOfCacheObjects: 500,
    ),
  );

  static const _maxConcurrent = 2;
  static var _running = 0;
  static final _waiting = Queue<Completer<void>>();
  static final _inFlight = <String, Future<String?>>{};

  /// Poster paths already found this session, for flicker-free rebuilds.
  static final _ready = <String, String>{};

  /// The poster file path for [videoUrl] if it is already known, else null.
  static String? cachedPath(String videoUrl) => _ready[videoUrl];

  /// The poster file path for [videoUrl], creating it first if needed.
  /// Completes with null when the video can't be decoded.
  static Future<String?> posterFor(String videoUrl) {
    if (videoUrl.isEmpty) return Future.value();
    final known = _ready[videoUrl];
    if (known != null) return Future.value(known);
    return _inFlight[videoUrl] ??= _load(videoUrl).whenComplete(
      () => _inFlight.remove(videoUrl),
    );
  }

  static Future<String?> _load(String videoUrl) async {
    final cached = await _cache.getFileFromCache(videoUrl);
    if (cached != null) return _ready[videoUrl] = cached.file.path;

    await _acquireSlot();
    try {
      final bytes = await VideoThumbnail.thumbnailData(
        video: videoUrl,
        imageFormat: ImageFormat.JPEG,
        maxWidth: 480,
        quality: 75,
      );
      final file = await _cache.putFile(
        videoUrl,
        bytes,
        fileExtension: 'jpg',
        maxAge: const Duration(days: 60),
      );
      return _ready[videoUrl] = file.path;
    } catch (e, s) {
      // The tile simply stays on its dark video placeholder.
      logger.w('Could not make a poster for $videoUrl', error: e, stackTrace: s);
      return null;
    } finally {
      _releaseSlot();
    }
  }

  static Future<void> _acquireSlot() async {
    if (_running < _maxConcurrent) {
      _running++;
      return;
    }
    final turn = Completer<void>();
    _waiting.add(turn);
    await turn.future; // The finishing job hands its slot straight over.
  }

  static void _releaseSlot() {
    if (_waiting.isNotEmpty) {
      _waiting.removeFirst().complete();
    } else {
      _running--;
    }
  }
}
