import 'package:flutter/material.dart';

/// Colors mirrored from the web frontend: `frontend/app/globals.css`.
///
/// - [AppPalette.editorial] is the `.gallerista-editorial` palette that the
///   photographer dashboard renders (`client-dashboard.tsx`). It is the
///   default light theme of the app.
/// - [AppPalette.webLight] / [AppPalette.webDark] are the shadcn `:root` and
///   `.dark` tokens, converted from OKLCH to sRGB hex.
@immutable
class AppPalette {
  const AppPalette({
    required this.background,
    required this.foreground,
    required this.card,
    required this.cardForeground,
    required this.primary,
    required this.primaryForeground,
    required this.secondary,
    required this.secondaryForeground,
    required this.muted,
    required this.mutedForeground,
    required this.accent,
    required this.accentForeground,
    required this.destructive,
    required this.border,
    required this.input,
    required this.ring,
  });

  final Color background;
  final Color foreground;
  final Color card;
  final Color cardForeground;
  final Color primary;
  final Color primaryForeground;
  final Color secondary;
  final Color secondaryForeground;
  final Color muted;
  final Color mutedForeground;
  final Color accent;
  final Color accentForeground;
  final Color destructive;
  final Color border;
  final Color input;
  final Color ring;

  /// `.gallerista-editorial` (photographer dashboard look).
  static const editorial = AppPalette(
    background: Color(0xFFF8F7F4), // --gallery-bg
    foreground: Color(0xFF151515), // --gallery-text
    card: Color(0xFFFFFFFF), // --gallery-card
    cardForeground: Color(0xFF151515),
    primary: Color(0xFF1C1C1C), // --gallery-primary
    primaryForeground: Color(0xFFFFFFFF),
    secondary: Color(0xFFF4F4F5), // shadcn --secondary
    secondaryForeground: Color(0xFF18181B),
    muted: Color(0xFFF4F4F5), // shadcn --muted
    mutedForeground: Color(0xFF5F5A54), // editorial muted text
    accent: Color(0xFFEFEBFF), // lavender 22% mixed with white
    accentForeground: Color(0xFF6F57D9), // --gallery-purple
    destructive: Color(0xFFE7000B), // shadcn --destructive
    border: Color(0xFFE8E5E1), // --gallery-border
    input: Color(0xFFE8E5E1),
    ring: Color(0xFF6F57D9), // purple focus ring
  );

  /// shadcn `:root` tokens.
  static const webLight = AppPalette(
    background: Color(0xFFFFFFFF),
    foreground: Color(0xFF09090B),
    card: Color(0xFFFFFFFF),
    cardForeground: Color(0xFF09090B),
    primary: Color(0xFF007595),
    primaryForeground: Color(0xFFECFEFF),
    secondary: Color(0xFFF4F4F5),
    secondaryForeground: Color(0xFF18181B),
    muted: Color(0xFFF4F4F5),
    mutedForeground: Color(0xFF71717B),
    accent: Color(0xFFF4F4F5),
    accentForeground: Color(0xFF18181B),
    destructive: Color(0xFFE7000B),
    border: Color(0xFFE4E4E7),
    input: Color(0xFFE4E4E7),
    ring: Color(0xFF9F9FA9),
  );

  /// shadcn `.dark` tokens.
  static const webDark = AppPalette(
    background: Color(0xFF09090B),
    foreground: Color(0xFFFAFAFA),
    card: Color(0xFF18181B),
    cardForeground: Color(0xFFFAFAFA),
    primary: Color(0xFF005F78),
    primaryForeground: Color(0xFFECFEFF),
    secondary: Color(0xFF27272A),
    secondaryForeground: Color(0xFFFAFAFA),
    muted: Color(0xFF27272A),
    mutedForeground: Color(0xFF9F9FA9),
    accent: Color(0xFF27272A),
    accentForeground: Color(0xFFFAFAFA),
    destructive: Color(0xFFFF6467),
    border: Color(0x1AFFFFFF), // white 10%
    input: Color(0x26FFFFFF), // white 15%
    ring: Color(0xFF71717B),
  );
}

/// Flat color constants for quick use in widgets (same idea as Nutshell's
/// `AppColors`). Values come from the frontend; see [AppPalette].
class AppColors {
  AppColors._();

  // Gallerista brand (.gallerista-editorial)
  static const galleryBackground = Color(0xFFF8F7F4);
  static const galleryCard = Color(0xFFFFFFFF);
  static const galleryText = Color(0xFF151515);
  static const galleryBorder = Color(0xFFE8E5E1);
  static const galleryPrimary = Color(0xFF1C1C1C);
  static const galleryPrimaryHover = Color(0xFF2E2E2E);
  static const galleryPurple = Color(0xFF6F57D9);
  static const galleryLavender = Color(0xFFB7A3FF);
  static const galleryLavenderTint = Color(0xFFEFEBFF);
  static const galleryGold = Color(0xFFC89F65); // .luxury-accent
  static const galleryMutedText = Color(0xFF5F5A54);

  // Semantic aliases
  static const primary = galleryPrimary;
  static const onPrimary = white;
  static const accent = galleryPurple;
  static const background = galleryBackground;
  static const surface = galleryCard;
  static const border = galleryBorder;
  static const textPrimary = galleryText;
  static const textSecondary = galleryMutedText;
  static const textDisabled = Color(0xFF9F9FA9); // shadcn --ring (zinc-400)

  // Status colors: sonner `richColors` text colors, because the frontend
  // renders toasts with <Toaster richColors />.
  static const success = Color(0xFF008A2E);
  static const warning = Color(0xFFDC7609);
  static const info = Color(0xFF0973DC);
  static const error = Color(0xFFE7000B); // shadcn --destructive

  static const white = Color(0xFFFFFFFF);
  static const black = Color(0xFF000000);
}

/// Corner radii from the frontend. `--radius: 0` in globals.css makes every
/// shadcn component square; `.polished-control` buttons use `rounded-full`.
class AppRadius {
  AppRadius._();

  static const double base = 0;
  static const double pill = 999;
}
