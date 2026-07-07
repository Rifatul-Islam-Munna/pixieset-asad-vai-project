export type DefaultStoreVariant = {
  id: string;
  label: string;
  options: Record<string, string>;
  price: number;
  extraShipping: number;
  hidden: boolean;
  sortOrder: number;
  isDefault?: boolean;
};

export type DefaultStoreProduct = {
  type: 'digital-download' | 'self-fulfilled';
  slug: string;
  active: boolean;
  sortOrder: number;
  name: string;
  description: string;
  productInfo: string;
  productionNote: string;
  category: 'Prints' | 'Wall Art' | 'Digital Downloads';
  price: number;
  extraShipping: number;
  images: string[];
  previewImages: string[];
  requiresPhoto: boolean;
  allowCrop: boolean;
  allowBulkPurchase: boolean;
  noImageRequired: boolean;
  exemptFromSalesTax: boolean;
  limitOnePerCheckout: boolean;
  downloadType?: 'single-photo' | 'all-photos';
  downloadSize?: string;
  options: { name: string; values: string[] }[];
  variants: DefaultStoreVariant[];
};

const preview = {
  print: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1400&q=86',
  largePrint: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=86',
  squarePrint: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1400&q=86',
  fineArt: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=86',
  mounted: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1400&q=86',
  canvas: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=86',
  metal: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1400&q=86',
  edge: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=86',
  galleryFrame: 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1400&q=86',
  metallicFrame: 'https://images.unsplash.com/photo-1519741347686-c1e331ec7f35?auto=format&fit=crop&w=1400&q=86',
  woodFrame: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1400&q=86',
  acrylic: 'https://images.unsplash.com/photo-1544078751-58fee2d8a03b?auto=format&fit=crop&w=1400&q=86',
  woodPrint: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=86',
  digital: 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1400&q=86',
};

function sizeVariants(
  values: Array<[string, string, number]>,
  extraShipping = 0,
): DefaultStoreVariant[] {
  return values.map(([inch, metric, price], index) => ({
    id: `size:${inch}`,
    label: `${inch} (${metric})`,
    options: { Size: `${inch} (${metric})` },
    price,
    extraShipping,
    hidden: false,
    sortOrder: index,
    isDefault: index === 0,
  }));
}

const printSizes: Array<[string, string, number]> = [
  ['6 x 4', '15 x 10 cm', 3],
  ['7 x 5', '18 x 13 cm', 4],
  ['10 x 8', '25 x 20 cm', 7],
  ['12 x 8', '30 x 20 cm', 8],
  ['14 x 11', '36 x 28 cm', 12],
  ['18 x 12', '46 x 30 cm', 15],
  ['20 x 16', '51 x 41 cm', 17],
  ['24 x 16', '61 x 41 cm', 22],
];

const wallSizes: Array<[string, string, number]> = [
  ['8 x 8', '20 x 20 cm', 67],
  ['10 x 8', '25 x 20 cm', 72],
  ['12 x 8', '30 x 20 cm', 79],
  ['12 x 12', '30 x 30 cm', 84],
  ['16 x 16', '41 x 41 cm', 96],
  ['20 x 16', '51 x 41 cm', 112],
  ['24 x 16', '61 x 41 cm', 128],
  ['30 x 20', '76 x 51 cm', 149],
  ['36 x 24', '91 x 61 cm', 179],
  ['40 x 30', '102 x 76 cm', 219],
];

function product(
  input: Omit<DefaultStoreProduct, 'active' | 'extraShipping' | 'noImageRequired' | 'exemptFromSalesTax' | 'limitOnePerCheckout'>,
): DefaultStoreProduct {
  return {
    active: true,
    extraShipping: 0,
    noImageRequired: false,
    exemptFromSalesTax: false,
    limitOnePerCheckout: false,
    ...input,
  };
}

export const DEFAULT_STORE_PRODUCTS: DefaultStoreProduct[] = [
  product({
    type: 'self-fulfilled', slug: 'print', sortOrder: 10, name: 'Print', category: 'Prints',
    description: 'Professional photographic prints with clean colour, natural skin tones and a lasting finish.',
    productInfo: 'Printed on professional photo paper. Available in the sizes shown and supplied ready for framing or gifting.',
    productionNote: 'Print production normally takes 3-5 business days before shipping.',
    price: 3, images: [preview.print], previewImages: [preview.print], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: printSizes.map(([inch, metric]) => `${inch} (${metric})`) }],
    variants: sizeVariants(printSizes),
  }),
  product({
    type: 'self-fulfilled', slug: 'large-format-print', sortOrder: 20, name: 'Large Format Print', category: 'Prints',
    description: 'A larger photographic print designed for statement displays and custom framing.',
    productInfo: 'Produced with archival inks on premium paper for crisp detail and smooth tonal range.',
    productionNote: 'Large format print production normally takes 4-6 business days.',
    price: 12, images: [preview.largePrint], previewImages: [preview.largePrint], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.slice(4).map(([inch, metric]) => `${inch} (${metric})`) }],
    variants: sizeVariants(wallSizes.slice(4).map(([a, b, c]) => [a, b, Math.max(12, c - 55)] as [string, string, number])),
  }),
  product({
    type: 'self-fulfilled', slug: 'square-print', sortOrder: 30, name: 'Square Print', category: 'Prints',
    description: 'Modern square prints that work beautifully for portraits, details and social-format photographs.',
    productInfo: 'Printed on premium photographic paper with an optional clean white border.',
    productionNote: 'Square print production normally takes 3-5 business days.',
    price: 3, images: [preview.squarePrint], previewImages: [preview.squarePrint], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true,
    options: [{ name: 'Size', values: ['6 x 6 (15 x 15 cm)', '8 x 8 (20 x 20 cm)', '10 x 10 (25 x 25 cm)', '12 x 12 (30 x 30 cm)'] }],
    variants: sizeVariants([['6 x 6', '15 x 15 cm', 3], ['8 x 8', '20 x 20 cm', 6], ['10 x 10', '25 x 25 cm', 9], ['12 x 12', '30 x 30 cm', 13]]),
  }),
  product({
    type: 'self-fulfilled', slug: 'giclee-fine-art-print', sortOrder: 40, name: 'Giclee Fine Art Print', category: 'Prints',
    description: 'Museum-quality giclee printing on textured fine-art paper for rich colour and exceptional longevity.',
    productInfo: 'Archival pigment inks and acid-free fine-art paper create a soft, elegant finish.',
    productionNote: 'Fine-art print production normally takes 5-7 business days.',
    price: 18, images: [preview.fineArt], previewImages: [preview.fineArt], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: printSizes.slice(2).map(([inch, metric]) => `${inch} (${metric})`) }, { name: 'Paper', values: ['Smooth Cotton', 'Textured Cotton'] }],
    variants: sizeVariants(printSizes.slice(2).map(([a, b, c]) => [a, b, c + 11] as [string, string, number])),
  }),
  product({
    type: 'self-fulfilled', slug: 'mounted-print', sortOrder: 50, name: 'Mounted Print', category: 'Prints',
    description: 'A photographic print professionally mounted to a rigid board for a clean, durable presentation.',
    productInfo: 'The print is bonded to a lightweight rigid mount and arrives ready to display or frame.',
    productionNote: 'Mounted print production normally takes 5-7 business days.',
    price: 24, images: [preview.mounted], previewImages: [preview.mounted], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: printSizes.slice(2).map(([inch, metric]) => `${inch} (${metric})`) }, { name: 'Finish', values: ['Matte', 'Lustre'] }, { name: 'Mount', values: ['3 mm', '5 mm'] }],
    variants: sizeVariants(printSizes.slice(2).map(([a, b, c]) => [a, b, c + 17] as [string, string, number]), 2),
  }),
  product({
    type: 'self-fulfilled', slug: 'canvas', sortOrder: 100, name: 'Canvas', category: 'Wall Art',
    description: 'Gallery-wrapped canvas with a soft, textured surface and vivid colour.',
    productInfo: 'Printed on archival canvas, stretched by hand and supplied ready to hang.',
    productionNote: 'Canvas production normally takes 5-7 business days.',
    price: 67, images: [preview.canvas], previewImages: [preview.canvas], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.map(([inch, metric]) => `${inch} (${metric})`) }], variants: sizeVariants(wallSizes, 7),
  }),
  product({
    type: 'self-fulfilled', slug: 'metal-print', sortOrder: 110, name: 'Metal Print', category: 'Wall Art',
    description: 'Metal aluminium prints are modern statement pieces with vibrant colour and a clean, lasting finish.',
    productInfo: 'Printed directly onto high-quality aluminium with a high-shine gloss finish. Robust, waterproof and scuff resistant, supplied ready to hang with a metal mount.',
    productionNote: 'This product ships after a print production time of 5-7 business days.',
    price: 80, images: [preview.metal], previewImages: [preview.metal], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.map(([inch, metric]) => `${inch} (${metric})`) }],
    variants: sizeVariants(wallSizes.map(([a, b, c]) => [a, b, c + 13] as [string, string, number]), 9),
  }),
  product({
    type: 'self-fulfilled', slug: 'edge-print', sortOrder: 120, name: 'Edge Print', category: 'Wall Art',
    description: 'A contemporary edge-mounted display that gives the photograph a clean floating appearance.',
    productInfo: 'The image is mounted to a rigid panel with a refined edge profile and concealed hanging system.',
    productionNote: 'Edge print production normally takes 6-8 business days.',
    price: 95, images: [preview.edge], previewImages: [preview.edge], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.map(([inch, metric]) => `${inch} (${metric})`) }],
    variants: sizeVariants(wallSizes.map(([a, b, c]) => [a, b, c + 28] as [string, string, number]), 10),
  }),
  product({
    type: 'self-fulfilled', slug: 'gallery-frame', sortOrder: 130, name: 'Gallery Frame', category: 'Wall Art',
    description: 'A timeless gallery frame with professional matting and a ready-to-hang finish.',
    productInfo: 'Includes archival print, white mat, protective glazing and a fitted hanging system.',
    productionNote: 'Framed wall art production normally takes 7-10 business days.',
    price: 76, images: [preview.galleryFrame], previewImages: [preview.galleryFrame], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.slice(1, 8).map(([inch, metric]) => `${inch} (${metric})`) }, { name: 'Frame Color', values: ['Black', 'White'] }],
    variants: sizeVariants(wallSizes.slice(1, 8).map(([a, b, c]) => [a, b, c + 9] as [string, string, number]), 9),
  }),
  product({
    type: 'self-fulfilled', slug: 'metallic-frame', sortOrder: 140, name: 'Metallic Frame', category: 'Wall Art',
    description: 'A refined metallic frame for a modern, premium presentation.',
    productInfo: 'Includes a professional print, mat, glazing and aluminium-effect frame, supplied ready to hang.',
    productionNote: 'Framed wall art production normally takes 7-10 business days.',
    price: 76, images: [preview.metallicFrame], previewImages: [preview.metallicFrame], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.slice(1, 8).map(([inch, metric]) => `${inch} (${metric})`) }, { name: 'Frame Color', values: ['Silver', 'Champagne', 'Graphite'] }],
    variants: sizeVariants(wallSizes.slice(1, 8).map(([a, b, c]) => [a, b, c + 9] as [string, string, number]), 9),
  }),
  product({
    type: 'self-fulfilled', slug: 'wood-frame', sortOrder: 150, name: 'Wood Frame', category: 'Wall Art',
    description: 'Warm natural wood framing with a clean mat and timeless gallery finish.',
    productInfo: 'Includes an archival print, white mat, protective glazing and real-wood frame.',
    productionNote: 'Wood frame production normally takes 7-10 business days.',
    price: 95, images: [preview.woodFrame], previewImages: [preview.woodFrame], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.slice(1, 8).map(([inch, metric]) => `${inch} (${metric})`) }, { name: 'Frame Color', values: ['Natural Oak', 'Walnut'] }],
    variants: sizeVariants(wallSizes.slice(1, 8).map(([a, b, c]) => [a, b, c + 28] as [string, string, number]), 10),
  }),
  product({
    type: 'self-fulfilled', slug: 'acrylic-print', sortOrder: 160, name: 'Acrylic Print', category: 'Wall Art',
    description: 'A high-gloss acrylic display with excellent depth, contrast and vibrant colour.',
    productInfo: 'The photographic print is face-mounted behind polished acrylic and supplied with a concealed mount.',
    productionNote: 'Acrylic production normally takes 7-10 business days.',
    price: 110, images: [preview.acrylic], previewImages: [preview.acrylic], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.slice(1).map(([inch, metric]) => `${inch} (${metric})`) }],
    variants: sizeVariants(wallSizes.slice(1).map(([a, b, c]) => [a, b, c + 43] as [string, string, number]), 12),
  }),
  product({
    type: 'self-fulfilled', slug: 'wood-print', sortOrder: 170, name: 'Wood Print', category: 'Wall Art',
    description: 'A photograph printed onto wood for an organic, tactile and distinctive finish.',
    productInfo: 'Natural wood grain remains subtly visible, making every finished piece unique.',
    productionNote: 'Wood print production normally takes 7-10 business days.',
    price: 98, images: [preview.woodPrint], previewImages: [preview.woodPrint], requiresPhoto: true, allowCrop: true,
    allowBulkPurchase: true, options: [{ name: 'Size', values: wallSizes.slice(1, 8).map(([inch, metric]) => `${inch} (${metric})`) }],
    variants: sizeVariants(wallSizes.slice(1, 8).map(([a, b, c]) => [a, b, c + 31] as [string, string, number]), 11),
  }),
  product({
    type: 'digital-download', slug: 'single-photo-download', sortOrder: 200, name: 'Single Photo Download', category: 'Digital Downloads',
    description: 'Download one selected photograph in high resolution.',
    productInfo: 'A personal-use high-resolution digital file delivered after successful payment.',
    productionNote: 'Digital delivery is available immediately after payment.',
    price: 12, images: [preview.digital], previewImages: [preview.digital], requiresPhoto: true, allowCrop: false,
    allowBulkPurchase: true, noImageRequired: false, exemptFromSalesTax: false, limitOnePerCheckout: false,
    downloadType: 'single-photo', downloadSize: 'High Resolution Original (Full res)', options: [], variants: [],
  }),
  product({
    type: 'digital-download', slug: 'full-gallery-download', sortOrder: 210, name: 'Full Gallery Download', category: 'Digital Downloads',
    description: 'Download the complete collection in high resolution.',
    productInfo: 'All available photographs from this collection are included for personal use.',
    productionNote: 'Digital delivery is available immediately after payment.',
    price: 99, images: [preview.digital], previewImages: [preview.digital], requiresPhoto: false, allowCrop: false,
    allowBulkPurchase: false, noImageRequired: true, exemptFromSalesTax: false, limitOnePerCheckout: true,
    downloadType: 'all-photos', downloadSize: 'High Resolution Original (Full res)', options: [], variants: [],
  }),
];
