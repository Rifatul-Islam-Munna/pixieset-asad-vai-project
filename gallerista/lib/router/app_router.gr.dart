// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

part of 'app_router.dart';

/// generated route for
/// [GalleriesPage]
class GalleriesRoute extends PageRouteInfo<GalleriesRouteArgs> {
  GalleriesRoute({Key? key, bool active = true, List<PageRouteInfo>? children})
    : super(
        GalleriesRoute.name,
        args: GalleriesRouteArgs(key: key, active: active),
        initialChildren: children,
      );

  static const String name = 'GalleriesRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<GalleriesRouteArgs>(
        orElse: () => const GalleriesRouteArgs(),
      );
      return GalleriesPage(key: args.key, active: args.active);
    },
  );
}

class GalleriesRouteArgs {
  const GalleriesRouteArgs({this.key, this.active = true});

  final Key? key;

  final bool active;

  @override
  String toString() {
    return 'GalleriesRouteArgs{key: $key, active: $active}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! GalleriesRouteArgs) return false;
    return key == other.key && active == other.active;
  }

  @override
  int get hashCode => key.hashCode ^ active.hashCode;
}

/// generated route for
/// [GalleryActivityPage]
class GalleryActivityRoute extends PageRouteInfo<GalleryActivityRouteArgs> {
  GalleryActivityRoute({
    Key? key,
    required String collectionId,
    String galleryName = '',
    List<PageRouteInfo>? children,
  }) : super(
         GalleryActivityRoute.name,
         args: GalleryActivityRouteArgs(
           key: key,
           collectionId: collectionId,
           galleryName: galleryName,
         ),
         rawPathParams: {'collectionId': collectionId},
         initialChildren: children,
       );

  static const String name = 'GalleryActivityRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<GalleryActivityRouteArgs>(
        orElse: () => GalleryActivityRouteArgs(
          collectionId: pathParams.getString('collectionId'),
        ),
      );
      return GalleryActivityPage(
        key: args.key,
        collectionId: args.collectionId,
        galleryName: args.galleryName,
      );
    },
  );
}

class GalleryActivityRouteArgs {
  const GalleryActivityRouteArgs({
    this.key,
    required this.collectionId,
    this.galleryName = '',
  });

  final Key? key;

  final String collectionId;

  final String galleryName;

  @override
  String toString() {
    return 'GalleryActivityRouteArgs{key: $key, collectionId: $collectionId, galleryName: $galleryName}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! GalleryActivityRouteArgs) return false;
    return key == other.key &&
        collectionId == other.collectionId &&
        galleryName == other.galleryName;
  }

  @override
  int get hashCode =>
      key.hashCode ^ collectionId.hashCode ^ galleryName.hashCode;
}

/// generated route for
/// [GalleryDesignPage]
class GalleryDesignRoute extends PageRouteInfo<GalleryDesignRouteArgs> {
  GalleryDesignRoute({
    Key? key,
    required String collectionId,
    List<PageRouteInfo>? children,
  }) : super(
         GalleryDesignRoute.name,
         args: GalleryDesignRouteArgs(key: key, collectionId: collectionId),
         rawPathParams: {'collectionId': collectionId},
         initialChildren: children,
       );

  static const String name = 'GalleryDesignRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<GalleryDesignRouteArgs>(
        orElse: () => GalleryDesignRouteArgs(
          collectionId: pathParams.getString('collectionId'),
        ),
      );
      return GalleryDesignPage(key: args.key, collectionId: args.collectionId);
    },
  );
}

class GalleryDesignRouteArgs {
  const GalleryDesignRouteArgs({this.key, required this.collectionId});

  final Key? key;

  final String collectionId;

  @override
  String toString() {
    return 'GalleryDesignRouteArgs{key: $key, collectionId: $collectionId}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! GalleryDesignRouteArgs) return false;
    return key == other.key && collectionId == other.collectionId;
  }

  @override
  int get hashCode => key.hashCode ^ collectionId.hashCode;
}

/// generated route for
/// [GalleryDetailPage]
class GalleryDetailRoute extends PageRouteInfo<GalleryDetailRouteArgs> {
  GalleryDetailRoute({
    Key? key,
    required String collectionId,
    Collection? initial,
    List<PageRouteInfo>? children,
  }) : super(
         GalleryDetailRoute.name,
         args: GalleryDetailRouteArgs(
           key: key,
           collectionId: collectionId,
           initial: initial,
         ),
         rawPathParams: {'collectionId': collectionId},
         initialChildren: children,
       );

  static const String name = 'GalleryDetailRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<GalleryDetailRouteArgs>(
        orElse: () => GalleryDetailRouteArgs(
          collectionId: pathParams.getString('collectionId'),
        ),
      );
      return GalleryDetailPage(
        key: args.key,
        collectionId: args.collectionId,
        initial: args.initial,
      );
    },
  );
}

class GalleryDetailRouteArgs {
  const GalleryDetailRouteArgs({
    this.key,
    required this.collectionId,
    this.initial,
  });

  final Key? key;

  final String collectionId;

  final Collection? initial;

  @override
  String toString() {
    return 'GalleryDetailRouteArgs{key: $key, collectionId: $collectionId, initial: $initial}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! GalleryDetailRouteArgs) return false;
    return key == other.key &&
        collectionId == other.collectionId &&
        initial == other.initial;
  }

  @override
  int get hashCode => key.hashCode ^ collectionId.hashCode ^ initial.hashCode;
}

/// generated route for
/// [GallerySettingsPage]
class GallerySettingsRoute extends PageRouteInfo<GallerySettingsRouteArgs> {
  GallerySettingsRoute({
    Key? key,
    required String collectionId,
    List<PageRouteInfo>? children,
  }) : super(
         GallerySettingsRoute.name,
         args: GallerySettingsRouteArgs(key: key, collectionId: collectionId),
         rawPathParams: {'collectionId': collectionId},
         initialChildren: children,
       );

  static const String name = 'GallerySettingsRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<GallerySettingsRouteArgs>(
        orElse: () => GallerySettingsRouteArgs(
          collectionId: pathParams.getString('collectionId'),
        ),
      );
      return GallerySettingsPage(
        key: args.key,
        collectionId: args.collectionId,
      );
    },
  );
}

class GallerySettingsRouteArgs {
  const GallerySettingsRouteArgs({this.key, required this.collectionId});

  final Key? key;

  final String collectionId;

  @override
  String toString() {
    return 'GallerySettingsRouteArgs{key: $key, collectionId: $collectionId}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! GallerySettingsRouteArgs) return false;
    return key == other.key && collectionId == other.collectionId;
  }

  @override
  int get hashCode => key.hashCode ^ collectionId.hashCode;
}

/// generated route for
/// [HomeShellPage]
class HomeShellRoute extends PageRouteInfo<void> {
  const HomeShellRoute({List<PageRouteInfo>? children})
    : super(HomeShellRoute.name, initialChildren: children);

  static const String name = 'HomeShellRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      return const HomeShellPage();
    },
  );
}

/// generated route for
/// [LoginPage]
class LoginRoute extends PageRouteInfo<void> {
  const LoginRoute({List<PageRouteInfo>? children})
    : super(LoginRoute.name, initialChildren: children);

  static const String name = 'LoginRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      return const LoginPage();
    },
  );
}

/// generated route for
/// [PhotoViewerPage]
class PhotoViewerRoute extends PageRouteInfo<PhotoViewerRouteArgs> {
  PhotoViewerRoute({
    Key? key,
    required List<CollectionImage> images,
    int initialIndex = 0,
    List<PageRouteInfo>? children,
  }) : super(
         PhotoViewerRoute.name,
         args: PhotoViewerRouteArgs(
           key: key,
           images: images,
           initialIndex: initialIndex,
         ),
         initialChildren: children,
       );

  static const String name = 'PhotoViewerRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      final args = data.argsAs<PhotoViewerRouteArgs>();
      return PhotoViewerPage(
        key: args.key,
        images: args.images,
        initialIndex: args.initialIndex,
      );
    },
  );
}

class PhotoViewerRouteArgs {
  const PhotoViewerRouteArgs({
    this.key,
    required this.images,
    this.initialIndex = 0,
  });

  final Key? key;

  final List<CollectionImage> images;

  final int initialIndex;

  @override
  String toString() {
    return 'PhotoViewerRouteArgs{key: $key, images: $images, initialIndex: $initialIndex}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! PhotoViewerRouteArgs) return false;
    return key == other.key &&
        const ListEquality<CollectionImage>().equals(images, other.images) &&
        initialIndex == other.initialIndex;
  }

  @override
  int get hashCode =>
      key.hashCode ^
      const ListEquality<CollectionImage>().hash(images) ^
      initialIndex.hashCode;
}

/// generated route for
/// [RegisterPage]
class RegisterRoute extends PageRouteInfo<void> {
  const RegisterRoute({List<PageRouteInfo>? children})
    : super(RegisterRoute.name, initialChildren: children);

  static const String name = 'RegisterRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      return const RegisterPage();
    },
  );
}

/// generated route for
/// [SplashPage]
class SplashRoute extends PageRouteInfo<void> {
  const SplashRoute({List<PageRouteInfo>? children})
    : super(SplashRoute.name, initialChildren: children);

  static const String name = 'SplashRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      return const SplashPage();
    },
  );
}

/// generated route for
/// [WelcomePage]
class WelcomeRoute extends PageRouteInfo<void> {
  const WelcomeRoute({List<PageRouteInfo>? children})
    : super(WelcomeRoute.name, initialChildren: children);

  static const String name = 'WelcomeRoute';

  static PageInfo page = PageInfo(
    name,
    builder: (data) {
      return const WelcomePage();
    },
  );
}
