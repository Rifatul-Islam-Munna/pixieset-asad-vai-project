# Face Search Setup

NestJS does not run local face-api detection anymore. It sends images to the
Python `image-model` service, then stores 512-dim InsightFace vectors in Qdrant.

Run Qdrant locally:

```powershell
docker run -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant
```

Add env:

```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
IMAGE_MODEL_URL=http://127.0.0.1:8010
IMAGE_MODEL_API_KEY=change-this-to-a-long-random-secret
IMAGE_MODEL_QDRANT_COLLECTION=album_faces_insightface
FACE_CLUSTER_DISTANCE=0.95
FACE_MATCH_DISTANCE=0.95
FACE_SEARCH_SCAN_LIMIT=10000
```

If `IMAGE_MODEL_URL` is missing or the health check fails, face indexing/search is disabled. There is no NestJS CPU fallback.

Unique-face grouping uses face descriptor Euclidean distance. Lower `FACE_CLUSTER_DISTANCE` splits people more aggressively; higher merges more. `FACE_MATCH_DISTANCE` controls how strict the photo filter is after Qdrant returns candidates.
