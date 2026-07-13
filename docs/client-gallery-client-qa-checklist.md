# Client Gallery QA Checklist

Use this document to show client every requested item is done and where to test it in UI.

## 1. Dashboard shortcuts

Status: Done.

Test:
1. Open `/dashboard/overview`.
2. In Client Gallery card, check buttons:
   - Manage Collections
   - Create Collection
   - View Homepage
   - Settings
3. Click each button and confirm it opens correct page.

Expected:
- Manage Collections opens `/dashboard/client-gallery`.
- Create Collection opens `/dashboard/client-gallery/collection-new`.
- View Homepage opens `/dashboard/client-gallery/homepage`.
- Settings opens `/dashboard/client-gallery/settings`.

## 2. Gallery preview

Status: Done.

Test:
1. Open `/dashboard/client-gallery`.
2. Find any collection.
3. Click `Preview`.
4. Also open collection detail, then use preview/open public link action if visible.

Expected:
- Public gallery opens in new tab.
- Cover, images, gallery sections, download/favorite/store buttons show based on settings.

## 3. Store product details, print sizes, prices

Status: Done.

Test global store:
1. Open `/dashboard/store-gallery`.
2. Open price sheet/products area.
3. Add or edit product.
4. Set product details, print sizes, variants, prices, shipping.
5. Save.

Test collection store:
1. Open `/dashboard/client-gallery`.
2. Open collection.
3. Open `Store` page: `/dashboard/client-gallery/collections/{collectionId}/store`.
4. Select price sheet and store toggles.
5. In `Collection product editor`, click `Add product`.
6. Add name, category, details, base price, print sizes, prices, shipping.
7. Click `Save product`.

Expected:
- Product appears in collection store list.
- Public store shows product and price.
- Print sizes show as variants.

## 4. Share: email, direct link, QR

Status: Done.

Test:
1. Open collection detail.
2. Click share action or open `/dashboard/client-gallery/collections/{collectionId}/share`.
3. Test:
   - Send email
   - Get direct link
   - QR code
4. Open direct link in private/incognito browser.
5. Scan QR with phone.

Expected:
- Email share sends/queues without error.
- Direct link opens public collection.
- QR opens same public collection URL.

## 5. Custom URL

Status: Done.

Test:
1. Open collection detail/settings.
2. Find custom URL/slug field.
3. Change slug manually.
4. Save.
5. Open new public URL.

Expected:
- User controls URL slug.
- App does not force random custom URL without user choice.

## 6. Greek fonts / Greek support

Status: Done.

Test:
1. Open gallery settings/design or admin content language areas.
2. Select Greek/GR content or Greek-compatible font option.
3. Enter Greek text in cover/title/content.
4. Save.
5. Open public gallery/homepage.

Expected:
- Greek text renders correctly.
- Font supports Greek characters.

## 7. Collection URL

Status: Done.

Test:
1. Open collection detail or share page.
2. Find `Collection URL` / direct link.
3. Copy link.
4. Open link in private/incognito browser.

Expected:
- URL opens correct public collection.
- Same URL can be used in email template/share.

## 8. Auto expiry

Status: Done.

Test:
1. Open collection detail/settings.
2. Find expiry/auto-expiry settings.
3. Set future expiry date.
4. Save.
5. Confirm public gallery remains accessible before expiry.
6. Set past expiry date for test.
7. Open public gallery.

Expected:
- Future expiry allows access.
- Past expiry blocks or hides gallery based on expiry behavior.

## 9. Collapse sidebar

Status: Done.

Test:
1. Open dashboard.
2. Click sidebar collapse button.
3. Reload page.
4. Expand again.

Expected:
- Sidebar collapses and expands.
- Dashboard remains usable in collapsed mode.

## 10. Templates by category and custom templates

Status: Done.

Built-in category presets:
- Clean Classic
- Modern Story
- Wedding Gallery
- Portrait Proofing
- Newborn Soft
- Event Delivery
- Family Lifestyle
- Commercial Product

Test built-ins:
1. Open `/dashboard/client-gallery/settings/presets`.
2. Select preset from list.
3. Review General, Design, Download, Favorite, Store tabs.
4. Save or apply to a collection.

Test custom client preset:
1. Open `/dashboard/client-gallery/settings/presets`.
2. Click `Add Preset`.
3. Change name and settings.
4. Click save.
5. Create/edit collection and select that preset.

Expected:
- Built-in presets show.
- Client can save own preset.
- Saved preset appears later and can be reused.

## 11. Gallery admin notifications for batch downloads

Status: Done.

Test:
1. Open public gallery.
2. Click download all / batch download.
3. Enter email if requested.
4. Complete download request.
5. Open collection admin activity/download area.

Expected:
- Batch download activity appears with client email.
- Admin can see download type as all/batch.

## 12. Email login / confirmed email to access gallery

Status: Done.

Test email required:
1. Open collection settings/access.
2. Enable email registration or email-required access.
3. Save.
4. Open public collection in private/incognito browser.
5. Enter email.

Test approved emails:
1. Open collection activity/access email area.
2. Add allowed email.
3. Open public gallery with allowed email.
4. Try another non-approved email.

Expected:
- Allowed/confirmed email can view gallery.
- Non-approved email is blocked or creates access request, based on settings.

## Final client demo path

Use this order for client test:
1. `/dashboard/overview`
2. `/dashboard/client-gallery`
3. Create or open collection
4. Preview public gallery
5. Share page: email, link, QR
6. Collection store page: add product, sizes, prices
7. Public store checkout test
8. Presets page: built-in category preset + custom preset
9. Public gallery: email access + batch download
10. Admin activity: confirm download/email activity
