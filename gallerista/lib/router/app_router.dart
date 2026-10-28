import 'package:auto_route/auto_route.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/pages/auth/login_page.dart';
import 'package:gallerista/pages/auth/register_page.dart';
import 'package:gallerista/pages/galleries/galleries_page.dart';
import 'package:gallerista/pages/galleries/gallery_activity_page.dart';
import 'package:gallerista/pages/galleries/gallery_design_page.dart';
import 'package:gallerista/pages/galleries/gallery_detail_page.dart';
import 'package:gallerista/pages/galleries/gallery_settings_page.dart';
import 'package:gallerista/pages/galleries/photo_viewer_page.dart';
import 'package:gallerista/pages/home_shell_page.dart';
import 'package:gallerista/pages/splash_page.dart';
import 'package:gallerista/pages/welcome_page.dart';

part 'app_router.gr.dart';

@AutoRouterConfig(replaceInRouteName: 'Screen|Page,Route')
class AppRouter extends RootStackRouter {
  @override
  List<AutoRoute> get routes => [
    AutoRoute(page: SplashRoute.page, initial: true),
    // Public home page: products, QR scan, log in. No account needed.
    AutoRoute(page: WelcomeRoute.page, path: '/welcome'),
    AutoRoute(page: LoginRoute.page, path: '/login'),
    AutoRoute(page: RegisterRoute.page, path: '/register'),
    AutoRoute(page: HomeShellRoute.page, path: '/home'),
    AutoRoute(page: GalleriesRoute.page, path: '/galleries'),
    AutoRoute(
      page: GalleryDetailRoute.page,
      path: '/galleries/:collectionId',
    ),
    AutoRoute(
      page: GallerySettingsRoute.page,
      path: '/galleries/:collectionId/settings',
    ),
    AutoRoute(
      page: GalleryActivityRoute.page,
      path: '/galleries/:collectionId/activity',
    ),
    AutoRoute(
      page: GalleryDesignRoute.page,
      path: '/galleries/:collectionId/design',
    ),
    AutoRoute(page: PhotoViewerRoute.page, path: '/viewer'),
  ];
}
