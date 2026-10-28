import 'package:flutter/material.dart';
import 'package:gallerista/core/cms/site_logo.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/gallery_filters.dart';
import 'package:gallerista/pages/galleries/gallery_card.dart';
import 'package:gallerista/theme/app_theme.dart';

String greetingFor(DateTime now) => now.hour < 12
    ? 'Good morning'
    : now.hour < 17
    ? 'Good afternoon'
    : 'Good evening';

/// Top of the home screen: brand, avatar, QR scan, greeting and totals.
class HomeGreeting extends StatelessWidget {
  const HomeGreeting({
    super.key,
    required this.firstName,
    required this.galleries,
    required this.photos,
    required this.onAccount,
    required this.onScan,
  });

  final String firstName;
  final int galleries;
  final int photos;
  final VoidCallback onAccount;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    final initial = firstName.isEmpty ? '?' : firstName[0].toUpperCase();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // The website's logo from the admin; the text until it loads.
              const SiteLogo(
                height: 22,
                maxWidth: 170,
                fallback: Text(
                  'GALLERISTA',
                  style: TextStyle(
                    fontSize: 12,
                    letterSpacing: 3,
                    fontWeight: FontWeight.w800,
                    color: AppColors.galleryPurple,
                  ),
                ),
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Scan gallery QR',
                onPressed: onScan,
                icon: const Icon(Icons.qr_code_scanner_rounded),
              ),
              Semantics(
                button: true,
                label: 'Account',
                child: GestureDetector(
                  onTap: onAccount,
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: CircleAvatar(
                      radius: 17,
                      backgroundColor: AppColors.galleryPrimary,
                      child: Text(initial,
                          style: const TextStyle(
                              color: AppColors.white,
                              fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            firstName.isEmpty
                ? greetingFor(DateTime.now())
                : '${greetingFor(DateTime.now())}, $firstName',
            style: const TextStyle(
              fontSize: 27,
              height: 1.15,
              fontWeight: FontWeight.w600,
              letterSpacing: -.5,
              color: AppColors.galleryText,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '$galleries ${galleries == 1 ? 'gallery' : 'galleries'}'
            '  •  $photos ${photos == 1 ? 'photo' : 'photos'}',
            style: const TextStyle(fontSize: 14, color: AppColors.galleryMutedText),
          ),
        ],
      ),
    );
  }
}

/// Published / Drafts / Photos summary tiles.
class HomeStats extends StatelessWidget {
  const HomeStats({
    super.key,
    required this.published,
    required this.drafts,
    required this.photos,
    required this.onStatus,
  });

  final int published;
  final int drafts;
  final int photos;
  final ValueChanged<String> onStatus;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          _StatTile(
            icon: Icons.public_rounded,
            value: published,
            label: 'Published',
            accent: AppColors.galleryPurple,
            onTap: () => onStatus('published'),
          ),
          const SizedBox(width: 10),
          _StatTile(
            icon: Icons.edit_note_rounded,
            value: drafts,
            label: 'Drafts',
            accent: AppColors.galleryGold,
            onTap: () => onStatus('draft'),
          ),
          const SizedBox(width: 10),
          _StatTile(
            icon: Icons.photo_outlined,
            value: photos,
            label: 'Photos',
            accent: AppColors.galleryText,
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.value,
    required this.label,
    required this.accent,
    this.onTap,
  });

  final IconData icon;
  final int value;
  final String label;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Material(
        color: AppColors.white,
        child: InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.galleryBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 18, color: accent),
                const SizedBox(height: 10),
                Text(
                  _compact(value),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                Text(label,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.galleryMeta)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _compact(int v) => v >= 10000
      ? '${(v / 1000).toStringAsFixed(0)}k'
      : v >= 1000
      ? '${(v / 1000).toStringAsFixed(1)}k'
      : '$v';
}

/// Section title with optional trailing widgets.
class HomeSectionTitle extends StatelessWidget {
  const HomeSectionTitle(this.title, {super.key, this.trailing = const []});

  final String title;
  final List<Widget> trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 12, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(title,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          ),
          ...trailing,
        ],
      ),
    );
  }
}

/// Horizontal row of starred galleries.
class StarredCarousel extends StatelessWidget {
  const StarredCarousel({super.key, required this.items, required this.onOpen});

  final List<Collection> items;
  final ValueChanged<Collection> onOpen;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 168,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (_, i) {
          final c = items[i];
          return Semantics(
            button: true,
            label: c.name,
            child: GestureDetector(
              onTap: () => onOpen(c),
              child: SizedBox(
                width: 236,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AppNetworkImage(url: c.coverUrl, memCacheWidth: 700),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0x00000000), Color(0xB3000000)],
                          stops: [.45, 1],
                        ),
                      ),
                    ),
                    const PositionedDirectional(
                      top: 10,
                      end: 10,
                      child: Icon(Icons.star_rounded,
                          color: AppColors.galleryLavender, size: 20),
                    ),
                    PositionedDirectional(
                      start: 12,
                      end: 12,
                      bottom: 12,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: AppColors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700)),
                          Text('${c.imageCount} photos',
                              style: const TextStyle(
                                  color: Color(0xCCFFFFFF), fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Sticky search + status tabs + filter button.
class SearchTabsHeader extends SliverPersistentHeaderDelegate {
  SearchTabsHeader({
    required this.status,
    required this.counts,
    required this.activeFilters,
    required this.onSearch,
    required this.onStatus,
    required this.onFilters,
  });

  final String status;
  final Map<String, int> counts;
  final int activeFilters;
  final ValueChanged<String> onSearch;
  final ValueChanged<String> onStatus;
  final VoidCallback onFilters;

  static const height = 118.0;

  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlaps) {
    return Material(
      color: AppColors.galleryBackground,
      elevation: overlaps ? 1 : 0,
      shadowColor: const Color(0x22000000),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 46,
                    child: TextField(
                      onChanged: onSearch,
                      textInputAction: TextInputAction.search,
                      decoration: const InputDecoration(
                        hintText: 'Search galleries, tags…',
                        prefixIcon: Icon(Icons.search_rounded),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Badge(
                  isLabelVisible: activeFilters > 0,
                  label: Text('$activeFilters'),
                  backgroundColor: AppColors.galleryPurple,
                  child: SizedBox(
                    width: 46,
                    height: 46,
                    child: OutlinedButton(
                      onPressed: onFilters,
                      style: OutlinedButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(46, 46),
                        backgroundColor: AppColors.white,
                      ),
                      child: const Icon(Icons.tune_rounded, size: 20),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 46,
              child: Row(
                children: [
                  for (final (key, label) in const [
                    ('all', 'All'),
                    ('published', 'Published'),
                    ('draft', 'Draft'),
                  ])
                    _StatusTab(
                      label: label,
                      count: counts[key] ?? 0,
                      selected: status == key,
                      onTap: () => onStatus(key),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(SearchTabsHeader old) =>
      old.status != status ||
      old.activeFilters != activeFilters ||
      old.counts.toString() != counts.toString();
}

class _StatusTab extends StatelessWidget {
  const _StatusTab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          margin: const EdgeInsetsDirectional.only(end: 20),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: selected ? AppColors.galleryPurple : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            '$label  $count',
            style: TextStyle(
              fontSize: 14,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? AppColors.galleryText : AppColors.galleryMeta,
            ),
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet with the remaining web filters and sort.
Future<GalleryFilters?> showGalleryFilterSheet(
  BuildContext context,
  GalleryFilters current,
) {
  return showModalBottomSheet<GalleryFilters>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (context) {
      var f = current;
      return StatefulBuilder(
        builder: (context, setSheet) {
          Widget group(String title, String value, Map<String, String> options,
                  GalleryFilters Function(String) apply) =>
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 18, bottom: 8),
                    child: Text(title.toUpperCase(),
                        style: const TextStyle(
                            fontSize: 12,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w700,
                            color: AppColors.galleryMeta)),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final e in options.entries)
                        ChoiceChip(
                          label: Text(e.value),
                          selected: e.key == value,
                          showCheckmark: false,
                          selectedColor: AppColors.galleryPrimary,
                          labelStyle: TextStyle(
                            color: e.key == value
                                ? AppColors.white
                                : AppColors.galleryText,
                            fontWeight: FontWeight.w600,
                          ),
                          onSelected: (_) => setSheet(() => f = apply(e.key)),
                        ),
                    ],
                  ),
                ],
              );
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Filter & sort',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                    ),
                    TextButton(
                      onPressed: () => setSheet(() => f = GalleryFilters(
                            search: f.search,
                            status: f.status,
                          )),
                      child: const Text('Reset'),
                    ),
                  ],
                ),
                group('Sort', f.sort, const {
                  'newest': 'Newest',
                  'oldest': 'Oldest',
                  'name-asc': 'Name A–Z',
                  'name-desc': 'Name Z–A',
                }, (v) => f.copyWith(sort: v)),
                group('Event date', f.eventDate, const {
                  'all': 'Any',
                  'upcoming': 'Upcoming',
                  'past': 'Past',
                  'none': 'No date',
                }, (v) => f.copyWith(eventDate: v)),
                group('Expiry', f.expiry, const {
                  'all': 'Any',
                  'active': 'Not expired',
                  'expired': 'Expired',
                  'none': 'No expiry',
                }, (v) => f.copyWith(expiry: v)),
                group('Starred', f.starred, const {
                  'all': 'All',
                  'yes': 'Starred',
                  'no': 'Not starred',
                }, (v) => f.copyWith(starred: v)),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => Navigator.pop(context, f),
                  child: const Text('Show galleries'),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}

/// Filters counted on the filter button (status and search have their own UI).
int sheetFilterCount(GalleryFilters f) => [
  f.eventDate != 'all',
  f.expiry != 'all',
  f.starred != 'all',
  f.sort != 'newest',
].where((v) => v).length;

/// Two-column card for phones: square cover, status badge, star, menu.
class CompactGalleryCard extends StatelessWidget {
  const CompactGalleryCard({
    super.key,
    required this.collection,
    required this.onOpen,
    required this.onStar,
    required this.onAction,
  });

  final Collection collection;
  final VoidCallback onOpen;
  final VoidCallback onStar;
  final ValueChanged<GalleryAction> onAction;

  @override
  Widget build(BuildContext context) {
    final c = collection;
    final date = c.eventDate ?? c.createdAt;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: GestureDetector(
            onTap: onOpen,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: const BoxDecoration(
                    color: AppColors.galleryCoverPlaceholder,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x12151515),
                        blurRadius: 18,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Hero(
                    tag: 'cover-${c.id}',
                    child: AppNetworkImage(url: c.coverUrl, memCacheWidth: 520),
                  ),
                ),
                PositionedDirectional(
                  top: 8,
                  start: 8,
                  child: _StatusBadge(published: c.isPublished),
                ),
                PositionedDirectional(
                  top: 2,
                  end: 2,
                  child: IconButton(
                    tooltip: c.isStarred ? 'Unstar gallery' : 'Star gallery',
                    onPressed: onStar,
                    icon: Icon(
                      c.isStarred ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: c.isStarred ? AppColors.galleryLavender : AppColors.white,
                      shadows: const [Shadow(color: Color(0x99000000), blurRadius: 6)],
                    ),
                  ),
                ),
                if (c.isMobileOnly)
                  const PositionedDirectional(
                    bottom: 8,
                    start: 8,
                    child: Icon(Icons.phone_iphone_rounded,
                        size: 18,
                        color: AppColors.white,
                        shadows: [Shadow(color: Color(0x99000000), blurRadius: 6)]),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: GestureDetector(
                onTap: onOpen,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(c.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.galleryTitle)),
                    const SizedBox(height: 2),
                    Text(
                      '${c.imageCount} photos'
                      '${date == null ? '' : '  •  ${formatDate(date)}'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11.5, color: AppColors.galleryMeta),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(
              width: 28,
              height: 32,
              child: GalleryMenuButton(
                collection: c,
                onAction: onAction,
                filled: false,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.published});

  final bool published;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      color: published ? AppColors.galleryPurple : const Color(0xE6FFFFFF),
      child: Text(
        published ? 'PUBLISHED' : 'DRAFT',
        style: TextStyle(
          fontSize: 9.5,
          letterSpacing: 1,
          fontWeight: FontWeight.w800,
          color: published ? AppColors.white : AppColors.galleryText,
        ),
      ),
    );
  }
}

/// Grey placeholders while galleries load.
class GallerySkeletonGrid extends StatelessWidget {
  const GallerySkeletonGrid({super.key, required this.columns});

  final int columns;

  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      sliver: SliverGrid.builder(
        itemCount: columns * 3,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: columns,
          crossAxisSpacing: 14,
          mainAxisSpacing: 20,
          childAspectRatio: .78,
        ),
        itemBuilder: (_, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Expanded(child: ColoredBox(color: Color(0xFFEDEAE4))),
            const SizedBox(height: 8),
            Container(height: 12, width: 110, color: const Color(0xFFEDEAE4)),
            const SizedBox(height: 6),
            Container(height: 10, width: 70, color: const Color(0xFFF2EFEA)),
          ],
        ),
      ),
    );
  }
}
