import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/sample_images.dart';
import 'package:gallerista/theme/app_theme.dart';
import 'package:intl/intl.dart';

String formatDate(DateTime? date) =>
    date == null ? '' : DateFormat.yMMMd().format(date);

String titleCase(String? value) {
  if (value == null || value.isEmpty) return '';
  return value[0].toUpperCase() + value.substring(1);
}

/// Cached network image that loads smoothly: a soft pulsing skeleton (or a
/// low-res [previewUrl]) while loading, then a short cross-fade to the photo.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.url,
    this.previewUrl,
    this.fit = BoxFit.cover,
    this.placeholderColor = AppColors.galleryCoverPlaceholder,
    this.memCacheWidth,
    this.alignment = Alignment.center,
    this.fallbackAsset,
    this.allowSampleFallback = true,
  });

  final String url;

  /// Smaller copy (usually the grid thumbnail, already cached) shown while
  /// [url] loads, so the full photo sharpens in place instead of popping in.
  final String? previewUrl;

  final BoxFit fit;
  final Color placeholderColor;
  final Alignment alignment;

  /// Decode width in physical pixels; keeps big photos light in grids.
  final int? memCacheWidth;

  /// Bundled image shown whenever [url] is empty or fails to load.
  final String? fallbackAsset;

  /// Whether a stock sample may replace a missing photo when
  /// `SAMPLE_IMAGES=true`. Turn off for logos and avatars.
  final bool allowSampleFallback;

  String? get _fallback =>
      fallbackAsset ??
      (allowSampleFallback && SampleImages.isEnabled
          ? SampleImages.forKey(url)
          : null);

  @override
  Widget build(BuildContext context) {
    final fallback = _fallback;
    final fallbackImage = fallback == null
        ? null
        : _AssetFallback(
            asset: fallback,
            fit: fit,
            alignment: alignment,
            cacheWidth: memCacheWidth,
          );
    if (url.isEmpty) {
      return fallbackImage ?? _Placeholder(color: placeholderColor);
    }

    final preview = previewUrl ?? '';
    final previewImage = preview.isEmpty || preview == url
        ? null
        : _PreviewImage(
            url: preview,
            fit: fit,
            alignment: alignment,
            color: placeholderColor,
          );

    return CachedNetworkImage(
      imageUrl: url,
      fit: fit,
      alignment: alignment,
      memCacheWidth: memCacheWidth,
      // The photo fades in on top; the placeholder underneath fades out more
      // slowly, so there is never a see-through dip mid cross-fade.
      fadeInDuration: const Duration(milliseconds: 250),
      fadeInCurve: Curves.easeOut,
      fadeOutDuration: const Duration(milliseconds: 400),
      placeholder: (_, _) =>
          previewImage ?? _LoadingPulse(color: placeholderColor),
      errorWidget: (_, _, _) =>
          fallbackImage ??
          previewImage ??
          _Placeholder(color: placeholderColor, broken: true),
    );
  }
}

/// The low-res stand-in shown while the full photo downloads.
class _PreviewImage extends StatelessWidget {
  const _PreviewImage({
    required this.url,
    required this.fit,
    required this.alignment,
    required this.color,
  });

  final String url;
  final BoxFit fit;
  final Alignment alignment;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: url,
      fit: fit,
      alignment: alignment,
      fadeInDuration: Duration.zero,
      fadeOutDuration: Duration.zero,
      placeholder: (_, _) => _LoadingPulse(color: color),
      errorWidget: (_, _, _) => _LoadingPulse(color: color),
    );
  }
}

/// Soft breathing skeleton shown while an image loads. Holds still when the
/// phone's "remove animations" setting is on, or when the color is clear.
class _LoadingPulse extends StatefulWidget {
  const _LoadingPulse({required this.color});

  final Color color;

  @override
  State<_LoadingPulse> createState() => _LoadingPulseState();
}

class _LoadingPulseState extends State<_LoadingPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still =
        MediaQuery.disableAnimationsOf(context) || widget.color.a == 0;
    if (still) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.color;
    // Light placeholders brighten noticeably; dark ones (the black photo
    // viewer) only lift a touch so the pulse never flashes.
    final highlight = Color.lerp(
      base,
      Colors.white,
      base.computeLuminance() > .5 ? .55 : .06,
    )!;
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, _) => ColoredBox(
        color: Color.lerp(
          base,
          highlight,
          Curves.easeInOut.transform(_controller.value),
        )!,
      ),
    );
  }
}

class _AssetFallback extends StatelessWidget {
  const _AssetFallback({
    required this.asset,
    required this.fit,
    required this.alignment,
    this.cacheWidth,
  });

  final String asset;
  final BoxFit fit;
  final Alignment alignment;
  final int? cacheWidth;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      asset,
      fit: fit,
      alignment: alignment,
      cacheWidth: cacheWidth,
      excludeFromSemantics: true,
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.color, this.broken = false});

  final Color color;
  final bool broken;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: color,
      child: Center(
        child: Icon(
          broken ? Icons.broken_image_outlined : Icons.photo_library_outlined,
          size: 36,
          color: const Color(0xFFCCCCCC),
        ),
      ),
    );
  }
}
