# Mobile Gallery App Feature Audit

Branch audited: `development`

## Implemented

- A third product named **Mobile Gallery App** is available in the existing Client Gallery / Store Gallery product switcher.
- Mobile Gallery has only two top-level navigation items: **Apps** and **Settings**.
- Apps index includes Create New, responsive app cards, search, published state, photo count, open and delete actions.
- Global Mobile Gallery settings include logo, biography, Facebook, Instagram, YouTube and LinkedIn links, contact email, phone number, business address and website.
- App Photos tab supports multi-image upload, cover selection, delete and drag-and-drop sorting.
- Uploaded files are checked as images, and deleted apps/photos clean their stored image objects.
- App Design tab supports Full, Third and None cover styles, changing the cover photo and click-or-slider focal-point controls.
- Echo, Spring, Lark and Sage now use distinct typography, title placement, date treatment and cover layout.
- Photo layout supports Vertical and Horizontal emphasis, Masonry or fixed Grid style, background colour and text colour.
- A custom app icon can be uploaded and is used by the app-specific PWA manifest and generated icons.
- App Settings includes app name, event date, Published/Unpublished status and an optional call-to-action button with label and URL.
- Preview includes responsive Mobile and Desktop device modes plus an Open Live action.
- Share supports Direct Link and a required email-template selection before opening the invitation composer.
- The email composer supports editable subject/message text, business-logo preview, Send a Copy and an Install App link.
- Email invitations can be sent through the backend when Resend is configured; otherwise the prepared invite opens in the user's email application.
- Unpublished apps are blocked from public email/link sharing and show a clear publish warning.
- Public app navigation contains Home, Favorites, Share and Account.
- Favorites are stored per app in the visitor's browser.
- Visitors can download a single photo, all photos as ZIP, favorites as ZIP or a manually selected batch as ZIP.
- The Visit Website button is shown at the end of the photo section when enabled and configured.
- Public galleries show an install-app modal and use an app-specific dynamic web manifest and generated 192px/512px icons.
- Android/desktop browsers use the supported PWA install prompt. iPhone/iPad users receive explicit Safari Add to Home Screen steps.
- The install instructions can be reopened from the Share and Account tabs.
- Public photos use a responsive masonry gallery by default.
- Backend data is separated into Mobile Gallery app, image and profile-setting models and endpoints.

## Verification

- NestJS backend production build: PASS.
- Next.js frontend production build: PASS.
- Mobile Gallery TypeScript errors: none found by the repository type-check run.
- The current verification details are recorded in `docs/mobile-gallery-final-verification.md`.
- The full existing frontend repository still has unrelated pre-existing TypeScript errors outside Mobile Gallery.

## Email delivery configuration

To send invitations directly from the backend, configure:

- `RESEND_API_KEY`
- `MOBILE_GALLERY_EMAIL_FROM` or `EMAIL_FROM`

Without those variables, the same prepared invitation safely falls back to the visitor's installed email application.

## Exact limitations

- iOS does not expose the automatic `beforeinstallprompt` event. Installation therefore follows Apple's Safari Share > Add to Home Screen flow.
- The UI follows the attached Pixieset reference structure, spacing, white/teal visual language and responsive device layouts, but it is an original implementation rather than copied Pixieset source code and should not be described as pixel-perfect without browser-by-browser visual QA.
- A live end-to-end test against production MongoDB, object storage, Resend delivery and HTTPS PWA hosting was not performed by the build workflow.
