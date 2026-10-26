import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollCacheExtent;
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/collections_api.dart';
import 'package:gallerista/pages/library_page.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Starred galleries and photos (web StarredPanel).
class StarredPage extends StatefulWidget {
  const StarredPage({super.key, this.active = true});

  /// Reloads when the tab becomes visible again.
  final bool active;

  @override
  State<StarredPage> createState() => _StarredPageState();
}

class _StarredPageState extends State<StarredPage> {
  List<Collection> _galleries = const [];
  List<CollectionImage> _photos = const [];
  var _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(StarredPage old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        CollectionsApi.list(),
        CollectionsApi.allImages(),
      ]);
      if (!mounted) return;
      setState(() {
        _galleries = (results[0] as List<Collection>)
            .where((c) => c.isStarred)
            .toList();
        _photos = (results[1] as List<CollectionImage>)
            .where((i) => i.isStarred)
            .toList();
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _unstarGallery(Collection c) async {
    setState(() => _galleries = _galleries.where((g) => g.id != c.id).toList());
    try {
      await CollectionsApi.setStarred(c, false);
    } catch (e) {
      AppToast.error(ApiError.message(e));
      await _load();
    }
  }

  Future<void> _unstarPhoto(CollectionImage image) async {
    setState(() => _photos = _photos.where((p) => p.id != image.id).toList());
    try {
      await CollectionsApi.starImage(image, false);
    } catch (e) {
      AppToast.error(ApiError.message(e));
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Starred',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: AppColors.galleryPurple,
            tabs: [
              Tab(text: 'Galleries (${_galleries.length})'),
              Tab(text: 'Photos (${_photos.length})'),
            ],
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _wrap(
                    _galleries.isEmpty
                        ? _Empty(
                            title: _error ?? 'You have no starred galleries yet',
                            text: 'Track your favorite galleries with stars.',
                          )
                        : GridView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                            itemCount: _galleries.length,
                            gridDelegate:
                                SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: width >= 900 ? 4 : width >= 600 ? 3 : 2,
                              crossAxisSpacing: 16,
                              mainAxisSpacing: 20,
                              childAspectRatio: .95,
                            ),
                            itemBuilder: (_, i) => _GalleryTile(
                              collection: _galleries[i],
                              onUnstar: () => _unstarGallery(_galleries[i]),
                            ),
                          ),
                  ),
                  _wrap(
                    _photos.isEmpty
                        ? _Empty(
                            title: _error ?? 'You have no starred photos yet',
                            text: 'Track your favorite photos with stars.',
                          )
                        : GridView.builder(
                            padding: const EdgeInsets.fromLTRB(2, 2, 2, 40),
                            // Start loading photos ~1.5 screens early.
                            scrollCacheExtent:
                                const ScrollCacheExtent.viewport(1.5),
                            itemCount: _photos.length,
                            gridDelegate:
                                SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: width >= 600 ? 5 : 3,
                              crossAxisSpacing: 2,
                              mainAxisSpacing: 2,
                            ),
                            itemBuilder: (_, i) => LibraryTile(
                              image: _photos[i],
                              memCacheWidth: 400,
                              onStar: () => _unstarPhoto(_photos[i]),
                              onTap: () => context.router.push(
                                PhotoViewerRoute(images: _photos, initialIndex: i),
                              ),
                            ),
                          ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _wrap(Widget child) => RefreshIndicator(
    color: AppColors.galleryPrimary,
    onRefresh: _load,
    child: child,
  );
}

class _GalleryTile extends StatelessWidget {
  const _GalleryTile({required this.collection, required this.onUnstar});

  final Collection collection;
  final VoidCallback onUnstar;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.router.push(
        GalleryDetailRoute(collectionId: collection.id, initial: collection),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1.35,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(
                  url: collection.coverUrl,
                  placeholderColor: const Color(0xFFF3F3F3),
                  memCacheWidth: 500,
                ),
                PositionedDirectional(
                  top: 0,
                  end: 0,
                  child: IconButton(
                    tooltip: 'Unstar gallery',
                    onPressed: onUnstar,
                    icon: const Icon(Icons.star_rounded,
                        color: AppColors.white,
                        shadows: [Shadow(color: Color(0x99000000), blurRadius: 6)]),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(collection.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF222222))),
          const SizedBox(height: 2),
          Text('${collection.imageCount} images',
              style: const TextStyle(fontSize: 12, color: AppColors.galleryMeta)),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(32),
      children: [
        const SizedBox(height: 60),
        Center(
          child: Container(
            width: 112,
            height: 112,
            decoration: const BoxDecoration(
              color: Color(0xFFEDF3EF),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.photo_library_outlined,
                size: 56, color: Color(0xFF444444)),
          ),
        ),
        const SizedBox(height: 28),
        Text(title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Text(text,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: Color(0xFF444444))),
      ],
    );
  }
}
