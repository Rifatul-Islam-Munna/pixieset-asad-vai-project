import 'package:flutter/material.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/storage/session_storage.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/core/utils/sample_images.dart';
import 'package:gallerista/gallery/account_settings_api.dart';
import 'package:gallerista/gallery/collections_api.dart';
import 'package:gallerista/gallery/gallery_design.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/pages/settings_page.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Shared save button for settings app bars.
Widget _saveAction({required bool saving, required VoidCallback? onSave}) =>
    Padding(
      padding: const EdgeInsetsDirectional.only(end: 12),
      child: FilledButton(
        onPressed: saving ? null : onSave,
        style: FilledButton.styleFrom(minimumSize: const Size(72, 38)),
        child: Text(saving ? 'Saving…' : 'Save'),
      ),
    );

Widget _label(String text) => Padding(
  padding: const EdgeInsets.fromLTRB(16, 22, 16, 8),
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

Widget _choices(
  Map<String, String> options,
  String value,
  ValueChanged<String> onChanged,
) => Padding(
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

String _hex(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

// ─────────────────────────── Branding ───────────────────────────

/// Branding (`/settings/branding`, localId "branding"): logo, brand text,
/// accent color and where the brand shows in emails.
class BrandingPage extends StatefulWidget {
  const BrandingPage({super.key});

  @override
  State<BrandingPage> createState() => _BrandingPageState();
}

class _BrandingPageState extends State<BrandingPage> {
  Map<String, dynamic>? _form;
  var _saving = false;

  static const _accents = [
    Color(0xFF22BDA7), Color(0xFF6F57D9), Color(0xFF1C1C1C), Color(0xFFC89F65),
    Color(0xFFA9807C), Color(0xFF96977A), Color(0xFF0973DC), Color(0xFFE7000B),
  ];

  @override
  void initState() {
    super.initState();
    AccountSettingsApi.single('branding').then((data) {
      final user = SessionStorage.getUser();
      if (mounted) {
        setState(() => _form = {
          'brandText': user?.businessName ?? user?.name ?? '',
          'brandingPosition': 'top',
          ...?data,
        });
      }
    }).catchError((Object e) {
      if (mounted) setState(() => _form = {'brandingPosition': 'top'});
      AppToast.error(ApiError.message(e));
    });
  }

  void _set(String key, dynamic value) => setState(() => _form![key] = value);

  Future<void> _pickLogo() async {
    try {
      final url = await pickImageAsDataUrl();
      if (url != null) _set('logoUrl', url);
    } catch (e) {
      AppToast.error(e is StateError ? e.message : ApiError.message(e));
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await AccountSettingsApi.save(
        'branding',
        localId: 'branding',
        name: 'Branding',
        data: _form!,
      );
      AppToast.success('Branding saved');
    } catch (e) {
      AppToast.error(ApiError.message(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final form = _form;
    final accent = hexColor(form?['accentColor'], AppColors.galleryPurple);
    final logo = '${form?['logoUrl'] ?? ''}';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Branding'),
        actions: [_saveAction(saving: _saving, onSave: form == null ? null : _save)],
      ),
      body: form == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.only(bottom: 40),
              children: [
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    border: Border.all(color: AppColors.galleryBorder),
                  ),
                  child: Column(
                    children: [
                      SizedBox(
                        height: 56,
                        child: logo.isEmpty
                            ? Text('${form['brandText'] ?? ''}',
                                style: const TextStyle(
                                    fontSize: 22, fontWeight: FontWeight.w700))
                            : SettingImage(logo),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 10),
                        color: accent,
                        child: const Text('OPEN GALLERY',
                            style: TextStyle(
                                color: AppColors.white,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.5)),
                      ),
                      const SizedBox(height: 8),
                      const Text('Email preview',
                          style: TextStyle(fontSize: 11, color: AppColors.galleryMeta)),
                    ],
                  ),
                ),
                _label('Logo'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: _pickLogo,
                        icon: const Icon(Icons.upload_rounded, size: 18),
                        label: Text(logo.isEmpty ? 'Upload logo' : 'Replace logo'),
                      ),
                      if (logo.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: () => _set('logoUrl', ''),
                          child: const Text('Remove'),
                        ),
                      ],
                    ],
                  ),
                ),
                _label('Brand name'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TextFormField(
                    initialValue: '${form['brandText'] ?? ''}',
                    onChanged: (v) => _set('brandText', v),
                    decoration: const InputDecoration(hintText: 'Your studio name'),
                  ),
                ),
                _label('Accent color'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final c in _accents)
                        Semantics(
                          button: true,
                          selected: _hex(c) == _hex(accent),
                          label: 'Accent ${_hex(c)}',
                          child: GestureDetector(
                            onTap: () => _set('accentColor', _hex(c)),
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: c,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: _hex(c) == _hex(accent)
                                      ? AppColors.galleryText
                                      : AppColors.galleryBorder,
                                  width: _hex(c) == _hex(accent) ? 3 : 1,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                _label('Brand position in emails'),
                _choices(
                  const {'top': 'Top', 'bottom': 'Bottom'},
                  '${form['brandingPosition'] ?? 'top'}',
                  (v) => _set('brandingPosition', v),
                ),
              ],
            ),
    );
  }
}

// ─────────────────────────── Preferences ───────────────────────────

/// Preferences (`/settings/preference`, localId "preferences").
class PreferencesPage extends StatefulWidget {
  const PreferencesPage({super.key});

  @override
  State<PreferencesPage> createState() => _PreferencesPageState();
}

class _PreferencesPageState extends State<PreferencesPage> {
  static const _defaults = <String, dynamic>{
    'defaultLanguage': 'English',
    'filenameDisplay': 'show',
    'searchEngineVisibility': 'homepage',
    'sharpeningLevel': 'optimal',
    'rawPhotoSupport': false,
    'termsOfService': '',
    'privacyPolicy': '',
  };
  static const _languages = [
    'English', 'Spanish', 'French', 'German', 'Greek', 'Arabic',
  ];

  Map<String, dynamic>? _form;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    AccountSettingsApi.single('preference').then((data) {
      if (mounted) setState(() => _form = {..._defaults, ...?data});
    }).catchError((Object e) {
      if (mounted) setState(() => _form = {..._defaults});
      AppToast.error(ApiError.message(e));
    });
  }

  void _set(String key, dynamic value) => setState(() => _form![key] = value);

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await AccountSettingsApi.save(
        'preference',
        localId: 'preferences',
        name: 'Preferences',
        data: _form!,
      );
      AppToast.success('Preferences saved');
    } catch (e) {
      AppToast.error(ApiError.message(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final f = _form;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Preferences'),
        actions: [_saveAction(saving: _saving, onSave: f == null ? null : _save)],
      ),
      body: f == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.only(bottom: 40),
              children: [
                _label('Default gallery language'),
                _choices({for (final l in _languages) l: l},
                    '${f['defaultLanguage']}', (v) => _set('defaultLanguage', v)),
                _label('Filename display'),
                _choices(const {'show': 'Show', 'hide': 'Hide'},
                    '${f['filenameDisplay']}', (v) => _set('filenameDisplay', v)),
                _label('Search engine visibility'),
                _choices(
                  const {
                    'homepage': 'Homepage only',
                    'all': 'All galleries',
                    'hidden': 'Hidden',
                  },
                  '${f['searchEngineVisibility']}',
                  (v) => _set('searchEngineVisibility', v),
                ),
                _label('Sharpening level'),
                _choices(const {'optimal': 'Optimal', 'low': 'Low', 'high': 'High'},
                    '${f['sharpeningLevel']}', (v) => _set('sharpeningLevel', v)),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: const Text('RAW photo support',
                      style: TextStyle(fontWeight: FontWeight.w500)),
                  value: f['rawPhotoSupport'] == true,
                  activeTrackColor: AppColors.galleryPurple,
                  onChanged: (v) => _set('rawPhotoSupport', v),
                ),
                _label('Terms of service'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TextFormField(
                    initialValue: '${f['termsOfService']}',
                    maxLines: 4,
                    onChanged: (v) => _set('termsOfService', v),
                  ),
                ),
                _label('Privacy policy'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TextFormField(
                    initialValue: '${f['privacyPolicy']}',
                    maxLines: 4,
                    onChanged: (v) => _set('privacyPolicy', v),
                  ),
                ),
              ],
            ),
    );
  }
}

// ─────────────────────────── Watermarks ───────────────────────────

const watermarkFonts = [
  'Times New Roman', 'Georgia', 'Playfair Display', 'Helvetica', 'Arial',
  'Courier New',
];

/// New text watermark, same defaults as the web `addWatermarkDraft`.
Map<String, dynamic> newWatermark() => {
  'id': 'wm-${DateTime.now().millisecondsSinceEpoch}',
  'name': 'Untitled text watermark',
  'type': 'text',
  'text': '',
  'font': 'Times New Roman',
  'color': '#ffffff',
  'scale': 42,
  'opacity': 90,
  'position': {'x': 15, 'y': 85},
  'image': '',
  'applyDownloads': false,
};

/// Saved watermarks (`/settings/watermark`).
class WatermarksPage extends StatefulWidget {
  const WatermarksPage({super.key});

  @override
  State<WatermarksPage> createState() => _WatermarksPageState();
}

class _WatermarksPageState extends State<WatermarksPage> {
  List<SettingRecord>? _items;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await AccountSettingsApi.list('watermark');
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) setState(() => _items = const []);
      AppToast.error(ApiError.message(e));
    }
  }

  Future<void> _edit(Map<String, dynamic> data, {required bool isNew}) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => WatermarkEditorPage(initial: data, isNew: isNew),
      ),
    );
    if (changed == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: const Text('Watermark')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(newWatermark(), isNew: true),
        backgroundColor: AppColors.galleryPrimary,
        foregroundColor: AppColors.white,
        shape: const RoundedRectangleBorder(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Watermark'),
      ),
      body: items == null
          ? const Center(child: CircularProgressIndicator())
          : items.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'No watermarks yet.\nCreate one to protect your photos.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF666666)),
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.only(bottom: 96),
              itemCount: items.length,
              separatorBuilder: (_, _) => const Divider(),
              itemBuilder: (_, i) {
                final d = items[i].data;
                final isText = d['type'] != 'image';
                return ListTile(
                  leading: Container(
                    width: 56,
                    height: 40,
                    color: const Color(0xFF333333),
                    alignment: Alignment.center,
                    child: isText
                        ? Text(
                            '${d['text'] ?? ''}'.isEmpty ? 'Aa' : '${d['text']}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: '${d['font'] ?? ''}',
                              color: hexColor(d['color'], AppColors.white),
                              fontSize: 12,
                            ),
                          )
                        : SettingImage('${d['image'] ?? ''}'),
                  ),
                  title: Text(items[i].name,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(isText ? 'Text watermark' : 'Image watermark'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => _edit({...newWatermark(), ...d,
                      'id': d['id'] ?? items[i].localId}, isNew: false),
                );
              },
            ),
    );
  }
}

/// Watermark editor with a live preview on one of your photos: drag or tap
/// to place it, like the web editor.
class WatermarkEditorPage extends StatefulWidget {
  const WatermarkEditorPage({
    super.key,
    required this.initial,
    required this.isNew,
  });

  final Map<String, dynamic> initial;
  final bool isNew;

  @override
  State<WatermarkEditorPage> createState() => _WatermarkEditorPageState();
}

class _WatermarkEditorPageState extends State<WatermarkEditorPage> {
  late final Map<String, dynamic> _w = {
    ...widget.initial,
    'position': Map<String, dynamic>.from(widget.initial['position'] as Map),
  };
  String _sample = '';
  var _saving = false;

  bool get _isText => _w['type'] != 'image';

  @override
  void initState() {
    super.initState();
    CollectionsApi.allImages().then((images) {
      if (mounted && images.isNotEmpty) {
        setState(() => _sample = images.first.viewerUrl);
      }
    }).catchError((_) {});
  }

  void _set(String key, dynamic value) => setState(() => _w[key] = value);

  void _place(Offset local, Size size) => setState(() {
    _w['position'] = {
      'x': (local.dx / size.width * 100).clamp(5, 95).round(),
      'y': (local.dy / size.height * 100).clamp(5, 95).round(),
    };
  });

  Future<void> _save() async {
    if (_isText && '${_w['text'] ?? ''}'.trim().isEmpty) {
      AppToast.error('Enter the watermark text.');
      return;
    }
    final name = _isText
        ? '${'${_w['text']}'.trim()} text watermark'
        : 'Image watermark';
    setState(() => _saving = true);
    try {
      await AccountSettingsApi.save(
        'watermark',
        localId: '${_w['id']}',
        name: name,
        data: {..._w, 'name': name},
      );
      AppToast.success('Watermark saved');
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
      title: 'Delete watermark?',
      message: 'Galleries using it will stop showing this watermark.',
    );
    if (!ok) return;
    try {
      await AccountSettingsApi.delete('watermark', '${_w['id']}');
      AppToast.success('Watermark deleted');
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final pos = _w['position'] as Map;
    final scale = (num.tryParse('${_w['scale']}') ?? 42).toDouble();
    final opacity = (num.tryParse('${_w['opacity']}') ?? 90).toDouble();
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isNew ? 'New Watermark' : 'Edit Watermark'),
        actions: [
          if (!widget.isNew)
            IconButton(
              tooltip: 'Delete',
              onPressed: _delete,
              icon: const Icon(Icons.delete_outline_rounded),
            ),
          _saveAction(saving: _saving, onSave: _save),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          AspectRatio(
            aspectRatio: 3 / 2,
            child: LayoutBuilder(builder: (context, box) {
              final size = box.biggest;
              return GestureDetector(
                onTapDown: (d) => _place(d.localPosition, size),
                onPanUpdate: (d) => _place(d.localPosition, size),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: AppNetworkImage(
                        url: _sample,
                        fallbackAsset: SampleImages.watermarkPreview,
                      ),
                    ),
                    Positioned(
                      left: size.width * (num.tryParse('${pos['x']}') ?? 15) / 100,
                      top: size.height * (num.tryParse('${pos['y']}') ?? 85) / 100,
                      child: FractionalTranslation(
                        translation: const Offset(-.5, -.5),
                        child: Opacity(
                          opacity: (opacity / 100).clamp(0, 1),
                          child: _isText
                              ? Text(
                                  '${_w['text'] ?? ''}'.isEmpty
                                      ? 'Your Studio'
                                      : '${_w['text']}',
                                  style: TextStyle(
                                    fontFamily: '${_w['font']}',
                                    color: hexColor(_w['color'], AppColors.white),
                                    fontSize: size.width * scale / 100 * .12,
                                  ),
                                )
                              : SizedBox(
                                  width: size.width * scale / 100 * .5,
                                  child: SettingImage('${_w['image'] ?? ''}'),
                                ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text('Tap or drag on the photo to place the watermark',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: AppColors.galleryMeta)),
          ),
          if (_isText) ...[
            _label('Text'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextFormField(
                initialValue: '${_w['text'] ?? ''}',
                onChanged: (v) => _set('text', v),
                decoration: const InputDecoration(hintText: '© Your Studio'),
              ),
            ),
            _label('Font'),
            _choices({for (final f in watermarkFonts) f: f}, '${_w['font']}',
                (v) => _set('font', v)),
            _label('Color'),
            _choices(const {'#ffffff': 'White', '#000000': 'Black', '#9ca3af': 'Gray'},
                '${_w['color']}'.toLowerCase(), (v) => _set('color', v)),
          ] else
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Text(
                'Image watermarks are uploaded on the web. You can adjust '
                'size, opacity and position here.',
                style: TextStyle(fontSize: 12, color: AppColors.galleryMeta),
              ),
            ),
          _label('Size  ${scale.round()}%'),
          Slider(
            value: scale.clamp(5, 100),
            min: 5,
            max: 100,
            activeColor: AppColors.galleryPurple,
            onChanged: (v) => _set('scale', v.round()),
          ),
          _label('Opacity  ${opacity.round()}%'),
          Slider(
            value: opacity.clamp(5, 100),
            min: 5,
            max: 100,
            activeColor: AppColors.galleryPurple,
            onChanged: (v) => _set('opacity', v.round()),
          ),
          SwitchListTile(
            title: const Text('Apply to downloads',
                style: TextStyle(fontWeight: FontWeight.w500)),
            subtitle: const Text('Also watermark photos clients download.'),
            value: _w['applyDownloads'] == true,
            activeTrackColor: AppColors.galleryPurple,
            onChanged: (v) => _set('applyDownloads', v),
          ),
        ],
      ),
    );
  }
}
