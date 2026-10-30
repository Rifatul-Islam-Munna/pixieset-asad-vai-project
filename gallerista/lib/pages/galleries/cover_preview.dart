import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/gallery/gallery_design.dart';

/// Lays [child] out at the full available width, then scales it down (never
/// up) when it is taller than the space it has, so cover text never spills
/// out of short covers or the text half of split / paper layouts.
class _ScaleDownToFit extends StatelessWidget {
  const _ScaleDownToFit({required this.alignment, required this.child});

  final AlignmentGeometry alignment;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) => FittedBox(
        fit: BoxFit.scaleDown,
        alignment: alignment,
        child: SizedBox(width: box.maxWidth, child: child),
      ),
    );
  }
}

/// Cover title that shrinks from [maxFontSize] towards [minFontSize] until
/// every word fits on one line and the whole title fits in [maxLines] lines,
/// so it never looks oversized or breaks mid-word on any screen. Measured
/// with the device text scale, so accessibility font sizes still apply.
class _FitTitle extends StatelessWidget {
  const _FitTitle({
    required this.text,
    required this.style,
    required this.textAlign,
    required this.maxFontSize,
    required this.minFontSize,
  });

  static const maxLines = 3;

  final String text;
  final TextStyle style;
  final TextAlign textAlign;
  final double maxFontSize;
  final double minFontSize;

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    return LayoutBuilder(builder: (context, box) {
      final size = _fittedSize(box.maxWidth, scaler, direction);
      return Text(
        text,
        textAlign: textAlign,
        maxLines: maxLines,
        overflow: TextOverflow.ellipsis,
        style: style.copyWith(fontSize: size),
      );
    });
  }

  double _fittedSize(double width, TextScaler scaler, TextDirection direction) {
    if (!width.isFinite || width <= 0) return maxFontSize;
    final words = text.split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
    var size = maxFontSize;
    while (size > minFontSize && !_fits(size, width, words, scaler, direction)) {
      size = math.max(minFontSize, size - 1);
    }
    return size;
  }

  bool _fits(
    double size,
    double width,
    Iterable<String> words,
    TextScaler scaler,
    TextDirection direction,
  ) {
    TextPainter measure(String value, {int? lines}) => TextPainter(
          text: TextSpan(text: value, style: style.copyWith(fontSize: size)),
          textDirection: direction,
          textScaler: scaler,
          maxLines: lines,
        )..layout(maxWidth: lines == null ? double.infinity : width);

    for (final word in words) {
      final painter = measure(word);
      final tooWide = painter.width > width;
      painter.dispose();
      if (tooWide) return false;
    }
    final whole = measure(text, lines: maxLines);
    final fits = !whole.didExceedMaxLines;
    whole.dispose();
    return fits;
  }
}

/// Phone-sized preview of a gallery cover with the chosen layout,
/// typography, colors and focal point. Tapping sets the focal point when
/// [onFocalTap] is given.
class CoverPreview extends StatelessWidget {
  const CoverPreview({
    super.key,
    required this.design,
    required this.imageUrl,
    required this.title,
    this.smallTitle = '',
    this.date = '',
    this.onFocalTap,
    this.showFocalMarker = false,
  });

  final Map<String, dynamic> design;
  final String imageUrl;
  final String title;
  final String smallTitle;
  final String date;
  final void Function(double x, double y)? onFocalTap;
  final bool showFocalMarker;

  T _v<T>(String key) => (design[key] ?? GalleryDesign.defaults[key]) as T;

  @override
  Widget build(BuildContext context) {
    final cover = '${_v<Object>('cover')}';
    final family = coverFamily(cover);
    final (bg, ink, accent) = GalleryDesign.paletteFor('${_v<Object>('color')}');
    final font = GalleryDesign.fontFor('${_v<Object>('typography')}');
    final fx = (num.tryParse('${_v<Object>('coverFocalX')}') ?? 50).toDouble();
    final fy = (num.tryParse('${_v<Object>('coverFocalY')}') ?? 50).toDouble();
    final alignment = Alignment(fx / 50 - 1, fy / 50 - 1);

    return LayoutBuilder(builder: (context, box) {
      // Spacing follows the cover width, within limits so tablets and wide
      // screens don't get giant padding.
      final s = (box.maxWidth / 360).clamp(0.85, 1.6).toDouble();
      // Text follows the width it actually gets (half the cover in split
      // layouts), also within limits; the title then shrinks to fit.
      final textWidth =
          family == CoverFamily.split ? box.maxWidth / 2 : box.maxWidth;
      final t = (textWidth / 360).clamp(0.8, 1.25).toDouble();
      final onImage = family != CoverFamily.split && family != CoverFamily.paper;
      final textColor = onImage
          ? hexColor(design['coverTitleColor'], Colors.white)
          : ink;
      final fitAlignment = family == CoverFamily.bottomLeft
          ? AlignmentDirectional.bottomStart
          : AlignmentDirectional.center;
      final texts = _ScaleDownToFit(
        alignment: fitAlignment,
        child: _CoverTexts(
          smallTitle: _v<bool>('showCoverSmallTitle') ? smallTitle : '',
          title: _v<bool>('showCoverTitle') ? title : '',
          date: _v<bool>('showCoverDate') ? date : '',
          button: _v<bool>('showCoverButton')
              ? '${design['coverButtonText'] ?? GalleryDesign.defaults['coverButtonText']}'
              : '',
          font: font,
          color: textColor,
          accent: onImage ? textColor : accent,
          scale: t,
          alignStart: family == CoverFamily.bottomLeft,
        ),
      );
      final image = LayoutBuilder(builder: (_, imageBox) => GestureDetector(
        onTapDown: onFocalTap == null
            ? null
            : (d) {
                final size = imageBox.biggest;
                onFocalTap!(
                  (d.localPosition.dx / size.width * 100).clamp(0, 100),
                  (d.localPosition.dy / size.height * 100).clamp(0, 100),
                );
              },
        child: Stack(
          fit: StackFit.expand,
          children: [
            AppNetworkImage(url: imageUrl, alignment: alignment),
            if (showFocalMarker)
              Align(
                alignment: alignment,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 6)],
                  ),
                ),
              ),
          ],
        ),
      ));

      return ClipRect(
        child: ColoredBox(
          color: bg,
          child: switch (family) {
            CoverFamily.split => Row(
                children: [
                  Expanded(child: Center(child: texts)),
                  Expanded(child: image),
                ],
              ),
            CoverFamily.paper => Column(
                children: [
                  Expanded(flex: 62, child: image),
                  Expanded(flex: 38, child: Center(child: texts)),
                ],
              ),
            _ => Stack(
                fit: StackFit.expand,
                children: [
                  image,
                  IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: family == CoverFamily.bottomLeft
                              ? const [Color(0x00000000), Color(0x99000000)]
                              : const [Color(0x40000000), Color(0x40000000)],
                        ),
                      ),
                    ),
                  ),
                  if (family == CoverFamily.framed)
                    IgnorePointer(
                      child: Padding(
                        padding: EdgeInsets.all(18 * s),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            border: Border.all(color: textColor, width: 1.2),
                          ),
                        ),
                      ),
                    ),
                  IgnorePointer(
                    child: Padding(
                      padding: EdgeInsets.all(32 * s),
                      child: Align(
                        alignment: family == CoverFamily.bottomLeft
                            ? AlignmentDirectional.bottomStart
                            : Alignment.center,
                        child: texts,
                      ),
                    ),
                  ),
                ],
              ),
          },
        ),
      );
    });
  }
}

class _CoverTexts extends StatelessWidget {
  const _CoverTexts({
    required this.smallTitle,
    required this.title,
    required this.date,
    required this.button,
    required this.font,
    required this.color,
    required this.accent,
    required this.scale,
    required this.alignStart,
  });

  final String smallTitle;
  final String title;
  final String date;
  final String button;
  final TextStyle font;
  final Color color;
  final Color accent;
  final double scale;
  final bool alignStart;

  @override
  Widget build(BuildContext context) {
    final align = alignStart ? TextAlign.start : TextAlign.center;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 12 * scale),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment:
            alignStart ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          if (smallTitle.isNotEmpty)
            Text(smallTitle.toUpperCase(),
                textAlign: align,
                style: font.copyWith(
                    color: color, fontSize: 11 * scale, letterSpacing: 3 * scale)),
          if (title.isNotEmpty) ...[
            SizedBox(height: 10 * scale),
            _FitTitle(
              text: title,
              textAlign: align,
              style: font.copyWith(color: color, height: 1.1),
              maxFontSize: 34 * scale,
              minFontSize: 16,
            ),
          ],
          if (date.isNotEmpty) ...[
            SizedBox(height: 10 * scale),
            Text(date,
                textAlign: align,
                style: font.copyWith(color: color, fontSize: 13 * scale)),
          ],
          if (button.isNotEmpty) ...[
            SizedBox(height: 18 * scale),
            Container(
              padding: EdgeInsets.symmetric(
                  horizontal: 18 * scale, vertical: 8 * scale),
              decoration: BoxDecoration(border: Border.all(color: accent)),
              child: Text(button.toUpperCase(),
                  style: font.copyWith(
                      color: accent,
                      fontSize: 10 * scale,
                      letterSpacing: 2 * scale)),
            ),
          ],
        ],
      ),
    );
  }
}
