import 'dart:async';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:gallerista/main.dart' show logger;
import 'package:gallerista/pages/galleries/video_poster_image.dart';
import 'package:video_player/video_player.dart';

/// Plays one gallery video inside the full-screen viewer. Tap to show or
/// hide the controls; drag the bar to seek. Plays only while [active] (the
/// page on screen) and pauses as soon as it is swiped away.
class GalleryVideoPlayer extends StatefulWidget {
  const GalleryVideoPlayer({
    super.key,
    required this.url,
    required this.active,
  });

  final String url;
  final bool active;

  @override
  State<GalleryVideoPlayer> createState() => _GalleryVideoPlayerState();
}

class _GalleryVideoPlayerState extends State<GalleryVideoPlayer> {
  late VideoPlayerController _controller;
  var _failed = false;
  String? _failure;
  var _controlsVisible = true;
  Timer? _hideTimer;

  @override
  void initState() {
    super.initState();
    _controller = _createController();
  }

  VideoPlayerController _createController() {
    final controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    unawaited(_initialize(controller));
    return controller;
  }

  Future<void> _initialize(VideoPlayerController controller) async {
    try {
      await controller.initialize();
      if (!mounted || controller != _controller) return;
      setState(() {});
      if (widget.active) await _play();
    } catch (e, s) {
      logger.e('Video failed to load: ${widget.url}', error: e, stackTrace: s);
      if (mounted && controller == _controller) {
        setState(() {
          _failed = true;
          _failure = '$e';
        });
      }
    }
  }

  Future<void> _retry() async {
    final old = _controller;
    setState(() {
      _failed = false;
      _failure = null;
      _controller = _createController();
    });
    await old.dispose();
  }

  @override
  void didUpdateWidget(GalleryVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_controller.value.isInitialized) return;
    if (widget.active && !oldWidget.active) unawaited(_play());
    if (!widget.active && oldWidget.active) unawaited(_pause());
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    unawaited(_controller.dispose());
    super.dispose();
  }

  Future<void> _play() async {
    final value = _controller.value;
    // Finished: start over instead of doing nothing.
    if (value.duration > Duration.zero && value.position >= value.duration) {
      await _controller.seekTo(Duration.zero);
    }
    await _controller.play();
    _scheduleHide();
  }

  Future<void> _pause() async {
    _hideTimer?.cancel();
    await _controller.pause();
    if (mounted) setState(() => _controlsVisible = true);
  }

  Future<void> _togglePlay() =>
      _controller.value.isPlaying ? _pause() : _play();

  Future<void> _toggleMute() =>
      _controller.setVolume(_controller.value.volume == 0 ? 1 : 0);

  void _toggleControls() {
    setState(() => _controlsVisible = !_controlsVisible);
    if (_controlsVisible) _scheduleHide();
  }

  /// Fades the controls out after a few seconds of uninterrupted playback.
  void _scheduleHide() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 3), () {
      if (mounted && _controller.value.isPlaying) {
        setState(() => _controlsVisible = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) return _VideoError(onRetry: _retry, details: _failure);
    return ValueListenableBuilder<VideoPlayerValue>(
      valueListenable: _controller,
      builder: (context, value, _) {
        if (value.hasError) {
          return _VideoError(onRetry: _retry, details: value.errorDescription);
        }
        if (!value.isInitialized) return _VideoLoading(videoUrl: widget.url);
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _toggleControls,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Same frame as the video's first one, so the switch from
              // "loading" to "playing" never flashes black.
              VideoPosterImage(videoUrl: widget.url, fit: BoxFit.contain),
              Center(
                child: AspectRatio(
                  aspectRatio: value.aspectRatio,
                  child: VideoPlayer(_controller),
                ),
              ),
              _VideoControls(
                controller: _controller,
                value: value,
                // Always show controls while paused, so play is reachable.
                visible: _controlsVisible || !value.isPlaying,
                onTogglePlay: _togglePlay,
                onToggleMute: _toggleMute,
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Center play/pause button and a bottom bar with time, seek bar and mute.
class _VideoControls extends StatelessWidget {
  const _VideoControls({
    required this.controller,
    required this.value,
    required this.visible,
    required this.onTogglePlay,
    required this.onToggleMute,
  });

  final VideoPlayerController controller;
  final VideoPlayerValue value;
  final bool visible;
  final VoidCallback onTogglePlay;
  final VoidCallback onToggleMute;

  static const _timeStyle = TextStyle(
    color: Colors.white,
    fontSize: 12,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  @override
  Widget build(BuildContext context) {
    final buffering = value.isBuffering && value.isPlaying;
    final muted = value.volume == 0;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (buffering)
          const Center(
            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
          ),
        IgnorePointer(
          ignoring: !visible,
          child: AnimatedOpacity(
            opacity: visible ? 1 : 0,
            duration: const Duration(milliseconds: 200),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (!buffering)
                  Center(
                    child: IconButton(
                      tooltip: value.isPlaying ? 'Pause' : 'Play',
                      onPressed: onTogglePlay,
                      iconSize: 44,
                      color: Colors.white,
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0x66000000),
                        padding: const EdgeInsets.all(14),
                      ),
                      icon: Icon(value.isPlaying
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded),
                    ),
                  ),
                PositionedDirectional(
                  start: 0,
                  end: 0,
                  bottom: 0,
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [Color(0xAA000000), Color(0x00000000)],
                      ),
                    ),
                    child: SafeArea(
                      top: false,
                      child: Padding(
                        padding:
                            const EdgeInsetsDirectional.fromSTEB(16, 28, 4, 8),
                        child: Row(
                          children: [
                            Text(_clock(value.position), style: _timeStyle),
                            const SizedBox(width: 12),
                            Expanded(
                              child: VideoProgressIndicator(
                                controller,
                                allowScrubbing: true,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 14),
                                colors: const VideoProgressColors(
                                  playedColor: Colors.white,
                                  bufferedColor: Color(0x66FFFFFF),
                                  backgroundColor: Color(0x33FFFFFF),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(_clock(value.duration), style: _timeStyle),
                            IconButton(
                              tooltip: muted ? 'Unmute' : 'Mute',
                              onPressed: onToggleMute,
                              color: Colors.white,
                              icon: Icon(muted
                                  ? Icons.volume_off_rounded
                                  : Icons.volume_up_rounded),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// `1:05` or `1:02:09`.
String _clock(Duration d) {
  final minutes = d.inMinutes.remainder(60).toString();
  final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  if (d.inHours == 0) return '$minutes:$seconds';
  return '${d.inHours}:${minutes.padLeft(2, '0')}:$seconds';
}

/// The video's poster frame with a spinner on top while the first chunks
/// of the video download.
class _VideoLoading extends StatelessWidget {
  const _VideoLoading({required this.videoUrl});

  final String videoUrl;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        VideoPosterImage(videoUrl: videoUrl, fit: BoxFit.contain),
        const Center(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Color(0x66000000),
              shape: BoxShape.circle,
            ),
            child: Padding(
              padding: EdgeInsets.all(14),
              child: SizedBox.square(
                dimension: 28,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _VideoError extends StatelessWidget {
  const _VideoError({required this.onRetry, this.details});

  final VoidCallback onRetry;

  /// The technical reason, shown in debug builds only so developers can
  /// tell a missing plugin or bad link apart from a dropped connection.
  final String? details;

  @override
  Widget build(BuildContext context) {
    final details = this.details;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.videocam_off_outlined,
                color: Colors.white70, size: 40),
            const SizedBox(height: 12),
            const Text(
              "This video couldn't be played.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white),
            ),
            const SizedBox(height: 4),
            const Text(
              'Check your connection and try again.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            if (kDebugMode && details != null && details.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                details,
                textAlign: TextAlign.center,
                maxLines: 6,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white54, fontSize: 11),
              ),
            ],
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white54),
              ),
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
