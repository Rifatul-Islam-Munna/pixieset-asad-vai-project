/// Preset defaults and the 8 built-in presets, ported from
/// `frontend/lib/dashboard-store.ts` (emptyPreset* and defaultPresetItems).
library;

const presetGeneralDefaults = <String, dynamic>{
  'collectionTags': '',
  'photoSets': '',
  'defaultWatermark': 'No watermark',
  'emailRegistration': false,
  'marketingSubscription': true,
  'galleryAssist': false,
  'slideshow': true,
  'slideshowSpeed': 'regular',
  'slideshowAutoLoop': true,
  'socialSharing': true,
  'language': 'English',
};

const presetDesignDefaults = <String, dynamic>{
  'cover': 'Center',
  'typography': 'Classic',
  'color': 'White',
  'gridStyle': 'Vertical',
  'thumbnailSize': 'Regular',
  'gridSpacing': 'Regular',
  'gridColumns': 4,
  'navigationStyle': 'Icon Only',
  'coverMotion': 'slow-zoom',
  'showCoverSmallTitle': true,
  'showCoverTitle': true,
  'showCoverDate': true,
  'showCoverButton': true,
};

const presetDownloadDefaults = <String, dynamic>{
  'photoDownload': true,
  'galleryDownload': true,
  'singlePhotoDownload': true,
  'singlePhotoDownloadEmailTracking': true,
  'restrictedSinglePhotoDownloadSize': false,
  'highResolution': true,
  'highResolutionSize': '3600px',
  'webSize': true,
  'webSizePx': '1024px',
  'videoDownload': false,
  'downloadPin': false,
  'downloadPinCode': '1234',
  'restrictDownloads': false,
  'limitDownloads': false,
  'limitPinUsage': '',
};

const presetFavoriteDefaults = <String, dynamic>{
  'favoritePhotos': true,
  'favoriteNotes': true,
  'maxFavorites': '',
  'description': '',
  'autoShareToPrintShop': false,
  'printShopEmail': '',
};

const presetStoreDefaults = <String, dynamic>{
  'storeStatus': true,
  'priceSheet': '',
  'productPreview': false,
  'showPrintStoreNav': true,
  'showBuyPhotoButton': true,
};

const presetGroups = ['general', 'design', 'download', 'favorite', 'store'];

Map<String, dynamic> _defaultsFor(String group) => switch (group) {
  'general' => presetGeneralDefaults,
  'design' => presetDesignDefaults,
  'download' => presetDownloadDefaults,
  'favorite' => presetFavoriteDefaults,
  _ => presetStoreDefaults,
};

/// A full preset with every group filled from defaults + [overrides].
Map<String, dynamic> buildPreset({
  required String id,
  required String name,
  Map<String, Map<String, dynamic>> overrides = const {},
  String updatedAt = 'Draft',
}) => {
  'id': id,
  'name': name,
  for (final g in presetGroups) g: {..._defaultsFor(g), ...?overrides[g]},
  'updatedAt': updatedAt,
};

/// Fills missing keys of a saved preset (also accepts the old
/// presetGeneral/presetDesign/… field names the web still reads).
Map<String, dynamic> normalizePreset(Map<String, dynamic> data, String localId) {
  Map<String, dynamic> group(String g) {
    final legacy = 'preset${g[0].toUpperCase()}${g.substring(1)}';
    final value = data[g] ?? data[legacy];
    return {..._defaultsFor(g), if (value is Map) ...Map<String, dynamic>.from(value)};
  }

  return {
    ...data,
    'id': data['id'] ?? localId,
    'name': data['name'] ?? data['presetName'] ?? 'Untitled Preset',
    for (final g in presetGroups) g: group(g),
  };
}

final builtInPresets = <Map<String, dynamic>>[
  buildPreset(id: 'builtin-clean-classic', name: 'Clean Classic', updatedAt: 'Built in', overrides: {
    'general': {'photoSets': 'Featured, Ceremony, Portraits'},
    'store': {'storeStatus': false},
  }),
  buildPreset(id: 'builtin-modern-story', name: 'Modern Story', updatedAt: 'Built in', overrides: {
    'general': {'photoSets': 'Story, Favorites', 'socialSharing': true},
    'design': {'cover': 'Left', 'typography': 'Modern', 'color': 'Sand', 'gridStyle': 'Horizontal', 'thumbnailSize': 'Large', 'gridSpacing': 'Large', 'navigationStyle': 'Icon & Text'},
    'download': {'downloadPin': true},
    'favorite': {'favoriteNotes': false},
  }),
  buildPreset(id: 'builtin-wedding-gallery', name: 'Wedding Gallery', updatedAt: 'Built in', overrides: {
    'general': {'collectionTags': 'Wedding', 'photoSets': 'Preview, Ceremony, Family, Couple Portraits, Reception', 'emailRegistration': true},
    'download': {'downloadPin': true, 'restrictDownloads': true},
    'favorite': {'description': 'Choose favorite images for the final album.'},
    'store': {'productPreview': true},
  }),
  buildPreset(id: 'builtin-portrait-proofing', name: 'Portrait Proofing', updatedAt: 'Built in', overrides: {
    'general': {'collectionTags': 'Portrait', 'photoSets': 'Proofs, Retouched, Favorites', 'emailRegistration': true, 'socialSharing': false},
    'design': {'cover': 'Left', 'typography': 'Modern', 'thumbnailSize': 'Large'},
    'download': {'galleryDownload': false, 'highResolution': false, 'downloadPin': true, 'limitDownloads': true, 'limitPinUsage': '25'},
    'favorite': {'maxFavorites': '20', 'description': 'Select images for retouching.'},
    'store': {'productPreview': true},
  }),
  buildPreset(id: 'builtin-newborn-soft', name: 'Newborn Soft', updatedAt: 'Built in', overrides: {
    'general': {'collectionTags': 'Newborn', 'photoSets': 'Featured, Family, Baby Details', 'emailRegistration': true},
    'design': {'typography': 'Serif', 'color': 'Sand', 'gridSpacing': 'Large'},
    'download': {'downloadPin': true},
    'favorite': {'maxFavorites': '30'},
    'store': {'productPreview': true},
  }),
  buildPreset(id: 'builtin-event-delivery', name: 'Event Delivery', updatedAt: 'Built in', overrides: {
    'general': {'collectionTags': 'Event', 'photoSets': 'Featured, Speakers, Guests, Details', 'socialSharing': true},
    'design': {'cover': 'Left', 'typography': 'Modern', 'gridStyle': 'Horizontal', 'navigationStyle': 'Icon & Text'},
    'download': {'webSizePx': '2048px', 'videoDownload': true},
    'favorite': {'favoriteNotes': false},
    'store': {'storeStatus': false},
  }),
  buildPreset(id: 'builtin-family-lifestyle', name: 'Family Lifestyle', updatedAt: 'Built in', overrides: {
    'general': {'collectionTags': 'Family', 'photoSets': 'Featured, Kids, Parents, Full Session', 'emailRegistration': true},
    'design': {'color': 'Sand'},
    'download': {'downloadPin': true},
    'favorite': {'maxFavorites': '40'},
    'store': {'productPreview': true},
  }),
  buildPreset(id: 'builtin-commercial-product', name: 'Commercial Product', updatedAt: 'Built in', overrides: {
    'general': {'collectionTags': 'Commercial', 'photoSets': 'Selects, Final Edits, Usage Approved', 'emailRegistration': true, 'socialSharing': false},
    'design': {'cover': 'Left', 'typography': 'Modern', 'gridStyle': 'Horizontal', 'thumbnailSize': 'Large'},
    'download': {'highResolutionSize': 'Original', 'downloadPin': true, 'restrictDownloads': true},
    'favorite': {'description': 'Leave usage notes and selects.'},
    'store': {'storeStatus': false},
  }),
];

bool isBuiltInPreset(Map<String, dynamic> preset) =>
    '${preset['id']}'.startsWith('builtin-');
