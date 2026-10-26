import 'dart:io';

import 'package:dio/dio.dart';
import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:mime/mime.dart';

/// A local file picked for upload.
class UploadSource {
  const UploadSource({
    required this.path,
    required this.name,
    required this.size,
    required this.type,
  });

  final String path;
  final String name;
  final int size;
  final String type;

  bool get isMedia => type.startsWith('image/') || type.startsWith('video/');

  static Future<UploadSource> fromPath(String path, {String? name}) async {
    final fileName = (name != null && name.isNotEmpty)
        ? name
        : path.split(RegExp(r'[/\\]')).last;
    return UploadSource(
      path: path,
      name: fileName,
      size: await File(path).length(),
      type: lookupMimeType(fileName) ??
          lookupMimeType(path) ??
          'application/octet-stream',
    );
  }

  Map<String, dynamic> toMetadata() => {
    'name': name,
    'type': type,
    'size': size,
  };
}

class _Ticket {
  _Ticket.fromJson(Map<String, dynamic> json)
    : objectKey = json['objectKey'].toString(),
      multipart = json['strategy'] == 'multipart',
      uploadUrl = json['uploadUrl']?.toString(),
      uploadId = json['uploadId']?.toString(),
      partSize = int.tryParse('${json['partSize'] ?? ''}'),
      parts = (json['parts'] is List ? json['parts'] as List : const [])
          .whereType<Map>()
          .map((p) => (
                number: int.parse('${p['partNumber']}'),
                url: p['url'].toString(),
              ))
          .toList();

  final String objectKey;
  final bool multipart;
  final String? uploadUrl;
  final String? uploadId;
  final int? partSize;
  final List<({int number, String url})> parts;
}

/// Direct-to-storage upload, ported from `frontend/lib/direct-s3-upload.ts`
/// and the `uploadImages` mutation in `use-collections.ts`:
/// 1. ask the API for signed upload tickets (max 200 files per request),
/// 2. PUT each file (or each multipart part) straight to storage,
/// 3. tell the API the uploads are complete (100 files per request).
class DirectUploader {
  DirectUploader({
    required this.collectionId,
    this.setId,
    this.watermarkId,
    required this.onProgress,
    required this.onStage,
  });

  final String collectionId;
  final String? setId;
  final String? watermarkId;
  final void Function(int sentBytes, int totalBytes) onProgress;
  final void Function(String message) onStage;

  static const _authorizeBatch = 200;
  static const _completeBatch = 100;
  static const _fileConcurrency = 3;
  static const _partConcurrency = 3;
  static const _maxAttempts = 4;

  /// Plain client for signed storage URLs: no base URL and no auth header,
  /// so the user's API token never goes to the storage server.
  final Dio _storage = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 45), // stall timeout
      receiveTimeout: const Duration(seconds: 60),
    ),
  );

  late final Map<String, int> _sent = {};
  late int _total;

  /// Uploads [files] and returns how many the API accepted.
  Future<int> upload(List<UploadSource> files) async {
    _total = files.fold(0, (sum, f) => sum + f.size);
    final completed = <Map<String, dynamic>>[];

    for (var start = 0; start < files.length; start += _authorizeBatch) {
      final batch = files.sublist(
        start,
        (start + _authorizeBatch).clamp(0, files.length),
      );
      onStage('Getting secure upload permission');
      final tickets = await _authorize(batch);
      onStage('Uploading ${files.length} '
          '${files.length == 1 ? 'file' : 'files'}');
      final results = await _pool<Map<String, dynamic>>(
        batch.length,
        _fileConcurrency,
        (i) => _uploadOne(batch[i], tickets[i]),
      );
      completed.addAll(results);
    }

    onStage('Finalizing upload');
    var accepted = 0;
    for (var start = 0; start < completed.length; start += _completeBatch) {
      final chunk = completed.sublist(
        start,
        (start + _completeBatch).clamp(0, completed.length),
      );
      final res = await DioHelper.dio.post(
        '/collections/$collectionId/images/direct-upload/complete',
        data: {
          'files': chunk,
          'setId': ?setId,
          'watermarkId': ?watermarkId,
        },
      );
      final data = (res.data is Map ? res.data as Map : const {})['data'];
      accepted += data is List ? data.length : chunk.length;
    }
    onProgress(_total, _total);
    return accepted;
  }

  Future<List<_Ticket>> _authorize(List<UploadSource> batch) async {
    final res = await DioHelper.dio.post(
      '/collections/$collectionId/images/direct-upload',
      data: {
        'files': [for (final f in batch) f.toMetadata()],
        'setId': ?setId,
        'watermarkId': ?watermarkId,
      },
    );
    final list = (res.data as Map)['data'] as List? ?? const [];
    if (list.length != batch.length) {
      throw StateError('Upload authorization mismatch. Please try again.');
    }
    return list
        .map((e) => _Ticket.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<Map<String, dynamic>> _uploadOne(
    UploadSource file,
    _Ticket ticket,
  ) async {
    final result = <String, dynamic>{
      'objectKey': ticket.objectKey,
      ...file.toMetadata(),
    };
    if (ticket.multipart) {
      final partSize = ticket.partSize;
      if (ticket.uploadId == null || partSize == null || ticket.parts.isEmpty) {
        throw StateError('Invalid multipart upload authorization.');
      }
      final etags = await _pool<Map<String, dynamic>>(
        ticket.parts.length,
        _partConcurrency,
        (i) async {
          final part = ticket.parts[i];
          final start = i * partSize;
          final end = (start + partSize).clamp(0, file.size);
          final etag = await _put(
            file,
            part.url,
            start: start,
            end: end,
            progressKey: '${file.path}#$i',
            contentType: 'application/octet-stream',
            requireEtag: true,
          );
          return {'partNumber': part.number, 'etag': etag};
        },
      );
      result['uploadId'] = ticket.uploadId;
      result['parts'] = etags;
    } else {
      final url = ticket.uploadUrl;
      if (url == null) throw StateError('Missing direct upload URL.');
      await _put(
        file,
        url,
        start: 0,
        end: file.size,
        progressKey: file.path,
        contentType: file.type,
      );
    }
    return result;
  }

  /// PUT a byte range with retries (350ms, 700ms, 1.4s backoff).
  Future<String> _put(
    UploadSource file,
    String url, {
    required int start,
    required int end,
    required String progressKey,
    required String contentType,
    bool requireEtag = false,
  }) async {
    Object? lastError;
    for (var attempt = 1; attempt <= _maxAttempts; attempt++) {
      try {
        final res = await _storage.put<void>(
          url,
          data: File(file.path).openRead(start, end),
          options: Options(
            contentType: contentType,
            headers: {Headers.contentLengthHeader: end - start},
          ),
          onSendProgress: (sent, _) => _report(progressKey, sent),
        );
        final etag = res.headers.value('etag') ?? '';
        if (requireEtag && etag.isEmpty && end > start) {
          throw StateError('Upload confirmation was incomplete.');
        }
        _report(progressKey, end - start);
        return etag;
      } catch (e) {
        lastError = e;
        _report(progressKey, 0);
        if (attempt == _maxAttempts) break;
        onStage('Retrying ${file.name} ($attempt/${_maxAttempts - 1})');
        await Future<void>.delayed(
          Duration(milliseconds: 350 * (1 << (attempt - 1))),
        );
      }
    }
    throw lastError ?? StateError('Upload failed.');
  }

  void _report(String key, int bytes) {
    _sent[key] = bytes;
    onProgress(_sent.values.fold(0, (a, b) => a + b), _total);
  }

  /// Runs [task] for indexes 0..count-1 with at most [limit] in flight,
  /// keeping results in index order.
  static Future<List<T>> _pool<T>(
    int count,
    int limit,
    Future<T> Function(int index) task,
  ) async {
    if (count == 0) return <T>[];
    final results = List<T?>.filled(count, null);
    var next = 0;
    Future<void> worker() async {
      while (next < count) {
        final index = next++;
        results[index] = await task(index);
      }
    }

    await Future.wait([
      for (var i = 0; i < limit.clamp(1, count); i++) worker(),
    ]);
    return results.cast<T>();
  }
}
