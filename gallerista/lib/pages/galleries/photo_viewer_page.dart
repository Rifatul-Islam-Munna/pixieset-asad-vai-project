import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/pages/galleries/gallery_video_player.dart';

/// Full-screen swipeable viewer: pinch-to-zoom photos, playable videos.
@RoutePage()
class PhotoViewerPage extends StatefulWidget {
  const PhotoViewerPage({
    super.key,
    required this.images,
    this.initialIndex = 0,
  });

  final List<CollectionImage> images;
  final int initialIndex;

  @override
  State<PhotoViewerPage> createState() => _PhotoViewerPageState();
}

class _PhotoViewerPageState extends State<PhotoViewerPage> {
  late final _controller = PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _precacheAround(_index);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Downloads and decodes the photos on either side of [index] in the
  /// background, so a swipe lands on a photo that is already sharp.
  void _precacheAround(int index) {
    for (final i in [index + 1, index - 1]) {
      if (i < 0 || i >= widget.images.length) continue;
      final image = widget.images[i];
      if (image.isVideo || image.viewerUrl.isEmpty) continue;
      // A failed warm-up is harmless: that page shows its own fallback
      // (thumbnail, sample or broken icon) when the user swipes to it.
      unawaited(precacheImage(
        CachedNetworkImageProvider(image.viewerUrl),
        context,
        onError: (_, _) {},
      ));
    }
  }

  void _onPageChanged(int index) {
    setState(() => _index = index);
    _precacheAround(index);
  }

  @override
  Widget build(BuildContext context) {
    final image = widget.images[_index];
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(
          image.originalName ?? '${_index + 1} / ${widget.images.length}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 15, color: Colors.white),
        ),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsetsDirectional.only(end: 16),
              child: Text(
                '${_index + 1} / ${widget.images.length}',
                style: const TextStyle(color: Colors.white70),
              ),
            ),
          ),
        ],
      ),
      body: PageView.builder(
        controller: _controller,
        // Keep the pages on either side built, so the next video has
        // already loaded its first chunks (paused) before you swipe to it.
        allowImplicitScrolling: true,
        itemCount: widget.images.length,
        onPageChanged: _onPageChanged,
        itemBuilder: (_, i) {
          final item = widget.images[i];
          if (item.isVideo) {
            return GalleryVideoPlayer(
              key: ValueKey(item.id),
              url: item.videoUrl,
              // Only the page on screen plays; swiping away pauses it.
              active: i == _index,
            );
          }
          return InteractiveViewer(
            minScale: 1,
            maxScale: 5,
            child: Center(
              child: AppNetworkImage(
                url: item.viewerUrl,
                // The grid thumbnail is already on the phone: show it at
                // once and let the full-size photo sharpen in over it.
                previewUrl: item.gridUrl,
                fit: BoxFit.contain,
                placeholderColor: Colors.black,
              ),
            ),
          );
        },
      ),
    );
  }
}
