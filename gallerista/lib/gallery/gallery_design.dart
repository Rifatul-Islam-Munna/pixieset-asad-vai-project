import 'package:flutter/material.dart';

/// Design options, mirroring the web gallery designer
/// (client-dashboard.tsx + cover-designs.tsx).
class GalleryDesign {
  GalleryDesign._();

  /// `collectionDefaultDesign` (the parts the app edits).
  static const defaults = <String, dynamic>{
    'cover': 'Center',
    'showCoverSmallTitle': true,
    'showCoverTitle': true,
    'showCoverDate': true,
    'showCoverButton': true,
    'coverButtonText': 'View Gallery',
    'coverFocalX': 50,
    'coverFocalY': 50,
    'coverMotion': 'slow-zoom',
    'typography': 'Classic',
    'color': 'White',
    'gridStyle': 'Vertical',
    'thumbnailSize': 'Regular',
    'gridSpacing': 'Regular',
    'gridColumns': 4,
    'navigationStyle': 'Icon Only',
  };

  /// The 30 cover layouts from `coverOptions`, in web order.
  static const covers = [
    'Center', 'Left', 'Novel', 'Vintage', 'Frame', 'Stripe', 'Divider',
    'Journal', 'Stamp', 'Outline', 'Classic', 'Split', 'Editorial',
    'Gallery', 'Minimal', 'Banner', 'Portal', 'Maison', 'Ceremony Wide',
    'Cinematic', 'Lower Left', 'Lower Split', 'Top Frame', 'Side Button',
    'Soft Center', 'Edge Title', 'Fine Art', 'Magazine', 'Mono Frame',
    'Quiet Luxury',
  ];

  /// `typographyOptions` (+ the default "Classic") with the web's
  /// preview font stacks (`collectionPreviewTypeMap`).
  static const typography = <String, (String sample, String hint)>{
    'Classic': ('Classic', 'The default serif'),
    'Sans': ('SANS', 'A neutral font'),
    'Serif': ('Serif', 'A classic font'),
    'Modern': ('Modern', 'A sophisticated font'),
    'Timeless': ('Timeless', 'A light and airy font'),
    'Bold': ('BOLD', 'A punchy font'),
    'Subtle': ('SUBTLE', 'A minimal font'),
  };

  static TextStyle fontFor(String typography) => switch (typography) {
    'Sans' => const TextStyle(fontFamily: 'Arial', fontFamilyFallback: ['sans-serif']),
    'Modern' || 'Subtle' => const TextStyle(
      fontFamily: 'Helvetica',
      fontFamilyFallback: ['sans-serif'],
      letterSpacing: 1.5,
    ),
    'Timeless' => const TextStyle(
      fontFamily: 'Times New Roman',
      fontFamilyFallback: ['serif'],
      fontWeight: FontWeight.w300,
    ),
    'Bold' => const TextStyle(
      fontFamily: 'Arial Black',
      fontFamilyFallback: ['sans-serif'],
      fontWeight: FontWeight.w900,
    ),
    _ => const TextStyle(fontFamily: 'Georgia', fontFamilyFallback: ['serif']),
  };

  /// `colorOptions` swatches and `collectionPreviewThemeMap`
  /// (background, text, accent).
  static const palettes = <String, (Color bg, Color text, Color accent)>{
    'White': (Color(0xFFFFFFFF), Color(0xFF111111), Color(0xFF555555)),
    'Gold': (Color(0xFFFFFDF8), Color(0xFF2A241B), Color(0xFFA99167)),
    'Rose': (Color(0xFFFBF7F6), Color(0xFF2D2020), Color(0xFFA9807C)),
    'Terracotta': (Color(0xFFFBF8F5), Color(0xFF352018), Color(0xFFAA7B60)),
    'Sand': (Color(0xFFF5F3F1), Color(0xFF2F2924), Color(0xFF9F8F82)),
    'Olive': (Color(0xFFF3F4F0), Color(0xFF24261B), Color(0xFF96977A)),
  };

  static (Color, Color, Color) paletteFor(String name) =>
      palettes[name == 'Light' ? 'White' : name] ?? palettes['White']!;

  static const gridStyles = ['Vertical', 'Horizontal', 'Art', 'Custom'];
  static const thumbnailSizes = ['Regular', 'Large', 'Extra Large'];
  static const gridSpacings = ['Regular', 'Large'];
  static const navigationStyles = ['Icon Only', 'Icon & Text'];
  static const coverMotions = {
    'none': 'None',
    'fade': 'Fade',
    'slow-zoom': 'Slow zoom',
    'rise': 'Rise',
  };
}

/// How the app previews each of the 30 web layouts.
enum CoverFamily { centered, bottomLeft, split, framed, paper }

CoverFamily coverFamily(String cover) => switch (cover) {
  'Left' || 'Lower Left' || 'Edge Title' || 'Side Button' =>
    CoverFamily.bottomLeft,
  'Split' || 'Lower Split' || 'Divider' || 'Stripe' => CoverFamily.split,
  'Frame' || 'Top Frame' || 'Mono Frame' || 'Outline' || 'Stamp' =>
    CoverFamily.framed,
  'Novel' || 'Journal' || 'Editorial' || 'Magazine' => CoverFamily.paper,
  _ => CoverFamily.centered,
};

/// Parses a "#rrggbb" design color, falling back to [fallback].
Color hexColor(dynamic value, Color fallback) {
  final hex = value?.toString().replaceFirst('#', '') ?? '';
  final parsed = int.tryParse(hex, radix: 16);
  if (parsed == null || hex.length != 6) return fallback;
  return Color(0xFF000000 | parsed);
}
