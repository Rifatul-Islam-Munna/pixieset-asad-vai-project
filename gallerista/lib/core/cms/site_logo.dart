import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/cms/site_brand.dart';

/// The website's wordmark logo (uploaded by the admin), [height] tall and
/// left-aligned. Shows [fallback] while no logo is known, when none is
/// uploaded, or when it fails to load.
class SiteLogo extends StatelessWidget {
  const SiteLogo({
    super.key,
    required this.height,
    required this.fallback,
    this.maxWidth = 220,
  });

  final double height;
  final double maxWidth;
  final Widget fallback;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<SiteBrand>(
      valueListenable: SiteBrand.current,
      builder: (context, brand, _) {
        if (brand.logoUrl.isEmpty) return fallback;
        return _BrandImage(
          url: brand.logoUrl,
          label: brand.name,
          height: height,
          maxWidth: maxWidth,
          alignment: Alignment.centerLeft,
          fallback: fallback,
        );
      },
    );
  }
}

/// The website's square icon (its favicon, uploaded by the admin), [size]
/// wide. Shows [fallback] while none is known or when it fails to load.
class SiteIcon extends StatelessWidget {
  const SiteIcon({super.key, required this.size, required this.fallback});

  final double size;
  final Widget fallback;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<SiteBrand>(
      valueListenable: SiteBrand.current,
      builder: (context, brand, _) {
        if (brand.iconUrl.isEmpty) return fallback;
        return _BrandImage(
          url: brand.iconUrl,
          label: brand.name,
          height: size,
          maxWidth: size,
          alignment: Alignment.center,
          fallback: fallback,
        );
      },
    );
  }
}

class _BrandImage extends StatelessWidget {
  const _BrandImage({
    required this.url,
    required this.label,
    required this.height,
    required this.maxWidth,
    required this.alignment,
    required this.fallback,
  });

  final String url;
  final String label;
  final double height;
  final double maxWidth;
  final Alignment alignment;
  final Widget fallback;

  @override
  Widget build(BuildContext context) {
    final image = Semantics(
      image: true,
      label: label,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: height, maxWidth: maxWidth),
        child: CachedNetworkImage(
          imageUrl: url,
          height: height,
          fit: BoxFit.contain,
          alignment: alignment,
          // Decode at display size: the uploaded logo is ~2400px wide.
          memCacheHeight: (height * MediaQuery.devicePixelRatioOf(context))
              .round(),
          fadeInDuration: const Duration(milliseconds: 150),
          placeholder: (_, _) => SizedBox(height: height),
          errorWidget: (_, _, _) => fallback,
        ),
      ),
    );
    // Logos are usually drawn for a light page; black lettering would vanish
    // on a dark one, so in dark mode the logo sits on a small light badge.
    if (Theme.of(context).brightness != Brightness.dark) return image;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: image,
      ),
    );
  }
}
