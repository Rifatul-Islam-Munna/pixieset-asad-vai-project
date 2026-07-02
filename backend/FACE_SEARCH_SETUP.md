# Face Search Local Setup

Models live here:

```text
backend/models/face-api
```

The backend auto-copies the needed files from `node_modules/@vladmandic/face-api/model` on startup. If you want to prepare them manually:

```powershell
cd backend
mkdir models\face-api
copy node_modules\@vladmandic\face-api\model\tiny_face_detector_model* models\face-api\
copy node_modules\@vladmandic\face-api\model\ssd_mobilenetv1_model* models\face-api\
copy node_modules\@vladmandic\face-api\model\face_landmark_68_model* models\face-api\
copy node_modules\@vladmandic\face-api\model\face_landmark_68_tiny_model* models\face-api\
copy node_modules\@vladmandic\face-api\model\face_recognition_model* models\face-api\
```

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
FACE_CLUSTER_DISTANCE=0.55
FACE_MATCH_DISTANCE=0.72
FACE_DETECTOR_INPUT_SIZE=832
FACE_DETECTOR_SCORE_THRESHOLD=0.08
FACE_GROUP_INPUT_SIZE=832
FACE_GROUP_SCORE_THRESHOLD=0.08
FACE_GROUP_TILE_SIZE=768
FACE_GROUP_TILE_OVERLAP=256
FACE_GROUP_MAX_TILES=20
```

Production Docker image uses Node Debian slim, not Alpine, because native TensorFlow CPU packages need glibc. Dockerfile copies models into `/app/models/face-api`.

Local Node 24 note: native `@tensorflow/tfjs-node` does not have a working prebuilt binary here. The app tries native first, then falls back to pure `@tensorflow/tfjs`. Local fallback runs on CPU, slower but works for dev. Docker/prod on Node 22 Debian slim should use native `tfjs-node` for much faster CPU inference.

If `IMAGE_MODEL_URL` is set, NestJS uses the InsightFace service first and stores vectors in `album_faces_insight`. If it is not set or fails, it falls back to local face-api.

Unique-face grouping uses face descriptor Euclidean distance. Lower `FACE_CLUSTER_DISTANCE` splits people more aggressively; higher merges more. `FACE_MATCH_DISTANCE` controls how strict the photo filter is after Qdrant returns candidates.

Face detection defaults to Tiny Face Detector with an overlapping tile scan. It detects individual faces first, removes duplicate boxes, then groups similar descriptors by `FACE_CLUSTER_DISTANCE`.
