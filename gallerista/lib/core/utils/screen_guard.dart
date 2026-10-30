import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:screen_protector/screen_protector.dart';

/// App-wide screen capture protection for client galleries.
///
/// - Android: FLAG_SECURE. Screenshots are refused and screen recordings come
///   out black; the OS does not let an app put anything else in them.
/// - iOS: screenshots and screen recordings show the Gallerista logo
///   ([iosShieldImage] in Runner/Assets.xcassets) instead of the photos, the
///   app-switcher preview is blurred, and while the screen is being recorded
///   or mirrored [recording] is true so the UI covers itself with the logo.
///
/// Reference-counted, so nested protected screens (gallery → photo viewer)
/// keep protection on until the last one closes.
class ScreenGuard {
  ScreenGuard._();

  /// Image set in ios/Runner/Assets.xcassets shown in iOS captures.
  static const iosShieldImage = 'GalleristaShield';

  static int _count = 0;

  /// True while iOS reports screen recording / mirroring.
  static final recording = ValueNotifier<bool>(false);

  static int get activeCount => _count;

  static bool get _supported =>
      !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  static Future<void> acquire() async {
    _count++;
    if (_count > 1 || !_supported) return;
    try {
      ScreenProtector.addListener(
        () => AppToast.warning('Screenshots are not allowed in this gallery.'),
        (captured) => recording.value = captured,
      );
      await ScreenProtector.preventScreenshotOn(
        iosPlaceholderImage: iosShieldImage,
        iosPlaceholderText: 'Protected by Gallerista',
      );
      await ScreenProtector.protectDataLeakageWithBlur();
      recording.value = await ScreenProtector.isRecording();
    } catch (e) {
      debugPrint('ScreenGuard: protection unavailable: $e');
    }
  }

  static Future<void> release() async {
    if (_count == 0) return;
    _count--;
    if (_count > 0) return;
    recording.value = false;
    if (!_supported) return;
    try {
      ScreenProtector.removeListener();
      await ScreenProtector.preventScreenshotOff();
      await ScreenProtector.protectDataLeakageWithBlurOff();
    } catch (e) {
      debugPrint('ScreenGuard: could not release protection: $e');
    }
  }
}

/// Wrap a screen to block screenshots and screen recording while visible.
class ProtectedScreen extends StatefulWidget {
  const ProtectedScreen({super.key, required this.child});

  final Widget child;

  @override
  State<ProtectedScreen> createState() => _ProtectedScreenState();
}

class _ProtectedScreenState extends State<ProtectedScreen> {
  @override
  void initState() {
    super.initState();
    ScreenGuard.acquire();
  }

  @override
  void dispose() {
    ScreenGuard.release();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: ScreenGuard.recording,
      child: widget.child,
      builder: (context, isRecording, child) => Stack(
        children: [
          child!,
          if (isRecording) const Positioned.fill(child: _RecordingCover()),
        ],
      ),
    );
  }
}

/// Shown over a protected screen while it is being recorded or mirrored:
/// the Gallerista logo on white instead of a black screen.
class _RecordingCover extends StatelessWidget {
  const _RecordingCover();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.white,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset(
                  'assets/brand/gallerista_logo.png',
                  semanticLabel: 'Gallerista',
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 28),
                const Text(
                  'Screen recording is not allowed',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFF151515),
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.none,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Stop recording or screen mirroring to keep viewing this '
                  'gallery.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFF5F5A54),
                    fontSize: 14,
                    height: 1.4,
                    decoration: TextDecoration.none,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
