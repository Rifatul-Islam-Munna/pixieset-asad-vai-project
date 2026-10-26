import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollCacheExtent;
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/collections_api.dart';
import 'package:gallerista/pages/galleries/collection_thumbnail.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Web Photo Library search: every word must match one of the photo's
/// searchable fields, optionally limited to one gallery.
List<CollectionImage> filterLibrary(
  List<CollectionImage> images,
  String query, {
  String? collectionId,
}) {
  final terms = query.trim().toLowerCase().split(RegExp(r'\s+'))
    ..removeWhere((t) => t.isEmpty);
  return images.where((image) {
    if (collectionId != null && image.collectionId != collectionId) {
      return false;
    }
    if (terms.isEmpty) return true;
    final text = image.searchText;
    return terms.every(text.contains);
  }).toList();
}

/// Every photo across all galleries, with search, a gallery filter and
/// stars. Tap to view, long-press to open its gallery.
class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key, this.active = true});

  /// Reloads when the tab becomes visible again.
  final bool active;

  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  List<CollectionImage> _images = const [];
  var _query = '';
  String? _collectionId;
  var _loading = true;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(LibraryPage old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final images = await CollectionsApi.allImages();
      if (!mounted) return;
      setState(() {
        _images = images;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = value);
    });
  }

  Future<void> _toggleStar(CollectionImage image) async {
    final starred = !image.isStarred;
    void swap(CollectionImage next) => setState(() {
      _images = [for (final i in _images) i.id == image.id ? next : i];
    });
    swap(image.withStarred(starred)); // optimistic
    try {
      await CollectionsApi.starImage(image, starred);
    } catch (e) {
      swap(image);
      AppToast.error(ApiError.message(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final galleries = <String, String>{
      for (final i in _images)
        if (i.collectionId != null) i.collectionId!: i.collectionName ?? 'Gallery',
    };
    final visible = filterLibrary(_images, _query, collectionId: _collectionId);
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1100 ? 7 : width >= 900 ? 6 : width >= 600 ? 4 : 3;
    final thumbPx = (width / columns * MediaQuery.devicePixelRatioOf(context)).round();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Photo Library',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
      ),
      body: RefreshIndicator(
        color: AppColors.galleryPrimary,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          // Start loading photos ~1.5 screens before they scroll into view.
          scrollCacheExtent: const ScrollCacheExtent.viewport(1.5),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      onChanged: _onSearch,
                      textInputAction: TextInputAction.search,
                      decoration: const InputDecoration(
                        hintText: 'Search images, keywords, camera…',
                        prefixIcon: Icon(Icons.search_rounded),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String?>(
                      initialValue: _collectionId,
                      isExpanded: true,
                      decoration: const InputDecoration(isDense: true),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('All galleries')),
                        for (final e in galleries.entries)
                          DropdownMenuItem(
                            value: e.key,
                            child: Text(e.value, overflow: TextOverflow.ellipsis),
                          ),
                      ],
                      onChanged: (v) => setState(() => _collectionId = v),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '${visible.length} of ${_images.length} photos',
                      style: const TextStyle(fontSize: 12, color: AppColors.galleryMeta),
                    ),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (visible.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text(
                      _error ??
                          (_images.isEmpty
                              ? 'Your uploaded photos will appear here.'
                              : 'No photos match your search.'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFF666666)),
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(2, 0, 2, 40),
                sliver: SliverGrid.builder(
                  itemCount: visible.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 2,
                    mainAxisSpacing: 2,
                  ),
                  itemBuilder: (_, i) => LibraryTile(
                    image: visible[i],
                    memCacheWidth: thumbPx,
                    onStar: () => _toggleStar(visible[i]),
                    onTap: () => context.router.push(
                      PhotoViewerRoute(images: visible, initialIndex: i),
                    ),
                    onLongPress: visible[i].collectionId == null
                        ? null
                        : () => context.router.push(
                            GalleryDetailRoute(collectionId: visible[i].collectionId!),
                          ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Square photo with a star button; shared by Library and Starred.
class LibraryTile extends StatelessWidget {
  const LibraryTile({
    super.key,
    required this.image,
    required this.memCacheWidth,
    required this.onTap,
    this.onStar,
    this.onLongPress,
  });

  final CollectionImage image;
  final int memCacheWidth;
  final VoidCallback onTap;
  final VoidCallback? onStar;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${image.displayName}, ${image.collectionName ?? 'gallery'}',
      child: GestureDetector(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Stack(
          fit: StackFit.expand,
          children: [
            CollectionThumbnail(image: image, memCacheWidth: memCacheWidth),
            if (image.isVideo)
              const Center(
                child: Icon(Icons.play_circle_fill_rounded,
                    color: Color(0xDDFFFFFF), size: 30),
              ),
            if (onStar != null)
              PositionedDirectional(
                top: 0,
                end: 0,
                child: IconButton(
                  tooltip: image.isStarred ? 'Unstar photo' : 'Star photo',
                  onPressed: onStar,
                  icon: Icon(
                    image.isStarred ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: image.isStarred ? AppColors.galleryLavender : AppColors.white,
                    shadows: const [Shadow(color: Color(0x99000000), blurRadius: 6)],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
