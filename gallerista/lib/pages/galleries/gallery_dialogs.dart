import 'package:flutter/material.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Values from the "New Gallery" / "Quick Edit" forms.
class GalleryFormResult {
  const GalleryFormResult({
    required this.name,
    this.eventDate,
    this.status = 'draft',
  });

  final String name;
  final DateTime? eventDate;
  final String status;
}

/// Bottom sheet for creating a gallery or quick-editing one.
Future<GalleryFormResult?> showGalleryForm(
  BuildContext context, {
  Collection? initial,
}) {
  return showModalBottomSheet<GalleryFormResult>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _GalleryFormSheet(initial: initial),
  );
}

class _GalleryFormSheet extends StatefulWidget {
  const _GalleryFormSheet({this.initial});

  final Collection? initial;

  @override
  State<_GalleryFormSheet> createState() => _GalleryFormSheetState();
}

class _GalleryFormSheetState extends State<_GalleryFormSheet> {
  late final _name = TextEditingController(text: widget.initial?.name);
  late DateTime? _eventDate = widget.initial?.eventDate;
  late String _status = widget.initial?.isPublished == true
      ? 'published'
      : 'draft';
  String? _error;

  bool get _editing => widget.initial != null;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _eventDate ?? now,
      firstDate: DateTime(now.year - 30),
      lastDate: DateTime(now.year + 10),
    );
    if (picked != null) setState(() => _eventDate = picked);
  }

  void _submit() {
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Gallery name is required.');
      return;
    }
    Navigator.of(context).pop(
      GalleryFormResult(name: name, eventDate: _eventDate, status: _status),
    );
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(24, 8, 24, 24 + insets),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _editing ? 'Quick Edit' : 'New Gallery',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _name,
            autofocus: !_editing,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              labelText: 'Gallery name',
              hintText: 'e.g. Jessica & Michael',
              errorText: _error,
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _pickDate,
            icon: const Icon(Icons.event_outlined, size: 18),
            label: Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(
                _eventDate == null
                    ? 'Event date (optional)'
                    : 'Event date: ${formatDate(_eventDate)}',
              ),
            ),
          ),
          if (_editing) ...[
            const SizedBox(height: 16),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'draft', label: Text('Draft')),
                ButtonSegment(value: 'published', label: Text('Published')),
              ],
              selected: {_status},
              showSelectedIcon: false,
              onSelectionChanged: (value) =>
                  setState(() => _status = value.first),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _submit,
            child: Text(_editing ? 'Save' : 'Create Gallery'),
          ),
        ],
      ),
    );
  }
}

Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Delete',
  bool destructive = true,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          style: TextButton.styleFrom(foregroundColor: AppColors.galleryText),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          style: destructive
              ? FilledButton.styleFrom(backgroundColor: AppColors.error)
              : null,
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}

Future<String?> promptText(
  BuildContext context, {
  required String title,
  String? initial,
  String hint = '',
  String confirmLabel = 'Save',
}) {
  final controller = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        decoration: InputDecoration(hintText: hint),
        onSubmitted: (value) => Navigator.pop(context, value.trim()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          style: TextButton.styleFrom(foregroundColor: AppColors.galleryText),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text.trim()),
          child: Text(confirmLabel),
        ),
      ],
    ),
  ).whenComplete(controller.dispose);
}
