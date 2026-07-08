# Mobile Gallery App Feature Audit

Branch audited: `development`

## Implemented

- A third product named **Mobile Gallery App** is available in the existing Client Gallery / Store Gallery product switcher.
- Mobile Gallery has only two top-level navigation items: **Apps** and **Settings**.
- Apps index includes Create New, app cards, search, published state, photo count, open and delete actions.
- Global Mobile Gallery settings include logo, biography, Facebook, Instagram, YouTube and LinkedIn links, contact email, phone number, business address and website.
- App Photos tab supports multi-image upload, cover selection, delete and drag-and-drop sorting.
- App Design tab supports Full, Third and None cover styles, changing the cover photo and focal-point controls.
- Echo, Spring, Lark and Sage themes use different typography and cover alignment.
- Photo layout supports Vertical and Horizontal emphasis, Masonry or fixed Grid style, background colour and text colour.
- A custom app icon can be uploaded.
- App Settings includes app name, event date, Published/Unpublished status and an optional call-to-action button with label and URL.
- Preview opens a responsive phone-style public gallery preview.
- Share supports Direct Link and a two-step email-template flow before opening the invitation composer.
- Public app navigation contains Home, Favorites, Share and Account.
- Favorites are stored per app in the visitor's browser.
- Visitors can download a single photo, all photos as ZIP, favorites as ZIP or a manually selected batch as ZIP.
- The Visit Website button is shown at the end of the photo section when enabled and configured.
- Public galleries show an install-app modal and use an app-specific dynamic web manifest and generated 192px/512px icons.
- Android/desktop browsers use the supported PWA install prompt. iPhone users receive Safari Add to Home Screen instructions.
- Public photos use a responsive masonry gallery by default.
- Backend data is separated into Mobile Gallery app, image and profile-setting models and endpoints.

## Verification

- NestJS backend production build: PASS.
- Next.js frontend production build: PASS.
- Mobile Gallery TypeScript errors: none found by the repository type-check run.
- The full existing frontend repository still has unrelated pre-existing TypeScript errors; these are listed in `docs/mobile-gallery-type-report.md`.

## Exact limitations

- Email sharing prepares the complete invitation and public app link in the visitor's installed email application through `mailto:`. It does not send mail from a server because no SMTP/email-delivery configuration was provided.
- iOS does not expose the automatic `beforeinstallprompt` event. Installation therefore follows Apple's Safari Share > Add to Home Screen flow.
- The UI follows the attached Pixieset reference structure, spacing, white/teal visual language and responsive phone layout, but it is an original implementation rather than copied Pixieset source code and should not be described as pixel-perfect without browser-by-browser visual QA.
- A live end-to-end test against production MongoDB, object storage, email delivery and HTTPS PWA hosting was not performed by the build workflow.
