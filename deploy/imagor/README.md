# Imagor -> R2 Result Storage

This folder is the existing Imagor EasyPanel app. It does not create a second cache/backend application.

## Data path

1. Browser uploads the original directly to private R2.
2. Backend stores only the original object key and deterministic signed Imagor URLs.
3. Until the whole gallery cache is ready, the gallery keeps serving every eligible image through Imagor.
4. The small cache worker in this same Imagor container asks the backend only for signed URL jobs.
5. The worker requests those URLs through localhost Imagor and discards the response locally.
6. Imagor reads the private original, transforms it, and writes the processed result directly to `S3_RESULT_STORAGE_BUCKET`.
7. The worker HEAD-checks R2 Result Storage. No transformed image bytes ever pass through the backend.
8. Only when every eligible image has all required variants confirmed in R2 does the backend switch that gallery to the public Result Storage URLs.

The switch is gallery-wide. There is never a half-Imagor / half-R2 gallery.

## Deletion and changes

Watermark, preset, or set changes immediately mark cached variants stale and put the whole gallery back on Imagor while new variants are generated.

When an image is deleted, it disappears from Mongo/gallery immediately. The Imagor-side worker deletes its Result Storage keys using the same R2 credentials already present on the Imagor app. Optional Cloudflare purge credentials also live on Imagor, not backend.
## EasyPanel

Build the existing Imagor app from `deploy/imagor/Dockerfile` and add the variables from `.env.example`.

Important values:

- `BACKEND_INTERNAL_URL`: private backend service URL such as `http://backend:4000`
- `IMAGOR_SECRET`: same value as backend; also authenticates the tiny worker job API
- `S3_LOADER_*`: read access to private originals
- `S3_RESULT_STORAGE_*`: Imagor Result Storage bucket/credentials
- `S3_RESULT_STORAGE_PUBLIC_URL`: public R2/custom-domain root for direct delivery after the entire gallery is ready
- `IMAGOR_CACHE_WORKER_CONCURRENCY=2`: run two independent image warm jobs at once; recommended for a 3-core Imagor allocation
- `IMAGOR_CACHE_WORKER_INTERVAL=250ms`: only a tiny pause after a completed job instead of the old 20-second artificial delay
- `IMAGOR_CACHE_WORKER_IDLE_POLL=2s`: cheap polling only when the warm queue is empty
- `IMAGOR_CACHE_WORKER_LOG_ENABLED=true`: verbose polling, transform, and R2 verification logs for diagnosis
- `DEBUG=1`: temporary Imagor-native debug logs, including configured result storage and S3 save errors
- `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN`: optional and kept only on Imagor

`IMAGOR_RESULT_STORAGE_PATH_STYLE` must stay `digest`; the worker uses the exact same SHA-1 result-key algorithm as Imagor.

The Docker image runs `/usr/local/bin/imagor` and the tiny static `imagor-cache-worker` side-by-side in the same container. The worker consumes transformed bytes only over localhost, so backend CPU, RAM, disk, and network are not used for copying processed images to R2. Warm-job claiming is atomic in MongoDB, so multiple cache-worker goroutines safely claim different images and completed R2 results survive restarts.

For a 20-25 day disposable cache, use a 25-day R2 lifecycle rule on the Result Storage bucket/custom cache prefix. The image URLs are content-versioned, so stale entries are never reused after a watermark/design path changes.
