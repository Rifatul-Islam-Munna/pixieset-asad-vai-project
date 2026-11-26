# InsightFace Vector API (CPU Docker)

This container exposes one private HTTP endpoint that receives an image and returns a detected face bounding box plus a normalized recognition embedding for every detected face.

- Upload endpoint: `POST /v1/faces`
- Background URL endpoint: `POST /v1/faces/url` (the model fetches the configured full-frame gallery derivative directly; Nest normally does not relay image bytes)
- Health: `GET /health`
- Default host URL: `http://127.0.0.1:8010`
- Auth header: `x-api-key: <API_KEY>`
- Default model: `buffalo_s` (keeps the existing embeddings compatible; changing model weights requires a separate index migration)
- Default detector: `960x960`, tiled group scan, mirror scan for side-face recovery
- Low-pressure defaults: one inference worker (no duplicate model RAM), OS nice priority, short CPU yields between scans
- Large queues use the direct URL endpoint plus a shorter Nest background gap; opening Face Filter prioritizes that gallery without increasing inference concurrency
- Recommended collection: `album_faces_insightface`
- Default upload cap: `80 MB` (`MAX_UPLOAD_MB`)

## Deploy

If you deploy the Dockerfile directly in EasyPanel, copy the variables from `image-model/.env.example` into that service's Environment section. In particular, start with `PROCESS_NICE=5`, `SCAN_YIELD_MS=1`, `ORT_NUM_THREADS=3`, `SOURCE_FETCH_TIMEOUT_SECONDS=20`, `WORKER_COUNT=1`, and `FACE_REQUEST_CONCURRENCY=2`. For a shared 8-vCPU / 16 GB VPS, set the service's hard CPU limit to 3 cores and memory limit to 5 GB. Docker Compose enforces this quota; when deploying the Dockerfile directly, configure the same CPU limit in EasyPanel. The Python inference thread budget is also capped at three even if an old environment requests more. Measure latency and resource usage before increasing concurrency. The Dockerfile deliberately does not use Uvicorn `--limit-concurrency`; heavy face requests are gated inside FastAPI so `/health` remains responsive during indexing.

For Compose deployments:

1. Edit `compose.yaml` and replace `API_KEY: change-this-to-a-long-random-secret`.
2. Run:

```bash
docker compose up -d --build
docker compose logs -f insightface-vector-api
```

The first start downloads the model into the named Docker volume. It must have outgoing internet access once. Subsequent starts use the persisted files.

## Test locally on the VPS

```bash
curl http://127.0.0.1:8010/health

curl -X POST http://127.0.0.1:8010/v1/faces \
  -H 'x-api-key: replace-with-your-api-key' \
  -F 'file=@/path/to/group-photo.jpg'
```

## Example response

```json
{
  "faceCount": 2,
  "embeddingDimension": 512,
  "image": { "width": 4032, "height": 3024 },
  "faces": [
    {
      "score": 0.97,
      "box": { "x": 121.3, "y": 81.6, "width": 168.1, "height": 168.6 },
      "boxPercent": { "x": 3.0084, "y": 2.6984, "width": 4.1691, "height": 5.5754 },
      "embedding": [0.0123, -0.0481]
    }
  ]
}
```

The real embedding array is usually 512 values. Do not create a Qdrant collection based only on the example. Send one real image to this API, read `embeddingDimension`, then create a new Qdrant collection using that value. Do not mix this collection with existing 128-dimensional face-api vectors.

## Qdrant

Use a new collection, for example `album_faces_insightface`, with cosine distance. For the default recognition packs, the endpoint normally reports 512-dimensional vectors. Reindex all images with the new service.

## NestJS

Set these in NestJS:

```env
IMAGE_MODEL_URL=http://127.0.0.1:8010
IMAGE_MODEL_API_KEY=replace-with-your-api-key
IMAGE_MODEL_QDRANT_COLLECTION=album_faces_insightface
FACE_MODEL_EXPECTED_NAME=buffalo_s
```

Use each returned `embedding` as the Qdrant vector and `boxPercent` as your payload box.

For stricter same-person grouping in NestJS, these env vars are supported:

```env
FACE_CLUSTER_SIMILARITY=0.60
FACE_CLUSTER_PAIR_SIMILARITY=0.55
FACE_CLUSTER_CONFLICT_SIMILARITY=0.80
FACE_PERSON_SIMILARITY=0.58
FACE_GLOBAL_PERSON_SIMILARITY=0.62
FACE_SIDEBAR_DUPLICATE_SIMILARITY=0.72
FACE_SIDEBAR_CONFLICT_DUPLICATE_SIMILARITY=0.95
FACE_MATCH_SIMILARITY=0.60
FACE_MATCH_MARGIN=0.06
FACE_SEARCH_EXACT=true
FACE_SEARCH_SCAN_LIMIT=100000
FACE_INDEX_USE_THUMBNAIL=false
FACE_BACKGROUND_GAP_MS=150
FACE_ACTIVE_BACKGROUND_GAP_MS=50
FACE_MODEL_SCAN_TIMEOUT_MS=120000
```

The face selector only displays groups containing at least two distinct indexed photos. Single-photo groups remain indexed and can still be found by face search. Changing the display minimum or search similarity does not require reindexing.

These are conservative starting thresholds, not measured accuracy guarantees. The search threshold is slightly lower than the grouping thresholds to retain more genuine matches without allowing loose identity-group merging. Higher values reduce false matches but can split groups or miss genuine matches. Validate with consented, representative gallery examples before deployment.

Selecting an existing face now searches the actual stored vector within its gallery instead of trusting old group membership. It returns the full-frame gallery images and includes the selected photo. Exact vector search avoids approximate-index misses, while the result window grows as needed up to the configured safety ceiling. A response with `truncated: true` has reached that ceiling.

After updating the backend and model service, use the existing per-gallery face reindex action to rebuild old mixed groups and obtain higher-resolution embeddings. This rebuild changes derived face metadata only; do not delete gallery photos or R2 objects. During a rebuild, the face filter may temporarily be incomplete. This release deliberately does not initiate a mass rebuild of existing galleries.

### Optional larger recognition model

Do not change `MODEL_NAME` or `FACE_MODEL_EXPECTED_NAME` alone. A licensed `buffalo_l` or other compatible model requires a staged migration to a fresh, model-specific Qdrant collection and freshly rebuilt person/identity grouping data. Two models can both produce 512-dimensional embeddings but those embeddings are not interchangeable. Preserve the current index until validation and plan a rollback before switching. This release keeps the existing weights and does not perform that migration.

## Safety / exposure

The compose file binds `127.0.0.1:8010`, so it is not reachable from the public internet. Keep it this way when NestJS runs on the same VPS. If NestJS is a separate Docker container, put both services in the same Compose network and call `http://insightface-vector-api:8010` instead of exposing port 8010 publicly.

## License

InsightFace's Python code is MIT, but InsightFace's supplied pretrained model packs (including automatic downloads) are stated by InsightFace to be for non-commercial research only. For a commercial product, use a model you have licensed or trained yourself, or obtain a license from InsightFace.
