# Direct photo downloads

Download requests now return a ready download-page URL immediately. The same
URL is queued for email, with up to five attempts and exponential backoff.
SMTP acceptance is recorded as `emailSentAt`; this does not prove inbox delivery.
The page and its signed object URLs expire 24 hours after the request. Each click
redirects to R2; the backend never reads, archives, copies, or uploads photo bytes.
The page lists up to 100 files at a time. Clients download individual photos.
There is no ZIP or browser blob buffering.

Production requirements:

- Set `PUBLIC_API_URL` to the publicly accessible backend origin, including any
  reverse-proxy path prefix. Do not use the frontend origin.
- Configure `SMTP_HOST`, `SMTP_FROM`, and the provider's authentication/TLS settings.
- R2 credentials must allow `GetObject` on both public and private photo buckets.
- Originals must exist in R2. Restricted downloads use the cached small variant
  or an existing storage thumbnail; they never fall back to private originals.
  External-only or local-only legacy photos require migration to object storage.
- Recreate the backend container to apply the single-process PM2 configuration,
  allocator setting, and `procps` installation. Old `BACKEND_WEB_CONCURRENCY`
  settings are no longer used. The 768 MB V8 heap limit excludes native buffers;
  PM2's RSS restart threshold is a fallback, not a total container memory limit.
- Set `IMAGE_BACKGROUND_PROCESSING_CONCURRENCY=1` and `SHARP_CACHE_MEMORY_MB=0`
  when old deployment environment values override the new defaults. Image
  background concurrency is capped at two even when an older value is higher.

Queued, interrupted, and unexpired failed ZIP requests are converted to direct
download pages. Existing archive email failures become retryable. Expired legacy
archives are deleted in bounded batches; original photos are never deleted by
delivery cleanup.

Run `node scripts/inspect-download-job.cjs` inside the production container for
read-only status counts, error categories, and email-attempt timestamps. It uses
`MONGODB_URL` and prints no recipient addresses, link tokens, or credentials.
Compare idle and repeated-download container RSS after recreating the service.
Production memory and SMTP delivery require live verification; local tests
cannot establish the deployed service's actual memory use or inbox placement.
