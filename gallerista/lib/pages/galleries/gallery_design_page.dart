import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/storage/session_storage.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/gallery_design.dart';
import 'package:gallerista/pages/galleries/cover_preview.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Placeholder texts the web treats as "not set" (coverTextOrDefault).
const _placeholderTexts = {
  'Avery Studio',
  'Sarah & Daniel',
  'June 14, 2026',
  'View Gallery',
};

/// Gallery designer: cover layout, texts, focal point, typography, color
/// palette and grid, saved to `collection.design` like the web.
@RoutePage()
class GalleryDesignPage extends StatefulWidget {
  const GalleryDesignPage({
    super.key,
    @PathParam('collectionId') required this.collectionId,
  });

  final String collectionId;

  @override
  State<GalleryDesignPage> createState() => _GalleryDesignPageState();
}

class _GalleryDesignPageState extends State<GalleryDesignPage> {
  Map<String, dynamic>? _raw;
  final _changed = <String, dynamic>{};
  var _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await DioHelper.dio.get(
        '/collections/${widget.collectionId}',
        queryParameters: {'limit': 1, 'offset': 0},
      );
      final data = Map<String, dynamic>.from((res.data as Map)['data'] as Map);
      if (mounted) setState(() => _raw = data);
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    }
  }

  Map<String, dynamic> get _stored => _raw?['design'] is Map
      ? Map<String, dynamic>.from(_raw!['design'] as Map)
      : {};

  Map<String, dynamic> get _design => {
    ...GalleryDesign.defaults,
    ..._stored,
    ..._changed,
  };

  void _set(String key, dynamic value) => setState(() => _changed[key] = value);

  String _text(String key, String fallback) {
    final value = '${_design[key] ?? ''}'.trim();
    return value.isEmpty || _placeholderTexts.contains(value) ? fallback : value;
  }

  String get _titleFallback => '${_raw?['name'] ?? ''}';
  String get _dateFallback =>
      formatDate(DateTime.tryParse('${_raw?['eventDate'] ?? ''}')?.toLocal());
  String get _studioFallback {
    final user = SessionStorage.getUser();
    return user?.businessName ?? user?.name ?? '';
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final res = await DioHelper.dio.patch(
        '/collections/${widget.collectionId}',
        data: {'design': {..._stored, ..._changed}},
      );
      final data = (res.data as Map)['data'];
      setState(() {
        if (data is Map) _raw = Map<String, dynamic>.from(data);
        _changed.clear();
      });
      AppToast.success('Design saved');
    } catch (e) {
      AppToast.error(ApiError.message(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final raw = _raw;
    final dirty = _changed.isNotEmpty;
    return PopScope(
      canPop: !dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await confirmAction(
          context,
          title: 'Discard design changes?',
          message: 'Your design changes have not been saved.',
          confirmLabel: 'Discard',
        );
        if (leave && context.mounted) Navigator.of(context).pop();
      },
      child: DefaultTabController(
        length: 4,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Design'),
            actions: [
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 12),
                child: FilledButton(
                  onPressed: dirty && !_saving ? _save : null,
                  style: FilledButton.styleFrom(minimumSize: const Size(72, 38)),
                  child: Text(_saving ? 'Saving…' : 'Save'),
                ),
              ),
            ],
          ),
          body: raw == null
              ? Center(
                  child: _error == null
                      ? const CircularProgressIndicator()
                      : Text(_error!),
                )
              : Column(
                  children: [
                    _preview(raw),
                    const TabBar(
                      tabs: [
                        Tab(text: 'Cover'),
                        Tab(text: 'Type'),
                        Tab(text: 'Color'),
                        Tab(text: 'Grid'),
                      ],
                    ),
                    Expanded(
                      child: TabBarView(
                        children: [_coverTab(raw), _typeTab(), _colorTab(), _gridTab()],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _preview(Map<String, dynamic> raw) {
    final height = MediaQuery.sizeOf(context).height * .36;
    return Container(
      color: AppColors.galleryCoverPlaceholder,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        children: [
          SizedBox(
            height: height,
            child: AspectRatio(
              aspectRatio: 9 / 16,
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  boxShadow: [BoxShadow(color: Color(0x22000000), blurRadius: 18)],
                ),
                child: CoverPreview(
                  design: _design,
                  imageUrl: resolveImageUrl('${raw['coverImage'] ?? ''}'),
                  title: _text('coverTitle', _titleFallback),
                  smallTitle: _text('coverSmallTitle', _studioFallback),
                  date: _text('coverDate', _dateFallback),
                  showFocalMarker: true,
                  onFocalTap: (x, y) {
                    _set('coverFocalX', x.round());
                    _set('coverFocalY', y.round());
                  },
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tap the photo to set the focal point',
            style: TextStyle(fontSize: 11, color: AppColors.galleryMeta),
          ),
        ],
      ),
    );
  }

  Widget _coverTab(Map<String, dynamic> raw) {
    final selected = '${_design['cover']}';
    return ListView(
      padding: const EdgeInsets.only(bottom: 40),
      children: [
        const _Label('Layout'),
        SizedBox(
          height: 156,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: GalleryDesign.covers.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final name = GalleryDesign.covers[i];
              final isSelected = name == selected;
              return Semantics(
                button: true,
                selected: isSelected,
                label: '$name cover',
                child: GestureDetector(
                  onTap: () => _set('cover', name),
                  child: Column(
                    children: [
                      Container(
                        width: 72,
                        height: 128,
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: isSelected
                                ? AppColors.galleryPurple
                                : AppColors.galleryBorder,
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        child: CoverPreview(
                          design: {..._design, 'cover': name},
                          imageUrl: resolveImageUrl('${raw['coverImage'] ?? ''}'),
                          title: _text('coverTitle', _titleFallback),
                          smallTitle: _text('coverSmallTitle', _studioFallback),
                          date: _text('coverDate', _dateFallback),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(name,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight:
                                isSelected ? FontWeight.w700 : FontWeight.w400,
                          )),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const _Label('Cover text'),
        _TextToggle(
          label: 'Studio name',
          value: _text('coverSmallTitle', _studioFallback),
          shown: _design['showCoverSmallTitle'] == true,
          onText: (v) => _set('coverSmallTitle', v),
          onShown: (v) => _set('showCoverSmallTitle', v),
        ),
        _TextToggle(
          label: 'Title',
          value: _text('coverTitle', _titleFallback),
          shown: _design['showCoverTitle'] == true,
          onText: (v) => _set('coverTitle', v),
          onShown: (v) => _set('showCoverTitle', v),
        ),
        _TextToggle(
          label: 'Date',
          value: _text('coverDate', _dateFallback),
          shown: _design['showCoverDate'] == true,
          onText: (v) => _set('coverDate', v),
          onShown: (v) => _set('showCoverDate', v),
        ),
        _TextToggle(
          label: 'Button',
          value: _text('coverButtonText', 'View Gallery'),
          shown: _design['showCoverButton'] == true,
          onText: (v) => _set('coverButtonText', v),
          onShown: (v) => _set('showCoverButton', v),
        ),
        const _Label('Cover motion'),
        _Choices(
          options: GalleryDesign.coverMotions,
          value: '${_design['coverMotion']}',
          onChanged: (v) => _set('coverMotion', v),
        ),
      ],
    );
  }

  Widget _typeTab() {
    final selected = '${_design['typography']}';
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        for (final entry in GalleryDesign.typography.entries)
          ListTile(
            onTap: () => _set('typography', entry.key),
            selected: entry.key == selected,
            selectedColor: AppColors.galleryPurple,
            title: Text(entry.value.$1,
                style: GalleryDesign.fontFor(entry.key).copyWith(fontSize: 24)),
            subtitle: Text('${entry.key} · ${entry.value.$2}'),
            trailing: entry.key == selected
                ? const Icon(Icons.check_rounded, color: AppColors.galleryPurple)
                : null,
          ),
      ],
    );
  }

  Widget _colorTab() {
    final selected = '${_design['color']}' == 'Light' ? 'White' : '${_design['color']}';
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        for (final entry in GalleryDesign.palettes.entries)
          ListTile(
            onTap: () => _set('color', entry.key),
            selected: entry.key == selected,
            selectedColor: AppColors.galleryPurple,
            leading: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final c in [entry.value.$1, entry.value.$3, entry.value.$2])
                  Container(
                    width: 22,
                    height: 22,
                    margin: const EdgeInsetsDirectional.only(end: 4),
                    decoration: BoxDecoration(
                      color: c,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.galleryBorder),
                    ),
                  ),
              ],
            ),
            title: Text(entry.key),
            trailing: entry.key == selected
                ? const Icon(Icons.check_rounded, color: AppColors.galleryPurple)
                : null,
          ),
      ],
    );
  }

  Widget _gridTab() {
    Map<String, String> same(List<String> v) => {for (final e in v) e: e};
    final style = '${_design['gridStyle']}';
    return ListView(
      padding: const EdgeInsets.only(bottom: 40),
      children: [
        const _Label('Grid style'),
        _Choices(
          options: same(GalleryDesign.gridStyles),
          value: style,
          onChanged: (v) => _set('gridStyle', v),
        ),
        if (style == 'Custom') ...[
          const _Label('Columns'),
          _Choices(
            options: {for (final n in [2, 3, 4, 5, 6]) '$n': '$n'},
            value: '${_design['gridColumns']}',
            onChanged: (v) => _set('gridColumns', int.parse(v)),
          ),
        ],
        const _Label('Thumbnail size'),
        _Choices(
          options: same(GalleryDesign.thumbnailSizes),
          value: '${_design['thumbnailSize']}',
          onChanged: (v) => _set('thumbnailSize', v),
        ),
        const _Label('Grid spacing'),
        _Choices(
          options: same(GalleryDesign.gridSpacings),
          value: '${_design['gridSpacing']}',
          onChanged: (v) => _set('gridSpacing', v),
        ),
        const _Label('Navigation'),
        _Choices(
          options: same(GalleryDesign.navigationStyles),
          value: '${_design['navigationStyle']}',
          onChanged: (v) => _set('navigationStyle', v),
        ),
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
    child: Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        letterSpacing: 1.2,
        fontWeight: FontWeight.w700,
        color: AppColors.galleryMeta,
      ),
    ),
  );
}

class _Choices extends StatelessWidget {
  const _Choices({
    required this.options,
    required this.value,
    required this.onChanged,
  });

  final Map<String, String> options;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Wrap(
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
                color: e.key == value ? AppColors.white : AppColors.galleryText,
                fontWeight: FontWeight.w600,
              ),
              onSelected: (_) => onChanged(e.key),
            ),
        ],
      ),
    );
  }
}

class _TextToggle extends StatelessWidget {
  const _TextToggle({
    required this.label,
    required this.value,
    required this.shown,
    required this.onText,
    required this.onShown,
  });

  final String label;
  final String value;
  final bool shown;
  final ValueChanged<String> onText;
  final ValueChanged<bool> onShown;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 8, 4),
      child: Row(
        children: [
          Expanded(
            child: TextFormField(
              initialValue: value,
              enabled: shown,
              onChanged: onText,
              decoration: InputDecoration(labelText: label, isDense: true),
            ),
          ),
          Switch(
            value: shown,
            activeTrackColor: AppColors.galleryPurple,
            onChanged: onShown,
          ),
        ],
      ),
    );
  }
}
