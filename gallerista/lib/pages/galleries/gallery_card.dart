import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/theme/app_theme.dart';

enum GalleryAction { quickEdit, togglePublish, duplicate, delete }

/// Grid card, matching the web Galleries grid (cover 1.33, star top-left,
/// menu top-right, title + "N items • Status • Date").
class GalleryGridCard extends StatelessWidget {
  const GalleryGridCard({
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
    final width = MediaQuery.sizeOf(context).width;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          children: [
            GestureDetector(
              onTap: onOpen,
              child: Container(
                decoration: const BoxDecoration(
                  color: AppColors.galleryCoverPlaceholder,
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x0D151515),
                      blurRadius: 44,
                      offset: Offset(0, 16),
                    ),
                  ],
                ),
                child: AspectRatio(
                  aspectRatio: 1.33,
                  child: Hero(
                    tag: 'cover-${collection.id}',
                    child: AppNetworkImage(
                      url: collection.coverUrl,
                      memCacheWidth: (width * dpr).round(),
                    ),
                  ),
                ),
              ),
            ),
            PositionedDirectional(
              start: 12,
              top: 12,
              child: StarButton(starred: collection.isStarred, onTap: onStar),
            ),
            PositionedDirectional(
              end: 12,
              top: 12,
              child: GalleryMenuButton(
                collection: collection,
                onAction: onAction,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        InkWell(
          onTap: onOpen,
          child: Text(
            collection.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              height: 1.2,
              color: AppColors.galleryTitle,
            ),
          ),
        ),
        const SizedBox(height: 8),
        GalleryMeta(collection: collection),
      ],
    );
  }
}

/// List row, matching the web list view.
class GalleryListTile extends StatelessWidget {
  const GalleryListTile({
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
    return InkWell(
      onTap: onOpen,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            SizedBox(
              width: 112,
              child: AspectRatio(
                aspectRatio: 1.35,
                child: AppNetworkImage(
                  url: collection.coverUrl,
                  placeholderColor: const Color(0xFFF2F2F2),
                  memCacheWidth: 360,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    collection.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  GalleryMeta(collection: collection),
                ],
              ),
            ),
            StarButton(
              starred: collection.isStarred,
              onTap: onStar,
              filled: false,
            ),
            GalleryMenuButton(
              collection: collection,
              onAction: onAction,
              filled: false,
            ),
          ],
        ),
      ),
    );
  }
}

class GalleryMeta extends StatelessWidget {
  const GalleryMeta({super.key, required this.collection});

  final Collection collection;

  @override
  Widget build(BuildContext context) {
    final parts = [
      '${collection.imageCount} ${collection.imageCount == 1 ? 'item' : 'items'}',
      if (collection.status != null) titleCase(collection.status),
      if (collection.eventDate != null) formatDate(collection.eventDate),
    ];
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: collection.isPublished
                ? AppColors.galleryPurple
                : const Color(0xFFBBBBBB),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            parts.join('  •  '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, color: AppColors.galleryMeta),
          ),
        ),
      ],
    );
  }
}

class StarButton extends StatelessWidget {
  const StarButton({
    super.key,
    required this.starred,
    required this.onTap,
    this.filled = true,
  });

  final bool starred;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return _RoundIcon(
      filled: filled,
      tooltip: starred ? 'Unstar gallery' : 'Star gallery',
      onTap: onTap,
      child: Icon(
        starred ? Icons.star_rounded : Icons.star_outline_rounded,
        size: 20,
        color: starred ? AppColors.galleryPurple : const Color(0xFF666666),
      ),
    );
  }
}

class GalleryMenuButton extends StatelessWidget {
  const GalleryMenuButton({
    super.key,
    required this.collection,
    required this.onAction,
    this.filled = true,
  });

  final Collection collection;
  final ValueChanged<GalleryAction> onAction;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<GalleryAction>(
      tooltip: 'Gallery actions',
      onSelected: onAction,
      itemBuilder: (_) => [
        const PopupMenuItem(
          value: GalleryAction.quickEdit,
          child: _MenuRow(Icons.edit_outlined, 'Quick edit'),
        ),
        PopupMenuItem(
          value: GalleryAction.togglePublish,
          child: _MenuRow(
            collection.isPublished
                ? Icons.visibility_off_outlined
                : Icons.public_rounded,
            collection.isPublished ? 'Move to draft' : 'Publish',
          ),
        ),
        const PopupMenuItem(
          value: GalleryAction.duplicate,
          child: _MenuRow(Icons.copy_rounded, 'Duplicate'),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: GalleryAction.delete,
          child: _MenuRow(Icons.delete_outline_rounded, 'Delete',
              color: AppColors.error),
        ),
      ],
      child: _RoundIcon(
        filled: filled,
        child: const Icon(Icons.more_horiz_rounded,
            size: 20, color: Color(0xFF444444)),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label, {this.color});

  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 12),
        Text(label, style: TextStyle(color: color)),
      ],
    );
  }
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon({
    required this.child,
    this.onTap,
    this.tooltip,
    this.filled = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final String? tooltip;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final circle = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? const Color(0xEBFFFFFF) : null,
        boxShadow: filled
            ? const [BoxShadow(color: Color(0x14000000), blurRadius: 4)]
            : null,
      ),
      child: Center(child: child),
    );
    if (onTap == null) return circle;
    return Tooltip(
      message: tooltip ?? '',
      child: InkResponse(onTap: onTap, radius: 24, child: circle),
    );
  }
}
