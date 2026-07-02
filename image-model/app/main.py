from __future__ import annotations

import asyncio
import io
import math
import os
import secrets
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status
from PIL import Image, ImageOps
from insightface.app import FaceAnalysis


@dataclass(frozen=True)
class Settings:
    model_name: str = os.getenv("MODEL_NAME", "buffalo_s")
    model_root: str = os.getenv("MODEL_ROOT", "/models")
    detection_size: int = int(os.getenv("DETECTION_SIZE", "640"))
    detection_threshold: float = float(os.getenv("DETECTION_THRESHOLD", "0.35"))
    group_scan: bool = os.getenv("GROUP_SCAN", "true").lower() in {"1", "true", "yes"}
    tile_size: int = int(os.getenv("TILE_SIZE", "1024"))
    tile_overlap: int = int(os.getenv("TILE_OVERLAP", "224"))
    max_tiles: int = int(os.getenv("MAX_TILES", "12"))
    max_image_side: int = int(os.getenv("MAX_IMAGE_SIDE", "2400"))
    min_face_size: int = int(os.getenv("MIN_FACE_SIZE", "14"))
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "80"))
    api_key: str = os.getenv("API_KEY", "")


SETTINGS = Settings()
face_app: FaceAnalysis | None = None
inference_lock = asyncio.Lock()


@dataclass
class Candidate:
    bbox: np.ndarray
    kps: np.ndarray | None
    score: float
    embedding: np.ndarray


def decode_image(data: bytes) -> tuple[np.ndarray, int, int, float, float]:
    """Read EXIF orientation, return BGR working image and scaling to original pixels."""
    try:
        with Image.open(io.BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            original_width, original_height = image.size
            rgb = np.asarray(image)
    except Exception as exc:  # Pillow error messages are safe to return as 400.
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    working_height, working_width = bgr.shape[:2]
    biggest_side = max(working_width, working_height)

    if biggest_side > SETTINGS.max_image_side:
        resize_scale = SETTINGS.max_image_side / biggest_side
        working_width = max(1, round(working_width * resize_scale))
        working_height = max(1, round(working_height * resize_scale))
        bgr = cv2.resize(bgr, (working_width, working_height), interpolation=cv2.INTER_AREA)

    scale_x = original_width / bgr.shape[1]
    scale_y = original_height / bgr.shape[0]
    return bgr, original_width, original_height, scale_x, scale_y


def normalize_embedding(value: Any) -> np.ndarray | None:
    embedding = np.asarray(value, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(embedding))
    if not math.isfinite(norm) or norm <= 0:
        return None
    return embedding / norm


def read_faces(image: np.ndarray, offset_x: int = 0, offset_y: int = 0) -> list[Candidate]:
    if face_app is None:
        raise RuntimeError("Face model is not ready")

    output: list[Candidate] = []
    for face in face_app.get(image):
        bbox = np.asarray(face.bbox, dtype=np.float32).copy()
        if bbox.shape[0] < 4:
            continue

        width = float(bbox[2] - bbox[0])
        height = float(bbox[3] - bbox[1])
        if min(width, height) < SETTINGS.min_face_size:
            continue

        embedding = normalize_embedding(getattr(face, "embedding", None))
        if embedding is None:
            continue

        bbox[[0, 2]] += offset_x
        bbox[[1, 3]] += offset_y

        raw_kps = getattr(face, "kps", None)
        kps = None
        if raw_kps is not None:
            kps = np.asarray(raw_kps, dtype=np.float32).copy()
            if kps.ndim == 2 and kps.shape[1] >= 2:
                kps[:, 0] += offset_x
                kps[:, 1] += offset_y
            else:
                kps = None

        output.append(
            Candidate(
                bbox=bbox,
                kps=kps,
                score=float(getattr(face, "det_score", 0.0)),
                embedding=embedding,
            )
        )
    return output


def tile_starts(length: int, tile_size: int, overlap: int) -> list[int]:
    if length <= tile_size:
        return [0]
    stride = max(1, tile_size - overlap)
    starts = list(range(0, max(1, length - tile_size + 1), stride))
    final = length - tile_size
    if starts[-1] != final:
        starts.append(final)
    return starts


def selected_tiles(width: int, height: int) -> list[tuple[int, int, int, int]]:
    tile_size = min(SETTINGS.tile_size, width, height)
    xs = tile_starts(width, tile_size, SETTINGS.tile_overlap)
    ys = tile_starts(height, tile_size, SETTINGS.tile_overlap)
    tiles = [(x, y, tile_size, tile_size) for y in ys for x in xs]

    if len(tiles) <= SETTINGS.max_tiles:
        return tiles

    # Preserve a spread across the image instead of processing only the first rows.
    positions = np.linspace(0, len(tiles) - 1, num=SETTINGS.max_tiles, dtype=int)
    return [tiles[index] for index in sorted(set(positions.tolist()))]


def iou(a: np.ndarray, b: np.ndarray) -> float:
    left = max(float(a[0]), float(b[0]))
    top = max(float(a[1]), float(b[1]))
    right = min(float(a[2]), float(b[2]))
    bottom = min(float(a[3]), float(b[3]))
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    area_a = max(0.0, float(a[2] - a[0])) * max(0.0, float(a[3] - a[1]))
    area_b = max(0.0, float(b[2] - b[0])) * max(0.0, float(b[3] - b[1]))
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def deduplicate(candidates: list[Candidate]) -> list[Candidate]:
    # Faces found on the full image and overlapping tiles often appear twice.
    unique: list[Candidate] = []
    for candidate in sorted(candidates, key=lambda item: item.score, reverse=True):
        if any(iou(candidate.bbox, accepted.bbox) >= 0.45 for accepted in unique):
            continue
        unique.append(candidate)
    return unique


def analyze_image(image: np.ndarray) -> list[Candidate]:
    candidates = read_faces(image)
    image_height, image_width = image.shape[:2]

    # A full-image pass catches large faces. Sequential tiles keep small faces visible
    # in large group photos without trying to use more than the VPS can handle.
    if SETTINGS.group_scan and (image_width > SETTINGS.tile_size or image_height > SETTINGS.tile_size):
        for x, y, width, height in selected_tiles(image_width, image_height):
            tile = image[y : y + height, x : x + width]
            candidates.extend(read_faces(tile, offset_x=x, offset_y=y))

    return deduplicate(candidates)


def candidate_response(
    candidate: Candidate,
    original_width: int,
    original_height: int,
    scale_x: float,
    scale_y: float,
) -> dict[str, Any]:
    x1, y1, x2, y2 = candidate.bbox.tolist()
    x1 = max(0.0, min(float(original_width), x1 * scale_x))
    x2 = max(0.0, min(float(original_width), x2 * scale_x))
    y1 = max(0.0, min(float(original_height), y1 * scale_y))
    y2 = max(0.0, min(float(original_height), y2 * scale_y))

    box = {
        "x": round(x1, 2),
        "y": round(y1, 2),
        "width": round(max(0.0, x2 - x1), 2),
        "height": round(max(0.0, y2 - y1), 2),
    }
    box_percent = {
        "x": round((box["x"] / original_width) * 100, 4),
        "y": round((box["y"] / original_height) * 100, 4),
        "width": round((box["width"] / original_width) * 100, 4),
        "height": round((box["height"] / original_height) * 100, 4),
    }

    response: dict[str, Any] = {
        "score": round(candidate.score, 6),
        "box": box,
        "boxPercent": box_percent,
        "embedding": candidate.embedding.astype(float).tolist(),
    }
    if candidate.kps is not None:
        response["landmarks"] = [
            {"x": round(float(x) * scale_x, 2), "y": round(float(y) * scale_y, 2)}
            for x, y in candidate.kps[:, :2]
        ]
    return response


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if SETTINGS.api_key and not secrets.compare_digest(x_api_key or "", SETTINGS.api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global face_app
    Path(SETTINGS.model_root).mkdir(parents=True, exist_ok=True)
    face_app = FaceAnalysis(
        name=SETTINGS.model_name,
        root=SETTINGS.model_root,
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    face_app.prepare(
        ctx_id=-1,
        det_thresh=SETTINGS.detection_threshold,
        det_size=(SETTINGS.detection_size, SETTINGS.detection_size),
    )
    yield
    face_app = None


app = FastAPI(
    title="InsightFace Vector API",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": face_app is not None,
        "model": SETTINGS.model_name,
        "provider": "CPUExecutionProvider",
        "groupScan": SETTINGS.group_scan,
        "detectionSize": SETTINGS.detection_size,
        "maxUploadMb": SETTINGS.max_upload_mb,
    }


@app.post("/v1/faces", dependencies=[Depends(require_api_key)])
async def faces(file: UploadFile = File(...)) -> dict[str, Any]:
    content = await file.read((SETTINGS.max_upload_mb * 1024 * 1024) + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Image file is required")
    if len(content) > SETTINGS.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image exceeds {SETTINGS.max_upload_mb} MB limit")

    image, original_width, original_height, scale_x, scale_y = decode_image(content)
    async with inference_lock:
        candidates = await asyncio.to_thread(analyze_image, image)

    results = [
        candidate_response(candidate, original_width, original_height, scale_x, scale_y)
        for candidate in candidates
    ]
    embedding_dimension = len(results[0]["embedding"]) if results else None
    return {
        "faceCount": len(results),
        "embeddingDimension": embedding_dimension,
        "image": {"width": original_width, "height": original_height},
        "faces": results,
    }
