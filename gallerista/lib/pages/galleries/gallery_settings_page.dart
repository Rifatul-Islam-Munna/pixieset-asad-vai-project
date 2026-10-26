import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Web defaults (client-dashboard.tsx: collectionDefaultGeneral & co.).
const _defaults = <String, Map<String, dynamic>>{
  'general': {
    'emailRegistration': false,
    'marketingSubscription': true,
    'galleryAssist': false,
    'slideshow': true,
    'slideshowSpeed': 'regular',
    'slideshowAutoLoop': true,
    'socialSharing': true,
    'filenameDisplay': 'hide',
    'mobileOnly': false,
  },
  'download': {
    'photoDownload': true,
    'galleryDownload': true,
    'singlePhotoDownload': true,
    'highResolution': true,
    'highResolutionSize': '3600px',
    'webSize': true,
    'webSizePx': '1024px',
    'videoDownload': false,
    'downloadPin': false,
    'downloadPinCode': '1234',
    'limitDownloads': false,
  },
  'favorite': {
    'favoritePhotos': true,
    'favoriteNotes': true,
    'maxFavorites': '',
    'description': '',
  },
  'store': {
    'storeStatus': false,
    'productPreview': false,
    'showBuyPhotoButton': true,
  },
  'access': {'pinEnabled': false, 'pinCode': ''},
};

/// Gallery settings, mirroring the web settings panels:
/// General, Privacy, Download, Favorites and Store.
@RoutePage()
class GallerySettingsPage extends StatefulWidget {
  const GallerySettingsPage({
    super.key,
    @PathParam('collectionId') required this.collectionId,
  });

  final String collectionId;

  @override
  State<GallerySettingsPage> createState() => _GallerySettingsPageState();
}

class _GallerySettingsPageState extends State<GallerySettingsPage> {
  Map<String, dynamic>? _raw;
  final _top = <String, dynamic>{}; // changed top-level fields
  final _changed = <String, Map<String, dynamic>>{}; // changed settings keys
  var _saving = false;
  String? _error;

  bool get _dirty => _top.isNotEmpty || _changed.isNotEmpty;

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

  Map<String, dynamic> _stored(String group) {
    final settings = _raw?['settings'];
    final value = settings is Map ? settings[group] : null;
    return value is Map ? Map<String, dynamic>.from(value) : {};
  }

  dynamic _get(String group, String key) =>
      _changed[group]?[key] ?? _stored(group)[key] ?? _defaults[group]?[key];

  bool _bool(String group, String key) => _get(group, key) == true;
  String _str(String group, String key) => '${_get(group, key) ?? ''}';

  void _set(String group, String key, dynamic value) =>
      setState(() => (_changed[group] ??= {})[key] = value);

  dynamic _topValue(String key) =>
      _top.containsKey(key) ? _top[key] : _raw?[key];

  void _setTop(String key, dynamic value) => setState(() => _top[key] = value);

  Future<void> _save() async {
    final raw = _raw;
    if (raw == null) return;
    setState(() => _saving = true);
    final settings = Map<String, dynamic>.from(
      raw['settings'] is Map ? raw['settings'] as Map : const {},
    );
    for (final entry in _changed.entries) {
      settings[entry.key] = {..._stored(entry.key), ...entry.value};
    }
    try {
      final res = await DioHelper.dio.patch(
        '/collections/${widget.collectionId}',
        data: {
          ..._top,
          if (_changed.isNotEmpty) 'settings': settings,
        },
      );
      final data = (res.data as Map)['data'];
      setState(() {
        if (data is Map) _raw = Map<String, dynamic>.from(data);
        _top.clear();
        _changed.clear();
      });
      AppToast.success('Settings saved');
    } catch (e) {
      AppToast.error(ApiError.message(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDate(String key) async {
    final current = DateTime.tryParse('${_topValue(key) ?? ''}');
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: DateTime(now.year - 30),
      lastDate: DateTime(now.year + 10),
    );
    if (picked != null) {
      _setTop(key, picked.toIso8601String().split('T').first);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await confirmAction(
          context,
          title: 'Discard changes?',
          message: 'You have unsaved gallery settings.',
          confirmLabel: 'Discard',
        );
        if (leave && context.mounted) {
          setState(() {
            _top.clear();
            _changed.clear();
          });
          Navigator.of(context).pop();
        }
      },
      child: DefaultTabController(
        length: 5,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Gallery Settings'),
            actions: [
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 12),
                child: FilledButton(
                  onPressed: _dirty && !_saving ? _save : null,
                  style: FilledButton.styleFrom(minimumSize: const Size(72, 38)),
                  child: Text(_saving ? 'Saving…' : 'Save'),
                ),
              ),
            ],
            bottom: const TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [
                Tab(text: 'General'),
                Tab(text: 'Privacy'),
                Tab(text: 'Download'),
                Tab(text: 'Favorites'),
                Tab(text: 'Store'),
              ],
            ),
          ),
          body: _raw == null
              ? Center(
                  child: _error == null
                      ? const CircularProgressIndicator()
                      : Text(_error!),
                )
              : TabBarView(
                  children: [
                    _general(),
                    _privacy(),
                    _download(),
                    _favorites(),
                    _store(),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _general() {
    final expires = DateTime.tryParse('${_topValue('expiresAt') ?? ''}');
    final event = DateTime.tryParse('${_topValue('eventDate') ?? ''}');
    final tags = _topValue('tags');
    final emails = _topValue('clientEmails');
    return _Tab(children: [
      _Section('Gallery'),
      _TextRow(
        label: 'Gallery name',
        initial: '${_topValue('name') ?? ''}',
        onChanged: (v) => _setTop('name', v.trim()),
      ),
      _TextRow(
        label: 'Gallery URL',
        hint: 'jessica-and-michael',
        initial: '${_topValue('slug') ?? ''}',
        onChanged: (v) => _setTop('slug', v.trim()),
      ),
      _TapRow(
        label: 'Event date',
        value: event == null ? 'Not set' : formatDate(event),
        onTap: () => _pickDate('eventDate'),
      ),
      _TapRow(
        label: 'Expiry date',
        value: expires == null ? 'Never expires' : formatDate(expires),
        onTap: () => _pickDate('expiresAt'),
        onClear: expires == null ? null : () => _setTop('expiresAt', null),
      ),
      _TextRow(
        label: 'Tags',
        hint: 'wedding, 2026',
        initial: tags is List ? tags.join(', ') : '',
        onChanged: (v) => _setTop('tags', _list(v)),
      ),
      _TextRow(
        label: 'Client emails',
        hint: 'client@example.com, partner@example.com',
        initial: emails is List ? emails.join(', ') : '',
        keyboardType: TextInputType.emailAddress,
        onChanged: (v) => _setTop('clientEmails', _list(v)),
      ),
      _SwitchRow(
        title: 'Show on homepage',
        value: _topValue('showOnHomepage') != false,
        onChanged: (v) => _setTop('showOnHomepage', v),
      ),
      _SwitchRow(
        title: 'Mobile only',
        subtitle: 'Clients can only open this gallery in the Gallerista app '
            'by scanning its QR code. The website will not show it, and '
            'the app blocks screenshots and screen recording.',
        value: _bool('general', 'mobileOnly'),
        onChanged: (v) => _set('general', 'mobileOnly', v),
      ),
      _Section('Gallery experience'),
      _SwitchRow(
        title: 'Slideshow',
        subtitle: 'Let clients play the gallery as a slideshow.',
        value: _bool('general', 'slideshow'),
        onChanged: (v) => _set('general', 'slideshow', v),
      ),
      if (_bool('general', 'slideshow')) ...[
        _ChoiceRow(
          label: 'Slideshow speed',
          value: _str('general', 'slideshowSpeed'),
          options: const {'slow': 'Slow', 'regular': 'Regular', 'fast': 'Fast'},
          onChanged: (v) => _set('general', 'slideshowSpeed', v),
        ),
        _SwitchRow(
          title: 'Auto loop slideshow',
          value: _bool('general', 'slideshowAutoLoop'),
          onChanged: (v) => _set('general', 'slideshowAutoLoop', v),
        ),
      ],
      _SwitchRow(
        title: 'Social sharing',
        subtitle: 'Show share buttons to visitors.',
        value: _bool('general', 'socialSharing'),
        onChanged: (v) => _set('general', 'socialSharing', v),
      ),
      _SwitchRow(
        title: 'Show filenames',
        value: _str('general', 'filenameDisplay') == 'show',
        onChanged: (v) =>
            _set('general', 'filenameDisplay', v ? 'show' : 'hide'),
      ),
      _SwitchRow(
        title: 'Gallery assist',
        subtitle: 'Guide clients through favorites and downloads.',
        value: _bool('general', 'galleryAssist'),
        onChanged: (v) => _set('general', 'galleryAssist', v),
      ),
    ]);
  }

  Widget _privacy() {
    final pinOn = _bool('access', 'pinEnabled');
    final emailOn = _bool('general', 'emailRegistration');
    return _Tab(children: [
      _Section('Gallery access'),
      _SwitchRow(
        title: 'Gallery PIN',
        subtitle: 'Visitors must enter a PIN to open the gallery.',
        value: pinOn,
        onChanged: (v) {
          _set('access', 'pinEnabled', v);
          if (v) _set('general', 'emailRegistration', false);
        },
      ),
      if (pinOn)
        _TextRow(
          label: 'PIN code',
          hint: '4–6 digits',
          initial: _str('access', 'pinCode'),
          keyboardType: TextInputType.number,
          digitsOnly: true,
          onChanged: (v) => _set('access', 'pinCode', v),
        ),
      _SwitchRow(
        title: 'Email registration',
        subtitle: 'Ask visitors for their email before viewing.',
        value: emailOn,
        onChanged: (v) {
          // Same rule as the web: email access turns the PIN off.
          _set('general', 'emailRegistration', v);
          if (v) _set('access', 'pinEnabled', false);
        },
      ),
      if (emailOn)
        _SwitchRow(
          title: 'Marketing subscription',
          subtitle: 'Offer an opt-in to your marketing emails.',
          value: _bool('general', 'marketingSubscription'),
          onChanged: (v) => _set('general', 'marketingSubscription', v),
        ),
    ]);
  }

  Widget _download() {
    final on = _bool('download', 'photoDownload');
    return _Tab(children: [
      _Section('Downloads'),
      _SwitchRow(
        title: 'Photo download',
        subtitle: 'Allow clients to download photos.',
        value: on,
        onChanged: (v) => _set('download', 'photoDownload', v),
      ),
      if (on) ...[
        _SwitchRow(
          title: 'Download all',
          subtitle: 'Let clients download the whole gallery.',
          value: _bool('download', 'galleryDownload'),
          onChanged: (v) => _set('download', 'galleryDownload', v),
        ),
        _SwitchRow(
          title: 'Single photo download',
          value: _bool('download', 'singlePhotoDownload'),
          onChanged: (v) => _set('download', 'singlePhotoDownload', v),
        ),
        _SwitchRow(
          title: 'High resolution',
          value: _bool('download', 'highResolution'),
          onChanged: (v) => _set('download', 'highResolution', v),
        ),
        if (_bool('download', 'highResolution'))
          _ChoiceRow(
            label: 'High resolution size',
            value: _str('download', 'highResolutionSize'),
            options: const {'Original': 'Original', '3600px': '3600px'},
            onChanged: (v) => _set('download', 'highResolutionSize', v),
          ),
        _SwitchRow(
          title: 'Web size',
          value: _bool('download', 'webSize'),
          onChanged: (v) => _set('download', 'webSize', v),
        ),
        if (_bool('download', 'webSize'))
          _ChoiceRow(
            label: 'Web size',
            value: _str('download', 'webSizePx'),
            options: const {
              '2048px': '2048px',
              '1024px': '1024px',
              '640px': '640px',
            },
            onChanged: (v) => _set('download', 'webSizePx', v),
          ),
        _SwitchRow(
          title: 'Video download',
          value: _bool('download', 'videoDownload'),
          onChanged: (v) => _set('download', 'videoDownload', v),
        ),
        _SwitchRow(
          title: 'Download PIN',
          subtitle: 'Require a PIN before downloading.',
          value: _bool('download', 'downloadPin'),
          onChanged: (v) => _set('download', 'downloadPin', v),
        ),
        if (_bool('download', 'downloadPin'))
          _TextRow(
            label: 'Download PIN code',
            initial: _str('download', 'downloadPinCode'),
            keyboardType: TextInputType.number,
            digitsOnly: true,
            onChanged: (v) => _set('download', 'downloadPinCode', v),
          ),
        _SwitchRow(
          title: 'Limit downloads',
          value: _bool('download', 'limitDownloads'),
          onChanged: (v) => _set('download', 'limitDownloads', v),
        ),
      ],
    ]);
  }

  Widget _favorites() {
    return _Tab(children: [
      _Section('Favorites'),
      _SwitchRow(
        title: 'Favorite photos',
        subtitle: 'Clients can heart photos and build favorite lists.',
        value: _bool('favorite', 'favoritePhotos'),
        onChanged: (v) => _set('favorite', 'favoritePhotos', v),
      ),
      if (_bool('favorite', 'favoritePhotos')) ...[
        _SwitchRow(
          title: 'Favorite notes',
          subtitle: 'Clients can add a note to each favorite.',
          value: _bool('favorite', 'favoriteNotes'),
          onChanged: (v) => _set('favorite', 'favoriteNotes', v),
        ),
        _TextRow(
          label: 'Maximum favorites',
          hint: 'Leave empty for unlimited',
          initial: _str('favorite', 'maxFavorites'),
          keyboardType: TextInputType.number,
          digitsOnly: true,
          onChanged: (v) => _set('favorite', 'maxFavorites', v),
        ),
        _TextRow(
          label: 'Instructions for clients',
          hint: 'e.g. Choose your 40 favorite photos for the album.',
          initial: _str('favorite', 'description'),
          maxLines: 3,
          onChanged: (v) => _set('favorite', 'description', v),
        ),
      ],
    ]);
  }

  Widget _store() {
    return _Tab(children: [
      _Section('Print store'),
      _SwitchRow(
        title: 'Store',
        subtitle: 'Sell prints and downloads from this gallery.',
        value: _bool('store', 'storeStatus'),
        onChanged: (v) => _set('store', 'storeStatus', v),
      ),
      if (_bool('store', 'storeStatus')) ...[
        _SwitchRow(
          title: 'Product preview',
          value: _bool('store', 'productPreview'),
          onChanged: (v) => _set('store', 'productPreview', v),
        ),
        _SwitchRow(
          title: '"Buy photo" button',
          value: _bool('store', 'showBuyPhotoButton'),
          onChanged: (v) => _set('store', 'showBuyPhotoButton', v),
        ),
      ],
      const Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
        child: Text(
          'Price sheets are managed in Store Gallery on the web.',
          style: TextStyle(fontSize: 12, color: AppColors.galleryMeta),
        ),
      ),
    ]);
  }

  static List<String> _list(String value) => value
      .split(',')
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .toList();
}

class _Tab extends StatelessWidget {
  const _Tab({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) =>
      ListView(padding: const EdgeInsets.only(bottom: 48), children: children);
}

class _Section extends StatelessWidget {
  const _Section(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 12,
          letterSpacing: 1.2,
          fontWeight: FontWeight.w700,
          color: AppColors.galleryMeta,
        ),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!,
              style: const TextStyle(fontSize: 12, color: AppColors.galleryMeta)),
      value: value,
      activeThumbColor: AppColors.white,
      activeTrackColor: AppColors.galleryPurple,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      onChanged: onChanged,
    );
  }
}

class _TextRow extends StatelessWidget {
  const _TextRow({
    required this.label,
    required this.initial,
    required this.onChanged,
    this.hint,
    this.keyboardType,
    this.digitsOnly = false,
    this.maxLines = 1,
  });

  final String label;
  final String initial;
  final String? hint;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;
  final bool digitsOnly;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      child: TextFormField(
        initialValue: initial,
        onChanged: onChanged,
        keyboardType: keyboardType,
        maxLines: maxLines,
        inputFormatters: [
          if (digitsOnly) FilteringTextInputFormatter.digitsOnly,
        ],
        decoration: InputDecoration(labelText: label, hintText: hint),
      ),
    );
  }
}

class _TapRow extends StatelessWidget {
  const _TapRow({
    required this.label,
    required this.value,
    required this.onTap,
    this.onClear,
  });

  final String label;
  final String value;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle: Text(value),
      onTap: onTap,
      trailing: onClear == null
          ? const Icon(Icons.event_outlined)
          : IconButton(
              tooltip: 'Clear',
              onPressed: onClear,
              icon: const Icon(Icons.close_rounded),
            ),
    );
  }
}

class _ChoiceRow extends StatelessWidget {
  const _ChoiceRow({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String value;
  final Map<String, String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 13, color: AppColors.galleryMeta)),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: [
              for (final e in options.entries)
                ButtonSegment(value: e.key, label: Text(e.value)),
            ],
            selected: {options.containsKey(value) ? value : options.keys.first},
            showSelectedIcon: false,
            onSelectionChanged: (v) => onChanged(v.first),
          ),
        ],
      ),
    );
  }
}
