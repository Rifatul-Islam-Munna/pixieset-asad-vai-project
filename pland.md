# Public Homepage and Collection Subdomain Plan

## 1. Goal

Give every enabled user homepage a public first-level subdomain while keeping the current Next.js pages and NestJS public features internally.

Example public URLs:

```text
https://asad.example.com/
https://asad.example.com/wedding
https://asad.example.com/wedding/favorites
https://asad.example.com/wedding/store
https://asad.example.com/wedding/store/product-slug
https://asad.example.com/wedding/checkout
```

Internally, Next.js continues rendering the existing routes:

```text
asad.example.com/
  -> /home/asad

asad.example.com/wedding
  -> /collection/asad/wedding

asad.example.com/wedding/favorites
  -> /collection/asad/wedding/favorites

asad.example.com/wedding/store
  -> /collection/asad/wedding/store
```

These must be rewrites, not redirects. The visitor always sees the clean subdomain URL.

## 2. Scope

Subdomains expose only public photographer pages:

- Public homepage
- Published collections
- Collection password/access flow
- Favorites
- Downloads and download tracking
- Face search
- Store, product builder, cart, checkout, payment success
- Other features already available inside a public collection
- Required static assets and internal public API handlers

Subdomains must not expose:

- Login
- Registration
- User dashboard
- Admin dashboard
- Plans or pricing pages
- Private settings
- Authenticated management APIs

Main-domain behavior remains unchanged.

## 3. Domain Model

Use the existing `Homepage.slug` as the subdomain label.

```text
Homepage.slug = asad
Public hostname = asad.example.com
```

Requirements:

- Keep homepage slug globally unique.
- Normalize to lowercase.
- Allow only letters, digits, and hyphens.
- Reject leading/trailing hyphens.
- Reserve system names such as `www`, `api`, `admin`, `app`, `mail`, `ftp`, `cdn`, `assets`, `support`, and `status`.
- Do not automatically change an existing published slug without a migration/redirect strategy.

Collections currently have user-scoped slugs. Therefore two users can both own a collection named `wedding`. Every subdomain collection lookup must validate the homepage owner before returning a collection.

Correct lookup:

```text
siteSlug -> Homepage -> homepage.userId
homepage.userId + collectionSlug -> Collection
```

Never resolve a subdomain collection using collection slug alone.

## 4. Environment Configuration

Frontend runtime/build environment:

```env
NEXT_PUBLIC_ROOT_DOMAIN=example.com
ROOT_DOMAIN=example.com
NEXT_PUBLIC_SITE_URL=https://example.com
```

Backend environment:

```env
PUBLIC_ROOT_DOMAIN=example.com
FRONTEND_URL=https://example.com
```

Use environment values instead of hardcoding the production domain.

Development options:

```text
asad.localhost:3000
asad.localtest.me:3000
```

Hostname parsing must remove the port before extracting the subdomain.

## 5. Frontend Hostname Rewrite

Create `frontend/proxy.ts` because this project uses Next.js 16.

Proxy responsibilities:

1. Read `x-forwarded-host` first, then `host`.
2. Remove port and lowercase the hostname.
3. Ignore the configured root hostname.
4. Ignore explicitly reserved system hostnames.
5. Extract the first-level homepage slug.
6. Allow Next.js assets, public files, and required API handlers.
7. Rewrite allowed public paths to current internal routes.
8. Return a public 404 or redirect to the subdomain homepage for forbidden routes.

Conceptual route map:

| Visible subdomain path | Internal existing route |
|---|---|
| `/` | `/home/{siteSlug}` |
| `/{collectionSlug}` | `/collection/{siteSlug}/{collectionSlug}` |
| `/{collectionSlug}/favorites` | `/collection/{siteSlug}/{collectionSlug}/favorites` |
| `/{collectionSlug}/store` | `/collection/{siteSlug}/{collectionSlug}/store` |
| `/{collectionSlug}/store/{productSlug}` | `/collection/{siteSlug}/{collectionSlug}/store/{productSlug}` |
| `/{collectionSlug}/store/success` | `/collection/{siteSlug}/{collectionSlug}/store/success` |
| `/{collectionSlug}/checkout` | `/collection/{siteSlug}/{collectionSlug}/checkout` |

Do not rewrite these framework paths as tenant pages:

```text
/_next/*
/favicon.ico
/manifest.webmanifest
/robots.txt
/sitemap.xml
/api/*
```

The `/api/*` handlers available on tenant hosts must be explicitly audited and restricted to public collection operations.

Forbidden tenant-host paths:

```text
/login
/register
/dashboard/*
/admin/*
/plans
/pricing
```

## 6. Public Links

When rendered on a user subdomain, homepage collection links must be relative clean paths:

```text
/wedding
/birthday
/client-album
```

They must not expose internal paths such as:

```text
/collection/Asad/wedding
```

Create one public-route helper rather than constructing URLs separately in many components.

The helper should produce:

- Homepage URL
- Collection URL
- Favorites URL
- Store URL
- Product URL
- Checkout and success URLs

Keep internal route identifiers separate from browser-visible URLs.

## 7. Backend Ownership Safety

Enhance public collection resolution to accept a homepage/site slug and enforce ownership.

Possible API shape:

```text
GET  /public/sites/:siteSlug
GET  /public/sites/:siteSlug/collections/:collectionSlug
GET  /public/sites/:siteSlug/collections/:collectionSlug/images
POST /public/sites/:siteSlug/collections/:collectionSlug/access-request
POST /public/sites/:siteSlug/collections/:collectionSlug/download-activity
```

Store, cart, checkout, favorites, and face-search operations need the same owner scope.

To reduce frontend changes, existing service methods may be reused after resolving the collection by `{ userId, slug }`. Do not maintain two independent business-logic implementations.

Add/confirm compound indexes:

```text
Homepage: unique { slug: 1 }
Homepage: unique { userId: 1 }
Collection: unique or indexed { userId: 1, slug: 1 }
CollectionImage: indexed { collectionId: 1, order: 1 }
```

## 8. Dashboard Public URL

The user dashboard should show and copy:

```text
https://{homepage.slug}.{PUBLIC_ROOT_DOMAIN}
```

Replace the displayed `/home/{slug}` URL. The old route may remain internally available during migration.

Do not create DNS records or EasyPanel services when a user account/homepage is created. Saving the unique homepage slug is enough; wildcard DNS handles the hostname automatically.

## 9. Passwords, Favorites, and Browser Storage

Each subdomain is a separate browser origin.

Audit all public collection behavior that uses:

- Cookies
- `localStorage`
- `sessionStorage`
- IndexedDB
- Service workers

Data previously stored for `example.com` is not automatically available to `asad.example.com`.

Requirements:

- Keep public password/access behavior working on the tenant hostname.
- Keep favorites tied to the correct collection/user.
- Avoid sharing dashboard authentication cookies with all tenant subdomains unless strictly required.
- Prefer public collection session data scoped to the tenant origin.
- Ensure PWA/service-worker scope cannot control other subdomains.

## 10. SEO and Sharing

- Generate canonical URLs from the public tenant hostname.
- Generate Open Graph URLs/images using the visible tenant URL.
- Update JSON-LD collection URLs.
- Update copy/share buttons.
- Update store checkout success/cancel URLs.
- Avoid indexing both old and new public URLs as duplicate pages.
- After rollout, redirect old public `/home/{slug}` and collection-sharing URLs to canonical subdomain URLs when safe.
- Keep internal rewrites invisible; use redirects only for legacy canonicalization.

## 11. Cloudflare Setup

Cloudflare will manage DNS, public proxying, and browser-facing SSL. The domain remains registered at Namecheap. The VPS and EasyPanel deployment remain on the current server.

### 11.1 Add domain to Cloudflare

1. Create/use a Cloudflare account.
2. Add `example.com` using the Free plan.
3. Let Cloudflare scan existing DNS records.
4. Verify all existing records before changing nameservers.

Pay special attention to:

- `MX` records
- SPF `TXT`
- DKIM `TXT`/`CNAME`
- DMARC `TXT`
- Any verification records
- Existing API/backend records

### 11.2 Change Namecheap nameservers

In Namecheap:

```text
Domain List -> Manage -> Nameservers -> Custom DNS
```

Enter the two nameservers supplied by Cloudflare.

This changes DNS management only. It does not move the VPS, application, database, or files.

### 11.3 Cloudflare DNS records

Create/confirm:

| Type | Name | Target | Proxy |
|---|---|---|---|
| `A` | `@` | VPS public IP | Proxied (orange) |
| `A` | `*` | VPS public IP | Proxied (orange) |

Add explicit records where needed, for example `api`, `mail`, or other services. Exact DNS records take priority over wildcard DNS records.

The single `*` record automatically covers future homepage slugs:

```text
asad.example.com
john.example.com
studio-123.example.com
```

No Cloudflare record is created per user.

### 11.4 Cloudflare edge SSL

Cloudflare Universal SSL automatically covers the apex and first-level subdomains after the zone becomes active:

```text
example.com
*.example.com
```

Keep the wildcard DNS record proxied. Wait for Universal SSL status to become active before production testing.

### 11.5 Cloudflare Origin CA certificate

Create one long-lived origin certificate in:

```text
Cloudflare -> SSL/TLS -> Origin Server -> Create Certificate
```

Hostnames:

```text
example.com
*.example.com
```

Save the certificate and private key securely. Install them once in EasyPanel/Traefik for the frontend service.

Then set Cloudflare encryption mode to:

```text
Full (strict)
```

Never use `Flexible`; it leaves the Cloudflare-to-origin leg unencrypted and can create redirect loops.

Cloudflare Origin CA certificates are intended for proxied traffic. If Cloudflare proxying is disabled, browsers will not directly trust that origin certificate.

### 11.6 Cloudflare caching rules

- Do not cache authenticated/dashboard paths.
- Do not cache password-validation responses.
- Do not cache personalized favorites/access responses.
- Do not cache checkout/cart mutations.
- Static Next.js assets may be cached normally.
- Public HTML caching should be introduced only after cache keys include hostname and relevant access state.

## 12. EasyPanel Setup

Keep one frontend service. Do not create a service/container per user.

Add two domain entries to the frontend service:

```text
example.com
*.example.com
```

EasyPanel requires separate root and wildcard domain entries.

For the wildcard entry:

- Enable wildcard-domain routing.
- Route to the existing frontend container port.
- Install/configure the Cloudflare Origin CA certificate and key.
- Do not request/create a separate certificate for every user hostname.

The backend can retain its current domain/internal networking. The tenant subdomain should reach backend functionality through existing frontend server requests or audited public API routes.

## 13. Rollout Order

1. Add root-domain environment variables.
2. Add reserved homepage slug validation.
3. Add owner-scoped collection resolution.
4. Add public URL helper.
5. Update homepage collection links.
6. Add `frontend/proxy.ts` invisible hostname rewrites.
7. Block private pages on tenant hosts.
8. Update checkout/share/canonical URLs.
9. Audit cookies and browser storage.
10. Test locally with subdomain-capable localhost naming.
11. Add domain to Cloudflare and verify imported DNS/email records.
12. Change Namecheap nameservers.
13. Add proxied root and wildcard Cloudflare records.
14. Generate/install Cloudflare Origin CA certificate.
15. Configure EasyPanel root and wildcard frontend domains.
16. Set Cloudflare SSL mode to `Full (strict)`.
17. Test one staging homepage slug.
18. Enable production dashboard URL display.
19. Add legacy canonical redirects after successful verification.

## 14. Test Matrix

### Routing

- `example.com` remains main site.
- `example.com/login` works normally.
- `asad.example.com` loads only Asad homepage.
- `asad.example.com/wedding` loads only Asad wedding collection.
- Internal route never appears in browser address bar.
- Unknown subdomain returns 404.
- Disabled homepage returns 404.
- Unknown collection returns 404.
- `/login`, `/dashboard`, and `/admin` do not render on tenant hosts.

### Duplicate slugs

- Asad and John can both have `wedding`.
- `asad.example.com/wedding` loads Asad collection.
- `john.example.com/wedding` loads John collection.

### Existing public features

- Password-protected homepage
- Password/access-protected collection
- Image pagination
- Favorites
- Downloads
- Face search
- Store catalog
- Product configuration
- Cart totals
- Checkout
- Payment success/cancel return URL
- Share/copy URL

### Infrastructure

- Root hostname has valid browser SSL.
- Random first-level subdomain has valid browser SSL.
- Cloudflare SSL mode is `Full (strict)`.
- EasyPanel origin certificate matches root and wildcard.
- Cloudflare wildcard record is proxied.
- Existing email delivery still works after nameserver change.
- Direct VPS access does not expose unintended tenant/private content.

## 15. Rollback

If hostname rollout fails:

1. Keep existing `/home/{slug}` and `/collection/...` routes available.
2. Stop displaying subdomain URLs in the dashboard.
3. Disable/remove the EasyPanel wildcard domain router.
4. Remove or DNS-disable the wildcard Cloudflare record.
5. Keep root-domain DNS and application deployment unchanged.

No user data migration should be required to roll back because homepage and collection records remain in the same MongoDB database.

## 16. Definition of Done

- One wildcard DNS record supports every current/future homepage slug.
- One EasyPanel frontend service handles all tenant subdomains.
- Cloudflare provides public SSL and proxying.
- EasyPanel uses one wildcard origin certificate.
- Browser shows clean subdomain URLs.
- Next.js internally reuses existing public pages.
- No private page is available from tenant subdomains.
- Every public collection operation validates homepage ownership.
- Existing public collection features work without visible regressions.
- Main-domain login/dashboard/admin behavior is unchanged.
