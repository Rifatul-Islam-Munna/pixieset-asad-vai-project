import 'dart:convert';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/auth/auth_api.dart';
import 'package:gallerista/core/storage/session_storage.dart';
import 'package:gallerista/core/utils/app_network_image.dart';
import 'package:gallerista/gallery/collection_models.dart';
import 'package:gallerista/pages/account_settings_pages.dart';
import 'package:gallerista/pages/settings_part2_pages.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Shows a stored image whether it is a URL or a `data:` URL (the web
/// stores branding logos as data URLs).
class SettingImage extends StatelessWidget {
  const SettingImage(this.url, {super.key, this.fit = BoxFit.contain});

  final String url;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    if (url.startsWith('data:')) {
      final comma = url.indexOf(',');
      try {
        return Image.memory(base64Decode(url.substring(comma + 1)), fit: fit);
      } catch (_) {
        return const SizedBox.shrink();
      }
    }
    return AppNetworkImage(
      url: resolveImageUrl(url),
      fit: fit,
      placeholderColor: Colors.transparent,
      allowSampleFallback: false,
    );
  }
}

/// Settings tab: account, Client Gallery settings (like the web Settings
/// tabs) and log out.
class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  Future<void> _logout(BuildContext context) async {
    await AuthApi.logout();
    if (context.mounted) await context.router.replaceAll([const WelcomeRoute()]);
  }

  void _open(BuildContext context, Widget page) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));

  @override
  Widget build(BuildContext context) {
    final user = SessionStorage.getUser();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.white,
              border: Border.all(color: AppColors.galleryBorder),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.galleryLavenderTint,
                  child: Text(
                    (user?.name.isNotEmpty ?? false)
                        ? user!.name[0].toUpperCase()
                        : '?',
                    style: const TextStyle(
                      color: AppColors.galleryPurple,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?.name ?? 'Account',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700)),
                      if ((user?.email ?? user?.phoneNumber) != null)
                        Text(user?.email ?? user!.phoneNumber!,
                            style: const TextStyle(color: AppColors.galleryMeta)),
                      Text('${user?.planName ?? 'Free'} plan',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.galleryPurple)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const _Header('Client Gallery'),
          _Tile(
            icon: Icons.palette_outlined,
            title: 'Branding',
            subtitle: 'Logo, brand name and accent color',
            onTap: () => _open(context, const BrandingPage()),
          ),
          _Tile(
            icon: Icons.branding_watermark_outlined,
            title: 'Watermark',
            subtitle: 'Text watermarks for your photos',
            onTap: () => _open(context, const WatermarksPage()),
          ),
          _Tile(
            icon: Icons.dashboard_customize_outlined,
            title: 'Presets',
            subtitle: 'Reusable gallery settings and design',
            onTap: () => _open(context, const PresetsPage()),
          ),
          _Tile(
            icon: Icons.mail_outline_rounded,
            title: 'Email Templates',
            subtitle: 'Messages for delivering galleries',
            onTap: () => _open(context, const EmailTemplatesPage()),
          ),
          _Tile(
            icon: Icons.face_retouching_natural_outlined,
            title: 'People',
            subtitle: 'Name faces found in your photos',
            onTap: () => _open(context, const PeoplePage()),
          ),
          _Tile(
            icon: Icons.tune_rounded,
            title: 'Preferences',
            subtitle: 'Language, filenames, search visibility, policies',
            onTap: () => _open(context, const PreferencesPage()),
          ),
          _Tile(
            icon: Icons.extension_outlined,
            title: 'Integrations',
            subtitle: 'Google Analytics',
            onTap: () => _open(context, const IntegrationsPage()),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              onPressed: () => _logout(context),
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Log out'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
    child: Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        letterSpacing: 1.2,
        fontWeight: FontWeight.w700,
        color: AppColors.galleryMeta,
      ),
    ),
  );
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: AppColors.galleryText),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right_rounded),
    onTap: onTap,
  );
}
