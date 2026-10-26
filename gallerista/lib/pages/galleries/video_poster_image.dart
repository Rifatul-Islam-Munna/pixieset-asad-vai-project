import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/video_posters.dart';

/// A video's poster frame, faded in once it is ready. Draws nothing until
/// then, so callers put their own background (dark tile, black viewer)
/// underneath.
class VideoPosterImage extends StatefulWidget {
  const VideoPosterImage({
    super.key,
    required this.videoUrl,
    this.fit = BoxFit.cover,
    this.cacheWidth,
  });

  final String videoUrl;
  final BoxFit fit;

  /// Decode width in physical pixels; keeps grid tiles light.
  final int? cacheWidth;

  @override
  State<VideoPosterImage> createState() => _VideoPosterImageState();
}

class _VideoPosterImageState extends State<VideoPosterImage> {
  String? _path;

  /// Whether the poster was already known when this tile was built, so it
  /// shows at once instead of fading in again while scrolling back.
  var _instant = false;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(VideoPosterImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoUrl != widget.videoUrl) _resolve();
  }

  void _resolve() {
    final url = widget.videoUrl;
    _path = VideoPosters.cachedPath(url);
    _instant = _path != null;
    if (_path == null) unawaited(_load(url));
  }

  Future<void> _load(String url) async {
    final path = await VideoPosters.posterFor(url);
    if (!mounted || path == null || url != widget.videoUrl) return;
    setState(() => _path = path);
  }

  @override
  Widget build(BuildContext context) {
    final path = _path;
    if (path == null) return const SizedBox.expand();
    return Image.file(
      File(path),
      fit: widget.fit,
      cacheWidth: widget.cacheWidth,
      gaplessPlayback: true,
      excludeFromSemantics: true,
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (_instant || wasSynchronouslyLoaded) return child;
        return AnimatedOpacity(
          opacity: frame == null ? 0 : 1,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
          child: child,
        );
      },
    );
  }
}
