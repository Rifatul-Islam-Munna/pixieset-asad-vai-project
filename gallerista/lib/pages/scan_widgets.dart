import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/gallery/scan_history.dart';
import 'package:gallerista/pages/public_gallery_page.dart';
import 'package:gallerista/theme/app_theme.dart';

void openScanner(BuildContext context) => Navigator.of(context).push(
  MaterialPageRoute<void>(builder: (_) => const ScanGalleryPage()),
);

void openScannedGallery(BuildContext context, ScanEntry entry) =>
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PublicGalleryPage(link: entry.link),
      ),
    );

/// Big "Scan a gallery QR code" call to action for the home screen.
class ScanCard extends StatelessWidget {
  const ScanCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Material(
        color: AppColors.galleryPrimary,
        child: InkWell(
          onTap: () => openScanner(context),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Scan a gallery QR code',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Open a client gallery, or check how your Mobile '
                        'only galleries look on a phone.',
                        style: TextStyle(
                          color: Color(0xB3FFFFFF),
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 14),
                      FilledButton.icon(
                        onPressed: () => openScanner(context),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.white,
                          foregroundColor: AppColors.galleryPrimary,
                          minimumSize: const Size(0, 40),
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                        ),
                        icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                        label: const Text('Scan now'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    color: const Color(0x1FFFFFFF),
                    border: Border.all(color: const Color(0x33FFFFFF)),
                  ),
                  child: const Icon(Icons.qr_code_2_rounded,
                      size: 54, color: AppColors.galleryLavender),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Recently scanned" galleries; hidden when there are none.
class RecentScansRow extends StatelessWidget {
  const RecentScansRow({super.key, this.padding = 16});

  final double padding;

  Future<void> _remove(BuildContext context, ScanEntry entry) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove from recent?'),
        content: Text('"${entry.name}" will be removed from this phone. '
            'You can scan its QR code again anytime.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok == true) await ScanHistory.remove(entry);
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<ScanEntry>>(
      valueListenable: ScanHistory.entries,
      builder: (context, entries, _) {
        if (entries.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(padding + 4, 20, padding - 4, 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('Recently scanned',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                  ),
                  TextButton(
                    onPressed: ScanHistory.clear,
                    child: const Text('Clear'),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 172,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: EdgeInsets.symmetric(horizontal: padding),
                itemCount: entries.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (_, i) {
                  final e = entries[i];
                  return Semantics(
                    button: true,
                    label: 'Open ${e.name}',
                    child: GestureDetector(
                      onTap: () => openScannedGallery(context, e),
                      onLongPress: () => _remove(context, e),
                      child: SizedBox(
                        width: 128,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 128,
                              height: 128,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  AppNetworkImage(url: e.coverUrl, memCacheWidth: 400),
                                  if (e.key != null)
                                    const PositionedDirectional(
                                      top: 6,
                                      end: 6,
                                      child: Icon(Icons.phone_iphone_rounded,
                                          size: 18,
                                          color: AppColors.white,
                                          shadows: [
                                            Shadow(color: Color(0x99000000), blurRadius: 6),
                                          ]),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(e.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w600)),
                            Text(formatDate(e.scannedAt),
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.galleryMeta)),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
