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
FACE_CLUSTER_DISTANCE=0.5
FACE_MATCH_DISTANCE=0.6
FACE_DETECTOR_MODEL=ssd
FACE_DETECTOR_MIN_CONFIDENCE=0.18
FACE_DETECTOR_MAX_RESULTS=100
FACE_IMAGE_MAX_SIZE=1600
```

Production Docker image uses Node Debian slim, not Alpine, because native TensorFlow CPU packages need glibc. Dockerfile copies models into `/app/models/face-api`.

Local Node 24 note: native `@tensorflow/tfjs-node` does not have a working prebuilt binary here. The app tries native first, then falls back to pure `@tensorflow/tfjs`. Local fallback runs on CPU, slower but works for dev. Docker/prod on Node 22 Debian slim should use native `tfjs-node` for much faster CPU inference.

Unique-face grouping uses face descriptor Euclidean distance. Lower `FACE_CLUSTER_DISTANCE` splits people more aggressively; higher merges more. `FACE_MATCH_DISTANCE` controls how strict the photo filter is after Qdrant returns candidates.

Face detection defaults to SSD Mobilenet because Tiny Face Detector misses more small/group faces. Use `FACE_DETECTOR_MODEL=tiny` only if speed matters more than recall.
