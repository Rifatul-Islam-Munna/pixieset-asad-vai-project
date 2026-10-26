import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/auth/auth_api.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/storage/session_storage.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/collections_api.dart';
import 'package:gallerista/gallery/gallery_filters.dart';
import 'package:gallerista/pages/galleries/gallery_card.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/pages/galleries/home_widgets.dart';
import 'package:gallerista/pages/public_gallery_page.dart';
import 'package:gallerista/pages/scan_widgets.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Home screen: greeting, summary, starred galleries and all galleries.
@RoutePage()
class GalleriesPage extends StatefulWidget {
  const GalleriesPage({super.key, this.active = true});

  /// Reloads when its tab becomes visible again (stars may have changed).
  final bool active;

  @override
  State<GalleriesPage> createState() => _GalleriesPageState();
}

class _GalleriesPageState extends State<GalleriesPage> {
  List<Collection> _items = const [];
  var _filters = const GalleryFilters();
  var _grid = true;
  var _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(GalleriesPage old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _load();
  }

  Future<void> _load() async {
    try {
      final items = await CollectionsApi.list();
      if (!mounted) return;
      setState(() {
        _items = items;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _replace(Collection updated) => setState(() {
    _items = [
      for (final item in _items) item.id == updated.id ? updated : item,
    ];
  });

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    try {
      await action();
      if (success != null) AppToast.success(success);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  Future<void> _toggleStar(Collection c) => _run(() async {
    _replace(await CollectionsApi.setStarred(c, !c.isStarred));
  });

  Future<void> _create() async {
    final form = await showGalleryForm(context);
    if (form == null || !mounted) return;
    await _run(() async {
      final created = await CollectionsApi.create(
        name: form.name,
        eventDate: form.eventDate,
      );
      setState(() => _items = [created, ..._items]);
      if (mounted) await _open(created);
    }, success: 'Gallery created');
  }

  Future<void> _open(Collection c) async {
    await context.router.push(
      GalleryDetailRoute(collectionId: c.id, initial: c),
    );
    if (mounted) await _load();
  }

  Future<void> _onAction(Collection c, GalleryAction action) async {
    switch (action) {
      case GalleryAction.quickEdit:
        final form = await showGalleryForm(context, initial: c);
        if (form == null) return;
        await _run(() async {
          _replace(await CollectionsApi.update(c.id, {
            'name': form.name,
            'eventDate': ?(form.eventDate == null
                ? null
                : CollectionsApi.dayString(form.eventDate!)),
            'status': form.status,
          }));
        }, success: 'Gallery updated');
      case GalleryAction.togglePublish:
        await _run(() async {
          _replace(await CollectionsApi.update(c.id, {
            'status': c.isPublished ? 'draft' : 'published',
          }));
        }, success: c.isPublished ? 'Moved to draft' : 'Gallery published');
      case GalleryAction.duplicate:
        await _run(() async {
          await CollectionsApi.duplicate(c.id);
          await _load();
        }, success: 'Gallery duplicated');
      case GalleryAction.delete:
        final ok = await confirmAction(
          context,
          title: 'Delete gallery?',
          message: '"${c.name}" and all of its photos will be permanently '
              'deleted. This cannot be undone.',
        );
        if (!ok) return;
        await _run(() async {
          await CollectionsApi.delete(c.id);
          setState(() => _items = _items.where((e) => e.id != c.id).toList());
        }, success: 'Gallery deleted');
    }
  }

  Future<void> _showAccount() async {
    final user = SessionStorage.getUser();
    final logout = await showModalBottomSheet<bool>(
      context: context,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(user?.name ?? 'Account',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            if (user?.email != null || user?.phoneNumber != null) ...[
              const SizedBox(height: 4),
              Text(user?.email ?? user!.phoneNumber!,
                  style: const TextStyle(color: AppColors.galleryMeta)),
            ],
            const SizedBox(height: 4),
            Text('${user?.planName ?? 'Free'} plan',
                style: const TextStyle(color: AppColors.galleryPurple)),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Log out'),
            ),
          ],
        ),
      ),
    );
    if (logout != true || !mounted) return;
    await AuthApi.logout();
    if (mounted) await context.router.replaceAll([const LoginRoute()]);
  }

  void _scan() => Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => const ScanGalleryPage()),
  );

  Future<void> _openFilters() async {
    final next = await showGalleryFilterSheet(context, _filters);
    if (next != null && mounted) setState(() => _filters = next);
  }

  @override
  Widget build(BuildContext context) {
    final visible = filterGalleries(_items, _filters);
    final starred = _items.where((c) => c.isStarred).toList();
    final photos = _items.fold<int>(0, (sum, c) => sum + c.imageCount);
    final published = _items.where((c) => c.isPublished).length;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1100 ? 4 : width >= 720 ? 3 : 2;
    final firstName = (SessionStorage.getUser()?.name ?? '').trim().split(' ').first;
    final browsing = _filters.search.isEmpty &&
        _filters.status == 'all' &&
        sheetFilterCount(_filters) == 0;

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        backgroundColor: AppColors.galleryPrimary,
        foregroundColor: AppColors.white,
        shape: const RoundedRectangleBorder(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Gallery', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.galleryPrimary,
          onRefresh: _load,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: HomeGreeting(
                  firstName: firstName,
                  galleries: _items.length,
                  photos: photos,
                  onAccount: _showAccount,
                  onScan: _scan,
                ),
              ),
              if (!_loading && _items.isNotEmpty)
                SliverToBoxAdapter(
                  child: HomeStats(
                    published: published,
                    drafts: _items.length - published,
                    photos: photos,
                    onStatus: (s) => setState(
                      () => _filters = _filters.copyWith(status: s),
                    ),
                  ),
                ),
              if (browsing) ...[
                const SliverToBoxAdapter(child: ScanCard()),
                const SliverToBoxAdapter(child: RecentScansRow()),
              ],
              if (browsing && starred.isNotEmpty) ...[
                const SliverToBoxAdapter(child: HomeSectionTitle('Starred')),
                SliverToBoxAdapter(
                  child: StarredCarousel(items: starred, onOpen: _open),
                ),
              ],
              const SliverToBoxAdapter(child: SizedBox(height: 12)),
              SliverPersistentHeader(
                pinned: true,
                delegate: SearchTabsHeader(
                  status: _filters.status,
                  counts: {
                    'all': _items.length,
                    'published': published,
                    'draft': _items.length - published,
                  },
                  activeFilters: sheetFilterCount(_filters),
                  onSearch: (v) => setState(
                    () => _filters = _filters.copyWith(search: v),
                  ),
                  onStatus: (s) => setState(
                    () => _filters = _filters.copyWith(status: s),
                  ),
                  onFilters: _openFilters,
                ),
              ),
              SliverToBoxAdapter(
                child: HomeSectionTitle(
                  browsing ? 'All galleries' : '${visible.length} found',
                  trailing: [
                    IconButton(
                      tooltip: _grid ? 'List view' : 'Grid view',
                      onPressed: () => setState(() => _grid = !_grid),
                      icon: Icon(_grid
                          ? Icons.view_agenda_outlined
                          : Icons.grid_view_rounded),
                    ),
                  ],
                ),
              ),
              if (_loading)
                GallerySkeletonGrid(columns: columns)
              else if (_error != null && _items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _EmptyState(
                    icon: Icons.cloud_off_rounded,
                    title: 'Could not load galleries',
                    text: _error!,
                    action: 'Try again',
                    onAction: _load,
                  ),
                )
              else if (visible.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _items.isEmpty
                      ? _EmptyState(
                          icon: Icons.photo_library_outlined,
                          title: 'Your first gallery starts here',
                          text: 'Create a gallery, upload your photos and '
                              'share it with your client in minutes.',
                          action: 'Create Gallery',
                          onAction: _create,
                        )
                      : _EmptyState(
                          icon: Icons.search_off_rounded,
                          title: 'No matching galleries',
                          text: 'Try another search, tab or filter.',
                          action: 'Clear filters',
                          onAction: () => setState(
                            () => _filters = const GalleryFilters(),
                          ),
                        ),
                )
              else if (_grid)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                  sliver: SliverGrid.builder(
                    itemCount: visible.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: columns,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 22,
                      childAspectRatio: .78,
                    ),
                    itemBuilder: (_, i) => CompactGalleryCard(
                      collection: visible[i],
                      onOpen: () => _open(visible[i]),
                      onStar: () => _toggleStar(visible[i]),
                      onAction: (a) => _onAction(visible[i], a),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                  sliver: DecoratedSliver(
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      border: Border.all(color: AppColors.galleryBorder),
                    ),
                    sliver: SliverList.separated(
                      itemCount: visible.length,
                      separatorBuilder: (_, _) => const Divider(),
                      itemBuilder: (_, i) => GalleryListTile(
                        collection: visible[i],
                        onOpen: () => _open(visible[i]),
                        onStar: () => _toggleStar(visible[i]),
                        onAction: (a) => _onAction(visible[i], a),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.text,
    required this.action,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String text;
  final String action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      child: Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(color: AppColors.galleryBorder),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.galleryLavenderTint,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: AppColors.galleryPurple),
            ),
            const SizedBox(height: 18),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(text,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 14, height: 1.5, color: AppColors.galleryMutedText)),
            const SizedBox(height: 22),
            FilledButton(onPressed: onAction, child: Text(action)),
          ],
        ),
      ),
    );
  }
}
