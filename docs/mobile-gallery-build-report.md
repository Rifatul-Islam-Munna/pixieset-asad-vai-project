# Mobile Gallery Build Verification

Generated from the development branch by GitHub Actions.

- Backend build: PASS
- Frontend build: PASS

## Backend log tail
```text
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me

added 879 packages, and audited 880 packages in 15s

168 packages are looking for funding
  run `npm fund` for details

7 vulnerabilities (2 moderate, 5 high)

To address all issues, run:
  npm audit fix

Run `npm audit` for details.

> backend@0.0.1 build
> nest build

```

## Frontend log tail
```text
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec instead
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated source-map@0.8.0-beta.0: The work that was done in this beta branch won't be included in future versions
npm warn deprecated source-map@0.8.0-beta.0: The work that was done in this beta branch won't be included in future versions

added 997 packages, and audited 998 packages in 21s

279 packages are looking for funding
  run `npm fund` for details

8 vulnerabilities (7 moderate, 1 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.

> frontend@0.1.0 build
> next build

⚠ No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache
Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry

▲ Next.js 16.2.9 (Turbopack)
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 22.2s
  Skipping validation of types
  Finished TypeScript config validation in 5ms ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/19) ...
  Generating static pages using 3 workers (4/19) 
  Generating static pages using 3 workers (9/19) 
  Generating static pages using 3 workers (14/19) 
✓ Generating static pages using 3 workers (19/19) in 507ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /admin
├ ƒ /admin/login
├ ƒ /api/collection-favorites
├ ƒ /api/collection-image-favorites
├ ƒ /api/collections/[collectionId]/images
├ ƒ /api/mobile-gallery/apps/[appId]/images
├ ƒ /api/mobile-gallery/assets
├ ƒ /api/public-download
├ ƒ /api/public-print-store/[identifier]/activity
├ ƒ /api/public-print-store/[identifier]/cart/price
├ ƒ /api/public-print-store/[identifier]/checkout
├ ƒ /api/public-print-store/checkout-session/[sessionId]
├ ƒ /api/public-store/[identifier]/checkout
├ ƒ /api/public-store/checkout-session/[sessionId]
├ ƒ /api/pwa-icon
├ ƒ /collection/[name]/[galary]
├ ƒ /collection/[name]/[galary]/checkout
├ ƒ /collection/[name]/[galary]/store
├ ƒ /collection/[name]/[galary]/store/[productSlug]
├ ƒ /collection/[name]/[galary]/store/success
├ ƒ /dashboard
├ ƒ /dashboard/[section]
├ ƒ /dashboard/[section]/[page]
├ ƒ /dashboard/[section]/collections/[collectionId]
├ ƒ /dashboard/[section]/collections/[collectionId]/download
├ ƒ /dashboard/[section]/collections/[collectionId]/mail-preview
├ ƒ /dashboard/[section]/collections/[collectionId]/store
├ ƒ /dashboard/[section]/marketing/[marketingPage]
├ ƒ /dashboard/[section]/pricing/[productId]
├ ƒ /dashboard/[section]/products/[priceSheetId]
├ ƒ /dashboard/[section]/products/[priceSheetId]/[productId]
├ ƒ /dashboard/[section]/settings
├ ƒ /dashboard/[section]/settings/[...settingsPage]
├ ƒ /dashboard/client-gallery
├ ƒ /dashboard/mobile-gallery
├ ƒ /dashboard/mobile-gallery/apps/[appId]
├ ƒ /dashboard/mobile-gallery/apps/[appId]/preview
├ ƒ /dashboard/mobile-gallery/apps/[appId]/share
├ ƒ /dashboard/mobile-gallery/settings
├ ƒ /login
├ ƒ /manifest.webmanifest
├ ƒ /mobile-gallery/[slug]
├ ƒ /mobile-gallery/[slug]/icon/[size]
├ ƒ /mobile-gallery/[slug]/manifest.webmanifest
├ ƒ /plans
├ ƒ /pricing
└ ƒ /register


ƒ  (Dynamic)  server-rendered on demand

```
