import 'package:flutter/widgets.dart';

/// Anchor rect for the system share sheet. iPad requires it (the share
/// popover must point somewhere, otherwise sharing throws); phones ignore it.
Rect? shareOrigin(BuildContext context) {
  final box = context.findRenderObject();
  if (box is! RenderBox || !box.hasSize) return null;
  return box.localToGlobal(Offset.zero) & box.size;
}
