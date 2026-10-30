import 'package:flutter/material.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/core/utils/screen_guard.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/gallery_design.dart';
import 'package:gallerista/gallery/public_gallery_api.dart';
import 'package:gallerista/gallery/scan_history.dart';
import 'package:gallerista/pages/auth/auth_widgets.dart';
import 'package:gallerista/pages/galleries/cover_preview.dart';
import 'package:gallerista/pages/galleries/photo_viewer_page.dart';
import 'package:gallerista/pages/library_page.dart';
import 'package:gallerista/theme/app_theme.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

// ─────────────────────────── Scanner ───────────────────────────

/// Scans a gallery QR code and opens the gallery in the app. Works without
/// an account, so clients can use it straight from the login screen.
class ScanGalleryPage extends StatefulWidget {
  const ScanGalleryPage({super.key});

  @override
  State<ScanGalleryPage> createState() => _ScanGalleryPageState();
}

class _ScanGalleryPageState extends State<ScanGalleryPage> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );
  var _handled = false;
  var _readingPhoto = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Reads a gallery QR code from a photo or screenshot already on the
  /// phone, for when the code was sent rather than shown in person.
  Future<void> _scanFromPhoto() async {
    final XFile? photo;
    try {
      photo = await ImagePicker().pickImage(source: ImageSource.gallery);
    } catch (_) {
      AppToast.error('Could not open your photos. Check photo access.');
      return;
    }
    if (photo == null || !mounted) return;
    setState(() => _readingPhoto = true);
    try {
      final capture = await _controller.analyzeImage(photo.path);
      final raw = capture?.barcodes
          .map((code) => code.rawValue)
          .nonNulls
          .firstOrNull;
      if (!mounted) return;
      if (raw == null) {
        AppToast.error('No QR code found in that photo. Try a clearer one.');
        return;
      }
      _open(raw);
    } catch (_) {
      AppToast.error('Could not read that photo. Try another one.');
    } finally {
      if (mounted) setState(() => _readingPhoto = false);
    }
  }

  void _open(String? raw) {
    if (_handled) return;
    final link = GalleryLink.tryParse(raw);
    if (link == null) {
      AppToast.error('This QR code is not a Gallerista gallery.');
      return;
    }
    _handled = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => PublicGalleryPage(link: link)),
    );
  }

  Future<void> _enterLink() async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Enter gallery link'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(hintText: 'https://…/collection/…'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Open'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value != null) _open(value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan gallery QR'),
        actions: [
          IconButton(
            tooltip: 'Flashlight',
            onPressed: _controller.toggleTorch,
            icon: const Icon(Icons.flashlight_on_outlined),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: (capture) {
              for (final code in capture.barcodes) {
                if (code.rawValue != null) return _open(code.rawValue);
              }
            },
          ),
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 2),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 32,
            child: SafeArea(
              child: Column(
                children: [
                  const Text(
                    'Point your camera at the gallery QR code from your '
                    'photographer.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _readingPhoto ? null : _scanFromPhoto,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black,
                      disabledBackgroundColor: Colors.white70,
                      disabledForegroundColor: Colors.black54,
                      minimumSize: const Size(0, 46),
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                    ),
                    icon: _readingPhoto
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.photo_library_outlined, size: 18),
                    label: Text(
                      _readingPhoto ? 'Reading photo…' : 'Choose from gallery',
                    ),
                  ),
                  TextButton(
                    onPressed: _enterLink,
                    child: const Text('Enter link instead',
                        style: TextStyle(color: AppColors.galleryLavender)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────── Client gallery ───────────────────────────

/// A gallery as the client sees it: cover, sets, photo grid and viewer.
/// Handles PIN / email access and "Mobile only" galleries.
class PublicGalleryPage extends StatefulWidget {
  const PublicGalleryPage({super.key, required this.link});

  final GalleryLink link;

  @override
  State<PublicGalleryPage> createState() => _PublicGalleryPageState();
}

class _PublicGalleryPageState extends State<PublicGalleryPage> {
  PublicGallery? _gallery;
  final _images = <CollectionImage>[];
  final _scroll = ScrollController();
  final _accessInput = TextEditingController();
  String? _pin;
  String? _email;
  String? _setId;
  var _hasMore = false;
  var _loading = true;
  var _loadingMore = false;
  var _blocked = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 800) _loadMore();
    });
    _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    _accessInput.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final gallery = await PublicGalleryApi.load(
        widget.link,
        pin: _pin,
        email: _email,
        setId: _setId,
      );
      if (!mounted) return;
      setState(() {
        _gallery = gallery;
        _images
          ..clear()
          ..addAll(gallery.images);
        _hasMore = gallery.hasMore;
        _setId ??= gallery.collection.sets.isEmpty
            ? null
            : gallery.collection.sets.first.id;
      });
      // Only galleries that actually opened go into "Recently scanned".
      if (!gallery.locked) ScanHistory.record(widget.link, gallery.collection);
    } on MobileOnlyException {
      if (mounted) setState(() => _blocked = true);
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _gallery == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await PublicGalleryApi.images(
        widget.link,
        offset: _images.length,
        pin: _pin,
        email: _email,
        setId: _setId,
      );
      if (!mounted) return;
      setState(() {
        _images.addAll(page.items);
        _hasMore = page.hasMore && page.items.isNotEmpty;
      });
    } catch (e) {
      if (mounted) setState(() => _hasMore = false);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _selectSet(String id) {
    if (id == _setId) return;
    _setId = id;
    _load();
  }

  @override
  Widget build(BuildContext context) =>
      ProtectedScreen(child: _content(context));

  Widget _content(BuildContext context) {
    final gallery = _gallery;
    if (_blocked) {
      return const _Message(
        icon: Icons.phonelink_lock_outlined,
        title: 'This gallery couldn’t be opened',
        text: 'This gallery is mobile only. Update the Gallerista app to '
            'the latest version and scan the QR code again.',
      );
    }
    if (gallery == null) {
      return _loading
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _Message(
              icon: Icons.cloud_off_rounded,
              title: 'Gallery not available',
              text: _error ?? 'The gallery could not be opened.',
              onRetry: _load,
            );
    }
    if (gallery.locked) return _accessGate(gallery);

    final c = gallery.collection;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 900 ? 5 : width >= 600 ? 4 : 2;
    final thumbPx = (width / columns * MediaQuery.devicePixelRatioOf(context)).round();
    final small = '${gallery.design['coverSmallTitle'] ?? ''}';
    return Scaffold(
      backgroundColor: GalleryDesign.paletteFor('${gallery.design['color'] ?? 'White'}').$1,
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          controller: _scroll,
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: AppColors.white,
              title: Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: MediaQuery.sizeOf(context).height * .62,
                child: CoverPreview(
                  design: gallery.design,
                  imageUrl: c.coverUrl,
                  title: c.name,
                  smallTitle: small == 'Avery Studio' ? '' : small,
                  date: formatDate(c.eventDate),
                ),
              ),
            ),
            if (c.sets.length > 1)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 60,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    children: [
                      for (final s in c.sets)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(end: 8),
                          child: ChoiceChip(
                            label: Text(s.name),
                            selected: s.id == _setId,
                            showCheckmark: false,
                            selectedColor: AppColors.galleryPrimary,
                            labelStyle: TextStyle(
                              color: s.id == _setId
                                  ? AppColors.white
                                  : AppColors.galleryText,
                              fontWeight: FontWeight.w600,
                            ),
                            onSelected: (_) => _selectSet(s.id),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            if (_loading)
              const SliverToBoxAdapter(child: LinearProgressIndicator(minHeight: 2)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(4, 4, 4, 40),
              sliver: SliverGrid.builder(
                itemCount: _images.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  crossAxisSpacing: 4,
                  mainAxisSpacing: 4,
                ),
                itemBuilder: (_, i) => LibraryTile(
                  image: _images[i],
                  memCacheWidth: thumbPx,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ProtectedScreen(
                        child: PhotoViewerPage(
                          images: List.of(_images),
                          initialIndex: i,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (_loadingMore)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// PIN or email step, same rules as the web gallery.
  Widget _accessGate(PublicGallery gallery) {
    final controller = _accessInput;
    final isPin = gallery.pinRequired;
    return Scaffold(
      appBar: AppBar(title: Text(gallery.collection.name)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 24),
          Icon(isPin ? Icons.lock_outline_rounded : Icons.mail_outline_rounded,
              size: 44, color: AppColors.galleryPurple),
          const SizedBox(height: 16),
          Text(
            isPin ? 'Enter the gallery PIN' : 'Enter your email to view',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 24),
          AuthField(
            label: isPin ? 'PIN' : 'Email',
            controller: controller,
            icon: isPin ? Icons.pin_outlined : Icons.mail_outline_rounded,
            keyboardType: isPin ? TextInputType.number : TextInputType.emailAddress,
            digitsOnly: isPin,
          ),
          if ((isPin ? _pin : _email) != null && !_loading) ...[
            const SizedBox(height: 8),
            AuthErrorBox(
              message: isPin
                  ? 'That PIN is not correct.'
                  : 'This email does not have access yet.',
            ),
          ],
          const SizedBox(height: 20),
          AuthGradientButton(
            label: 'Open gallery',
            pending: _loading,
            onPressed: () {
              final value = controller.text.trim();
              if (value.isEmpty) return;
              if (isPin) {
                _pin = value;
              } else {
                _email = value;
              }
              _load();
            },
          ),
        ],
      ),
    );
  }
}


class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.title,
    required this.text,
    this.onRetry,
  });

  final IconData icon;
  final String title;
  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48, color: AppColors.galleryPurple),
              const SizedBox(height: 16),
              Text(title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Text(text,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.galleryMeta, height: 1.5)),
              if (onRetry != null) ...[
                const SizedBox(height: 20),
                FilledButton(onPressed: onRetry, child: const Text('Try again')),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
