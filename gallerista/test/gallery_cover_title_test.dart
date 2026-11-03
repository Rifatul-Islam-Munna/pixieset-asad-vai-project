import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallerista/pages/galleries/cover_preview.dart';

void main() {
  const longTitle =
      'ΒΙΩΜΑΤΙΚΟ ΣΕΜΙΝΑΡΙΟ ΦΩΤΟΓΡΑΦΙΑΣ ΜΕ ΚΑΛΕΣΜΕΝΟΥΣ ΚΑΙ ΔΡΑΣΤΗΡΙΟΤΗΤΕΣ';

  for (final cover in ['Center', 'Split', 'Magazine', 'Lower Left']) {
    testWidgets('$cover cover wraps a long mobile title at 12–14 px', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 390,
                height: 280,
                child: CoverPreview(
                  design: {'cover': cover},
                  imageUrl: '',
                  title: longTitle,
                ),
              ),
            ),
          ),
        ),
      );
      final title = tester.widget<Text>(find.text(longTitle));
      expect(title.style!.fontSize, inInclusiveRange(12, 14));
      expect(title.softWrap, isTrue);
      expect(title.maxLines, isNull);
      expect(title.overflow, TextOverflow.visible);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('a wide cover retains its original larger title styling', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 900,
              height: 450,
              child: CoverPreview(
                design: {'cover': 'Center'},
                imageUrl: '',
                title: 'Wide gallery',
              ),
            ),
          ),
        ),
      ),
    );
    final title = tester.widget<Text>(find.text('Wide gallery'));
    expect(title.style!.fontSize, greaterThan(14));
    expect(title.maxLines, 3);
    expect(tester.takeException(), isNull);
  });
}
