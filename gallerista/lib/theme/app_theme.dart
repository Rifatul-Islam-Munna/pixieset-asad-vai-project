import 'package:flutter/material.dart';
import 'package:gallerista/theme/app_colors.dart';

export 'package:gallerista/theme/app_colors.dart';

class AppTheme {
  AppTheme._();

  /// Default theme: the `.gallerista-editorial` palette.
  static final ThemeData light = _build(
    AppPalette.editorial,
    Brightness.light,
    secondary: AppColors.galleryPurple,
  );

  /// The frontend's shadcn `.dark` tokens.
  static final ThemeData dark = _build(
    AppPalette.webDark,
    Brightness.dark,
    secondary: AppColors.galleryLavender,
  );

  static ThemeData _build(
    AppPalette p,
    Brightness brightness, {
    required Color secondary,
  }) {
    final scheme = ColorScheme(
      brightness: brightness,
      primary: p.primary,
      onPrimary: p.primaryForeground,
      secondary: secondary,
      onSecondary: brightness == Brightness.light
          ? AppColors.white
          : AppColors.galleryText,
      tertiary: AppColors.galleryGold,
      onTertiary: AppColors.galleryText,
      error: p.destructive,
      onError: AppColors.white,
      surface: p.card,
      onSurface: p.cardForeground,
      onSurfaceVariant: p.mutedForeground,
      surfaceContainerHighest: p.muted,
      outline: p.border,
      outlineVariant: p.input,
    );
    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
    );
    final squareShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.base),
    );
    final inputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadius.base),
      borderSide: BorderSide(color: p.input),
    );
    const buttonSize = Size(64, 44);
    const buttonText = TextStyle(fontWeight: FontWeight.w600);

    return base.copyWith(
      scaffoldBackgroundColor: p.background,
      canvasColor: p.background,
      cardColor: p.card,
      dividerColor: p.border,
      disabledColor: p.mutedForeground,
      textTheme: base.textTheme.apply(
        bodyColor: p.foreground,
        displayColor: p.foreground,
      ),
      iconTheme: IconThemeData(color: p.foreground),
      appBarTheme: AppBarTheme(
        backgroundColor: p.background,
        foregroundColor: p.foreground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: p.card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: squareShape.copyWith(side: BorderSide(color: p.border)),
      ),
      dividerTheme: DividerThemeData(color: p.border, thickness: 1, space: 1),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: p.primaryForeground,
          minimumSize: buttonSize,
          shape: squareShape,
          textStyle: buttonText,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: p.primaryForeground,
          elevation: 0,
          minimumSize: buttonSize,
          shape: squareShape,
          textStyle: buttonText,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.foreground,
          side: BorderSide(color: p.border),
          minimumSize: buttonSize,
          shape: squareShape,
          textStyle: buttonText,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: secondary,
          shape: squareShape,
          textStyle: buttonText,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.card,
        hintStyle: TextStyle(color: p.mutedForeground),
        labelStyle: TextStyle(color: p.mutedForeground),
        prefixIconColor: p.mutedForeground,
        suffixIconColor: p.mutedForeground,
        border: inputBorder,
        enabledBorder: inputBorder,
        focusedBorder: inputBorder.copyWith(
          borderSide: BorderSide(color: p.ring, width: 1.5),
        ),
        errorBorder: inputBorder.copyWith(
          borderSide: BorderSide(color: p.destructive),
        ),
        focusedErrorBorder: inputBorder.copyWith(
          borderSide: BorderSide(color: p.destructive, width: 1.5),
        ),
        errorStyle: TextStyle(color: p.destructive),
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: p.foreground,
        selectionColor: secondary.withValues(alpha: .3),
        selectionHandleColor: secondary,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        shape: squareShape,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.card,
        modalBackgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        shape: squareShape,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: p.card,
        surfaceTintColor: Colors.transparent,
        shape: squareShape.copyWith(side: BorderSide(color: p.border)),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: p.secondary,
        selectedColor: p.accent,
        side: BorderSide(color: p.border),
        shape: squareShape,
        labelStyle: TextStyle(color: p.foreground),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: p.card,
        contentTextStyle: TextStyle(color: p.foreground),
        behavior: SnackBarBehavior.floating,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p.primary,
        linearTrackColor: p.muted,
        circularTrackColor: p.muted,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: p.foreground,
        unselectedLabelColor: p.mutedForeground,
        indicatorColor: p.foreground,
        dividerColor: p.border,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        indicatorColor: p.accent,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: p.card,
        selectedItemColor: p.foreground,
        unselectedItemColor: p.mutedForeground,
      ),
    );
  }
}
