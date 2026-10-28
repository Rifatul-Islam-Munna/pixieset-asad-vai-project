import 'dart:async';

import 'package:cached_query_flutter/cached_query_flutter.dart';
import 'package:cached_storage/cached_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:gallerista/api-hooks/dio_helper.dart';
import 'package:gallerista/core/cms/site_brand.dart';
import 'package:gallerista/core/navigation/app_router_instance.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/gallery/scan_history.dart';
import 'package:gallerista/gallery/upload_queue.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';
import 'package:get_it/get_it.dart';
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';

final logger = Logger(
  printer: PrettyPrinter(
    methodCount: 1,
    errorMethodCount: 5,
    colors: true,
    printEmojis: true,
  ),
);
final getIt = GetIt.instance;

Future<void> setupLocator() async {
  final prefs = await SharedPreferences.getInstance();
  if (!getIt.isRegistered<SharedPreferences>()) {
    getIt.registerSingleton<SharedPreferences>(prefs);
  }
  if (!getIt.isRegistered<FlutterSecureStorage>()) {
    getIt.registerSingleton<FlutterSecureStorage>(const FlutterSecureStorage());
  }
  if (!getIt.isRegistered<UploadQueue>()) {
    getIt.registerSingleton<UploadQueue>(UploadQueue());
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Keep decoded images bounded; gallery screens are image-heavy.
  final imageCache = PaintingBinding.instance.imageCache;
  imageCache.maximumSize = 150;
  imageCache.maximumSizeBytes = 50 * 1024 * 1024;

  await setupLocator();
  await ScanHistory.load();
  await dotenv.load(fileName: '.env');
  DioHelper.init(
    // Session expired: log in again, with the public home page behind it.
    onUnauthorized: () =>
        appRouter.replaceAll([const WelcomeRoute(), const LoginRoute()]),
  );
  // The website's logo/icon from the admin: saved copy at once, then
  // refreshed in the background (never blocks startup).
  unawaited(SiteBrand.load());
  CachedQuery.instance.configFlutter(
    config: GlobalQueryConfig(refetchOnConnection: true, refetchOnResume: true),
    storage: await CachedStorage.ensureInitialized(),
  );
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.galleryBackground,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Gallerista',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: AppToast.messengerKey,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      // The web frontend renders light by default; use ThemeMode.system to
      // follow the phone setting instead.
      themeMode: ThemeMode.light,
      routerConfig: appRouter.config(),
    );
  }
}
