import 'dart:convert';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/core/utils/share_origin.dart';
import 'package:gallerista/gallery/collection_activity.dart';
import 'package:gallerista/pages/galleries/favorite_list_sheet.dart';
import 'package:gallerista/pages/galleries/gallery_dialogs.dart';
import 'package:gallerista/theme/app_theme.dart';
import 'package:share_plus/share_plus.dart';

/// Client activity for one gallery: favorites, downloads, email
/// registrations and private-photo requests.
@RoutePage()
class GalleryActivityPage extends StatefulWidget {
  const GalleryActivityPage({
    super.key,
    @PathParam('collectionId') required this.collectionId,
    this.galleryName = '',
  });

  final String collectionId;
  final String galleryName;

  @override
  State<GalleryActivityPage> createState() => _GalleryActivityPageState();
}

class _GalleryActivityPageState extends State<GalleryActivityPage> {
  CollectionActivity? _activity;
  String? _error;

  String get _id => widget.collectionId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final activity = await ActivityApi.load(_id);
      if (!mounted) return;
      setState(() {
        _activity = activity;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    }
  }

  Future<void> _exportCsv(String name, List<List<String>> rows) async {
    final bytes = utf8.encode(toCsv(rows));
    final fileName = '${_slug(widget.galleryName)}-$name.csv';
    await SharePlus.instance.share(
      ShareParams(
        sharePositionOrigin: shareOrigin(context),
        files: [XFile.fromData(bytes, mimeType: 'text/csv', name: fileName)],
        fileNameOverrides: [fileName],
        subject: '${widget.galleryName} – $name',
      ),
    );
  }

  static String _slug(String v) {
    final s = v.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-');
    return s.replaceAll(RegExp(r'^-|-$'), '').isEmpty ? 'gallery' : s;
  }

  static String _day(DateTime? d) =>
      d == null ? '' : d.toIso8601String().split('T').first;

  @override
  Widget build(BuildContext context) {
    final a = _activity;
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Activity'),
              if (widget.galleryName.isNotEmpty)
                Text(widget.galleryName,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.galleryMeta)),
            ],
          ),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: 'Favorites (${a?.favorites.length ?? 0})'),
              Tab(text: 'Downloads (${a?.downloads.length ?? 0})'),
              Tab(text: 'Registrations (${a?.registrations.length ?? 0})'),
              Tab(text: 'Private (${a?.privatePhotos.length ?? 0})'),
            ],
          ),
        ),
        body: a == null
            ? Center(
                child: _error == null
                    ? const CircularProgressIndicator()
                    : Text(_error!, textAlign: TextAlign.center),
              )
            : TabBarView(
                children: [
                  _favorites(a.favorites),
                  _downloads(a.downloads),
                  _registrations(a.registrations),
                  _privatePhotos(a.privatePhotos),
                ],
              ),
      ),
    );
  }

  Widget _list({
    required int count,
    required IconData emptyIcon,
    required String emptyText,
    required List<Widget> header,
    required Widget Function(int) item,
  }) {
    return RefreshIndicator(
      color: AppColors.galleryPrimary,
      onRefresh: _load,
      child: count == 0
          ? ListView(
              children: [
                const SizedBox(height: 120),
                Icon(emptyIcon, size: 40, color: const Color(0xFF999999)),
                const SizedBox(height: 16),
                Text(emptyText,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFF666666))),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.only(bottom: 40),
              itemCount: count + 1,
              separatorBuilder: (_, i) =>
                  i == 0 ? const SizedBox.shrink() : const Divider(),
              itemBuilder: (_, i) => i == 0
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                      child: Wrap(spacing: 8, runSpacing: 8, children: header),
                    )
                  : item(i - 1),
            ),
    );
  }

  Widget _favorites(List<FavoriteList> lists) => _list(
    count: lists.length,
    emptyIcon: Icons.favorite_border_rounded,
    emptyText: 'No favorite lists yet.\nClients\' favorites will appear here.',
    header: [
      OutlinedButton.icon(
        onPressed: () => _exportCsv('favorites', [
          ['Email', 'Favorite List', 'Photos', 'Filenames', 'Updated'],
          for (final l in lists)
            [l.email, l.name, '${l.photos}', l.filenames.join(' '), _day(l.updatedAt)],
        ]),
        icon: const Icon(Icons.file_upload_outlined, size: 18),
        label: const Text('Export CSV'),
      ),
    ],
    item: (i) {
      final l = lists[i];
      return ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 48,
          height: 48,
          color: const Color(0xFFF3F3F3),
          child: l.images.isEmpty
              ? const Icon(Icons.photo_library_outlined, color: Color(0xFF888888))
              : AppNetworkImage(url: l.images.first.imageUrl, memCacheWidth: 150),
        ),
        title: Text(l.email, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          '${l.name}  •  ${l.photos} photos'
          '${l.updatedAt == null ? '' : '  •  ${formatDate(l.updatedAt)}'}',
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () async {
          final changed = await showFavoriteListSheet(
            context,
            collectionId: _id,
            list: l,
          );
          if (changed) await _load();
        },
      );
    },
  );

  Widget _downloads(List<DownloadActivity> items) => _list(
    count: items.length,
    emptyIcon: Icons.download_outlined,
    emptyText: 'No downloads yet.',
    header: [
      OutlinedButton.icon(
        onPressed: () => _exportCsv('downloads', [
          ['Email', 'Photo', 'Type', 'Count', 'Date'],
          for (final d in items)
            [d.email, d.isAll ? 'All photos' : d.imageName,
             d.isAll ? 'all' : 'single', '${d.count}', _day(d.createdAt)],
        ]),
        icon: const Icon(Icons.file_upload_outlined, size: 18),
        label: const Text('Export CSV'),
      ),
    ],
    item: (i) {
      final d = items[i];
      return ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: SizedBox(
          width: 48,
          height: 48,
          child: d.isAll || d.imageUrl == null
              ? const ColoredBox(
                  color: Color(0xFFF3F3F3),
                  child: Icon(Icons.folder_zip_outlined, color: Color(0xFF888888)),
                )
              : AppNetworkImage(url: d.imageUrl!, memCacheWidth: 150),
        ),
        title: Text(
          d.isAll ? 'All photos' : d.imageName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          '${d.email.isEmpty ? 'Guest' : d.email}'
          '${d.createdAt == null ? '' : '  •  ${formatDate(d.createdAt)}'}',
        ),
        trailing: d.count > 1 ? Text('×${d.count}') : null,
      );
    },
  );

  Widget _registrations(List<EmailRegistration> items) => _list(
    count: items.length,
    emptyIcon: Icons.mark_email_unread_outlined,
    emptyText: 'No email registrations yet.\n'
        'Turn on Email registration in gallery settings to collect them.',
    header: [
      OutlinedButton.icon(
        onPressed: () async {
          await Clipboard.setData(
            ClipboardData(text: items.map((e) => e.email).join(', ')),
          );
          AppToast.success('${items.length} emails copied');
        },
        icon: const Icon(Icons.content_copy_rounded, size: 18),
        label: const Text('Copy emails'),
      ),
      OutlinedButton.icon(
        onPressed: () => _exportCsv('registrations', [
          ['Email', 'Source', 'Marketing opt-in', 'Date'],
          for (final r in items)
            [r.email, r.sources.join(' '), r.marketingOptIn ? 'yes' : 'no',
             _day(r.createdAt)],
        ]),
        icon: const Icon(Icons.file_upload_outlined, size: 18),
        label: const Text('Export CSV'),
      ),
    ],
    item: (i) {
      final r = items[i];
      return ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: const CircleAvatar(
          backgroundColor: AppColors.galleryLavenderTint,
          child: Icon(Icons.person_outline_rounded, color: AppColors.galleryPurple),
        ),
        title: Text(r.email, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text([
          if (r.sources.isNotEmpty) r.sources.map(titleCase).join(', '),
          if (r.createdAt != null) formatDate(r.createdAt),
        ].join('  •  ')),
        trailing: r.marketingOptIn
            ? const _Chip('Subscribed', AppColors.success)
            : null,
      );
    },
  );

  Widget _privatePhotos(List<PrivatePhotoRequest> items) => _list(
    count: items.length,
    emptyIcon: Icons.lock_outline_rounded,
    emptyText: 'No private photo requests.',
    header: const [],
    item: (i) {
      final r = items[i];
      final color = switch (r.status) {
        'approved' => AppColors.success,
        'declined' => AppColors.error,
        _ => AppColors.warning,
      };
      return ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: SizedBox(
          width: 48,
          height: 48,
          child: r.imageUrl == null
              ? const ColoredBox(
                  color: Color(0xFFF3F3F3),
                  child: Icon(Icons.lock_outline_rounded, color: Color(0xFF888888)),
                )
              : AppNetworkImage(url: r.imageUrl!, memCacheWidth: 150),
        ),
        title: Text(
          r.imageName.isEmpty ? 'Photo' : r.imageName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text('${r.email}'
            '${r.createdAt == null ? '' : '  •  ${formatDate(r.createdAt)}'}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Chip(titleCase(r.status), color),
            PopupMenuButton<String>(
              tooltip: 'Request actions',
              onSelected: (v) => _privateAction(r, v),
              itemBuilder: (_) => [
                if (r.status != 'approved')
                  const PopupMenuItem(value: 'approved', child: Text('Approve')),
                if (r.status != 'declined')
                  const PopupMenuItem(value: 'declined', child: Text('Decline')),
                const PopupMenuItem(
                  value: 'delete',
                  child: Text('Delete', style: TextStyle(color: AppColors.error)),
                ),
              ],
            ),
          ],
        ),
      );
    },
  );

  Future<void> _privateAction(PrivatePhotoRequest r, String action) async {
    if (action == 'delete') {
      final ok = await confirmAction(
        context,
        title: 'Delete request?',
        message: 'The request from ${r.email} will be removed.',
      );
      if (!ok) return;
    }
    try {
      if (action == 'delete') {
        await ActivityApi.deletePrivatePhoto(_id, r.id);
      } else {
        await ActivityApi.setPrivatePhotoStatus(_id, r.id, action);
      }
      AppToast.success(action == 'delete'
          ? 'Request deleted'
          : 'Request ${action == 'approved' ? 'approved' : 'declined'}');
      await _load();
    } catch (e) {
      AppToast.error(ApiError.message(e));
    }
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      color: color.withValues(alpha: .1),
      child: Text(label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}
