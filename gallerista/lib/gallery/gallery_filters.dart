import 'package:gallerista/gallery/collection_models.dart';

/// Galleries filters, same options as the web Galleries page.
class GalleryFilters {
  const GalleryFilters({
    this.search = '',
    this.status = 'all',
    this.starred = 'all',
    this.eventDate = 'all',
    this.expiry = 'all',
    this.sort = 'newest',
  });

  final String search;
  final String status; // all | published | draft
  final String starred; // all | yes | no
  final String eventDate; // all | upcoming | past | none
  final String expiry; // all | active | expired | none
  final String sort; // newest | oldest | name-asc | name-desc

  bool get active =>
      search.isNotEmpty ||
      status != 'all' ||
      starred != 'all' ||
      eventDate != 'all' ||
      expiry != 'all' ||
      sort != 'newest';

  GalleryFilters copyWith({
    String? search,
    String? status,
    String? starred,
    String? eventDate,
    String? expiry,
    String? sort,
  }) => GalleryFilters(
    search: search ?? this.search,
    status: status ?? this.status,
    starred: starred ?? this.starred,
    eventDate: eventDate ?? this.eventDate,
    expiry: expiry ?? this.expiry,
    sort: sort ?? this.sort,
  );
}

/// Pure filter + sort, ported from the web `filteredCollections` memo.
List<Collection> filterGalleries(
  List<Collection> items,
  GalleryFilters f, {
  DateTime? now,
}) {
  final clock = now ?? DateTime.now();
  final today = DateTime(clock.year, clock.month, clock.day);
  final query = f.search.trim().toLowerCase();

  bool keep(Collection c) {
    final searchable = [c.name, c.status ?? '', ...c.tags]
        .join(' ')
        .toLowerCase();
    if (query.isNotEmpty && !searchable.contains(query)) return false;
    if (f.status != 'all' && c.status != f.status) return false;

    final event = c.eventDate;
    if (f.eventDate == 'upcoming' && (event == null || event.isBefore(today))) {
      return false;
    }
    if (f.eventDate == 'past' && (event == null || !event.isBefore(today))) {
      return false;
    }
    if (f.eventDate == 'none' && event != null) return false;

    final expiry = c.expiresAt;
    if (f.expiry == 'active' && (expiry == null || expiry.isBefore(clock))) {
      return false;
    }
    if (f.expiry == 'expired' && (expiry == null || !expiry.isBefore(clock))) {
      return false;
    }
    if (f.expiry == 'none' && expiry != null) return false;

    if (f.starred == 'yes' && !c.isStarred) return false;
    if (f.starred == 'no' && c.isStarred) return false;
    return true;
  }

  int time(Collection c) =>
      (c.createdAt ?? c.eventDate)?.millisecondsSinceEpoch ?? 0;

  final result = items.where(keep).toList();
  result.sort((a, b) {
    switch (f.sort) {
      case 'name-asc':
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      case 'name-desc':
        return b.name.toLowerCase().compareTo(a.name.toLowerCase());
      case 'oldest':
        return time(a).compareTo(time(b));
      default:
        return time(b).compareTo(time(a));
    }
  });
  return result;
}
