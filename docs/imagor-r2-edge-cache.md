# Imagor + R2 + Cloudflare delivery architecture

This project now treats the image URL and the image bytes as two different problems.

The backend still creates deterministic signed Imagor URLs. That HMAC work is tiny and faster than a MongoDB lookup, so URLs are not stored in MongoDB. The expensive part is the transformed image bytes.

## Delivery flow

1. Original uploads go straight to private R2.
2. The database stores the original object key; the gallery immediately uses deterministic Imagor URLs, so uploads never wait for cache generation.
3. A tiny worker runs **inside the same Imagor container**. It asks the backend only for signed URL job metadata.
4. The worker requests thumbnail, view, small, medium, and large variants through localhost Imagor and discards those response bytes locally.
5. Imagor reads the private original, transforms it, and writes the result directly to its configured R2 Result Storage bucket.
6. The worker HEAD-checks those exact Result Storage keys in R2. The backend never downloads transformed image bytes and never uploads transformed image bytes to R2.
7. While even one eligible photo is missing a confirmed current Result Storage variant, **every photo in that gallery continues to use Imagor URLs**.
8. Only after all required variants for every eligible photo are confirmed in R2 is the collection marked `imageCacheStatus=ready`; the next API response switches the entire gallery to the Result Storage public URLs together.
9. If a photo, watermark, preset, or set assignment changes, the gallery immediately falls back to Imagor while the Imagor-side worker rebuilds the stale variants.
10. Image deletion removes the gallery record immediately; the Imagor-side worker deletes the Result Storage keys and optionally purges their Cloudflare URLs.

This keeps uploads instant, preserves the all-or-nothing switch, and keeps transformed bytes completely off the backend data path.

## Required Cloudflare setup

Use a dedicated proxied hostname such as `img.gallerista.app` that points to the Imagor origin.

Set the backend `IMAGOR_URL` to that Cloudflare-proxied HTTPS hostname. Set `IMAGOR_INTERNAL_URL` to the private EasyPanel/service address such as `http://imagor:8000`.

Create a Cloudflare Cache Rule for the image hostname:
- hostname equals the Imagor hostname
- cache eligibility: eligible for cache
- edge TTL: respect origin Cache-Control, or set 30 days
- browser TTL: respect origin
- cache key: include the complete path; the signed path already includes size, quality, format and watermark parameters

Do not point `IMAGOR_URL` directly at the VPS IP if the goal is to protect the 1 Gbps port and monthly transfer cap.

## R2 result cache

Create a separate bucket such as `gallarista-image-cache`. It is disposable cache data; never put originals there.

The provided `deploy/imagor/Dockerfile` is meant to replace the image/build of the existing Imagor EasyPanel app. It enables the safe runtime defaults; add the R2 loader/result-storage credentials from `deploy/imagor/.env.example` to that same Imagor app. No second cache application is required.

Use a 25-day R2 lifecycle rule for the Result Storage bucket/prefix. A deleted result is safely generated again by Imagor on the next cache miss.

## 8-core VPS allocation

The production backend now uses PM2 cluster mode with three Node workers (`BACKEND_WEB_CONCURRENCY=3`). PM2 instance 0 alone runs scheduled/background queues, so marketing jobs, AI jobs, face indexing and maintenance loops are not multiplied across API workers.

Recommended starting allocation on an 8-core host:
- backend: up to about 3 cores through three Node workers
- Imagor: up to 3 cores using `GOMAXPROCS=3`
- remaining capacity: MongoDB, frontend/reverse proxy and OS

This is a starting limit, not a guarantee that every workload will remain below exactly three physical cores. Container CPU limits should also be configured in EasyPanel if strict cgroup enforcement is required.

## First-hit behavior

R2 Result Storage and Cloudflare eliminate repeated work. A never-before-generated transformation still needs one Imagor/libvips pass. The worker inside the Imagor container warms one image about every 20 seconds by default, so the backend remains out of the transformed-image data path and Imagor CPU is not hit by an upload burst.
