import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:gal/gal.dart';
import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/storage/session_storage.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/core/utils/share_origin.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/collections_api.dart';
import 'package:gallerista/gallery/public_gallery_api.dart';
import 'package:gallerista/main.dart' show logger;
import 'package:gallerista/theme/app_theme.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

String? _homepageSlug;
String? _homepageSlugUser;

/// The photographer's homepage slug (`/homepages/me`), cached per user so a
/// different account signing in never reuses someone else's address.
Future<String> homepageSlug() async {
  final userId = SessionStorage.getUser()?.id;
  final cached = _homepageSlug;
  if (cached != null && _homepageSlugUser == userId) return cached;
  final res = await DioHelper.dio.get('/homepages/me');
  final data = (res.data as Map)['data'];
  final slug = data is Map ? data['slug']?.toString() ?? '' : '';
  if (slug.isEmpty) throw StateError('Set up your homepage address first.');
  _homepageSlugUser = userId;
  return _homepageSlug = slug;
}

/// Public gallery link on the single web domain (no tenant subdomains):
/// `WEB_URL/collection/{homepage slug}/{gallery slug}`, the
/// `app/collection/[name]/[galary]` route of the frontend.
String publicCollectionUrl(String siteSlug, String collectionSlug) {
  final origin = dotenv
      .get('WEB_URL', fallback: 'http://localhost:3000')
      .trim()
      .replaceFirst(RegExp(r'/$'), '');
  final site = Uri.encodeComponent(siteSlug);
  final gallery = Uri.encodeComponent(collectionSlug);
  return '$origin/collection/$site/$gallery';
}

/// Share sheet: link, QR code, copy, share to any app, email clients.
/// [onPublish] publishes the gallery when it is still a draft.
Future<void> showGalleryShareSheet(
  BuildContext context, {
  required Collection collection,
  required List<String> clientEmails,
  required Future<void> Function() onPublish,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _ShareSheet(
      collection: collection,
      clientEmails: clientEmails,
      onPublish: onPublish,
    ),
  );
}

class _ShareSheet extends StatefulWidget {
  const _ShareSheet({
    required this.collection,
    required this.clientEmails,
    required this.onPublish,
  });

  final Collection collection;
  final List<String> clientEmails;
  final Future<void> Function() onPublish;

  @override
  State<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<_ShareSheet> {
  late bool _published = widget.collection.isPublished;
  String? _url;
  String? _error;
  var _publishing = false;

  /// Progress of the latest "Download QR", shown on the button and in a
  /// line under it. (Toasts would appear behind this open sheet.)
  var _qrSave = _QrSave.idle;
  String? _qrSaveMessage;
  Timer? _qrSaveReset;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void dispose() {
    _qrSaveReset?.cancel();
    super.dispose();
  }

  Future<void> _resolve() async {
    try {
      final slug = await homepageSlug();
      final c = widget.collection;
      var url = publicCollectionUrl(slug, c.slug ?? c.id);
      if (c.isMobileOnly) {
        // The key goes in the fragment: browsers never send it to the server.
        final key = await CollectionsApi.mobileKey(c.id);
        url = '$url#${GalleryLink.keyParam}=${Uri.encodeComponent(key)}';
      }
      if (mounted) setState(() => _url = url);
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    }
  }

  Future<void> _publish() async {
    setState(() => _publishing = true);
    try {
      await widget.onPublish();
      if (mounted) setState(() => _published = true);
    } finally {
      if (mounted) setState(() => _publishing = false);
    }
  }

  Future<void> _copy(String url) async {
    await Clipboard.setData(ClipboardData(text: url));
    AppToast.success('Gallery link copied');
  }

  String get _qrFileName => '${widget.collection.slug ?? 'gallery'}-qr';

  /// Renders the QR code as a white-background PNG, ready to print or post.
  Future<Uint8List> _qrPng(String url) async {
    const size = 1024.0;
    const pad = 64.0;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder)
      ..drawRect(
        const Rect.fromLTWH(0, 0, size + pad * 2, size + pad * 2),
        Paint()..color = Colors.white,
      )
      ..translate(pad, pad);
    QrPainter(data: url, version: QrVersions.auto, gapless: true)
        .paint(canvas, const Size(size, size));
    final image = await recorder
        .endRecording()
        .toImage((size + pad * 2).toInt(), (size + pad * 2).toInt());
    final png = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    if (png == null) throw StateError('QR code could not be rendered.');
    return png.buffer.asUint8List();
  }

  /// Shares the QR code PNG to any app.
  Future<void> _shareQr(String url) async {
    try {
      final png = await _qrPng(url);
      final name = '$_qrFileName.png';
      if (!mounted) return;
      await SharePlus.instance.share(
        ShareParams(
          sharePositionOrigin: shareOrigin(context),
          files: [XFile.fromData(png, mimeType: 'image/png', name: name)],
          fileNameOverrides: [name],
          text: 'Scan this QR code with the Gallerista app to open '
              '"${widget.collection.name}".',
        ),
      );
    } catch (e, s) {
      logger.e('Sharing the gallery QR code failed', error: e, stackTrace: s);
      AppToast.error('Could not share the QR code.');
    }
  }

  /// Saves the QR code PNG straight into the phone's photo gallery.
  /// The first save asks for photo permission on its own.
  Future<void> _saveQr(String url) async {
    _qrSaveReset?.cancel();
    setState(() {
      _qrSave = _QrSave.saving;
      _qrSaveMessage = null;
    });
    try {
      await Gal.putImageBytes(await _qrPng(url), name: _qrFileName);
      unawaited(HapticFeedback.lightImpact());
      _finishQrSave(
        _QrSave.saved,
        'Downloaded to your gallery as $_qrFileName.png',
      );
    } on GalException catch (e, s) {
      logger.e('Saving the gallery QR code failed', error: e, stackTrace: s);
      _finishQrSave(
        _QrSave.failed,
        e.type == GalExceptionType.accessDenied
            ? 'Allow photo access for Gallerista in Settings, then try again.'
            : e.type.message,
      );
    } catch (e, s) {
      logger.e('Saving the gallery QR code failed', error: e, stackTrace: s);
      _finishQrSave(_QrSave.failed, 'Could not save the QR code. Try again.');
    }
  }

  /// Shows the result on the button and under it, then resets the button
  /// after a few seconds so another copy can be saved.
  void _finishQrSave(_QrSave result, String message) {
    if (!mounted) return;
    setState(() {
      _qrSave = result;
      _qrSaveMessage = message;
    });
    _qrSaveReset = Timer(const Duration(seconds: 6), () {
      if (!mounted) return;
      setState(() {
        _qrSave = _QrSave.idle;
        _qrSaveMessage = null;
      });
    });
  }

  Future<void> _share(String url) => SharePlus.instance.share(
    ShareParams(text: url, subject: widget.collection.name, sharePositionOrigin: shareOrigin(context)),
  );

  Future<void> _email(String url) async {
    final uri = Uri(
      scheme: 'mailto',
      path: widget.clientEmails.join(','),
      query: _query({
        'subject': 'Your gallery is ready: ${widget.collection.name}',
        'body': 'Hi,\n\nYour photos are ready to view:\n$url\n\nEnjoy!',
      }),
    );
    if (!await launchUrl(uri)) AppToast.error('No email app found.');
  }

  Future<void> _open(String url) async {
    final ok = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!ok) AppToast.error('Could not open the gallery link.');
  }

  static String _query(Map<String, String> params) => params.entries
      .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
      .join('&');

  @override
  Widget build(BuildContext context) {
    final url = _url;
    return Padding(
      // 24 on every side, plus the system gesture/nav bar at the bottom so
      // the last row of buttons never sits on top of it.
      padding: EdgeInsetsDirectional.fromSTEB(
        24,
        24,
        24,
        24 + MediaQuery.paddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Share gallery',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(widget.collection.name,
              style: const TextStyle(color: AppColors.galleryMeta)),
          const SizedBox(height: 20),
          if (!_published) ...[
            Container(
              padding: const EdgeInsets.all(14),
              color: AppColors.galleryLavenderTint,
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'This gallery is a draft. Publish it before sharing so '
                      'clients can open the link.',
                      style: TextStyle(fontSize: 13, height: 1.4),
                    ),
                  ),
                  const SizedBox(width: 12),
                  FilledButton(
                    onPressed: _publishing ? null : _publish,
                    child: Text(_publishing ? 'Publishing…' : 'Publish'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          if (url == null)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: _error == null
                    ? const CircularProgressIndicator()
                    : Text(_error!, textAlign: TextAlign.center),
              ),
            )
          else ...[
            Center(
              child: Opacity(
                opacity: _published ? 1 : .35,
                child: QrImageView(data: url, size: 168),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.galleryBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(url,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13)),
                  ),
                  IconButton(
                    tooltip: 'Copy link',
                    onPressed: () => _copy(url),
                    icon: const Icon(Icons.copy_rounded, size: 18),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (widget.collection.isMobileOnly) ...[
              const Text(
                'Mobile only: clients open this gallery by scanning this QR '
                'code with the Gallerista app ("Scan gallery QR"). The '
                'website will not show it.',
                style: TextStyle(fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _published ? () => _shareQr(url) : null,
                icon: const Icon(Icons.qr_code_2_rounded, size: 18),
                label: const Text('Share QR code'),
              ),
              const SizedBox(height: 10),
              _DownloadQrButton(
                state: _qrSave,
                onPressed: _published ? () => _saveQr(url) : null,
              ),
              _QrSaveStatus(state: _qrSave, message: _qrSaveMessage),
            ] else ...[
            FilledButton.icon(
              onPressed: _published ? () => _share(url) : null,
              icon: const Icon(Icons.ios_share_rounded, size: 18),
              label: const Text('Share link'),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _published ? () => _shareQr(url) : null,
                    icon: const Icon(Icons.qr_code_2_rounded, size: 18),
                    label: const Text('Share QR'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _DownloadQrButton(
                    state: _qrSave,
                    onPressed: _published ? () => _saveQr(url) : null,
                  ),
                ),
              ],
            ),
            _QrSaveStatus(state: _qrSave, message: _qrSaveMessage),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _published ? () => _email(url) : null,
                    icon: const Icon(Icons.mail_outline_rounded, size: 18),
                    label: Text(widget.clientEmails.isEmpty
                        ? 'Email'
                        : 'Email clients'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _open(url),
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                    label: const Text('Preview'),
                  ),
                ),
              ],
            ),
            ],
          ],
        ],
      ),
    );
  }
}

/// Where the latest "Download QR" stands.
enum _QrSave { idle, saving, saved, failed }

/// Saves the gallery QR code to the phone's photos. The button itself shows
/// the progress: Download QR → Saving… → ✓ Saved (or Try again).
class _DownloadQrButton extends StatelessWidget {
  const _DownloadQrButton({required this.state, required this.onPressed});

  final _QrSave state;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final (icon, label, color) = switch (state) {
      _QrSave.idle => (
          const Icon(Icons.download_rounded, size: 18),
          'Download QR',
          null,
        ),
      _QrSave.saving => (
          const SizedBox.square(
            dimension: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          'Saving…',
          null,
        ),
      _QrSave.saved => (
          const Icon(Icons.check_circle_rounded, size: 18),
          'Saved',
          AppColors.success,
        ),
      _QrSave.failed => (
          const Icon(Icons.refresh_rounded, size: 18),
          'Try again',
          AppColors.error,
        ),
    };
    return OutlinedButton.icon(
      // Saving or just saved: hold off so one tap never makes two copies.
      onPressed: state == _QrSave.saving || state == _QrSave.saved
          ? null
          : onPressed,
      style: color == null
          ? null
          : OutlinedButton.styleFrom(
              foregroundColor: color,
              disabledForegroundColor: color,
              side: BorderSide(color: color),
            ),
      icon: icon,
      label: Text(label),
    );
  }
}

/// The result of the latest download, under the buttons inside the sheet,
/// with a shortcut to the phone's gallery app after a successful save.
class _QrSaveStatus extends StatelessWidget {
  const _QrSaveStatus({required this.state, required this.message});

  final _QrSave state;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final message = this.message;
    final saved = state == _QrSave.saved;
    final color = saved ? AppColors.success : AppColors.error;
    return AnimatedSize(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      alignment: AlignmentDirectional.topStart,
      child: message == null
          ? const SizedBox(width: double.infinity)
          : Semantics(
              liveRegion: true,
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsetsDirectional.fromSTEB(12, 6, 4, 6),
                decoration: BoxDecoration(
                  color: Color.lerp(AppColors.white, color, .08),
                  border: Border.all(color: Color.lerp(AppColors.white, color, .3)!),
                ),
                child: Row(
                  children: [
                    Icon(
                      saved ? Icons.check_circle_rounded : Icons.error_rounded,
                      color: color,
                      size: 18,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        message,
                        style: TextStyle(
                          color: color,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          height: 1.3,
                        ),
                      ),
                    ),
                    if (saved)
                      TextButton(
                        onPressed: Gal.open,
                        style: TextButton.styleFrom(foregroundColor: color),
                        child: const Text('View'),
                      )
                    else
                      const SizedBox(height: 36),
                  ],
                ),
              ),
            ),
    );
  }
}
