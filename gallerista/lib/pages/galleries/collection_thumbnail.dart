import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/pages/galleries/video_poster_image.dart';

/// Grid thumbnail for one gallery item. Photos show their thumbnail; a video
/// with no server thumbnail shows a frame taken from the video itself (made
/// once on the phone, then cached), over a dark tile while that is made.
/// Each grid adds its own play icon on top.
class CollectionThumbnail extends StatelessWidget {
  const CollectionThumbnail({
    super.key,
    required this.image,
    this.memCacheWidth,
  });

  final CollectionImage image;

  /// Decode width in physical pixels; keeps big photos light in grids.
  final int? memCacheWidth;

  @override
  Widget build(BuildContext context) {
    if (image.hasPoster) {
      return AppNetworkImage(url: image.gridUrl, memCacheWidth: memCacheWidth);
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        const _VideoPosterTile(),
        VideoPosterImage(
          videoUrl: image.videoUrl,
          cacheWidth: memCacheWidth,
        ),
      ],
    );
  }
}

class _VideoPosterTile extends StatelessWidget {
  const _VideoPosterTile();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF3A3A3A), Color(0xFF1C1C1C)],
        ),
      ),
    );
  }
}
