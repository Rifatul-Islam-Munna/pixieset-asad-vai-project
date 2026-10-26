import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/collection_activity.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Opens a client's favorite list. Returns true if anything changed.
Future<bool> showFavoriteListSheet(
  BuildContext context, {
  required String collectionId,
  required FavoriteList list,
}) async {
  final changed = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .85,
      maxChildSize: .95,
      builder: (context, scroll) => _FavoriteListView(
        collectionId: collectionId,
        list: list,
        scroll: scroll,
      ),
    ),
  );
  return changed ?? false;
}

class _FavoriteListView extends StatefulWidget {
  const _FavoriteListView({
    required this.collectionId,
    required this.list,
    required this.scroll,
  });

  final String collectionId;
  final FavoriteList list;
  final ScrollController scroll;

  @override
  State<_FavoriteListView> createState() => _FavoriteListViewState();
}

class _FavoriteListViewState extends State<_FavoriteListView> {
  late final _images = List.of(widget.list.images);
  var _changed = false;

  List<String> get _filenames => _images.isNotEmpty
      ? _images.map((e) => e.name).where((e) => e.isNotEmpty).toList()
      : widget.list.filenames;

  Future<void> _run(Future<void> Function() action, String success) async {
    try {
      await action();
      _changed = true;
      AppToast.success(success);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  Future<void> _copyFilenames() async {
    // Comma-separated works directly in Lightroom's filename filter.
    await Clipboard.setData(ClipboardData(text: _filenames.join(', ')));
    AppToast.success('${_filenames.length} filenames copied');
  }

  Future<void> _copyTo({required bool gallery}) async {
    final name = await promptText(
      context,
      title: gallery ? 'Copy to new gallery' : 'Copy to new set',
      initial: '${widget.list.name} - ${widget.list.email}',
      confirmLabel: 'Copy',
    );
    if (name == null || name.isEmpty) return;
    final id = widget.collectionId;
    await _run(
      () => gallery
          ? ActivityApi.copyFavoritesToGallery(id, widget.list.id, name)
          : ActivityApi.copyFavoritesToSet(id, widget.list.id, name),
      gallery ? 'New gallery created' : 'New set created',
    );
  }

  Future<void> _remove(FavoriteImage image) async {
    await _run(() async {
      await ActivityApi.removeFavoriteImage(
        widget.collectionId,
        widget.list.id,
        image.imageId,
      );
      setState(() => _images.remove(image));
    }, 'Removed from favorites');
  }

  Future<void> _deleteList() async {
    final ok = await confirmAction(
      context,
      title: 'Delete favorite list?',
      message: '${widget.list.email}\'s list "${widget.list.name}" will be '
          'deleted. The photos stay in the gallery.',
    );
    if (!ok) return;
    try {
      await ActivityApi.deleteFavoriteList(widget.collectionId, widget.list.id);
      AppToast.success('Favorite list deleted');
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.list;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _changed);
      },
      child: CustomScrollView(
        controller: widget.scroll,
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(list.name,
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(
                          '${list.email}  •  ${_filenames.length} photos'
                          '${list.updatedAt == null ? '' : '  •  ${formatDate(list.updatedAt)}'}',
                          style: const TextStyle(
                              fontSize: 13, color: AppColors.galleryMeta),
                        ),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    tooltip: 'List actions',
                    onSelected: (v) => switch (v) {
                      'set' => _copyTo(gallery: false),
                      'gallery' => _copyTo(gallery: true),
                      _ => _deleteList(),
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'set', child: Text('Copy to new set')),
                      PopupMenuItem(
                          value: 'gallery', child: Text('Copy to new gallery')),
                      PopupMenuDivider(),
                      PopupMenuItem(
                        value: 'delete',
                        child: Text('Delete list',
                            style: TextStyle(color: AppColors.error)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
              child: OutlinedButton.icon(
                onPressed: _filenames.isEmpty ? null : _copyFilenames,
                icon: const Icon(Icons.content_copy_rounded, size: 18),
                label: const Text('Copy filenames (Lightroom)'),
              ),
            ),
          ),
          if (_images.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                child: Text(
                  _filenames.isEmpty
                      ? 'This list is empty.'
                      : _filenames.join('\n'),
                  style: const TextStyle(height: 1.6),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(2, 0, 2, 32),
              sliver: SliverGrid.builder(
                itemCount: _images.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 2,
                  mainAxisSpacing: 2,
                ),
                itemBuilder: (_, i) {
                  final image = _images[i];
                  return Stack(
                    fit: StackFit.expand,
                    children: [
                      AppNetworkImage(url: image.imageUrl, memCacheWidth: 400),
                      PositionedDirectional(
                        top: 4,
                        end: 4,
                        child: IconButton.filled(
                          tooltip: 'Remove from favorites',
                          visualDensity: VisualDensity.compact,
                          style: IconButton.styleFrom(
                            backgroundColor: const Color(0xCC000000),
                          ),
                          onPressed: () => _remove(image),
                          icon: const Icon(Icons.heart_broken_outlined,
                              size: 16, color: AppColors.white),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
