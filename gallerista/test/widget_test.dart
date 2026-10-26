import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallerista/core/auth/auth_api.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/screen_guard.dart';
import 'package:gallerista/gallery/account_settings_api.dart';
import 'package:gallerista/gallery/collection_activity.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/gallery/gallery_design.dart';
import 'package:gallerista/gallery/gallery_filters.dart';
import 'package:gallerista/gallery/preset_defaults.dart';
import 'package:gallerista/gallery/public_gallery_api.dart';
import 'package:gallerista/gallery/scan_history.dart';
import 'package:gallerista/pages/account_settings_pages.dart';
import 'package:gallerista/pages/auth/login_page.dart';
import 'package:gallerista/pages/auth/register_page.dart';
import 'package:gallerista/pages/galleries/home_widgets.dart';
import 'package:gallerista/pages/library_page.dart';
import 'package:gallerista/pages/settings_part2_pages.dart';
import 'package:gallerista/theme/app_theme.dart';

DioException _errorWithBody(Object? body) {
  final options = RequestOptions(path: '/test');
  return DioException(
    requestOptions: options,
    response: Response(requestOptions: options, statusCode: 400, data: body),
    type: DioExceptionType.badResponse,
  );
}

Collection _gallery(
  String name, {
  String status = 'draft',
  bool starred = false,
  String? created,
  String? event,
}) => Collection.fromJson({
  '_id': name,
  'name': name,
  'status': status,
  'settings': {'starred': starred},
  'createdAt': ?created,
  'eventDate': ?event,
});

void main() {
  group('ApiError.message', () {
    test('reads a plain NestJS message', () {
      final error = _errorWithBody({'message': 'Invalid credentials'});
      expect(ApiError.message(error), 'Invalid credentials');
    });

    test('joins validation messages', () {
      final error = _errorWithBody({
        'message': ['email must be an email', 'password is too short'],
      });
      expect(
        ApiError.message(error),
        'email must be an email\npassword is too short',
      );
    });
  });

  group('filterGalleries', () {
    final now = DateTime(2026, 10, 25);
    final items = [
      _gallery('Beach', status: 'published', created: '2026-10-01'),
      _gallery('Autumn', starred: true, created: '2026-09-01',
          event: '2026-12-01'),
      _gallery('Studio', created: '2026-10-20', event: '2026-01-10'),
    ];

    test('newest first by default', () {
      final names = filterGalleries(items, const GalleryFilters(), now: now)
          .map((c) => c.name);
      expect(names, ['Studio', 'Beach', 'Autumn']);
    });

    test('status, starred, search and event date filters', () {
      List<String> run(GalleryFilters f) =>
          filterGalleries(items, f, now: now).map((c) => c.name).toList();
      expect(run(const GalleryFilters(status: 'published')), ['Beach']);
      expect(run(const GalleryFilters(starred: 'yes')), ['Autumn']);
      expect(run(const GalleryFilters(search: 'stu')), ['Studio']);
      expect(run(const GalleryFilters(eventDate: 'upcoming')), ['Autumn']);
      expect(run(const GalleryFilters(eventDate: 'past')), ['Studio']);
      expect(run(const GalleryFilters(sort: 'name-asc')),
          ['Autumn', 'Beach', 'Studio']);
    });
  });

  test('upload watermark: set first, then gallery default', () {
    final gallery = Collection.fromJson({
      '_id': 'g1',
      'name': 'Wedding',
      'settings': {
        'general': {'defaultWatermark': 'wm-default'},
      },
    });
    const plainSet = CollectionSet(id: 's1', name: 'Ceremony');
    const markedSet = CollectionSet(id: 's2', name: 'Party', watermarkId: 'wm-set');
    expect(gallery.uploadWatermarkFor(markedSet), 'wm-set');
    expect(gallery.uploadWatermarkFor(plainSet), 'wm-default');

    final none = Collection.fromJson({
      '_id': 'g2',
      'name': 'Studio',
      'settings': {
        'general': {'defaultWatermark': 'No watermark'},
      },
    });
    expect(none.uploadWatermarkFor(null), isNull);
  });

  group('activity', () {
    test('parses the /activity payload', () {
      final a = CollectionActivity.fromJson({
        'favoriteLists': [
          {
            'id': 'u1',
            'email': 'anna@example.com',
            'name': 'Album picks',
            'photos': 2,
            'filenames': ['IMG_1.jpg', 'IMG_2.jpg'],
          },
        ],
        'downloads': [
          {'email': 'b@example.com', 'imageName': 'x', 'downloadType': 'all', 'count': 3},
        ],
        'emailRegistrations': [
          {'email': 'c@example.com', 'source': 'gallery', 'marketingOptIn': true},
        ],
        'privatePhotos': [
          {'_id': 'p1', 'email': 'd@example.com', 'imageName': 'y'},
        ],
      });
      expect(a.favorites.single.filenames, ['IMG_1.jpg', 'IMG_2.jpg']);
      expect(a.downloads.single.isAll, isTrue);
      expect(a.downloads.single.count, 3);
      expect(a.registrations.single.sources, ['gallery']);
      expect(a.privatePhotos.single.status, 'pending');
    });

    test('CSV quotes values and blocks formula injection', () {
      final csv = toCsv([
        ['Email', 'Note'],
        ['a@b.com', 'Hello, "world"'],
        ['=HYPERLINK("x")', '+1'],
      ]);
      expect(
        csv,
        'Email,Note\r\n'
        'a@b.com,"Hello, ""world"""\r\n'
        '"\'=HYPERLINK(""x"")",\'+1',
      );
    });
  });

  test('design: every web cover maps to a preview family, colors parse', () {
    expect(GalleryDesign.covers, hasLength(30));
    expect(coverFamily('Center'), CoverFamily.centered);
    expect(coverFamily('Lower Left'), CoverFamily.bottomLeft);
    expect(coverFamily('Split'), CoverFamily.split);
    expect(coverFamily('Mono Frame'), CoverFamily.framed);
    expect(coverFamily('Magazine'), CoverFamily.paper);
    expect(hexColor('#a99167', Colors.black), const Color(0xFFA99167));
    expect(hexColor('nope', Colors.black), Colors.black);
    expect(GalleryDesign.paletteFor('Light'), GalleryDesign.paletteFor('White'));
  });

  test('library search matches every word across photo metadata', () {
    final images = [
      CollectionImage.fromJson({
        '_id': '1',
        'url': '/a.jpg',
        'originalName': 'IMG_0001.jpg',
        'collectionId': 'g1',
        'collectionName': 'Beach Wedding',
        'metadata': {'camera': 'Canon EOS R5', 'starred': true},
      }),
      CollectionImage.fromJson({
        '_id': '2',
        'url': '/b.jpg',
        'originalName': 'IMG_0002.jpg',
        'collectionId': 'g2',
        'collectionName': 'Studio',
        'metadata': {'keywords': 'portrait canon'},
      }),
    ];
    List<String> ids(String q, {String? gallery}) =>
        filterLibrary(images, q, collectionId: gallery).map((e) => e.id).toList();

    expect(ids(''), ['1', '2']);
    expect(ids('canon'), ['1', '2']);
    expect(ids('canon beach'), ['1']);
    expect(ids('portrait'), ['2']);
    expect(ids('', gallery: 'g2'), ['2']);
    expect(images.first.isStarred, isTrue);
    expect(images.first.withStarred(false).isStarred, isFalse);
  });

  test('registration uses the backend CreateUserDto rules', () {
    String? check({
      String name = 'Asad Rahman',
      String phone = '01712345678',
      String password = 'secret1',
      String email = '',
    }) => AuthApi.validateRegistration(
      name: name,
      phoneNumber: phone,
      password: password,
      email: email,
    );
    expect(check(), isNull);
    expect(check(email: 'asad@example.com'), isNull);
    expect(check(name: 'A'), 'Enter your full name.');
    expect(check(phone: '  '), 'Enter your phone number.');
    expect(check(email: 'not-an-email'), 'Enter a valid email address.');
    expect(check(password: '12345'), 'Password must be at least 6 characters.');
  });

  testWidgets('register screen validates before submitting', (tester) async {
    await tester.pumpWidget(
      MaterialApp(theme: AppTheme.light, home: const RegisterPage()),
    );
    await tester.pumpAndSettle();
    expect(find.text('Start creating today'), findsOneWidget);
    expect(find.text('Create your account'), findsOneWidget);
    await tester.ensureVisible(find.text('Create account'));
    await tester.tap(find.text('Create account'));
    await tester.pump();
    expect(find.text('Enter your full name.'), findsOneWidget);
  });

  test('account settings records and watermark defaults', () {
    final record = SettingRecord.fromJson({
      'localId': 'wm-1',
      'name': 'Studio text watermark',
      'data': {'type': 'text', 'text': 'Studio', 'scale': 42},
    });
    expect(record.localId, 'wm-1');
    expect(record.data['text'], 'Studio');
    expect(SettingRecord.fromJson({'localId': 'x'}).data, isEmpty);

    final draft = newWatermark();
    expect(draft['type'], 'text');
    expect(draft['font'], 'Times New Roman');
    expect(draft['position'], {'x': 15, 'y': 85});
    expect(watermarkFonts, contains(draft['font']));
  });

  group('gallery QR links', () {
    test('mobile-only link carries the key in the fragment', () {
      final url = GalleryLink.build(
        'https://gallerista.app/',
        'avery-studio',
        'sarah-daniel',
        key: 'abc_123-XYZ',
      );
      expect(url,
          'https://gallerista.app/collection/avery-studio/sarah-daniel#gallerista-key=abc_123-XYZ');
      final link = GalleryLink.tryParse(url)!;
      expect(link.site, 'avery-studio');
      expect(link.slug, 'sarah-daniel');
      expect(link.key, 'abc_123-XYZ');
    });

    test('normal gallery links open without a key', () {
      final link = GalleryLink.tryParse(
          'https://gallerista.app/collection/studio/wedding')!;
      expect(link.key, isNull);
      expect(link.slug, 'wedding');
    });

    test('rejects QR codes that are not gallery links', () {
      expect(GalleryLink.tryParse('hello world'), isNull);
      expect(GalleryLink.tryParse('https://example.com/collection/only-one'), isNull);
    });

    test('mobile-only flag reads from general settings', () {
      expect(Collection.fromJson({'_id': '1', 'name': 'A', 'settings': {
        'general': {'mobileOnly': true},
      }}).isMobileOnly, isTrue);
      expect(Collection.fromJson({'_id': '1', 'name': 'A'}).isMobileOnly, isFalse);
    });
  });

  test('screen protection stays on until the last protected screen closes', () async {
    expect(ScreenGuard.activeCount, 0);
    await ScreenGuard.acquire(); // client gallery
    await ScreenGuard.acquire(); // photo viewer on top
    await ScreenGuard.release(); // viewer closed
    expect(ScreenGuard.activeCount, 1);
    await ScreenGuard.release(); // gallery closed
    expect(ScreenGuard.activeCount, 0);
    await ScreenGuard.release(); // extra release never goes negative
    expect(ScreenGuard.activeCount, 0);
  });

  test('home greeting and filter badge count', () {
    expect(greetingFor(DateTime(2026, 10, 25, 8)), 'Good morning');
    expect(greetingFor(DateTime(2026, 10, 25, 14)), 'Good afternoon');
    expect(greetingFor(DateTime(2026, 10, 25, 21)), 'Good evening');
    expect(sheetFilterCount(const GalleryFilters()), 0);
    // Search and status have their own controls, so they don't count.
    expect(
      sheetFilterCount(const GalleryFilters(search: 'x', status: 'draft')),
      0,
    );
    expect(
      sheetFilterCount(const GalleryFilters(starred: 'yes', sort: 'oldest')),
      2,
    );
  });

  test('recently scanned: newest first, no duplicates, capped', () {
    ScanEntry entry(String slug, {String? key}) => ScanEntry(
      site: 'studio',
      slug: slug,
      key: key,
      name: slug,
      coverUrl: '',
      scannedAt: DateTime(2026, 10, 25),
    );
    var list = <ScanEntry>[];
    for (var i = 0; i < 10; i++) {
      list = mergeScan(list, entry('g$i'));
    }
    expect(list, hasLength(8));
    expect(list.first.slug, 'g9');
    list = mergeScan(list, entry('g5', key: 'k'));
    expect(list.first.slug, 'g5');
    expect(list.where((e) => e.slug == 'g5'), hasLength(1));

    final restored = ScanEntry.fromJson(list.first.toJson())!;
    expect(restored.link.key, 'k');
    expect(restored.id, 'studio/g5');
    expect(ScanEntry.fromJson({'site': ''}), isNull);
  });

  test('presets: 8 built-ins, defaults filled, legacy fields read', () {
    expect(builtInPresets, hasLength(8));
    expect(builtInPresets.every(isBuiltInPreset), isTrue);
    final wedding = builtInPresets.firstWhere((p) => p['name'] == 'Wedding Gallery');
    expect((wedding['general'] as Map)['emailRegistration'], isTrue);
    expect((wedding['download'] as Map)['webSizePx'], '1024px'); // default kept

    final legacy = normalizePreset({
      'presetName': 'Old',
      'presetDesign': {'cover': 'Left'},
    }, 'preset-1');
    expect(legacy['id'], 'preset-1');
    expect(legacy['name'], 'Old');
    expect((legacy['design'] as Map)['cover'], 'Left');
    expect((legacy['design'] as Map)['typography'], 'Classic');
    expect(isBuiltInPreset(legacy), isFalse);

    final tpl = newEmailTemplate();
    expect(tpl['buttonText'], 'Open Gallery');
    expect(tpl['source'], 'user');
  });

  testWidgets('login screen shows password and PIN modes', (tester) async {
    await tester.pumpWidget(
      MaterialApp(theme: AppTheme.light, home: const LoginPage()),
    );

    expect(find.text('Welcome back!'), findsOneWidget);
    expect(find.text('Password'), findsWidgets);
    await tester.tap(find.text('One-time PIN'));
    await tester.pumpAndSettle();
    expect(find.text('6-digit PIN from your login email'), findsOneWidget);
  });
}
