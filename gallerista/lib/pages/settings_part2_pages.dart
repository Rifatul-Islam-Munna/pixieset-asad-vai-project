import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/account_settings_api.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/gallery_design.dart';
import 'package:gallerista/gallery/preset_defaults.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/theme/app_theme.dart';

// ─────────────────────────── shared bits ───────────────────────────

Widget _save(bool saving, VoidCallback? onSave) => Padding(
  padding: const EdgeInsetsDirectional.only(end: 12),
  child: FilledButton(
    onPressed: saving ? null : onSave,
    style: FilledButton.styleFrom(minimumSize: const Size(72, 38)),
    child: Text(saving ? 'Saving…' : 'Save'),
  ),
);

Widget _label(String text) => Padding(
  padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
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

Widget _chips(List<String> options, String value, ValueChanged<String> onChanged,
        {Map<String, String> labels = const {}}) =>
    Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final o in options)
            ChoiceChip(
              label: Text(labels[o] ?? o),
              selected: o == value,
              showCheckmark: false,
              selectedColor: AppColors.galleryPrimary,
              labelStyle: TextStyle(
                color: o == value ? AppColors.white : AppColors.galleryText,
                fontWeight: FontWeight.w600,
              ),
              onSelected: (_) => onChanged(o),
            ),
        ],
      ),
    );

Widget _switch(String title, bool value, ValueChanged<bool> onChanged,
        {String? subtitle}) =>
    SwitchListTile(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle: subtitle == null
          ? null
          : Text(subtitle,
              style: const TextStyle(fontSize: 12, color: AppColors.galleryMeta)),
      value: value,
      activeTrackColor: AppColors.galleryPurple,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      onChanged: onChanged,
    );

Widget _field(String label, String initial, ValueChanged<String> onChanged,
        {String? hint, int maxLines = 1, bool digits = false}) =>
    Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
      child: TextFormField(
        initialValue: initial,
        maxLines: maxLines,
        keyboardType: digits ? TextInputType.number : null,
        inputFormatters: [if (digits) FilteringTextInputFormatter.digitsOnly],
        onChanged: onChanged,
        decoration: InputDecoration(labelText: label, hintText: hint),
      ),
    );

String _today() => formatDate(DateTime.now());

// ─────────────────────────── Presets ───────────────────────────

/// Presets: your saved presets plus the 8 built-in ones from the web.
class PresetsPage extends StatefulWidget {
  const PresetsPage({super.key});

  @override
  State<PresetsPage> createState() => _PresetsPageState();
}

class _PresetsPageState extends State<PresetsPage> {
  List<Map<String, dynamic>>? _mine;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final records = await AccountSettingsApi.list('preset');
      if (mounted) {
        setState(() => _mine = [
          for (final r in records) normalizePreset(r.data, r.localId),
        ]);
      }
    } catch (e) {
      if (mounted) setState(() => _mine = const []);
      AppToast.error(ApiError.message(e));
    }
  }

  Future<void> _open(Map<String, dynamic> preset) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PresetEditorPage(preset: preset)),
    );
    if (changed == true) await _load();
  }

  Widget _tile(Map<String, dynamic> p) {
    final design = Map<String, dynamic>.from(p['design'] as Map);
    final (bg, _, accent) = GalleryDesign.paletteFor('${design['color']}');
    return ListTile(
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: AppColors.galleryBorder),
        ),
        alignment: Alignment.center,
        child: Text('Aa',
            style: GalleryDesign.fontFor('${design['typography']}')
                .copyWith(color: accent, fontSize: 16)),
      ),
      title: Text('${p['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text('${design['cover']} cover · ${design['typography']} · '
          '${p['updatedAt'] ?? ''}'),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => _open(p),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mine = _mine;
    return Scaffold(
      appBar: AppBar(title: const Text('Presets')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _open(buildPreset(
          id: 'preset-${DateTime.now().millisecondsSinceEpoch}',
          name: 'Untitled Preset',
        )),
        backgroundColor: AppColors.galleryPrimary,
        foregroundColor: AppColors.white,
        shape: const RoundedRectangleBorder(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Preset'),
      ),
      body: mine == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.only(bottom: 96),
              children: [
                _label('Your presets'),
                if (mine.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text('No custom presets yet. Start from a built-in '
                        'one or create a new preset.',
                        style: TextStyle(color: AppColors.galleryMeta)),
                  ),
                for (final p in mine) _tile(p),
                _label('Built-in'),
                for (final p in builtInPresets) _tile(p),
              ],
            ),
    );
  }
}

/// Edit a preset. Built-in presets are saved as a new copy.
class PresetEditorPage extends StatefulWidget {
  const PresetEditorPage({super.key, required this.preset});

  final Map<String, dynamic> preset;

  @override
  State<PresetEditorPage> createState() => _PresetEditorPageState();
}

class _PresetEditorPageState extends State<PresetEditorPage> {
  late final Map<String, dynamic> _p = {
    for (final e in widget.preset.entries)
      e.key: e.value is Map ? Map<String, dynamic>.from(e.value as Map) : e.value,
  };
  var _saving = false;

  bool get _builtIn => isBuiltInPreset(widget.preset);

  Map<String, dynamic> _g(String group) => _p[group] as Map<String, dynamic>;
  bool _b(String group, String key) => _g(group)[key] == true;
  String _s(String group, String key) => '${_g(group)[key] ?? ''}';
  void _set(String group, String key, dynamic v) => setState(() => _g(group)[key] = v);

  Future<void> _savePreset() async {
    final id = _builtIn
        ? 'preset-${DateTime.now().millisecondsSinceEpoch}'
        : '${_p['id']}';
    final name = '${_p['name']}'.trim().isEmpty ? 'Untitled Preset' : '${_p['name']}'.trim();
    setState(() => _saving = true);
    try {
      await AccountSettingsApi.save('preset', localId: id, name: name, data: {
        ..._p,
        'id': id,
        'name': name,
        'updatedAt': _today(),
      });
      AppToast.success(_builtIn ? 'Saved as your preset' : 'Preset saved');
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final ok = await confirmAction(
      context,
      title: 'Delete preset?',
      message: '"${_p['name']}" will be deleted. Galleries keep their settings.',
    );
    if (!ok) return;
    try {
      await AccountSettingsApi.delete('preset', '${_p['id']}');
      AppToast.success('Preset deleted');
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: AppBar(
          title: Text(_builtIn ? 'Built-in preset' : 'Edit preset'),
          actions: [
            if (!_builtIn)
              IconButton(
                tooltip: 'Delete',
                onPressed: _delete,
                icon: const Icon(Icons.delete_outline_rounded),
              ),
            _save(_saving, _savePreset),
          ],
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: 'General'),
              Tab(text: 'Design'),
              Tab(text: 'Download'),
              Tab(text: 'Favorites'),
              Tab(text: 'Store'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            ListView(children: [
              if (_builtIn)
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(12),
                  color: AppColors.galleryLavenderTint,
                  child: const Text(
                    'Built-in presets can’t be changed. Saving creates your own '
                    'copy you can edit later.',
                    style: TextStyle(fontSize: 13, height: 1.4),
                  ),
                ),
              _field('Preset name', '${_p['name']}', (v) => setState(() => _p['name'] = v)),
              _field('Gallery tags', _s('general', 'collectionTags'),
                  (v) => _set('general', 'collectionTags', v), hint: 'Wedding, 2026'),
              _field('Photo sets', _s('general', 'photoSets'),
                  (v) => _set('general', 'photoSets', v),
                  hint: 'Featured, Ceremony, Portraits'),
              _switch('Email registration', _b('general', 'emailRegistration'),
                  (v) => _set('general', 'emailRegistration', v)),
              _switch('Marketing subscription', _b('general', 'marketingSubscription'),
                  (v) => _set('general', 'marketingSubscription', v)),
              _switch('Social sharing', _b('general', 'socialSharing'),
                  (v) => _set('general', 'socialSharing', v)),
              _switch('Slideshow', _b('general', 'slideshow'),
                  (v) => _set('general', 'slideshow', v)),
              _switch('Gallery assist', _b('general', 'galleryAssist'),
                  (v) => _set('general', 'galleryAssist', v)),
              _label('Language'),
              _chips(const ['English', 'Spanish', 'French', 'German', 'Greek', 'Arabic'],
                  _s('general', 'language'), (v) => _set('general', 'language', v)),
              const SizedBox(height: 32),
            ]),
            ListView(children: [
              _label('Cover'),
              _chips(GalleryDesign.covers, _s('design', 'cover'),
                  (v) => _set('design', 'cover', v)),
              _label('Typography'),
              _chips(GalleryDesign.typography.keys.toList(), _s('design', 'typography'),
                  (v) => _set('design', 'typography', v)),
              _label('Color'),
              _chips(GalleryDesign.palettes.keys.toList(),
                  _s('design', 'color') == 'Light' ? 'White' : _s('design', 'color'),
                  (v) => _set('design', 'color', v)),
              _label('Grid style'),
              _chips(GalleryDesign.gridStyles, _s('design', 'gridStyle'),
                  (v) => _set('design', 'gridStyle', v)),
              _label('Thumbnail size'),
              _chips(GalleryDesign.thumbnailSizes, _s('design', 'thumbnailSize'),
                  (v) => _set('design', 'thumbnailSize', v)),
              _label('Grid spacing'),
              _chips(GalleryDesign.gridSpacings, _s('design', 'gridSpacing'),
                  (v) => _set('design', 'gridSpacing', v)),
              _label('Navigation'),
              _chips(GalleryDesign.navigationStyles, _s('design', 'navigationStyle'),
                  (v) => _set('design', 'navigationStyle', v)),
              const SizedBox(height: 32),
            ]),
            ListView(children: [
              _switch('Photo download', _b('download', 'photoDownload'),
                  (v) => _set('download', 'photoDownload', v)),
              _switch('Download all', _b('download', 'galleryDownload'),
                  (v) => _set('download', 'galleryDownload', v)),
              _switch('Single photo download', _b('download', 'singlePhotoDownload'),
                  (v) => _set('download', 'singlePhotoDownload', v)),
              _switch('High resolution', _b('download', 'highResolution'),
                  (v) => _set('download', 'highResolution', v)),
              if (_b('download', 'highResolution'))
                _chips(const ['Original', '3600px'], _s('download', 'highResolutionSize'),
                    (v) => _set('download', 'highResolutionSize', v)),
              _switch('Web size', _b('download', 'webSize'),
                  (v) => _set('download', 'webSize', v)),
              if (_b('download', 'webSize'))
                _chips(const ['2048px', '1024px', '640px'], _s('download', 'webSizePx'),
                    (v) => _set('download', 'webSizePx', v)),
              _switch('Video download', _b('download', 'videoDownload'),
                  (v) => _set('download', 'videoDownload', v)),
              _switch('Download PIN', _b('download', 'downloadPin'),
                  (v) => _set('download', 'downloadPin', v)),
              if (_b('download', 'downloadPin'))
                _field('Download PIN code', _s('download', 'downloadPinCode'),
                    (v) => _set('download', 'downloadPinCode', v), digits: true),
              _switch('Limit downloads', _b('download', 'limitDownloads'),
                  (v) => _set('download', 'limitDownloads', v)),
              const SizedBox(height: 32),
            ]),
            ListView(children: [
              _switch('Favorite photos', _b('favorite', 'favoritePhotos'),
                  (v) => _set('favorite', 'favoritePhotos', v)),
              _switch('Favorite notes', _b('favorite', 'favoriteNotes'),
                  (v) => _set('favorite', 'favoriteNotes', v)),
              _field('Maximum favorites', _s('favorite', 'maxFavorites'),
                  (v) => _set('favorite', 'maxFavorites', v),
                  hint: 'Empty = unlimited', digits: true),
              _field('Instructions for clients', _s('favorite', 'description'),
                  (v) => _set('favorite', 'description', v), maxLines: 3),
              const SizedBox(height: 32),
            ]),
            ListView(children: [
              _switch('Store', _b('store', 'storeStatus'),
                  (v) => _set('store', 'storeStatus', v)),
              _switch('Product preview', _b('store', 'productPreview'),
                  (v) => _set('store', 'productPreview', v)),
              _switch('"Buy photo" button', _b('store', 'showBuyPhotoButton'),
                  (v) => _set('store', 'showBuyPhotoButton', v)),
              const SizedBox(height: 32),
            ]),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────── Email templates ───────────────────────────

/// New template, same defaults as the web `addEmailTemplateDraft`.
Map<String, dynamic> newEmailTemplate() => {
  'id': 'tpl-${DateTime.now().millisecondsSinceEpoch}',
  'name': 'Untitled Template',
  'subject': '',
  'previewText': '',
  'title': 'Untitled Template',
  'message': '',
  'buttonText': 'Open Gallery',
  'buttonLink': 'Collection URL',
  'buttonColor': '#22bda7',
  'footerText': '',
  'image': '',
  'eyebrowText': 'Client Gallery',
  'showImage': true,
  'category': 'Gallery Delivery',
  'galleryCategory': 'Wedding',
  'customGalleryCategoryLabel': '',
  'language': 'English',
  'updatedAt': 'Draft',
  'source': 'user',
};

/// Your templates first, then the templates your admin provides (CMS).
class EmailTemplatesPage extends StatefulWidget {
  const EmailTemplatesPage({super.key});

  @override
  State<EmailTemplatesPage> createState() => _EmailTemplatesPageState();
}

class _EmailTemplatesPageState extends State<EmailTemplatesPage> {
  List<Map<String, dynamic>>? _mine;
  List<Map<String, dynamic>> _global = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        AccountSettingsApi.list('email-template'),
        DioHelper.dio.get('/home-cms').then((r) => r.data).catchError((_) => null),
      ]);
      final records = results[0] as List<SettingRecord>;
      final cms = results[1];
      final cmsData = cms is Map ? cms['data'] : null;
      final global = cmsData is Map ? cmsData['emailTemplates'] : null;
      if (!mounted) return;
      setState(() {
        _mine = [
          for (final r in records) {...r.data, 'id': r.data['id'] ?? r.localId, 'source': 'user'},
        ];
        _global = [
          for (final t in (global is List ? global : const []))
            if (t is Map) {...Map<String, dynamic>.from(t), 'source': 'admin'},
        ];
      });
    } catch (e) {
      if (mounted) setState(() => _mine = const []);
      AppToast.error(ApiError.message(e));
    }
  }

  Future<void> _open(Map<String, dynamic> template) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => EmailTemplateEditorPage(template: template)),
    );
    if (changed == true) await _load();
  }

  Widget _tile(Map<String, dynamic> t) => ListTile(
    leading: Container(
      width: 44,
      height: 44,
      color: hexColor(t['buttonColor'], AppColors.galleryPurple).withValues(alpha: .12),
      child: Icon(Icons.mail_outline_rounded,
          color: hexColor(t['buttonColor'], AppColors.galleryPurple)),
    ),
    title: Text('${t['name'] ?? 'Template'}',
        style: const TextStyle(fontWeight: FontWeight.w600)),
    subtitle: Text(
      [
        if ('${t['category'] ?? ''}'.isNotEmpty) '${t['category']}',
        if ('${t['subject'] ?? ''}'.isNotEmpty) '${t['subject']}',
      ].join(' · '),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    ),
    trailing: const Icon(Icons.chevron_right_rounded),
    onTap: () => _open(t),
  );

  @override
  Widget build(BuildContext context) {
    final mine = _mine;
    return Scaffold(
      appBar: AppBar(title: const Text('Email Templates')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _open(newEmailTemplate()),
        backgroundColor: AppColors.galleryPrimary,
        foregroundColor: AppColors.white,
        shape: const RoundedRectangleBorder(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Template'),
      ),
      body: mine == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.only(bottom: 96),
              children: [
                _label('Your templates'),
                if (mine.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text('No templates yet. Create one, or edit a '
                        'ready-made template below to make your own copy.',
                        style: TextStyle(color: AppColors.galleryMeta)),
                  ),
                for (final t in mine) _tile(t),
                if (_global.isNotEmpty) ...[
                  _label('Ready-made'),
                  for (final t in _global) _tile(t),
                ],
              ],
            ),
    );
  }
}

/// Edit an email template with a live preview. Ready-made templates are
/// saved as your own copy, like the web.
class EmailTemplateEditorPage extends StatefulWidget {
  const EmailTemplateEditorPage({super.key, required this.template});

  final Map<String, dynamic> template;

  @override
  State<EmailTemplateEditorPage> createState() => _EmailTemplateEditorPageState();
}

class _EmailTemplateEditorPageState extends State<EmailTemplateEditorPage> {
  late final Map<String, dynamic> _t = Map<String, dynamic>.from(widget.template);
  var _saving = false;

  bool get _isUser => widget.template['source'] == 'user';
  bool get _isNew => '${widget.template['updatedAt']}' == 'Draft';
  String _v(String key) => '${_t[key] ?? ''}';
  void _set(String key, dynamic value) => setState(() => _t[key] = value);

  static const _colors = [
    '#22bda7', '#6f57d9', '#1c1c1c', '#c89f65', '#a9807c', '#0973dc', '#444444',
  ];

  Future<void> _saveTemplate() async {
    final copy = !_isUser;
    final id = copy ? 'tpl-${DateTime.now().millisecondsSinceEpoch}' : _v('id');
    final name = _v('name').trim().isEmpty ? 'Untitled Template' : _v('name').trim();
    setState(() => _saving = true);
    try {
      await AccountSettingsApi.save('email-template', localId: id, name: name, data: {
        ..._t,
        'id': id,
        'name': copy && name == widget.template['name'] ? '$name Copy' : name,
        'source': 'user',
        if (copy) 'sourceTemplateId': widget.template['id'],
        'updatedAt': _today(),
      });
      AppToast.success(copy ? 'Saved as your template' : 'Template saved');
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final ok = await confirmAction(
      context,
      title: 'Delete template?',
      message: '"${_v('name')}" will be deleted.',
    );
    if (!ok) return;
    try {
      await AccountSettingsApi.delete('email-template', _v('id'));
      AppToast.success('Template deleted');
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final button = hexColor(_t['buttonColor'], const Color(0xFF22BDA7));
    return Scaffold(
      appBar: AppBar(
        title: Text(_isUser ? 'Edit template' : 'Ready-made template'),
        actions: [
          if (_isUser && !_isNew)
            IconButton(
              tooltip: 'Delete',
              onPressed: _delete,
              icon: const Icon(Icons.delete_outline_rounded),
            ),
          _save(_saving, _saveTemplate),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.white,
              border: Border.all(color: AppColors.galleryBorder),
            ),
            child: Column(
              children: [
                Text(_v('eyebrowText').toUpperCase(),
                    style: const TextStyle(
                        fontSize: 11, letterSpacing: 2, color: AppColors.galleryMeta)),
                const SizedBox(height: 10),
                Text(_v('title'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
                if (_t['showImage'] == true && _v('image').isNotEmpty) ...[
                  const SizedBox(height: 14),
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: AppNetworkImage(url: resolveImageUrl(_v('image'))),
                  ),
                ],
                const SizedBox(height: 14),
                Text(_v('message').isEmpty ? 'Your message to the client…' : _v('message'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(height: 1.5, color: AppColors.galleryMutedText)),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11),
                  color: button,
                  child: Text(_v('buttonText').toUpperCase(),
                      style: const TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2)),
                ),
                if (_v('footerText').isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(_v('footerText'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 11, color: AppColors.galleryMeta)),
                ],
              ],
            ),
          ),
          if (!_isUser)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text('Saving creates your own copy of this template.',
                  style: TextStyle(fontSize: 12, color: AppColors.galleryMeta)),
            ),
          _field('Template name', _v('name'), (v) => _set('name', v)),
          _field('Subject', _v('subject'), (v) => _set('subject', v),
              hint: 'Your photos are ready!'),
          _field('Preview text', _v('previewText'), (v) => _set('previewText', v)),
          _field('Small heading', _v('eyebrowText'), (v) => _set('eyebrowText', v)),
          _field('Title', _v('title'), (v) => _set('title', v)),
          _field('Message', _v('message'), (v) => _set('message', v), maxLines: 6),
          _field('Button text', _v('buttonText'), (v) => _set('buttonText', v)),
          _label('Button color'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 10,
              children: [
                for (final c in _colors)
                  GestureDetector(
                    onTap: () => _set('buttonColor', c),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: hexColor(c, Colors.black),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _v('buttonColor').toLowerCase() == c
                              ? AppColors.galleryText
                              : AppColors.galleryBorder,
                          width: _v('buttonColor').toLowerCase() == c ? 3 : 1,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          _switch('Show image', _t['showImage'] == true, (v) => _set('showImage', v)),
          _field('Footer', _v('footerText'), (v) => _set('footerText', v), maxLines: 2),
        ],
      ),
    );
  }
}

// ─────────────────────────── People (face recognition) ───────────────────────────

/// People found by face recognition across your galleries (rename them).
class PeoplePage extends StatefulWidget {
  const PeoplePage({super.key});

  @override
  State<PeoplePage> createState() => _PeoplePageState();
}

class _PeoplePageState extends State<PeoplePage> {
  final _items = <Map<String, dynamic>>[];
  var _page = 1;
  var _hasNext = false;
  var _loading = true;
  var _total = 0;
  var _search = '';
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) _page = 1;
    setState(() => _loading = true);
    try {
      final res = await DioHelper.dio.get('/face-identities', queryParameters: {
        'page': _page,
        'limit': 30,
        if (_search.trim().isNotEmpty) 'search': _search.trim(),
      });
      final data = Map<String, dynamic>.from((res.data as Map)['data'] as Map);
      final items = (data['items'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e));
      if (!mounted) return;
      setState(() {
        if (reset) _items.clear();
        _items.addAll(items);
        _hasNext = data['hasNext'] == true;
        _total = int.tryParse('${data['total'] ?? 0}') ?? 0;
      });
    } catch (e) {
      AppToast.error(ApiError.message(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _rename(Map<String, dynamic> person) async {
    final name = await promptText(
      context,
      title: 'Name this person',
      initial: '${person['name'] ?? ''}',
      hint: 'e.g. Sarah',
    );
    if (name == null || name.isEmpty) return;
    try {
      await DioHelper.dio.patch(
        '/face-identities/${Uri.encodeComponent('${person['identityKey']}')}',
        data: {'name': name},
      );
      setState(() => person['name'] = name);
      AppToast.success('Name saved');
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  Alignment _faceAlign(Map<String, dynamic> p) {
    final box = p['representativeBox'];
    if (box is! Map) return Alignment.center;
    double v(String k) => (num.tryParse('${box[k]}') ?? 0).toDouble();
    final cx = v('x') + v('width') / 2;
    final cy = v('y') + v('height') / 2;
    if (cx > 1 || cy > 1) return Alignment.center; // pixel boxes: keep centered
    return Alignment(cx * 2 - 1, cy * 2 - 1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('People${_total > 0 ? ' ($_total)' : ''}')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), () {
                  _search = v;
                  _load(reset: true);
                });
              },
              decoration: const InputDecoration(
                hintText: 'Search people',
                prefixIcon: Icon(Icons.search_rounded),
                isDense: true,
              ),
            ),
          ),
          Expanded(
            child: _items.isEmpty && !_loading
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text(
                        'No people found yet. Faces are detected automatically '
                        'as photos are processed.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.galleryMeta),
                      ),
                    ),
                  )
                : ListView.builder(
                    itemCount: _items.length + (_hasNext || _loading ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (i >= _items.length) {
                        return Padding(
                          padding: const EdgeInsets.all(20),
                          child: Center(
                            child: _loading
                                ? const CircularProgressIndicator()
                                : OutlinedButton(
                                    onPressed: () {
                                      _page++;
                                      _load();
                                    },
                                    child: const Text('Load more'),
                                  ),
                          ),
                        );
                      }
                      final p = _items[i];
                      final name = '${p['name'] ?? ''}'.trim();
                      final url = '${p['representativeUrl'] ?? ''}';
                      return ListTile(
                        leading: ClipOval(
                          child: SizedBox(
                            width: 48,
                            height: 48,
                            child: url.isEmpty
                                ? const ColoredBox(
                                    color: AppColors.galleryLavenderTint,
                                    child: Icon(Icons.person_outline_rounded,
                                        color: AppColors.galleryPurple),
                                  )
                                : AppNetworkImage(
                                    url: resolveImageUrl(url),
                                    alignment: _faceAlign(p),
                                    memCacheWidth: 200,
                                    allowSampleFallback: false,
                                  ),
                          ),
                        ),
                        title: Text(name.isEmpty ? 'Unnamed person' : name,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: name.isEmpty ? AppColors.galleryMeta : null,
                            )),
                        subtitle: Text(
                            '${p['imageCount'] ?? 0} photos · '
                            '${p['collectionCount'] ?? 0} galleries'),
                        trailing: const Icon(Icons.edit_outlined, size: 20),
                        onTap: () => _rename(p),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────── Integrations ───────────────────────────

/// Google Analytics 4 for your public galleries
/// (`/settings/integration`, localId "google-analytics").
class IntegrationsPage extends StatefulWidget {
  const IntegrationsPage({super.key});

  @override
  State<IntegrationsPage> createState() => _IntegrationsPageState();
}

class _IntegrationsPageState extends State<IntegrationsPage> {
  var _enabled = false;
  var _id = '';
  var _ready = false;
  var _saving = false;

  static final gaPattern = RegExp(r'^G-[A-Z0-9]+$');

  @override
  void initState() {
    super.initState();
    AccountSettingsApi.list('integration').then((records) {
      final ga = records.where((r) => r.localId == 'google-analytics');
      final data = ga.isEmpty ? const <String, dynamic>{} : ga.first.data;
      if (mounted) {
        setState(() {
          _enabled = data['enabled'] == true;
          _id = '${data['measurementId'] ?? ''}';
          _ready = true;
        });
      }
    }).catchError((Object e) {
      if (mounted) setState(() => _ready = true);
      AppToast.error(ApiError.message(e));
    });
  }

  Future<void> _saveGa() async {
    final id = _id.trim().toUpperCase();
    if (_enabled && !gaPattern.hasMatch(id)) {
      AppToast.error('Enter a valid GA4 Measurement ID like G-XXXXXXXXXX');
      return;
    }
    setState(() => _saving = true);
    try {
      await AccountSettingsApi.save('integration',
          localId: 'google-analytics',
          name: 'Google Analytics',
          data: {'enabled': _enabled, 'measurementId': id});
      AppToast.success('Google Analytics saved');
    } catch (e) {
      AppToast.error(ApiError.message(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Integrations'),
        actions: [_save(_saving, _ready ? _saveGa : null)],
      ),
      body: !_ready
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                Container(
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    border: Border.all(color: AppColors.galleryBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ListTile(
                        leading: Container(
                          width: 44,
                          height: 44,
                          color: const Color(0xFFFFF4DF),
                          child: const Icon(Icons.bar_chart_rounded,
                              color: Color(0xFFE37400)),
                        ),
                        title: const Text('Google Analytics',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: const Text('Track visits to your public galleries.'),
                      ),
                      _switch('Enabled', _enabled, (v) => setState(() => _enabled = v)),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        child: TextFormField(
                          initialValue: _id,
                          enabled: _enabled,
                          textCapitalization: TextCapitalization.characters,
                          onChanged: (v) => _id = v,
                          decoration: const InputDecoration(
                            labelText: 'Measurement ID',
                            hintText: 'G-XXXXXXXXXX',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
