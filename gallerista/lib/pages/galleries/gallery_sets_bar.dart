import 'package:flutter/material.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/collections_api.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Horizontal set tabs: "All" + each set (long-press to rename/delete) +
/// "Add set". Mirrors the sets sidebar of the web gallery editor.
class GallerySetsBar extends StatelessWidget {
  const GallerySetsBar({
    super.key,
    required this.collection,
    required this.selectedSetId,
    required this.onSelect,
    required this.onChanged,
  });

  final Collection collection;
  final String? selectedSetId;
  final ValueChanged<String?> onSelect;
  final Future<void> Function() onChanged;

  Future<void> _run(Future<void> Function() action, String success) async {
    try {
      await action();
      AppToast.success(success);
      await onChanged();
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  Future<void> _addSet(BuildContext context) async {
    final name = await promptText(
      context,
      title: 'New set',
      hint: 'e.g. Ceremony',
      confirmLabel: 'Add set',
    );
    if (name == null || name.isEmpty) return;
    await _run(() => CollectionsApi.addSet(collection.id, name), 'Set added');
  }

  Future<void> _manageSet(BuildContext context, CollectionSet set) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(title: Text(set.name)),
          ListTile(
            leading: const Icon(Icons.edit_outlined),
            title: const Text('Rename set'),
            onTap: () => Navigator.pop(context, 'rename'),
          ),
          ListTile(
            leading: const Icon(Icons.delete_outline_rounded,
                color: AppColors.error),
            title: const Text('Delete set',
                style: TextStyle(color: AppColors.error)),
            onTap: () => Navigator.pop(context, 'delete'),
          ),
        ],
      ),
    );
    if (!context.mounted) return;
    if (action == 'rename') {
      final name = await promptText(
        context,
        title: 'Rename set',
        initial: set.name,
      );
      if (name == null || name.isEmpty) return;
      await _run(
        () => CollectionsApi.renameSet(collection.id, set.id, name),
        'Set renamed',
      );
    } else if (action == 'delete') {
      final ok = await confirmAction(
        context,
        title: 'Delete "${set.name}"?',
        message: 'The set and the photos in it will be deleted.',
      );
      if (!ok) return;
      if (selectedSetId == set.id) onSelect(null);
      await _run(
        () => CollectionsApi.deleteSet(collection.id, set.id),
        'Set deleted',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 60,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        children: [
          _SetChip(
            label: 'All photos',
            count: collection.imageCount,
            selected: selectedSetId == null,
            onTap: () => onSelect(null),
          ),
          for (final set in collection.sets)
            _SetChip(
              label: set.name,
              count: collection.setImageCounts[set.id],
              selected: selectedSetId == set.id,
              onTap: () => onSelect(set.id),
              onLongPress: () => _manageSet(context, set),
            ),
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 4),
            child: TextButton.icon(
              onPressed: () => _addSet(context),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add set'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SetChip extends StatelessWidget {
  const _SetChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
    this.onLongPress,
  });

  final String label;
  final int? count;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 8),
      child: Semantics(
        button: true,
        selected: selected,
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? AppColors.galleryPrimary : AppColors.white,
              border: Border.all(
                color: selected
                    ? AppColors.galleryPrimary
                    : AppColors.galleryBorder,
              ),
            ),
            child: Text(
              count == null ? label : '$label ($count)',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? AppColors.white : AppColors.galleryText,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
