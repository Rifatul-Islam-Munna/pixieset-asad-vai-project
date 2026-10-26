import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:screen_protector/screen_protector.dart';

/// App-wide screen capture protection for client galleries.
///
/// - Android: FLAG_SECURE. Screenshots and screen recordings come out black
///   and the recent-apps preview is hidden.
/// - iOS: screenshots come out blank (secure-layer technique), the
///   app-switcher preview is blurred, and while the screen is being
///   recorded or mirrored [recording] is true so the UI can cover itself.
///
/// Reference-counted, so nested protected screens (gallery → photo viewer)
/// keep protection on until the last one closes.
class ScreenGuard {
  ScreenGuard._();

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
      await ScreenProtector.preventScreenshotOn();
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

class _RecordingCover extends StatelessWidget {
  const _RecordingCover();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.videocam_off_outlined, color: Colors.white, size: 48),
              SizedBox(height: 16),
              Text(
                'Screen recording is not allowed',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  decoration: TextDecoration.none,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Stop recording or screen mirroring to keep viewing this '
                'gallery.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  decoration: TextDecoration.none,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
