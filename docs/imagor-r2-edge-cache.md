# Imagor + R2 + Cloudflare delivery architecture

This project now treats the image URL and the image bytes as two different problems.

The backend still creates deterministic signed Imagor URLs. That HMAC work is tiny and faster than a MongoDB lookup, so URLs are not stored in MongoDB. The expensive part is the transformed image bytes.

## Delivery flow

1. Original uploads go straight to private R2.
2. The database stores the original object key; the gallery immediately uses deterministic Imagor URLs, so uploads never wait for cache generation.
3. A tiny worker runs **inside the same Imagor container**. It asks the backend only for signed URL job metadata.
4. The worker permanently warms only **small AVIF (720px)** and **view AVIF (1800px)** through localhost Imagor. Medium/large responsive delivery reuses the same view object instead of creating extra copies.
5. The **320px AVIF thumbnail is on-demand only**. It is generated/cached only when a browser actually requests that photo's thumbnail.
6. Imagor reads the private original, transforms it, and writes the result directly to its configured R2 Result Storage bucket.
7. The worker HEAD-checks the two permanent Result Storage keys in R2. The backend never downloads transformed image bytes and never uploads transformed image bytes to R2.
8. While even one eligible photo is missing a confirmed current permanent Result Storage variant, **every photo in that gallery continues to use Imagor URLs**.
9. Only after small+view for every eligible photo are confirmed in R2 is the collection marked `imageCacheStatus=ready`; the next API response switches normal delivery to Result Storage public URLs together.
10. If a photo, watermark, preset, or set assignment changes, the gallery immediately falls back to Imagor while the Imagor-side worker rebuilds stale variants.
11. Image deletion removes the gallery row immediately, deletes the private original, deletes permanent small/view Result Storage objects, derives/deletes any on-demand thumbnail Result Storage object, and optionally purges its Cloudflare URL.

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

Do not use a blanket expiry on the Result Storage bucket when small/view are the permanent delivery copies. Old versions are removed after a successful rebuild, and deleting an image removes its private original, permanent small/view AVIF objects, and any on-demand thumbnail object.

## 8-core VPS allocation

The production backend now uses PM2 cluster mode with three Node workers (`BACKEND_WEB_CONCURRENCY=3`). PM2 instance 0 alone runs scheduled/background queues, so marketing jobs, AI jobs, face indexing and maintenance loops are not multiplied across API workers.

Recommended starting allocation on an 8-core host:
- backend: up to about 3 cores through three Node workers
- Imagor: up to 3 cores using `GOMAXPROCS=3`
- remaining capacity: MongoDB, frontend/reverse proxy and OS

This is a starting limit, not a guarantee that every workload will remain below exactly three physical cores. Container CPU limits should also be configured in EasyPanel if strict cgroup enforcement is required.

## First-hit behavior

R2 Result Storage and Cloudflare eliminate repeated work. A never-before-generated transformation still needs one Imagor/libvips pass. The worker inside the Imagor container runs two safe warm jobs in parallel by default and pauses only 250ms between successful jobs. Each job creates only the small+view AVIF pair, which is substantially faster and smaller than the previous five-variant warm set.
