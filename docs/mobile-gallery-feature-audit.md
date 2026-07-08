# Mobile Gallery App Feature Audit

Branch audited: `development`

## Implemented

- A third product named **Mobile Gallery App** is available in the existing Client Gallery / Store Gallery product switcher.
- Mobile Gallery has only two top-level navigation items: **Apps** and **Settings**.
- Apps index includes Create New, responsive app cards, search, published state, photo count, open and delete actions.
- Global Mobile Gallery settings include logo, biography, Facebook, Instagram, YouTube and LinkedIn links, contact email, phone number, business address and website.
- App Photos tab supports multi-image upload, cover selection, delete and drag-and-drop sorting.
- Uploaded files are checked as images, and deleted apps/photos clean their stored image objects.
- App Design supports Full, Third and None cover styles, changing the cover photo and click-or-slider focal-point controls.
- Echo, Spring, Lark and Sage use distinct typography, title placement, date treatment and cover layout.
- The advanced Cover Maker includes quick presets plus editable eyebrow, title, subtitle, date label, date visibility, divider, uppercase mode, horizontal alignment, vertical position, font style, title/subtitle sizing, letter spacing, content width, text colour, overlay colour/opacity and text shadow.
- Photo layout supports Vertical and Horizontal emphasis, Masonry or fixed Grid style, background colour and text colour.
- A custom app icon can be uploaded and is used by the app-specific PWA manifest, Apple touch icon and generated icons.
- App Settings includes app name, event date, Published/Unpublished status and an optional call-to-action button with label and URL.
- Preview includes responsive Mobile and Desktop device modes plus an Open Live action.
- Share supports Direct Link and a required email-template selection before opening the editable invitation composer.
- Email sharing is provider-neutral and opens the prepared message in the user's email application. A custom SMTP service can be connected later without replacing the template UI.
- Unpublished apps are blocked from public email/link sharing and show a clear publish warning.
- Public app navigation contains Home, Favorites, Share and Account.
- Favorites are stored per app in the visitor's browser.
- Visitors can download a single photo, all photos as ZIP, favorites as ZIP or a manually selected batch as ZIP.
- The Visit Website button is shown at the end of the photo section when enabled and configured.
- Public galleries use an app-specific dynamic web manifest, service-worker registration in production, 180/192/512 icons, Apple standalone metadata, dynamic iOS launch images and safe-area-aware bottom navigation.
- Android/desktop browsers use the supported PWA install prompt. iPhone/iPad users receive explicit Safari Add to Home Screen steps that can be reopened from Share or Account.
- Public photos use a responsive masonry gallery by default.
- Backend data is separated into Mobile Gallery app, image and profile-setting models and endpoints.

## Verification

- NestJS backend production build: PASS in the latest completed verification.
- Next.js frontend production build: PASS in the latest completed verification.
- Mobile Gallery TypeScript errors: none found in the latest completed repository check.
- A final verification run is included for the iOS metadata and advanced cover-maker integration.
- The full existing frontend repository may still contain unrelated pre-existing TypeScript errors outside Mobile Gallery.

## Exact platform limitations

- Apple does not allow a website or third-party JavaScript package to press **Add to Home Screen** for the user. On iPhone and iPad, installation must be confirmed through Safari Share > Add to Home Screen.
- A PWA service worker requires production HTTPS; it is intentionally disabled by the existing configuration during local development.
- The UI follows the attached Pixieset reference structure, white/teal visual language and responsive device layouts, but it remains an original implementation rather than copied Pixieset source code.
- A live end-to-end test against the production MongoDB, object storage, future SMTP service and final HTTPS domain must be performed after deployment.
