# Public Collection Print Store Plan

## Goal

Build a Pixieset-style store inside existing public collections. When photographer turns Store on for a collection, public gallery shows `Print Store`, `Buy Photo`, cart, and checkout. Buyer can choose product type, select photos, crop each photo for chosen size, add to cart, enter professional/customer info, pay by the collection owner's Stripe account, and all events show under collection activity.

## Core Rules

- Store belongs to photographer/user, not admin.
- Stripe payment must use the store owner's Stripe keys/account from Store Settings.
- Public gallery design must stay same-to-same with current gallery: white top nav, simple text tabs, thin dividers, no heavy cards.
- Store is collection-aware. Only products/price sheets assigned to that collection appear.
- Each product type can be turned on/off.
- Each product size/variant can be turned on/off and priced separately.
- Buyer must choose exact variant before adding non-digital products to cart.
- Products requiring a photo must force image selection before cart.
- Crop data must be saved per cart item/order item.
- Activity must log store view, product view, add to cart, checkout started, payment success/fail, order created.

## Existing Code To Extend

- Frontend public gallery: `frontend/components/dashboard/public-gallery.tsx`
- Frontend public store: `frontend/components/dashboard/public-store.tsx`
- Dashboard store UI: `frontend/components/dashboard/client-dashboard.tsx`
- Store hooks/types: `frontend/api-hooks/use-store.ts`
- Store backend module: `backend/src/store/*`
- Collection activity/download surface: collection detail activity area in dashboard

## Photographer Dashboard UX

### Collection Store Toggle

Location: collection detail toolbar/settings.

Fields:

- `Store enabled` toggle.
- `Assigned price sheet` select.
- `Show Print Store in gallery nav` toggle.
- `Show Buy Photo in lightbox` toggle.
- `Allow bulk buy from gallery` toggle.
- `Minimum order amount`.
- `Currency`.

Behavior:

- If Store off, hide `Print Store`, cart icon, and `Buy Photo`.
- If Store on but no price sheet, show dashboard warning and hide public buy buttons.
- Store setting should save inside collection settings or collection store config.

### Price Sheet Builder

Keep current Store Gallery products page, but make it print-store specific.

Sections:

- Prints
- Wall Art
- Digital Downloads
- Other Products

Default product groups:

- Prints: Print, Large Format Print, Square Print, Giclee Fine Art Print, Mounted Print
- Wall Art: Canvas, Metal Print, Edge Print, Gallery Frame, Metallic Frame, Wood Frame, Acrylic Print, Wood Print
- Digital: Single Photo Download, Full Gallery Download

Each product editor:

- Active toggle.
- Public product name.
- Category.
- Description.
- Product info accordion text.
- Production/shipping note.
- Product preview images.
- Requires photo toggle.
- Allow multiple photos toggle.
- Allow crop toggle.
- Option groups:
  - Size
  - Paper/finish
  - Frame color
  - Mount type
  - Border
  - Quantity rules
- Variant table:
  - Variant label
  - Options
  - Price
  - Extra shipping
  - Hidden toggle
  - Default toggle

Mounted Print example:

- Product active on/off.
- Sizes editable.
- Finish values editable.
- Mount thickness editable.
- Each variant has own price.
- Photographer can hide one size without deleting it.

### Store Product Setup Flow

1. Photographer opens `Store`.
2. Creates or chooses price sheet.
3. Adds products or enables default templates.
4. Edits each product sizes/prices.
5. Assigns price sheet to collection.
6. Turns Store on in collection.
7. Public gallery updates immediately.

## Public Gallery UX

### Top Navigation

Match screenshot style:

- Left: collection title + studio name.
- Middle: set tabs.
- Right: `Print Store`, cart icon, favorite, download, share, slideshow.

When `Print Store` hover/click:

- Open clean mega menu under nav.
- White background.
- Two columns:
  - Prints list.
  - Wall Art list.
- Only active products show.
- Clicking product opens product detail page.

### Gallery Grid

Keep current masonry/manual gallery.

Add:

- Hover icons remain.
- If store enabled, lightbox has `Buy Photo` button on top-right.
- `Buy Photo` opens side modal for current photo.

## Buy This Photo Modal

Triggered from photo lightbox `Buy Photo`.

Layout same as screenshot:

- Left side: dimmed photo preview area.
- Right side: white panel.
- Header: `Buy This Photo`, `Visit Store`.
- Tabs: `Prints`, `Wall Art`.
- Prints tab first shows common print sizes with prices.
- Wall Art tab shows product cards.

Rules:

- If buyer clicks normal print size, open crop step for that selected photo.
- If buyer clicks Wall Art product, open product detail/options.
- `Visit Store` opens full print store page with all products.

## Full Print Store UX

Route idea:

- `/collection/[slug]/[name]/store`
- `/collection/[slug]/[name]/store/[productSlug]`

Store home:

- Same top nav.
- Product category tabs/list.
- Product cards with large preview images.
- Price line: `From EUR 80.00`.
- `View Gallery` link back.
- Cart icon.

Product detail:

- Breadcrumb: `Home / Wall Art / Metal Print`.
- Left: product hero image + thumbnails.
- Right:
  - product name
  - from price
  - description
  - size buttons
  - other options if enabled
  - `Buy Prints`
  - product info accordion
  - shipping/production note
- `You Might Also Like` below.

Click `Buy Prints`:

1. If no photo selected, open photo picker.
2. Buyer selects one or more collection images.
3. Buyer chooses options/size for each image.
4. Buyer crops each image.
5. Buyer adds to cart.

## Photo Picker UX

Open after `Buy Prints` when product requires images.

Features:

- Masonry gallery same as public gallery.
- Set tabs at top.
- Search/filter if face search exists.
- Multi-select if product allows bulk.
- Selected count sticky bottom.
- Button: `Continue`.

Selection rules:

- Product `allowBulkPurchase=false`: one image only.
- Product `allowBulkPurchase=true`: many images.
- Digital full-gallery product: no photo picker needed.

## Crop UX

Use a cropper package such as `react-easy-crop` or `react-advanced-cropper`.

Crop screen:

- Left: image cropper.
- Right: selected product summary.
- Aspect ratio locked from selected size.
- Controls:
  - zoom
  - rotate
  - reset
  - fit/fill
- Button: `Apply Crop`.

Saved crop payload per line item:

```ts
crop: {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  rotation: number;
  aspectRatio: string;
}
```

No image file needs to be generated at cart time. Save crop coordinates and original image ID/url.

## Cart UX

Cart drawer:

- Product image thumbnail with crop preview.
- Product name.
- Variant/options.
- Quantity.
- Unit price.
- Remove/edit crop.
- Subtotal, shipping, tax, discount, total.
- Checkout button.

Cart item model:

```ts
{
  productId: string;
  productName: string;
  category: "Prints" | "Wall Art" | "Digital";
  imageId?: string;
  imageUrl?: string;
  variantId: string;
  variantLabel: string;
  options: Record<string, string>;
  crop?: CropData;
  quantity: number;
  unitPrice: number;
  extraShipping: number;
  total: number;
}
```

## Checkout UX

Steps:

1. Contact info:
   - full name
   - email
   - phone
2. Shipping address:
   - country
   - address line 1
   - address line 2
   - city
   - state/region
   - postal code
3. Professional info if enabled by photographer:
   - company/studio name
   - tax/VAT number
   - invoice note
4. Delivery method.
5. Payment.

Payment:

- Create pending order first.
- Create Stripe PaymentIntent using owner's Stripe settings.
- Confirm card payment.
- Verify payment on backend.
- Mark order paid.
- Show success page.

Important:

- Do not use admin Stripe.
- Never expose owner secret key to frontend.
- Backend chooses Stripe key by collection owner/userId.

## Backend Data Model

### Store Product

Extend current `StoreProduct`:

```ts
slug: string;
active: boolean;
sortOrder: number;
requiresPhoto: boolean;
allowCrop: boolean;
allowBulkPurchase: boolean;
productInfo: string;
productionNote: string;
previewImages: string[];
```

Variant should become stronger:

```ts
{
  id: string;
  label: string;
  options: Record<string, string>;
  price: number;
  extraShipping: number;
  hidden: boolean;
  sortOrder: number;
}
```

### Store Order Item

Extend current `StoreOrderItem`:

```ts
collectionId: string;
imageId?: string;
imageUrl?: string;
crop?: CropData;
extraShipping?: number;
fulfillmentStatus?: "pending" | "in-production" | "ready" | "shipped" | "delivered";
```

### Store Order

Extend current `StoreOrder`:

```ts
collectionId: string;
priceSheetId: string;
stripePaymentIntentId?: string;
stripeAccountMode: "owner";
checkoutSource: "public-gallery" | "public-store" | "buy-photo";
professionalInfo?: {
  company?: string;
  taxId?: string;
  invoiceNote?: string;
};
activityLogIds?: string[];
```

### Collection Store Config

Add to collection settings:

```ts
store: {
  enabled: boolean;
  priceSheetId?: string;
  showPrintStoreNav: boolean;
  showBuyPhotoButton: boolean;
  allowBulkBuy: boolean;
  minimumOrderAmount?: number;
}
```

### Activity Entity

Add store activity type under collection activity:

```ts
type:
  | "download"
  | "favorite"
  | "store_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_started"
  | "payment_succeeded"
  | "payment_failed"
  | "order_created";
metadata: {
  orderId?: string;
  productId?: string;
  imageId?: string;
  amount?: number;
  currency?: string;
}
```

## Backend API Plan

Public store:

- `GET /public/collections/:slug/:name/store`
- `GET /public/collections/:slug/:name/store/products/:productSlug`
- `POST /public/collections/:slug/:name/store/cart/price`
- `POST /public/collections/:slug/:name/store/orders`
- `POST /public/collections/:slug/:name/store/payments/stripe-intent`
- `POST /public/collections/:slug/:name/store/payments/verify`
- `POST /public/collections/:slug/:name/activity`

Dashboard store:

- `PATCH /collections/:id/store`
- `GET /store/price-sheets?collectionId=...`
- Existing product CRUD stays, but add active/slug/crop/product info fields.
- Add product reorder endpoint if needed.

Payment backend rule:

1. Resolve public collection.
2. Get collection owner `userId`.
3. Get owner store settings.
4. Confirm Stripe enabled and secret key exists.
5. Create PaymentIntent with owner secret key.
6. Attach metadata:
   - orderId
   - collectionId
   - ownerUserId
7. Never fallback to admin Stripe.

## Frontend State Plan

Use cart state scoped by collection:

```ts
storeCart: {
  collectionId: string;
  items: CartItem[];
  couponCode?: string;
  totals: CartTotals;
}
```

Persist in `localStorage` by key:

```ts
pixieset-store-cart:${collectionId}
```

Clear cart after successful payment.

## UI Components To Build

- `PublicStoreNav`
- `PrintStoreMegaMenu`
- `BuyPhotoButton`
- `BuyThisPhotoModal`
- `PublicStoreHome`
- `PublicProductDetail`
- `PhotoPickerModal`
- `PhotoCropModal`
- `CartDrawer`
- `CheckoutFlow`
- `OrderSuccessPage`
- `CollectionStoreSettingsPanel`
- `ProductVariantMatrix`
- `StoreActivityTimeline`

## Implementation Phases

### Phase 1: Data Safety

- Add missing backend fields.
- Add collection store config.
- Add public store endpoints.
- Make Stripe owner-only, no admin fallback.
- Add store activity logging.

### Phase 2: Dashboard Setup

- Build collection Store toggle/settings.
- Improve product editor with active toggles and variant matrix.
- Add default product templates for Prints and Wall Art.
- Assign price sheet to collection.

### Phase 3: Public Store UI

- Add `Print Store` nav item.
- Add mega menu.
- Add store home.
- Add product detail page.
- Match screenshot spacing/typography.

### Phase 4: Buy Photo Flow

- Add lightbox `Buy Photo`.
- Add `Buy This Photo` modal.
- Add variant selection.
- Add crop modal.
- Add cart drawer.

### Phase 5: Checkout

- Add customer/professional info form.
- Add shipping/tax/discount calculation.
- Add Stripe payment.
- Add order success page.

### Phase 6: Activity + Admin Ops

- Show store activity under collection activity.
- Add order details with image/crop preview.
- Add order fulfillment status.
- Add email notifications later if needed.

## Acceptance Checklist

- Store off means no public store UI.
- Store on means `Print Store` appears in public nav.
- Mega menu only shows active products.
- `Buy Photo` appears in lightbox only if enabled.
- Buyer cannot add print/wall art without variant choice.
- Buyer cannot add photo-required product without selected image.
- Crop saved per item.
- Cart shows correct price/quantity/options/crop.
- Checkout uses owner Stripe only.
- Paid order appears in photographer Store Orders.
- Collection activity logs full store flow.
- Public UI stays same-to-same with reference screenshots.
