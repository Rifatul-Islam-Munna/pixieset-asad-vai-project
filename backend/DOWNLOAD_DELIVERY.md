# Browser-side one-click photo downloads

Public gallery download requests create a short-lived authorization record and send the same frontend URL to the client and by email. The email button opens:

`https://gallerista.app/download/:token`

The download page asks the backend for a paginated manifest. The backend re-checks the 24-hour token, collection membership, removed photos, and newly private photos, then returns short-lived presigned R2 URLs or the existing public URL for legacy files. For Chrome and Edge the backend only signs URLs and does not construct ZIPs; Safari and Firefox use the bounded streaming fallback described below.

The browser fetches one photo at a time and writes a ZIP64 archive with ZIP compression disabled (photo files are already compressed). On browsers with the File System Access API, ZIP output is streamed directly to the visitor's chosen file on disk. The browser therefore does not need to hold the gallery or the completed ZIP in RAM. Safari and Firefox use a streamed backend ZIP for public gallery delivery links. The separate owner-preview ZIP flow still has a 96 MB in-memory fallback when a direct-to-disk save picker is unavailable; published mobile galleries have a native backend ZIP fallback too.

Single-photo requests redirect directly to the signed file URL rather than creating a ZIP. Old backend download URLs remain compatible and redirect to the frontend download page.

## Production environment

Backend:
- `FRONTEND_URL=https://gallerista.app`
- `PUBLIC_API_URL=https://ai-photo-book-moment-backend.wrtsxa.easypanel.host`

Frontend:
- `NEXT_PUBLIC_BASE_URL=https://ai-photo-book-moment-backend.wrtsxa.easypanel.host`

The code has safe production fallbacks for these supplied origins, but keep the environment values explicit in EasyPanel so staging and future domain changes remain predictable.

## Browser CORS requirements

Chrome and Edge fetch R2 objects directly from the visitor's device. Both public and private photo buckets must allow browser GET/HEAD requests from the frontend. The backend attempts to configure these CORS rules at startup. If the R2 API token cannot update bucket CORS, configure the buckets in Cloudflare manually:

- Allowed origin: `https://gallerista.app`
- Allowed methods: `GET`, `HEAD`, `OPTIONS`
- Allowed headers: `*`
- Exposed headers: `Content-Length`, `Content-Type`, `Content-Disposition`, `ETag`
- Max age: `86400`

Private-bucket GET access remains protected by short-lived presigned URLs; the bucket itself must remain private. Do not make the private bucket public.

Legacy `/uploads/...` photos are fetched from the backend's existing public static route. Other legacy HTTPS URLs are used as-is; their host must allow CORS from `https://gallerista.app`. If a legacy URL points at a custom Imagor/image hostname, add the same CORS response headers at that hostname (for example with a Cloudflare response-header Transform Rule). A browser cannot read a third-party image into a ZIP if that host blocks CORS. This implementation does not proxy those image bytes through the backend or move them into object storage.

A legacy photo URL that is already public remains public after it is returned to the browser; the 24-hour token protects access to the manifest, but cannot revoke a public third-party URL after a client has received it. Private R2 originals remain protected by their expiring presigned URLs. No legacy photo migration is performed.

## Email logo

The studio logo is rendered using its absolute public HTTPS URL rather than relying on a CID attachment, which avoids the broken inline-image behavior seen in Gmail. Relative `/uploads/...` logo paths are resolved against `PUBLIC_API_URL`, because the backend serves that static route.

## Security and memory

- Tokens are 256-bit random values and expire after 24 hours.
- Manifest pages contain at most 100 photos.
- Private photos are checked again on every manifest page.
- Object-storage URLs expire no later than the delivery token.
- The browser fetches and archives sequentially; it does not fetch the entire gallery concurrently.
- ZIP64 supports archives larger than 4 GB.
- For Chrome/Edge the backend handles metadata and URL signing only. For Safari/Firefox it builds ZIPs using the existing bounded-memory stream, with backpressure, cancellation and at most two concurrent archives per backend process.
- Cancelled or failed direct-to-disk downloads abort the local file stream.

## Validation

Run the focused backend tests from `backend`:

```sh
npm test -- --runInBand --runTestsByPath src/collections/collection-download-delivery.service.spec.ts src/mail/download-email.smtp.spec.ts src/mail/branding-email.service.spec.ts src/lib/minio-download.spec.ts
```

Run the frontend type check from `frontend`:

```sh
npx tsc --noEmit --pretty false
```

A local test cannot verify production R2 CORS, EasyPanel environment values, external legacy-host CORS, Gmail rendering, or actual Safari download behavior. Verify small and large galleries in Safari/iOS Safari and Chrome/Edge against the deployed services before announcing the fix to clients.

## Safari and Firefox native downloads

On the secure public download page, browsers without showSaveFilePicker get a real, user-clicked anchor to GET /public/collections/download-deliveries/:token/archive. The backend validates the original 24-hour token and gallery permissions, then streams a native ZIP attachment using the existing backpressure-aware ZIP64 implementation. It does not buffer the completed ZIP, and it allows only two archive streams at once per process. Single-photo links redirect to the authorized presigned file URL.

The Safari/Firefox ZIP stream currently requires photo originals in R2/object storage. External-only or local-only legacy URLs cannot be packaged by that backend fallback. They must be migrated to object storage before native ZIP download; never turn arbitrary external image URLs into backend fetch targets. Published mobile-gallery downloads use a separate native backend ZIP route for Safari/Firefox, including selected photos and single-file attachment links; only the owner-preview ZIP workflow retains the 96 MB browser fallback without a native save picker.

Run backend ZIP stream tests: node --require ts-node/register/transpile-only --test scripts/stream-photo-zip.test.cjs.
