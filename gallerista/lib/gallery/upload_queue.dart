import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/direct_upload.dart';

enum UploadPhase { uploading, processing, done, failed }

class UploadJob {
  UploadJob({
    required this.collectionId,
    required this.files,
    this.setId,
    this.setName,
    this.watermarkId,
  }) : totalBytes = files.fold(0, (sum, f) => sum + f.size);

  final String collectionId;
  final List<UploadSource> files;
  final String? setId;
  final String? setName;
  final String? watermarkId;
  final int totalBytes;
  final _startedAt = DateTime.now();

  UploadPhase phase = UploadPhase.uploading;
  int sentBytes = 0;
  String message = 'Preparing upload';
  String? error;

  /// Files the server is still optimizing (thumbnails, watermark).
  int pending = 0;

  double get progress => totalBytes == 0 ? 1 : sentBytes / totalBytes;

  double get bytesPerSecond {
    final seconds =
        DateTime.now().difference(_startedAt).inMilliseconds / 1000;
    return seconds <= 0 ? 0 : sentBytes / seconds;
  }

  bool get isActive =>
      phase == UploadPhase.uploading || phase == UploadPhase.processing;
}

/// App-wide upload manager (registered in get_it). Uploads keep running
/// while the user moves between screens; one upload per gallery at a time,
/// like the web.
class UploadQueue extends ChangeNotifier {
  final Map<String, UploadJob> _jobs = {};

  UploadJob? jobFor(String collectionId) => _jobs[collectionId];

  bool isUploading(String collectionId) =>
      _jobs[collectionId]?.isActive ?? false;

  void dismiss(String collectionId) {
    if (_jobs[collectionId]?.isActive ?? false) return;
    _jobs.remove(collectionId);
    notifyListeners();
  }

  /// Starts uploading [files] into [collection], optionally into [set].
  void start({
    required Collection collection,
    required List<UploadSource> files,
    CollectionSet? set,
  }) {
    if (isUploading(collection.id)) {
      AppToast.error('This gallery already has an upload running.');
      return;
    }
    final media = files.where((f) => f.isMedia).toList();
    if (media.isEmpty) {
      AppToast.error('Choose photos or videos to upload.');
      return;
    }
    final job = UploadJob(
      collectionId: collection.id,
      files: media,
      setId: set?.id,
      setName: set?.name,
      watermarkId: collection.uploadWatermarkFor(set),
    );
    _jobs[collection.id] = job;
    notifyListeners();
    unawaited(_run(job));
  }

  /// Re-runs a failed upload with the same files.
  void retry(String collectionId) {
    final old = _jobs[collectionId];
    if (old == null || old.isActive) return;
    final job = UploadJob(
      collectionId: old.collectionId,
      files: old.files,
      setId: old.setId,
      setName: old.setName,
      watermarkId: old.watermarkId,
    );
    _jobs[collectionId] = job;
    notifyListeners();
    unawaited(_run(job));
  }

  Future<void> _run(UploadJob job) async {
    var lastNotify = DateTime.fromMillisecondsSinceEpoch(0);
    final uploader = DirectUploader(
      collectionId: job.collectionId,
      setId: job.setId,
      watermarkId: job.watermarkId,
      onProgress: (sent, _) {
        job.sentBytes = sent;
        final now = DateTime.now();
        if (now.difference(lastNotify).inMilliseconds > 150) {
          lastNotify = now;
          notifyListeners();
        }
      },
      onStage: (message) {
        job.message = message;
        notifyListeners();
      },
    );
    try {
      await uploader.upload(job.files);
      job
        ..phase = UploadPhase.processing
        ..message = 'Optimizing photos';
      notifyListeners();
      await _waitForProcessing(job);
      job
        ..phase = UploadPhase.done
        ..message = 'Upload complete';
      notifyListeners();
      AppToast.success('${job.files.length} '
          '${job.files.length == 1 ? 'file' : 'files'} uploaded');
    } catch (e, s) {
      debugPrint('Upload failed: $e\n$s');
      job
        ..phase = UploadPhase.failed
        ..error = ApiError.message(e)
        ..message = 'Upload failed';
      notifyListeners();
    }
  }

  /// Polls the processing status until the server has finished (max ~10 min).
  Future<void> _waitForProcessing(UploadJob job) async {
    for (var i = 0; i < 200; i++) {
      try {
        final res = await DioHelper.dio.get(
          '/collections/${job.collectionId}/images/direct-upload/status',
        );
        final data = (res.data as Map)['data'];
        final pending = data is Map ? int.tryParse('${data['pending']}') : 0;
        job.pending = pending ?? 0;
        notifyListeners();
        if (job.pending <= 0) return;
      } catch (_) {
        return; // Status is best-effort; the photos are already uploaded.
      }
      await Future<void>.delayed(const Duration(seconds: 3));
    }
  }
}
