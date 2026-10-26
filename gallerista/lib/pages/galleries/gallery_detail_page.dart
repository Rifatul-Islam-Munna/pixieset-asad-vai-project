import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollCacheExtent;
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/collections_api.dart';
import 'package:gallerista/gallery/upload_queue.dart';
import 'package:gallerista/main.dart' show getIt;
import 'package:gallerista/pages/galleries/collection_thumbnail.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/pages/galleries/gallery_sets_bar.dart';
import 'package:gallerista/pages/galleries/gallery_share_sheet.dart';
import 'package:gallerista/pages/galleries/upload_widgets.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';

@RoutePage()
class GalleryDetailPage extends StatefulWidget {
  const GalleryDetailPage({
    super.key,
    @PathParam('collectionId') required this.collectionId,
    this.initial,
  });

  final String collectionId;
  final Collection? initial;

  @override
  State<GalleryDetailPage> createState() => _GalleryDetailPageState();
}

class _GalleryDetailPageState extends State<GalleryDetailPage> {
  late Collection? _collection = widget.initial;
  final _images = <CollectionImage>[];
  final _selected = <String>{};
  final _scroll = ScrollController();
  String? _setId;
  var _total = 0;
  var _hasMore = true;
  var _loadingPage = false;
  String? _error;

  String get _id => widget.collectionId;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _refresh();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.extentAfter < 800) _loadMore();
  }

  Future<void> _refresh() async {
    try {
      final collection = await CollectionsApi.detail(_id);
      if (!mounted) return;
      setState(() {
        _collection = collection;
        _images.clear();
        _selected.clear();
        _hasMore = true;
        _error = null;
      });
      await _loadMore();
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    }
  }

  Future<void> _loadMore() async {
    if (_loadingPage || !_hasMore) return;
    setState(() => _loadingPage = true);
    try {
      final page = await CollectionsApi.images(
        _id,
        offset: _images.length,
        setId: _setId,
      );
      if (!mounted) return;
      setState(() {
        _images.addAll(page.items);
        _total = page.total;
        _hasMore = page.hasMore && page.items.isNotEmpty;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _hasMore = false);
        AppToast.error(ApiError.message(e));
      }
    } finally {
      if (mounted) setState(() => _loadingPage = false);
    }
  }

  void _selectSet(String? setId) {
    if (setId == _setId) return;
    setState(() {
      _setId = setId;
      _images.clear();
      _selected.clear();
      _hasMore = true;
    });
    _loadMore();
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    try {
      await action();
      AppToast.success(success);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  Future<void> _togglePublish() async {
    final c = _collection;
    if (c == null) return;
    await _run(() async {
      final updated = await CollectionsApi.update(c.id, {
        'status': c.isPublished ? 'draft' : 'published',
      });
      setState(() => _collection = updated);
    }, c.isPublished ? 'Moved to draft' : 'Gallery published');
  }

  Future<void> _quickEdit() async {
    final c = _collection;
    if (c == null) return;
    final form = await showGalleryForm(context, initial: c);
    if (form == null) return;
    await _run(() async {
      final updated = await CollectionsApi.update(c.id, {
        'name': form.name,
        'eventDate': ?(form.eventDate == null
            ? null
            : CollectionsApi.dayString(form.eventDate!)),
        'status': form.status,
      });
      setState(() => _collection = updated);
    }, 'Gallery updated');
  }

  Future<void> _deleteGallery() async {
    final c = _collection;
    if (c == null) return;
    final ok = await confirmAction(
      context,
      title: 'Delete gallery?',
      message: '"${c.name}" and all of its photos will be permanently '
          'deleted. This cannot be undone.',
    );
    if (!ok || !mounted) return;
    try {
      await CollectionsApi.delete(c.id);
      AppToast.success('Gallery deleted');
      if (mounted) await context.router.maybePop();
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  Future<void> _deleteSelected() async {
    final ids = _selected.toList();
    final ok = await confirmAction(
      context,
      title: 'Delete ${ids.length} ${ids.length == 1 ? 'photo' : 'photos'}?',
      message: 'Deleted photos are removed from this gallery permanently.',
    );
    if (!ok) return;
    await _run(() async {
      await CollectionsApi.deleteImages(_id, ids);
      setState(() {
        _images.removeWhere((image) => ids.contains(image.id));
        _total = (_total - ids.length).clamp(0, 1 << 31);
        _selected.clear();
      });
    }, 'Photos deleted');
  }

  Future<void> _moveSelected() async {
    final sets = _collection?.sets ?? const [];
    if (sets.isEmpty) {
      AppToast.info('Add a set first, then move photos into it.');
      return;
    }
    final target = await showModalBottomSheet<CollectionSet>(
      context: context,
      useSafeArea: true,
      builder: (context) => ListView(
        shrinkWrap: true,
        children: [
          const ListTile(title: Text('Move to set')),
          for (final set in sets)
            ListTile(
              leading: const Icon(Icons.folder_outlined),
              title: Text(set.name),
              onTap: () => Navigator.pop(context, set),
            ),
        ],
      ),
    );
    if (target == null) return;
    await _run(() async {
      await CollectionsApi.moveImagesToSet(_id, _selected.toList(), target.id);
      await _refresh();
    }, 'Moved to ${target.name}');
  }

  Future<void> _setCover() async {
    final image = _images.firstWhere((i) => i.id == _selected.first);
    await _run(() async {
      await CollectionsApi.setCover(_id, image);
      final updated = await CollectionsApi.detail(_id);
      setState(() {
        _collection = updated;
        _selected.clear();
      });
    }, 'Cover photo updated');
  }

  /// Uploads into the selected set; on "All photos" the first set is used,
  /// matching the web where an upload always targets the active set.
  Future<void> _addPhotos() async {
    final c = _collection;
    if (c == null) return;
    final files = await pickUploadSources(context);
    if (files.isEmpty) return;
    CollectionSet? target;
    for (final set in c.sets) {
      if (set.id == _setId) target = set;
    }
    target ??= c.sets.isEmpty ? null : c.sets.first;
    getIt<UploadQueue>().start(collection: c, files: files, set: target);
  }

  void _openViewer(int index) {
    context.router.push(
      PhotoViewerRoute(images: List.of(_images), initialIndex: index),
    );
  }

  void _toggleSelect(CollectionImage image) => setState(() {
    if (!_selected.remove(image.id)) _selected.add(image.id);
  });

  @override
  Widget build(BuildContext context) {
    final c = _collection;
    final selecting = _selected.isNotEmpty;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
    final thumbPx = (width / columns * MediaQuery.devicePixelRatioOf(context))
        .round();
    return PopScope(
      canPop: !selecting,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && selecting) setState(_selected.clear);
      },
      child: Scaffold(
        floatingActionButton: selecting || c == null
            ? null
            : FloatingActionButton.extended(
                onPressed: _addPhotos,
                backgroundColor: AppColors.galleryPrimary,
                foregroundColor: AppColors.white,
                shape: const RoundedRectangleBorder(),
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: const Text('Add Photos',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
        body: RefreshIndicator(
          color: AppColors.galleryPrimary,
          onRefresh: _refresh,
          child: CustomScrollView(
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            // Build (and so start loading) tiles ~1.5 screens ahead of the
            // scroll, so photos are usually ready before they appear.
            scrollCacheExtent: const ScrollCacheExtent.viewport(1.5),
            slivers: [
              selecting ? _selectionBar() : _coverBar(c),
              if (c != null && !selecting)
                SliverToBoxAdapter(child: _summary(c)),
              if (c != null)
                SliverToBoxAdapter(
                  child: GallerySetsBar(
                    collection: c,
                    selectedSetId: _setId,
                    onSelect: _selectSet,
                    onChanged: _refresh,
                  ),
                ),
              SliverToBoxAdapter(
                child: UploadProgressCard(
                  collectionId: _id,
                  onFinished: _refresh,
                ),
              ),
              if (_error != null && c == null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: Text(_error!)),
                )
              else if (_images.isEmpty && !_loadingPage)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: _NoPhotos(),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(2, 2, 2, 40),
                  sliver: SliverGrid.builder(
                    itemCount: _images.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: columns,
                      crossAxisSpacing: 2,
                      mainAxisSpacing: 2,
                    ),
                    itemBuilder: (_, i) => _PhotoTile(
                      image: _images[i],
                      memCacheWidth: thumbPx,
                      selected: _selected.contains(_images[i].id),
                      selecting: selecting,
                      onTap: selecting
                          ? () => _toggleSelect(_images[i])
                          : () => _openViewer(i),
                      onLongPress: () => _toggleSelect(_images[i]),
                    ),
                  ),
                ),
              if (_loadingPage)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _coverBar(Collection? c) {
    return SliverAppBar(
      pinned: true,
      expandedHeight: 280,
      backgroundColor: AppColors.galleryBackground,
      foregroundColor: AppColors.white,
      iconTheme: const IconThemeData(color: AppColors.white),
      actions: [
        IconButton(
          tooltip: 'Share',
          onPressed: c == null
              ? null
              : () => showGalleryShareSheet(
                  context,
                  collection: c,
                  clientEmails: c.clientEmails,
                  onPublish: () async {
                    final updated = await CollectionsApi.update(c.id, {
                      'status': 'published',
                    });
                    if (mounted) setState(() => _collection = updated);
                  },
                ),
          icon: const Icon(Icons.ios_share_rounded),
        ),
        IconButton(
          tooltip: c?.isPublished == true ? 'Move to draft' : 'Publish',
          onPressed: _togglePublish,
          icon: Icon(c?.isPublished == true
              ? Icons.public_rounded
              : Icons.public_off_rounded),
        ),
        PopupMenuButton<String>(
          tooltip: 'More',
          iconColor: AppColors.white,
          // Open below the ⋮ button instead of covering it and the status bar.
          position: PopupMenuPosition.under,
          offset: const Offset(0, 4),
          constraints: const BoxConstraints(minWidth: 210),
          onSelected: (v) async {
            if (v == 'edit') return _quickEdit();
            if (v == 'delete') return _deleteGallery();
            if (v == 'activity') {
              await context.router.push(GalleryActivityRoute(
                collectionId: _id,
                galleryName: c?.name ?? '',
              ));
              if (mounted) await _refresh();
              return;
            }
            if (v == 'design') {
              await context.router.push(GalleryDesignRoute(collectionId: _id));
              if (mounted) await _refresh();
              return;
            }
            await context.router.push(
              GallerySettingsRoute(collectionId: _id),
            );
            if (mounted) await _refresh();
          },
          itemBuilder: (_) => const [
            PopupMenuItem(
              value: 'edit',
              child: _MenuRow(icon: Icons.edit_outlined, label: 'Quick edit'),
            ),
            PopupMenuItem(
              value: 'design',
              child: _MenuRow(icon: Icons.palette_outlined, label: 'Design'),
            ),
            PopupMenuItem(
              value: 'settings',
              child: _MenuRow(
                icon: Icons.settings_outlined,
                label: 'Gallery settings',
              ),
            ),
            PopupMenuItem(
              value: 'activity',
              child: _MenuRow(icon: Icons.insights_outlined, label: 'Activity'),
            ),
            PopupMenuDivider(),
            PopupMenuItem(
              value: 'delete',
              child: _MenuRow(
                icon: Icons.delete_outline_rounded,
                label: 'Delete gallery',
                color: AppColors.error,
              ),
            ),
          ],
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsetsDirectional.only(start: 56, bottom: 16),
        title: Text(
          c?.name ?? '',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: AppColors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
        background: Stack(
          fit: StackFit.expand,
          children: [
            Hero(
              tag: 'cover-$_id',
              child: AppNetworkImage(url: c?.coverUrl ?? ''),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x55000000),
                    Color(0x00000000),
                    Color(0xAA000000),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _selectionBar() {
    return SliverAppBar(
      pinned: true,
      backgroundColor: AppColors.galleryPrimary,
      foregroundColor: AppColors.white,
      leading: IconButton(
        tooltip: 'Cancel selection',
        onPressed: () => setState(_selected.clear),
        icon: const Icon(Icons.close_rounded),
      ),
      title: Text('${_selected.length} selected'),
      actions: [
        if (_selected.length == 1)
          IconButton(
            tooltip: 'Set as cover',
            onPressed: _setCover,
            icon: const Icon(Icons.wallpaper_rounded),
          ),
        IconButton(
          tooltip: 'Move to set',
          onPressed: _moveSelected,
          icon: const Icon(Icons.drive_file_move_outline),
        ),
        IconButton(
          tooltip: 'Delete',
          onPressed: _deleteSelected,
          icon: const Icon(Icons.delete_outline_rounded),
        ),
      ],
    );
  }

  Widget _summary(Collection c) {
    final parts = [
      '$_total ${_total == 1 ? 'item' : 'items'}',
      titleCase(c.status ?? 'draft'),
      if (c.eventDate != null) formatDate(c.eventDate),
      if (c.expiresAt != null)
        '${c.isExpired ? 'Expired' : 'Expires'} ${formatDate(c.expiresAt)}',
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: c.isPublished
                  ? AppColors.galleryPurple
                  : const Color(0xFFBBBBBB),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              parts.join('  •  '),
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.galleryMeta,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({
    required this.image,
    required this.memCacheWidth,
    required this.selected,
    required this.selecting,
    required this.onTap,
    required this.onLongPress,
  });

  final CollectionImage image;
  final int memCacheWidth;
  final bool selected;
  final bool selecting;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: image.originalName ?? 'Photo',
      child: GestureDetector(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Stack(
          fit: StackFit.expand,
          children: [
            AnimatedPadding(
              duration: const Duration(milliseconds: 150),
              padding: EdgeInsets.all(selected ? 8 : 0),
              child: CollectionThumbnail(
                image: image,
                memCacheWidth: memCacheWidth,
              ),
            ),
            if (image.isVideo)
              const Center(
                child: Icon(Icons.play_circle_fill_rounded,
                    color: Color(0xDDFFFFFF), size: 34),
              ),
            if (selecting)
              PositionedDirectional(
                top: 6,
                start: 6,
                child: Icon(
                  selected
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: selected ? AppColors.galleryPurple : AppColors.white,
                  size: 24,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NoPhotos extends StatelessWidget {
  const _NoPhotos();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.add_photo_alternate_outlined,
              size: 44, color: Color(0xFF999999)),
          SizedBox(height: 16),
          Text('No photos here yet',
              style: TextStyle(fontWeight: FontWeight.w700)),
          SizedBox(height: 6),
          Text(
            'Photos you upload to this gallery will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF666666)),
          ),
        ],
      ),
    );
  }
}

/// One row of the gallery ⋮ menu: an icon and a label, optionally tinted
/// (red for Delete).
class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.icon, required this.label, this.color});

  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    // The menu inherits the app bar's white icon color (it sits over the
    // cover photo), so normal rows need their icon color set explicitly.
    final iconColor = color ?? Theme.of(context).colorScheme.onSurfaceVariant;
    return Row(
      children: [
        Icon(icon, size: 20, color: iconColor),
        const SizedBox(width: 14),
        Text(label, style: color == null ? null : TextStyle(color: color)),
      ],
    );
  }
}
