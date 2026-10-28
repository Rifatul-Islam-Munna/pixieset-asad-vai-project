import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:gallerista/core/cms/home_cms.dart';

/// One product on the website's home page (CMS `content.<lang>.products`).
class HomeProduct {
  const HomeProduct({
    required this.title,
    required this.tagline,
    required this.description,
  });

  final String title;
  final String tagline;
  final String description;
}

/// One "why us" card (CMS `featureCards`); [icon] is the website's Lucide
/// icon name, e.g. "CloudUpload".
class HomeFeature {
  const HomeFeature({
    required this.title,
    required this.text,
    required this.icon,
  });

  final String title;
  final String text;
  final String icon;
}

class HomeStat {
  const HomeStat({required this.value, required this.label});

  final String value;
  final String label;
}

/// What the app's public home page shows: the same content the admin edits
/// for the website's home page (`GET /home-cms`), so both always match.
/// [fallback] mirrors the website's current text for offline first launches.
class HomeContent {
  const HomeContent({
    required this.eyebrow,
    required this.titleLines,
    required this.subtitle,
    required this.products,
    required this.features,
    required this.stats,
    required this.ctaTitle,
    required this.ctaSubtitle,
    required this.websiteUrl,
  });

  final String eyebrow;

  /// Headline lines; the website shows the first dark, the rest in purple.
  final List<String> titleLines;
  final String subtitle;
  final List<HomeProduct> products;
  final List<HomeFeature> features;
  final List<HomeStat> stats;
  final String ctaTitle;
  final String ctaSubtitle;

  /// The website's home page, opened from the products and links.
  final String websiteUrl;

  static final fallback = HomeContent(
    eyebrow: 'The Premium Client Gallery Experience',
    titleLines: const ['Elegant galleries.', 'Endless possibilities'],
    subtitle: 'The all-in-one platform for photographers who believe every '
        'client experience should be as beautiful as their photography',
    products: const [
      HomeProduct(
        title: 'Client Gallery',
        tagline: 'Share, deliver, proof and sell',
        description: 'Beautiful client collections with favorites, downloads '
            'and face search.',
      ),
      HomeProduct(
        title: 'Store Gallery',
        tagline: 'Prints and downloads',
        description: 'Sell print products, digital downloads and wall art '
            'from any collection.',
      ),
      HomeProduct(
        title: 'Mobile Gallery App',
        tagline: 'Installable photo apps',
        description: 'Create mobile-first gallery apps clients can save to '
            'their phones.',
      ),
    ],
    features: const [
      HomeFeature(
        title: 'All in the Cloud',
        text: 'Secure storage and lightning fast delivery.',
        icon: 'CloudUpload',
      ),
      HomeFeature(
        title: 'Private & Secure',
        text: 'Password protection and privacy controls.',
        icon: 'LockKeyhole',
      ),
      HomeFeature(
        title: 'AI-Powered',
        text: 'Smart search finds photos instantly.',
        icon: 'Sparkles',
      ),
      HomeFeature(
        title: 'Built to Sell',
        text: 'Beautiful stores to sell prints and downloads.',
        icon: 'ShoppingBag',
      ),
      HomeFeature(
        title: 'Works Everywhere',
        text: 'Perfect on any device, any time.',
        icon: 'Smartphone',
      ),
    ],
    stats: const [
      HomeStat(value: '2,000+', label: 'Photographers'),
      HomeStat(value: '1M+', label: 'Galleries Delivered'),
      HomeStat(value: '50M+', label: 'Photos Uploaded'),
      HomeStat(value: '120+', label: 'Countries Worldwide'),
    ],
    ctaTitle: 'Start using Gallerista today for free',
    ctaSubtitle: 'Free forever. Upgrade when you need to.',
    websiteUrl: _envWebsite(),
  );

  /// The latest content from the admin, or [fallback] when offline.
  static Future<HomeContent> load() async {
    final cms = await HomeCms.fetch();
    return cms == null ? fallback : HomeContent.fromCms(cms);
  }

  factory HomeContent.fromCms(Map<String, dynamic> cms) {
    final d = fallback;
    final lang = '${cms['defaultLanguage'] ?? 'en'}';
    final all = cms['content'];
    final content = all is Map ? (all[lang] ?? all['en']) : null;
    final c = content is Map ? content : const <String, dynamic>{};
    final hero = c['hero'] is Map ? c['hero'] as Map : const {};
    final cta = c['cta'] is Map ? c['cta'] as Map : const {};
    final seo = cms['seo'] is Map ? cms['seo'] as Map : const {};

    String text(Object? v, String or) {
      final s = _plain('${v ?? ''}');
      return s.isEmpty ? or : s;
    }

    List<T> list<T extends Object>(
      Object? raw,
      T? Function(Map item) parse,
      List<T> or,
    ) {
      if (raw is! List) return or;
      final items = raw.whereType<Map>().map(parse).nonNulls.toList();
      return items.isEmpty ? or : items;
    }

    final title = _plain('${hero['title'] ?? ''}', keepLines: true);
    final site = '${seo['siteCanonicalUrl'] ?? ''}'.trim();
    return HomeContent(
      eyebrow: text(hero['eyebrow'], d.eyebrow),
      titleLines: title.isEmpty
          ? d.titleLines
          : title.split('\n').where((l) => l.trim().isNotEmpty).toList(),
      subtitle: text(hero['subtitle'], d.subtitle),
      products: list(c['products'], (p) {
        final t = _plain('${p['title'] ?? ''}');
        if (t.isEmpty) return null;
        return HomeProduct(
          title: t,
          tagline: _plain('${p['price'] ?? ''}'),
          description: _plain('${p['description'] ?? ''}'),
        );
      }, d.products),
      features: list(c['featureCards'], (f) {
        final t = _plain('${f['title'] ?? ''}');
        if (t.isEmpty) return null;
        return HomeFeature(
          title: t,
          text: _plain('${f['text'] ?? ''}'),
          icon: '${f['icon'] ?? ''}',
        );
      }, d.features),
      stats: list(c['stats'], (s) {
        final v = _plain('${s['value'] ?? ''}');
        if (v.isEmpty) return null;
        return HomeStat(value: v, label: _plain('${s['label'] ?? ''}'));
      }, d.stats),
      ctaTitle: text(cta['title'], d.ctaTitle),
      ctaSubtitle: text(cta['subtitle'], d.ctaSubtitle),
      websiteUrl: site.startsWith('http') ? site : d.websiteUrl,
    );
  }

  static String _envWebsite() {
    final url = dotenv.isInitialized
        ? dotenv.get('WEB_URL', fallback: '').split('#').first.trim()
        : '';
    // A dev address (localhost) can't be opened on a phone; use the live site.
    final local = url.isEmpty ||
        url.contains('localhost') ||
        url.contains('127.0.0.1') ||
        url.contains('10.0.2.2');
    return local ? 'https://gallerista.app/' : url;
  }

  /// CMS text can hold rich-text HTML (`<span style…>`, `<br>`); the app
  /// shows plain text. With [keepLines], `<br>` and newlines become line
  /// breaks; otherwise everything is joined into one line.
  static String _plain(String html, {bool keepLines = false}) {
    var s = html.replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n');
    s = s.replaceAll(RegExp(r'<[^>]*>'), '');
    s = s
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>');
    if (!keepLines) s = s.replaceAll(RegExp(r'\s*\n\s*'), ' ');
    return s.trim();
  }
}
