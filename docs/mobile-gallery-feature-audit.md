# Mobile Gallery App Feature Audit

Branch audited: `development`

## Implemented

- A third product named **Mobile Gallery App** is available in the existing Client Gallery / Store Gallery product switcher.
- Mobile Gallery has only two top-level navigation items: **Apps** and **Settings**.
- Apps index includes Create New, responsive app cards, search, published state, photo count, open and delete actions.
- Global Mobile Gallery settings include logo, biography, Facebook, Instagram, YouTube and LinkedIn links, contact email, phone number, business address and website.
- App Photos supports multi-image upload, cover selection, deletion and drag-and-drop sorting.
- Uploaded photos are validated as images, and deleting apps/photos also cleans their stored objects.
- App Design supports Full, Third and None cover styles and changing the cover photo.
- The cover-photo focal point is positioned by dragging the green point directly on the image with mouse, touch or pen; the old focal sliders are removed.
- Full-cover text can be repositioned directly by choosing **Move Cover Text** and dragging the text box on the cover.
- Echo, Spring, Lark and Sage use distinct typography, title placement, date treatment and cover layout.
- The Cover Maker includes quick presets plus editable eyebrow, title, subtitle, date label, date visibility, divider, uppercase mode, alignment, position, font style, title/subtitle sizing, letter spacing, content width, text colour, overlay colour/opacity and text shadow.
- Numeric cover controls use selectable presets plus an exact-number field instead of range sliders.
- Admins can upload WOFF, WOFF2, TTF or OTF custom fonts per gallery; the chosen font is rendered in the editor preview and public gallery through a same-origin font proxy.
- Photo layout supports Vertical and Horizontal emphasis, Masonry or fixed Grid style, background colour and text colour.
- A custom app icon can be uploaded and is used by the app-specific PWA manifest, Apple touch icon and generated icons.
- App Settings includes app name, event date, Published/Unpublished status and an optional call-to-action button with label and URL.
- Preview includes responsive Mobile and Desktop device modes plus an Open Live action.
- Share supports Direct Link and a required email-template selection before opening the editable invitation composer.
- Email invitations use the global NestJS SMTP service. Mobile Gallery is connected to the same globally exported mail service intended for all backend email flows.
- Missing SMTP configuration never throws a request error: the server logs one warning and returns a safe `SMTP_NOT_CONFIGURED` result; the admin then opens the prepared invitation in the local email app.
- SMTP connection or delivery failure is logged and also falls back to the prepared local email without losing the recipient, subject, message or gallery link.
- Unpublished apps are blocked from public email/link sharing and show a clear publish warning.
- Public app navigation contains Home, Favorites, Share and Account.
- Favorites are stored per app in the visitor's browser.
- Visitors can download a single photo, all photos as ZIP, favorites as ZIP or a manually selected batch as ZIP.
- The Visit Website button is shown at the end of the photo section when enabled and configured.
- Public galleries use an app-specific dynamic web manifest, service-worker registration in production, 180/192/512 icons, Apple standalone metadata, dynamic iOS launch images and safe-area-aware bottom navigation.
- Android/desktop browsers use the supported PWA install prompt. iPhone/iPad users receive explicit Safari Add to Home Screen steps that can be reopened from Share or Account.
- Public photos use a responsive masonry gallery by default.
- Backend data is separated into Mobile Gallery app, image and profile-setting models and endpoints.

## Global SMTP configuration

Required when direct server delivery is wanted:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM=Gallery <gallery@example.com>
```

Optional:

```env
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
SMTP_STARTTLS=true
SMTP_REQUIRE_TLS=false
SMTP_TLS_REJECT_UNAUTHORIZED=true
SMTP_REPLY_TO=
SMTP_HELO_NAME=
SMTP_TIMEOUT=20000
```

If `SMTP_HOST` or `SMTP_FROM` is absent, the backend remains operational, writes a warning log once, and returns a non-error fallback result.

## Verification status

- Earlier Mobile Gallery revisions passed NestJS and Next.js production builds.
- The final direct-drag, custom-font and dependency-free SMTP changes received a code-level audit.
- A fresh completed CI report for these final changes was not available through the GitHub connector, so no new build result is claimed here.
- The full existing frontend repository may still contain unrelated pre-existing TypeScript errors outside Mobile Gallery.

## Exact platform limitations

- Apple does not allow a website or third-party JavaScript package to press **Add to Home Screen** for the user. On iPhone and iPad, installation must be confirmed through Safari Share > Add to Home Screen.
- A PWA service worker requires production HTTPS; it is intentionally disabled by the existing configuration during local development.
- The UI follows the attached Pixieset reference structure, white/teal visual language and responsive device layouts, but it remains an original implementation rather than copied Pixieset source code.
- A live end-to-end test against production MongoDB, object storage, SMTP server and final HTTPS domain must be performed after deployment.
