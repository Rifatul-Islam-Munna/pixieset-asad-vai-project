import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/cms/home_content.dart';
import 'package:gallerista/core/cms/site_logo.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/pages/scan_widgets.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';
import 'package:url_launcher/url_launcher.dart';

/// The app's public home page, shown to anyone who isn't logged in: what
/// Gallerista offers (the same content the admin edits for the website),
/// QR scanning for clients, and the way in to log in or sign up.
@RoutePage()
class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key});

  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  HomeContent _content = HomeContent.fallback;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final content = await HomeContent.load();
    if (mounted) setState(() => _content = content);
  }

  Future<void> _openWebsite() async {
    try {
      final opened = await launchUrl(
        Uri.parse(_content.websiteUrl),
        mode: LaunchMode.externalApplication,
      );
      if (!opened) AppToast.error('Could not open the website.');
    } catch (_) {
      AppToast.error('Could not open the website.');
    }
  }

  void _login() => unawaited(context.router.push(const LoginRoute()));

  void _register() => unawaited(context.router.push(const RegisterRoute()));

  @override
  Widget build(BuildContext context) {
    final c = _content;
    return Scaffold(
      backgroundColor: AppColors.galleryBackground,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _TopBar(onLogin: _login)),
            SliverToBoxAdapter(
              child: _Hero(
                content: c,
                onStart: _register,
                onWebsite: _openWebsite,
              ),
            ),
            const SliverToBoxAdapter(child: ScanCard()),
            const SliverToBoxAdapter(child: RecentScansRow()),
            SliverToBoxAdapter(child: _Stats(stats: c.stats)),
            const SliverToBoxAdapter(
              child: _SectionTitle(
                eyebrow: 'OUR PRODUCTS',
                title: 'Everything you need to deliver',
              ),
            ),
            SliverList.list(
              children: [
                for (final p in c.products)
                  _ProductCard(product: p, onTap: _openWebsite),
              ],
            ),
            const SliverToBoxAdapter(
              child: _SectionTitle(
                eyebrow: 'WHY PHOTOGRAPHERS CHOOSE US',
                title: 'Built for beautiful delivery',
              ),
            ),
            SliverList.list(
              children: [for (final f in c.features) _FeatureRow(feature: f)],
            ),
            SliverToBoxAdapter(
              child: _CallToAction(
                title: c.ctaTitle,
                subtitle: c.ctaSubtitle,
                onStart: _register,
                onLogin: _login,
              ),
            ),
            SliverToBoxAdapter(
              child: _Footer(website: c.websiteUrl, onTap: _openWebsite),
            ),
            SliverToBoxAdapter(
              child: SizedBox(height: MediaQuery.paddingOf(context).bottom + 16),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onLogin});

  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 12, 12, 4),
      child: Row(
        children: [
          const SiteLogo(
            height: 26,
            maxWidth: 180,
            fallback: Text(
              'GALLERISTA',
              style: TextStyle(
                fontSize: 13,
                letterSpacing: 3,
                fontWeight: FontWeight.w800,
                color: AppColors.galleryPurple,
              ),
            ),
          ),
          const Spacer(),
          FilledButton(
            onPressed: onLogin,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.galleryPrimary,
              foregroundColor: AppColors.white,
              minimumSize: const Size(0, 40),
              padding: const EdgeInsets.symmetric(horizontal: 18),
            ),
            child: const Text('Log in'),
          ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.content,
    required this.onStart,
    required this.onWebsite,
  });

  final HomeContent content;
  final VoidCallback onStart;
  final VoidCallback onWebsite;

  @override
  Widget build(BuildContext context) {
    final lines = content.titleLines;
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 20, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            color: AppColors.galleryLavenderTint,
            child: Text(
              content.eyebrow,
              style: const TextStyle(
                color: AppColors.galleryPurple,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text.rich(
            TextSpan(
              children: [
                for (var i = 0; i < lines.length; i++)
                  TextSpan(
                    text: i == lines.length - 1 ? lines[i] : '${lines[i]}\n',
                    // Like the website: first line dark, the rest purple.
                    style: TextStyle(
                      color: i == 0
                          ? AppColors.galleryText
                          : AppColors.galleryPurple,
                    ),
                  ),
              ],
            ),
            style: const TextStyle(
              fontSize: 32,
              height: 1.15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            content.subtitle,
            style: const TextStyle(
              color: AppColors.galleryMutedText,
              fontSize: 15,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton(
                onPressed: onStart,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.galleryPurple,
                  foregroundColor: AppColors.white,
                  minimumSize: const Size(0, 48),
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                ),
                child: const Text('Get started free'),
              ),
              OutlinedButton.icon(
                onPressed: onWebsite,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 48),
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                ),
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: const Text('Visit website'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.stats});

  final List<HomeStat> stats;

  @override
  Widget build(BuildContext context) {
    if (stats.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(color: AppColors.galleryBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            children: [
              for (var i = 0; i < stats.length; i += 2)
                Row(
                  children: [
                    Expanded(child: _StatCell(stat: stats[i])),
                    Expanded(
                      child: i + 1 < stats.length
                          ? _StatCell(stat: stats[i + 1])
                          : const SizedBox.shrink(),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.stat});

  final HomeStat stat;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Column(
        children: [
          Text(
            stat.value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.galleryPurple,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            stat.label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: AppColors.galleryMeta),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.eyebrow, required this.title});

  final String eyebrow;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 32, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow,
            style: const TextStyle(
              fontSize: 11,
              letterSpacing: 1.6,
              fontWeight: FontWeight.w700,
              color: AppColors.galleryPurple,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

/// A product from the website; tapping opens the website's home page.
class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onTap});

  final HomeProduct product;
  final VoidCallback onTap;

  IconData get _icon {
    final t = product.title.toLowerCase();
    if (t.contains('store') || t.contains('shop')) {
      return Icons.storefront_outlined;
    }
    if (t.contains('mobile') || t.contains('app')) {
      return Icons.phone_iphone_rounded;
    }
    return Icons.photo_library_outlined;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Semantics(
        button: true,
        label: '${product.title}. Opens the website.',
        excludeSemantics: true,
        child: Material(
          color: AppColors.white,
          shape: const Border.fromBorderSide(
            BorderSide(color: AppColors.galleryBorder),
          ),
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    color: AppColors.galleryLavenderTint,
                    child: Icon(_icon, color: AppColors.galleryPurple),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (product.tagline.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            product.tagline,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.galleryPurple,
                            ),
                          ),
                        ],
                        if (product.description.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            product.description,
                            style: const TextStyle(
                              fontSize: 13,
                              height: 1.45,
                              color: AppColors.galleryMutedText,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(
                    Icons.open_in_new_rounded,
                    size: 18,
                    color: AppColors.galleryMeta,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.feature});

  final HomeFeature feature;

  /// The website uses Lucide icon names; these are the Material twins.
  IconData get _icon => switch (feature.icon) {
        'CloudUpload' => Icons.cloud_upload_outlined,
        'LockKeyhole' || 'Lock' => Icons.lock_outline_rounded,
        'Sparkles' => Icons.auto_awesome_outlined,
        'ShoppingBag' => Icons.shopping_bag_outlined,
        'Smartphone' => Icons.smartphone_rounded,
        'Heart' => Icons.favorite_border_rounded,
        'Download' => Icons.download_rounded,
        'Image' || 'Images' => Icons.image_outlined,
        _ => Icons.check_circle_outline_rounded,
      };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.galleryLavenderTint,
            child: Icon(_icon, size: 20, color: AppColors.galleryPurple),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  feature.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  feature.text,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.45,
                    color: AppColors.galleryMutedText,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CallToAction extends StatelessWidget {
  const _CallToAction({
    required this.title,
    required this.subtitle,
    required this.onStart,
    required this.onLogin,
  });

  final String title;
  final String subtitle;
  final VoidCallback onStart;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      padding: const EdgeInsets.all(22),
      color: AppColors.galleryPrimary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: const TextStyle(color: Color(0xB3FFFFFF), height: 1.4),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: onStart,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.white,
              foregroundColor: AppColors.galleryPrimary,
              minimumSize: const Size.fromHeight(48),
            ),
            child: const Text('Create a free account'),
          ),
          const SizedBox(height: 6),
          TextButton(
            onPressed: onLogin,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.galleryLavender,
              minimumSize: const Size.fromHeight(44),
            ),
            child: const Text('I already have an account — Log in'),
          ),
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.website, required this.onTap});

  final String website;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final host = Uri.tryParse(website)?.host ?? '';
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Center(
        child: TextButton.icon(
          onPressed: onTap,
          icon: const Icon(Icons.language_rounded, size: 18),
          label: Text(host.isEmpty ? 'Visit our website' : 'Visit $host'),
        ),
      ),
    );
  }
}
