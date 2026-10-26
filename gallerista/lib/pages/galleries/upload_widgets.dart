import 'package:flutter/material.dart';
import 'package:gallerista/gallery/direct_upload.dart';
import 'package:gallerista/gallery/upload_queue.dart';
import 'package:gallerista/main.dart' show getIt;
import 'package:gallerista/theme/app_theme.dart';
import 'package:image_picker/image_picker.dart';

String formatBytes(num bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  var value = bytes.toDouble();
  var unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return '${value.toStringAsFixed(unit == 0 ? 0 : 1)} ${units[unit]}';
}

/// Asks where to take photos from, then returns the picked files.
Future<List<UploadSource>> pickUploadSources(BuildContext context) async {
  final source = await showModalBottomSheet<String>(
    context: context,
    useSafeArea: true,
    builder: (context) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const ListTile(
          title: Text('Add photos',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          subtitle: Text('Originals are uploaded without compression.'),
        ),
        ListTile(
          leading: const Icon(Icons.photo_library_outlined),
          title: const Text('Choose from library'),
          subtitle: const Text('Photos and videos'),
          onTap: () => Navigator.pop(context, 'library'),
        ),
        ListTile(
          leading: const Icon(Icons.photo_camera_outlined),
          title: const Text('Take a photo'),
          onTap: () => Navigator.pop(context, 'camera'),
        ),
        const SizedBox(height: 8),
      ],
    ),
  );
  if (source == null) return const [];
  final picker = ImagePicker();
  final picked = source == 'camera'
      ? [?await picker.pickImage(source: ImageSource.camera)]
      : await picker.pickMultipleMedia();
  return Future.wait(
    picked.map((x) => UploadSource.fromPath(x.path, name: x.name)),
  );
}

/// Live upload status for one gallery. Calls [onFinished] once the upload
/// and server processing are done, so the page can reload its photos.
class UploadProgressCard extends StatefulWidget {
  const UploadProgressCard({
    super.key,
    required this.collectionId,
    required this.onFinished,
  });

  final String collectionId;
  final VoidCallback onFinished;

  @override
  State<UploadProgressCard> createState() => _UploadProgressCardState();
}

class _UploadProgressCardState extends State<UploadProgressCard> {
  final _queue = getIt<UploadQueue>();
  UploadPhase? _lastPhase;

  @override
  void initState() {
    super.initState();
    _lastPhase = _queue.jobFor(widget.collectionId)?.phase;
    _queue.addListener(_onQueue);
  }

  @override
  void dispose() {
    _queue.removeListener(_onQueue);
    super.dispose();
  }

  void _onQueue() {
    final phase = _queue.jobFor(widget.collectionId)?.phase;
    if (phase != _lastPhase) {
      // Refresh once the files are registered, and again when optimized.
      if (phase == UploadPhase.processing || phase == UploadPhase.done) {
        widget.onFinished();
      }
      _lastPhase = phase;
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final job = _queue.jobFor(widget.collectionId);
    if (job == null) return const SizedBox.shrink();
    final failed = job.phase == UploadPhase.failed;
    final done = job.phase == UploadPhase.done;
    final count = job.files.length;
    final title = switch (job.phase) {
      UploadPhase.uploading =>
        'Uploading $count ${count == 1 ? 'file' : 'files'}'
            '${job.setName == null ? '' : ' to ${job.setName}'}',
      UploadPhase.processing => job.pending > 0
          ? 'Optimizing ${job.pending} ${job.pending == 1 ? 'file' : 'files'}'
          : 'Optimizing photos',
      UploadPhase.done => '$count ${count == 1 ? 'file' : 'files'} uploaded',
      UploadPhase.failed => 'Upload failed',
    };
    final detail = switch (job.phase) {
      UploadPhase.uploading =>
        '${(job.progress * 100).round()}%  •  ${formatBytes(job.sentBytes)} '
            'of ${formatBytes(job.totalBytes)}  •  '
            '${formatBytes(job.bytesPerSecond)}/s',
      UploadPhase.processing =>
        'Your originals are safe. Creating previews and watermarks.',
      UploadPhase.done => 'Photos are ready in this gallery.',
      UploadPhase.failed => job.error ?? 'Something went wrong.',
    };
    final accent = failed
        ? AppColors.error
        : done
        ? AppColors.success
        : AppColors.galleryPurple;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.galleryBorder),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A151515),
            blurRadius: 30,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(
            failed
                ? Icons.error_outline_rounded
                : done
                ? Icons.check_circle_outline_rounded
                : Icons.cloud_upload_outlined,
            color: accent,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                  detail,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.galleryMeta,
                  ),
                ),
                if (job.isActive) ...[
                  const SizedBox(height: 10),
                  LinearProgressIndicator(
                    value: job.phase == UploadPhase.uploading
                        ? job.progress
                        : null,
                    color: AppColors.galleryPurple,
                    backgroundColor: AppColors.galleryLavenderTint,
                    minHeight: 4,
                  ),
                  if (job.phase == UploadPhase.uploading) ...[
                    const SizedBox(height: 6),
                    Text(job.message,
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.galleryMeta)),
                  ],
                ],
              ],
            ),
          ),
          if (failed)
            TextButton(
              onPressed: () => _queue.retry(widget.collectionId),
              child: const Text('Retry'),
            ),
          if (!job.isActive)
            IconButton(
              tooltip: 'Dismiss',
              onPressed: () => _queue.dismiss(widget.collectionId),
              icon: const Icon(Icons.close_rounded, size: 20),
            ),
        ],
      ),
    );
  }
}
