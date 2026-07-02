# InsightFace Vector API (CPU Docker)

This container exposes one private HTTP endpoint that receives an image and returns a detected face bounding box plus a normalized recognition embedding for every detected face.

- Endpoint: `POST /v1/faces`
- Health: `GET /health`
- Default host URL: `http://127.0.0.1:8010`
- Auth header: `x-api-key: <API_KEY>`
- Default model: `buffalo_s` (better suited to a 2-core VPS than `buffalo_l`)
- Recommended collection: `album_faces_insightface`

## Deploy

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
```

Use each returned `embedding` as the Qdrant vector and `boxPercent` as your payload box.

## Safety / exposure

The compose file binds `127.0.0.1:8010`, so it is not reachable from the public internet. Keep it this way when NestJS runs on the same VPS. If NestJS is a separate Docker container, put both services in the same Compose network and call `http://insightface-vector-api:8010` instead of exposing port 8010 publicly.

## License

InsightFace's Python code is MIT, but InsightFace's supplied pretrained model packs (including automatic downloads) are stated by InsightFace to be for non-commercial research only. For a commercial product, use a model you have licensed or trained yourself, or obtain a license from InsightFace.
