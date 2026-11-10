# One-click photo downloads

Gallery, set, and favorite download links immediately start one ZIP attachment
containing all requested photos inside a named folder. The gallery UI starts the
download automatically after the request and retains a "Download again" link.
Browsers cannot silently create arbitrary folders; extract the ZIP after download.
Single-photo requests redirect to the original or permitted small file in R2.

The exact URL returned to the browser is persisted as `downloadUrl` and used in
both the email button and plain text. The first email attempt runs during the
request, independent of `APP_BACKGROUND_WORKER`. Retries run every three seconds
on each API process using atomic MongoDB claims, with up to five attempts and
exponential backoff. Email concurrency is capped at two per process. The response
reports `emailStatus` as `sent`, `queued`, or `failed`; the frontend shows the
actual result. SMTP acceptance is recorded as `emailSentAt`; it does not prove
inbox delivery. A retry can resend after a crash between SMTP acceptance and the
database update.

The download URL expires 24 hours after the request. An already started transfer
can finish after expiry. ZIPs stream through the backend directly from storage,
one file at a time, without compression, temporary files, archive uploads, or
whole-gallery buffers. Slow-client backpressure reaches storage. Two concurrent
archives are allowed per process; additional requests receive 503 and Retry-After.
Storage stalls and browser disconnects cancel the upstream and free the slot.
Image metadata is queried in batches of 100. ZIP64 supports galleries over 4 GB.
ZIP metadata and unique filenames still grow with file count. Archive bytes use
bounded stream buffers; backend bandwidth is used for the duration of a transfer.

Production requirements:

- Set `PUBLIC_API_URL` to the publicly accessible backend origin, including any
  reverse-proxy path prefix. Do not use the frontend origin.
- Configure `SMTP_HOST`, `SMTP_FROM`, and the provider's authentication/TLS settings.
- R2 credentials must allow `GetObject` on both public and private photo buckets.
- The reverse proxy must allow long streamed responses and avoid response
  buffering. The endpoint sets `X-Accel-Buffering: no` and `no-transform`.
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

Queued, interrupted, and unexpired failed ZIP requests become immediately
downloadable. Existing archive email failures become retryable. Expired legacy
archives are deleted in bounded batches; original photos are never deleted by
delivery cleanup.

Run `node scripts/inspect-download-job.cjs` inside the production container for
read-only status counts, error categories, and email-attempt timestamps. It uses
`MONGODB_URL` and prints no recipient addresses, link tokens, or credentials.
Compare idle and repeated-download container RSS after recreating the service.
Production memory and SMTP delivery require live verification; local tests
cannot establish the deployed service's actual memory use or inbox placement.

Validation without building the application:

```sh
node --require ts-node/register/transpile-only --test scripts/stream-photo-zip.test.cjs
npm test -- --runInBand --runTestsByPath src/collections/collection-download-delivery.service.spec.ts src/mail/download-email.smtp.spec.ts
```

The stream tests validate original file bytes and folder names, ZIP64 output,
128 MB of generated photos with less than 2 MB read-ahead, cancellation, errors,
and stalled sources. SMTP tests use a local test server and send no external mail.
