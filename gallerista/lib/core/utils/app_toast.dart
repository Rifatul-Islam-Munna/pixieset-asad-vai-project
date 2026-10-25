import 'package:flutter/material.dart';
import 'package:gallerista/theme/app_colors.dart';

/// Global toasts (works without a BuildContext). Styled like the frontend's
/// sonner `<Toaster richColors />`: tinted background, colored text + border.
class AppToast {
  AppToast._();

  static final messengerKey = GlobalKey<ScaffoldMessengerState>();

  static void success(String message) =>
      _show(message, Icons.check_circle_rounded, AppColors.success);

  static void error(String message) =>
      _show(message, Icons.error_rounded, AppColors.error);

  static void warning(String message) =>
      _show(message, Icons.warning_rounded, AppColors.warning);

  static void info(String message) =>
      _show(message, Icons.info_rounded, AppColors.info);

  static void _show(String message, IconData icon, Color color) {
    if (message.trim().isEmpty) return;
    final messenger = messengerKey.currentState;
    if (messenger == null) return;
    final background = Color.lerp(AppColors.white, color, .07)!;
    final border = Color.lerp(AppColors.white, color, .25)!;
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: background,
        elevation: 0,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 18),
        duration: const Duration(seconds: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: border),
        ),
        content: _ToastContent(
          message: message,
          icon: icon,
          color: color,
          onClose: messenger.hideCurrentSnackBar,
        ),
      ),
    );
  }
}

class _ToastContent extends StatelessWidget {
  const _ToastContent({
    required this.message,
    required this.icon,
    required this.color,
    required this.onClose,
  });

  final String message;
  final IconData icon;
  final Color color;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              height: 1.25,
            ),
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          onPressed: onClose,
          tooltip: 'Dismiss',
          visualDensity: VisualDensity.compact,
          icon: Icon(Icons.close_rounded, color: color, size: 18),
        ),
      ],
    );
  }
}
