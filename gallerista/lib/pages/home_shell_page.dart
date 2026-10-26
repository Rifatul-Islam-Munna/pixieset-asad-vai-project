import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/pages/galleries/galleries_page.dart';
import 'package:gallerista/pages/library_page.dart';
import 'package:gallerista/pages/settings_page.dart';
import 'package:gallerista/pages/starred_page.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Main screen after login: Galleries, Photo Library and Starred, like the
/// Client Gallery sidebar on the web.
@RoutePage()
class HomeShellPage extends StatefulWidget {
  const HomeShellPage({super.key});

  @override
  State<HomeShellPage> createState() => _HomeShellPageState();
}

class _HomeShellPageState extends State<HomeShellPage> {
  var _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          GalleriesPage(active: _index == 0),
          LibraryPage(active: _index == 1),
          StarredPage(active: _index == 2),
          const SettingsPage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: AppColors.white,
        indicatorColor: AppColors.galleryLavenderTint,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.photo_library_outlined),
            selectedIcon: Icon(Icons.photo_library_rounded,
                color: AppColors.galleryPurple),
            label: 'Galleries',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon:
                Icon(Icons.grid_view_rounded, color: AppColors.galleryPurple),
            label: 'Library',
          ),
          NavigationDestination(
            icon: Icon(Icons.star_outline_rounded),
            selectedIcon:
                Icon(Icons.star_rounded, color: AppColors.galleryPurple),
            label: 'Starred',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon:
                Icon(Icons.settings_rounded, color: AppColors.galleryPurple),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
