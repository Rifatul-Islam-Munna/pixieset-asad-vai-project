import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import Module from 'module';
import { Model } from 'mongoose';
import { dirname, join } from 'path';
import { cwd } from 'process';
import sharp from 'sharp';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';

type FaceApiModule = typeof import('@vladmandic/face-api');
type IndexedImage = CollectionImage & { _id?: unknown };
type DetectorName = 'ssd' | 'tiny';
type PixelBox = { x: number; y: number; width: number; height: number };
type Tensor3D = {
  dispose: () => void;
  slice: (begin: [number, number, number], size: [number, number, number]) => Tensor3D;
};
type FacePoint = {
  id: string | number;
  score?: number;
  vector?: number[];
  payload?: {
    collectionId?: string;
    imageId?: string;
    url?: string;
    faceIndex?: number;
    box?: { x: number; y: number; width: number; height: number };
  };
};
type FaceCandidate = {
  box: PixelBox;
  score: number;
  source: 'full' | 'tile';
};
type DetectedFace = {
  vector: number[];
  box: { x: number; y: number; width: number; height: number };
};
type Tile = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type TensorflowRuntime = {
  setBackend: (backendName: string) => Promise<boolean>;
  ready: () => Promise<void>;
  getBackend?: () => string;
};

const VECTOR_SIZE = 128;
const COLLECTION = 'album_faces';

/**
 * CPU-friendly face indexing/search service.
 *
 * Detection is done in two passes:
 * 1. an accurate full-image pass;
 * 2. sequential overlapping tiles to retain small faces in group photos.
 *
 * Tiles are deliberately processed one at a time. This avoids several TensorFlow
 * jobs competing for a 2-core CPU and prevents memory spikes during re-indexing.
 */
@Injectable()
export class FaceSearchService implements OnModuleInit {
  private readonly logger = new Logger(FaceSearchService.name);
  private readonly modelDir = join(cwd(), 'models', 'face-api');
  private faceApi?: FaceApiModule;
  private qdrant?: QdrantClient;
  private ready = false;

  /**
   * TensorFlow.js work is CPU-heavy and synchronous on the Node backend.
   * A one-job queue is the most stable option for a 2-core server.
   */
  private extractionQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureModels().catch((error) => {
      this.logger.error(`Face model not found: ${error?.message ?? error}`);
      throw error;
    });
    await this.initQdrant();
    await this.initFaceApi();
  }

  async indexImage(image: IndexedImage) {
    if (!this.ready || !this.qdrant) return 0;

    const imageId = image._id?.toString();
    if (!imageId || !image.url) return 0;

    const buffer = await this.readImage(image.url).catch(() => null);
    if (!buffer) {
      this.logger.warn(`Face indexing skipped for ${imageId}: image download failed`);
      return 0;
    }

    const faces = await this.extractFaces(buffer).catch((error) => {
      this.logger.warn(`Face indexing skipped for ${imageId}: ${error?.message ?? error}`);
      return [];
    });

    if (!faces.length) {
      await this.imageModel
        .updateOne(
          { _id: imageId },
          { $set: { faceIndexedAt: new Date(), faceCount: 0 } },
        )
        .catch(() => undefined);
      return 0;
    }

    await this.qdrant
      .upsert(COLLECTION, {
        // Face points are eventually visible; the Mongo record is still updated
        // immediately so the image is not needlessly reprocessed.
        wait: false,
        points: faces.map((face, index) => ({
          id: this.pointId(`${image.collectionId}-${imageId}-${index}`),
          vector: face.vector,
          payload: {
            collectionId: image.collectionId,
            imageId,
            url: image.url,
            faceIndex: index,
            box: face.box,
          },
        })),
      })
      .catch((error) => this.logger.warn(`Qdrant upsert failed: ${error?.message ?? error}`));

    await this.imageModel
      .updateOne(
        { _id: imageId },
        { $set: { faceIndexedAt: new Date(), faceCount: faces.length } },
      )
      .catch(() => undefined);

    return faces.length;
  }

  async deleteImageFaces(collectionId: string, imageId: string) {
    if (!this.ready || !this.qdrant) return;

    await this.qdrant
      .delete(COLLECTION, {
        wait: true,
        filter: {
          must: [
            { key: 'collectionId', match: { value: collectionId } },
            { key: 'imageId', match: { value: imageId } },
          ],
        },
      })
      .catch((error) => this.logger.warn(`Qdrant face delete failed: ${error?.message ?? error}`));
  }

  async deleteCollectionFaces(collectionId: string) {
    if (!this.ready || !this.qdrant) return;

    await this.qdrant
      .delete(COLLECTION, {
        wait: true,
        filter: {
          must: [{ key: 'collectionId', match: { value: collectionId } }],
        },
      })
      .catch((error) => this.logger.warn(`Qdrant collection face delete failed: ${error?.message ?? error}`));
  }

  async reindexCollectionFaces(collectionId: string) {
    if (!this.ready || !this.qdrant) {
      throw new BadRequestException('Face search is not ready');
    }

    const images = await this.imageModel.find({ collectionId }).lean();
    await this.deleteCollectionFaces(collectionId);

    let faces = 0;
    for (const image of images) {
      // Sequential indexing is intentional for a 2-core CPU.
      faces += await this.indexImage(image as IndexedImage);
    }

    return { collectionId, images: images.length, faces };
  }

  async searchCollection(collectionIdOrSlug: string, file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Face image is required');
    }
    if (!this.ready || !this.qdrant) {
      throw new BadRequestException('Face search is not ready');
    }

    const collection = await this.findCollection(collectionIdOrSlug);
    const faces = await this.extractFaces(file.buffer);

    if (!faces.length) {
      throw new BadRequestException('No usable face found in uploaded image');
    }

    return this.searchByVectors(collection._id.toString(), faces.map((face) => face.vector));
  }

  async listCollectionFaces(collectionIdOrSlug: string) {
    if (!this.ready || !this.qdrant) {
      throw new BadRequestException('Face search is not ready');
    }

    const collection = await this.findCollection(collectionIdOrSlug);
    const collectionId = collection._id.toString();

    const response = await this.qdrant.scroll(COLLECTION, {
      limit: 10000,
      with_payload: true,
      with_vector: true,
      filter: {
        must: [{ key: 'collectionId', match: { value: collectionId } }],
      },
    });

    const points = (response.points ?? []) as FacePoint[];
    const missingImages = await this.imageModel
      .find({ collectionId, faceIndexedAt: { $exists: false } })
      .limit(50)
      .lean();

    if (missingImages.length) {
      setTimeout(() => {
        void this.indexMissingFaces(missingImages as IndexedImage[]);
      }, 250);
    }

    const groups: { representative: FacePoint; points: FacePoint[] }[] = [];
    const maxDistance = this.configNumber(
      'FACE_CLUSTER_DISTANCE',
      this.configNumber('FACE_CLUSTER_THRESHOLD', 0.55, 0.1, 2),
      0.1,
      2,
    );

    for (const point of points) {
      const vector = this.pointVector(point);
      if (!vector) continue;

      const match = groups.find((group) =>
        group.points.some((groupPoint) => {
          const groupVector = this.pointVector(groupPoint);
          return groupVector ? this.euclidean(vector, groupVector) <= maxDistance : false;
        }),
      );

      if (match) match.points.push(point);
      else groups.push({ representative: point, points: [point] });
    }

    return {
      collectionId,
      count: groups.length,
      indexing: missingImages.length > 0,
      missingImages: missingImages.length,
      faces: groups.map((group, index) => ({
        id: String(group.representative.id),
        label: `Face ${index + 1}`,
        imageId: group.representative.payload?.imageId,
        imageUrl: group.representative.payload?.url,
        box: group.representative.payload?.box,
        photoCount: new Set(
          group.points.map((point) => point.payload?.imageId).filter(Boolean),
        ).size,
      })),
    };
  }

  async searchCollectionByFaceId(collectionIdOrSlug: string, faceId: string) {
    if (!this.ready || !this.qdrant) {
      throw new BadRequestException('Face search is not ready');
    }

    const collection = await this.findCollection(collectionIdOrSlug);
    const points = await this.qdrant.retrieve(COLLECTION, {
      ids: [faceId],
      with_vector: true,
      with_payload: true,
    });

    const point = points[0] as FacePoint | undefined;
    const vector = point ? this.pointVector(point) : undefined;

    if (!vector || point?.payload?.collectionId !== collection._id.toString()) {
      throw new BadRequestException('Face not found');
    }

    return this.searchByVectors(collection._id.toString(), [vector]);
  }

  private async indexMissingFaces(images: IndexedImage[]) {
    for (const image of images) {
      await this.indexImage(image).catch((error) => {
        this.logger.warn(`Missing face index failed: ${error?.message ?? error}`);
      });

      // Yield to the event loop between images. The queue still ensures that
      // no two face-extraction jobs run together.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async searchByVectors(collectionId: string, vectors: number[][]) {
    if (!this.qdrant) {
      throw new BadRequestException('Face search is not ready');
    }

    const response = await this.qdrant.scroll(COLLECTION, {
      limit: this.configNumber('FACE_SEARCH_SCAN_LIMIT', 10000, 1, 100000),
      with_payload: true,
      with_vector: true,
      filter: {
        must: [{ key: 'collectionId', match: { value: collectionId } }],
      },
    });

    const points = (response.points ?? []) as FacePoint[];
    const maxDistance = this.configNumber('FACE_MATCH_DISTANCE', 0.72, 0.1, 2);

    const matched = points
      .map((item) => {
        const candidate = this.pointVector(item);
        const distance = candidate
          ? Math.min(...vectors.map((vector) => this.euclidean(vector, candidate)))
          : Number.POSITIVE_INFINITY;

        return { item, distance };
      })
      .filter(({ distance }) => distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);

    const imageIds = [
      ...new Set(
        matched
          .map(({ item }) => String(item.payload?.imageId ?? ''))
          .filter(Boolean),
      ),
    ];

    const images = imageIds.length
      ? await this.imageModel.find({ _id: { $in: imageIds }, collectionId }).lean()
      : [];

    const distanceMap = new Map<string, number>();
    for (const { item, distance } of matched) {
      const imageId = String(item.payload?.imageId ?? '');
      if (!imageId) continue;
      distanceMap.set(
        imageId,
        Math.min(distanceMap.get(imageId) ?? Number.POSITIVE_INFINITY, distance),
      );
    }

    this.logger.log(
      `Face match scan collection=${collectionId} queryFaces=${vectors.length} indexedFaces=${points.length} matchedFaces=${matched.length} matchedImages=${images.length} threshold=${maxDistance}`,
    );

    return {
      collectionId,
      count: images.length,
      images: images
        .map((image) => ({
          ...image,
          faceScore: 1 - Math.min(distanceMap.get(image._id.toString()) ?? 1, 1),
        }))
        .sort((a, b) => b.faceScore - a.faceScore),
    };
  }

  private async initQdrant() {
    const url = this.configService.get<string>('QDRANT_URL')?.trim();

    if (!url) {
      this.logger.error('QDRANT_URL not found. Face search is disabled until QDRANT_URL is set.');
      return;
    }

    this.qdrant = new QdrantClient({
      url,
      apiKey: this.configService.get<string>('QDRANT_API_KEY')?.trim() || undefined,
      checkCompatibility: false,
    });

    const exists = await this.qdrant.collectionExists(COLLECTION).catch((error) => {
      this.qdrant = undefined;
      this.logger.error(`Qdrant connection failed: ${error?.message ?? error}`);
      return null;
    });

    if (!exists) return;

    if (!exists.exists) {
      await this.qdrant.createCollection(COLLECTION, {
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
      });

      await this.qdrant
        .createPayloadIndex(COLLECTION, {
          field_name: 'collectionId',
          field_schema: 'keyword',
          wait: true,
        })
        .catch(() => undefined);
    }

    this.logger.log(`Qdrant connected; collection ready: ${COLLECTION}`);
  }

  private async initFaceApi() {
    try {
      this.installTfjsFallback();
      this.faceApi = await import('@vladmandic/face-api');

      const tf = this.faceApi.tf as unknown as TensorflowRuntime;
      const backend = await this.selectTensorflowBackend(tf);

      await this.faceApi.nets.ssdMobilenetv1.loadFromDisk(this.modelDir);
      await this.faceApi.nets.tinyFaceDetector.loadFromDisk(this.modelDir);

      // Use the full 68-point landmark model for descriptor alignment. The
      // original code loaded and forced the tiny model, which is faster but
      // less stable for face recognition.
      await this.faceApi.nets.faceLandmark68Net.loadFromDisk(this.modelDir);
      await this.faceApi.nets.faceLandmark68TinyNet.loadFromDisk(this.modelDir);
      await this.faceApi.nets.faceRecognitionNet.loadFromDisk(this.modelDir);

      this.ready = Boolean(this.qdrant);
      this.logger.log(
        `Face models loaded from ${this.modelDir}; TensorFlow backend=${backend}; group scan=${this.groupScanEnabled()}`,
      );

      if (!this.ready) {
        this.logger.error('Face models loaded, but Qdrant is not connected.');
      }
    } catch (error) {
      this.ready = false;
      this.logger.error(`Face search disabled: ${error?.message ?? error}`);
    }
  }

  /**
   * Prefer the native TensorFlow backend when @tensorflow/tfjs-node is
   * installed. Do not force "cpu": that is the slow, pure-JS backend.
   *
   * FACE_TF_BACKEND can override this, e.g. "tensorflow,cpu".
   */
  private async selectTensorflowBackend(tf: TensorflowRuntime) {
    const configured = this.configService.get<string>('FACE_TF_BACKEND')?.trim();
    const preferred = (configured ? configured.split(',') : ['tensorflow', 'cpu'])
      .map((value) => value.trim())
      .filter(Boolean);

    for (const backend of [...new Set([...preferred, 'cpu'])]) {
      const selected = await tf.setBackend(backend).catch(() => false);
      if (!selected) continue;

      await tf.ready();
      return tf.getBackend?.() ?? backend;
    }

    throw new Error('No TensorFlow.js backend could be initialized');
  }

  /**
   * face-api attempts to load @tensorflow/tfjs-node in Node. Retain a safe
   * fallback for servers where the native package cannot be installed.
   */
  private installTfjsFallback() {
    const loader = Module as unknown as {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    };
    const originalLoad = loader._load;

    loader._load = (request: string, parent: unknown, isMain: boolean) => {
      if (request !== '@tensorflow/tfjs-node') {
        return originalLoad(request, parent, isMain);
      }

      try {
        return originalLoad(request, parent, isMain);
      } catch {
        this.logger.warn(
          'Native @tensorflow/tfjs-node is unavailable; using the slower TensorFlow.js CPU fallback.',
        );
        return originalLoad('@tensorflow/tfjs', parent, isMain);
      }
    };
  }

  private async ensureModels() {
    mkdirSync(this.modelDir, { recursive: true });

    const sourceDir = join(
      dirname(require.resolve('@vladmandic/face-api/package.json')),
      'model',
    );

    const needed = [
      'tiny_face_detector_model-weights_manifest.json',
      'tiny_face_detector_model.bin',
      'ssd_mobilenetv1_model-weights_manifest.json',
      'ssd_mobilenetv1_model.bin',
      'face_landmark_68_tiny_model-weights_manifest.json',
      'face_landmark_68_tiny_model.bin',
      'face_landmark_68_model-weights_manifest.json',
      'face_landmark_68_model.bin',
      'face_recognition_model-weights_manifest.json',
      'face_recognition_model.bin',
    ];

    for (const file of needed) {
      const target = join(this.modelDir, file);
      if (!existsSync(target)) {
        copyFileSync(join(sourceDir, file), target);
      }
    }

    const missing = needed.filter((file) => !existsSync(join(this.modelDir, file)));
    if (missing.length || !readdirSync(this.modelDir).length) {
      throw new Error(
        `Missing face model files in ${this.modelDir}: ${missing.join(', ')}`,
      );
    }

    this.logger.log(`Face model files found in ${this.modelDir}`);
  }

  /**
   * Runs all TensorFlow work through a one-job queue. This is intentional:
   * on a 2-core machine, concurrent face scans make each request slower and
   * can cause Node memory spikes.
   */
  private async extractFaces(buffer: Buffer): Promise<DetectedFace[]> {
    return this.runExclusive(() => this.extractFacesUnlocked(buffer));
  }

  private async extractFacesUnlocked(buffer: Buffer): Promise<DetectedFace[]> {
    if (!this.faceApi) return [];

    const { input, width, height } = await this.imageTensor(buffer);
    const startedAt = Date.now();

    try {
      const primaryDetector = this.detectorName(
        this.configService.get<string>('FACE_DETECTOR_MODEL') ?? 'ssd',
        'ssd',
      );

      let candidates = await this.detectCandidates(input, primaryDetector, 'full');

      if (this.groupScanEnabled() && this.shouldRunGroupScan(width, height)) {
        const tileDetector = this.detectorName(
          this.configService.get<string>('FACE_GROUP_DETECTOR') ?? 'tiny',
          'tiny',
        );
        const tiles = this.buildTiles(width, height);

        for (const tile of tiles) {
          const tileInput = input.slice(
            [tile.y, tile.x, 0],
            [tile.height, tile.width, 3],
          );

          try {
            const localCandidates = await this.detectCandidates(
              tileInput,
              tileDetector,
              'tile',
            );

            candidates.push(
              ...localCandidates.map((candidate) => ({
                ...candidate,
                box: {
                  x: candidate.box.x + tile.x,
                  y: candidate.box.y + tile.y,
                  width: candidate.box.width,
                  height: candidate.box.height,
                },
              })),
            );
          } finally {
            tileInput.dispose();
          }
        }
      }

      const minFaceSize = this.configNumber('FACE_MIN_FACE_SIZE', 14, 4, 512);
      const uniqueCandidates = this.deduplicateCandidates(candidates)
        .filter((candidate) => this.isInsideImage(candidate.box, width, height))
        .filter(
          (candidate) =>
            candidate.box.width >= minFaceSize && candidate.box.height >= minFaceSize,
        );

      const maxFaces = this.configNumber('FACE_DETECTOR_MAX_RESULTS', 150, 1, 500);
      const selectedCandidates = uniqueCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, maxFaces);

      const faces: DetectedFace[] = [];
      for (const candidate of selectedCandidates) {
        const vector = await this.createDescriptor(input, candidate.box, width, height);
        if (!vector) continue;

        faces.push({
          vector,
          box: {
            x: this.asPercent(candidate.box.x, width),
            y: this.asPercent(candidate.box.y, height),
            width: this.asPercent(candidate.box.width, width),
            height: this.asPercent(candidate.box.height, height),
          },
        });
      }

      this.logger.log(
        `Face scan ${width}x${height}: primary=${primaryDetector}, candidates=${candidates.length}, unique=${uniqueCandidates.length}, descriptors=${faces.length}, elapsedMs=${Date.now() - startedAt}`,
      );

      return faces;
    } finally {
      input.dispose();
    }
  }

  /**
   * Detect boxes only. Descriptors are computed afterwards just once for each
   * deduplicated face, which is much cheaper than running recognition in every
   * overlapping tile.
   */
  private async detectCandidates(
    input: Tensor3D,
    detector: DetectorName,
    source: FaceCandidate['source'],
  ): Promise<FaceCandidate[]> {
    if (!this.faceApi) return [];

    const detections = await this.faceApi.detectAllFaces(
      input as never,
      this.detectorOptions(detector, source),
    );

    return detections.map((detection) => {
      const raw = detection as unknown as {
        box: PixelBox;
        score?: number;
      };

      return {
        box: {
          x: raw.box.x,
          y: raw.box.y,
          width: raw.box.width,
          height: raw.box.height,
        },
        score: Number(raw.score ?? 0),
        source,
      };
    });
  }

  /**
   * Crop each detected face and calculate its descriptor with full 68-point
   * landmarks. This gives more stable matching than forcing the tiny landmark
   * model for every descriptor.
   */
  private async createDescriptor(
    input: Tensor3D,
    box: PixelBox,
    imageWidth: number,
    imageHeight: number,
  ): Promise<number[] | null> {
    if (!this.faceApi) return null;

    const padding = this.configNumber('FACE_DESCRIPTOR_PADDING', 0.22, 0, 0.6);
    const crop = this.cropTensor(input, box, imageWidth, imageHeight, padding);
    if (!crop) return null;

    try {
      const detector = this.detectorName(
        this.configService.get<string>('FACE_DESCRIPTOR_DETECTOR') ?? 'ssd',
        'ssd',
      );

      const result = await this.faceApi
        .detectSingleFace(crop as never, this.descriptorDetectorOptions(detector))
        // false = full landmark model; true = tiny landmark model.
        .withFaceLandmarks(false)
        .withFaceDescriptor();

      return result?.descriptor ? Array.from(result.descriptor) : null;
    } finally {
      crop.dispose();
    }
  }

  private detectorOptions(
    detector: DetectorName,
    source: FaceCandidate['source'],
  ) {
    if (!this.faceApi) {
      throw new Error('Face API not ready');
    }

    if (detector === 'tiny') {
      const inputKey =
        source === 'tile' ? 'FACE_GROUP_INPUT_SIZE' : 'FACE_DETECTOR_INPUT_SIZE';
      const scoreKey =
        source === 'tile'
          ? 'FACE_GROUP_SCORE_THRESHOLD'
          : 'FACE_DETECTOR_SCORE_THRESHOLD';

      return new this.faceApi.TinyFaceDetectorOptions({
        // 608 preserves small group-photo faces while remaining reasonable
        // when tiles are processed sequentially.
        inputSize: this.tinyInputSize(
          this.configNumber(
            inputKey,
            608,
            128,
            1024,
          ),
        ),
        scoreThreshold: this.configNumber(
          scoreKey,
          source === 'tile' ? 0.12 : 0.15,
          0.01,
          0.99,
        ),
      });
    }

    const confidenceKey =
      source === 'tile'
        ? 'FACE_GROUP_MIN_CONFIDENCE'
        : 'FACE_DETECTOR_MIN_CONFIDENCE';
    const maxResultsKey =
      source === 'tile'
        ? 'FACE_GROUP_MAX_RESULTS'
        : 'FACE_DETECTOR_MAX_RESULTS';

    return new this.faceApi.SsdMobilenetv1Options({
      minConfidence: this.configNumber(
        confidenceKey,
        source === 'tile' ? 0.12 : 0.18,
        0.01,
        0.99,
      ),
      maxResults: this.configNumber(maxResultsKey, 150, 1, 500),
    });
  }

  private descriptorDetectorOptions(detector: DetectorName) {
    if (!this.faceApi) {
      throw new Error('Face API not ready');
    }

    if (detector === 'tiny') {
      return new this.faceApi.TinyFaceDetectorOptions({
        inputSize: this.tinyInputSize(
          this.configNumber('FACE_DESCRIPTOR_INPUT_SIZE', 416, 128, 1024),
        ),
        scoreThreshold: this.configNumber(
          'FACE_DESCRIPTOR_SCORE_THRESHOLD',
          0.08,
          0.01,
          0.99,
        ),
      });
    }

    return new this.faceApi.SsdMobilenetv1Options({
      minConfidence: this.configNumber(
        'FACE_DESCRIPTOR_MIN_CONFIDENCE',
        0.08,
        0.01,
        0.99,
      ),
      maxResults: 1,
    });
  }

  private groupScanEnabled() {
    return this.configBoolean('FACE_GROUP_SCAN_ENABLED', true);
  }

  private shouldRunGroupScan(width: number, height: number) {
    const tileSize = this.configNumber('FACE_GROUP_TILE_SIZE', 1024, 320, 2048);
    return width > tileSize || height > tileSize;
  }

  /**
   * Build a complete overlapping tile grid, then increase tile size as needed
   * to stay within the configured sequential-work limit. No image area is
   * skipped when reducing the number of tiles.
   */
  private buildTiles(width: number, height: number): Tile[] {
    const overlap = this.configNumber('FACE_GROUP_TILE_OVERLAP', 256, 0, 1024);
    const maxTiles = this.configNumber('FACE_GROUP_MAX_TILES', 12, 1, 36);
    let tileSize = this.configNumber('FACE_GROUP_TILE_SIZE', 1024, 320, 2048);

    tileSize = Math.min(tileSize, Math.max(width, height));

    let tiles = this.tileGrid(width, height, tileSize, overlap);
    while (tiles.length > maxTiles && tileSize < Math.max(width, height)) {
      tileSize = Math.min(
        Math.max(width, height),
        tileSize + 128,
      );
      tiles = this.tileGrid(width, height, tileSize, overlap);
    }

    return tiles;
  }

  private tileGrid(
    width: number,
    height: number,
    tileSize: number,
    overlap: number,
  ): Tile[] {
    const xPositions = this.tilePositions(width, tileSize, overlap);
    const yPositions = this.tilePositions(height, tileSize, overlap);
    const tiles: Tile[] = [];

    for (const y of yPositions) {
      for (const x of xPositions) {
        tiles.push({
          x,
          y,
          width: Math.min(tileSize, width - x),
          height: Math.min(tileSize, height - y),
        });
      }
    }

    return tiles;
  }

  private tilePositions(length: number, tileSize: number, overlap: number) {
    if (length <= tileSize) return [0];

    const step = Math.max(32, tileSize - Math.min(overlap, tileSize - 32));
    const last = Math.max(0, length - tileSize);
    const positions: number[] = [];

    for (let position = 0; position < last; position += step) {
      positions.push(position);
    }

    positions.push(last);
    return [...new Set(positions)];
  }

  private deduplicateCandidates(candidates: FaceCandidate[]) {
    const threshold = this.configNumber('FACE_DETECTION_NMS_IOU', 0.45, 0.1, 0.95);
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const unique: FaceCandidate[] = [];

    for (const candidate of sorted) {
      const duplicate = unique.some(
        (existing) => this.intersectionOverUnion(existing.box, candidate.box) >= threshold,
      );

      if (!duplicate) {
        unique.push(candidate);
      }
    }

    return unique;
  }

  private cropTensor(
    input: Tensor3D,
    box: PixelBox,
    imageWidth: number,
    imageHeight: number,
    padding: number,
  ) {
    const x = Math.max(0, Math.floor(box.x - box.width * padding));
    const y = Math.max(0, Math.floor(box.y - box.height * padding));
    const right = Math.min(
      imageWidth,
      Math.ceil(box.x + box.width * (1 + padding)),
    );
    const bottom = Math.min(
      imageHeight,
      Math.ceil(box.y + box.height * (1 + padding)),
    );

    const width = Math.max(1, right - x);
    const height = Math.max(1, bottom - y);

    if (width < 2 || height < 2) return null;
    return input.slice([y, x, 0], [height, width, 3]);
  }

  private async imageTensor(buffer: Buffer) {
    if (!this.faceApi) {
      throw new Error('Face API not ready');
    }

    const maxSize = this.configNumber('FACE_IMAGE_MAX_SIZE', 1920, 640, 3072);

    const { data, info } = await sharp(buffer, { limitInputPixels: true })
      .rotate()
      .resize({
        width: maxSize,
        height: maxSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toColourspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return {
      input: this.faceApi.tf.tensor3d(
        new Uint8Array(data),
        [info.height, info.width, info.channels],
        'int32',
      ) as unknown as Tensor3D,
      width: info.width,
      height: info.height,
    };
  }

  private async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.extractionQueue;

    let release!: () => void;
    this.extractionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous.catch(() => undefined);

    try {
      return await task();
    } finally {
      release();
    }
  }

  private async readImage(url: string) {
    const timeoutMs = this.configNumber('FACE_IMAGE_FETCH_TIMEOUT_MS', 15000, 1000, 60000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } finally {
      clearTimeout(timeout);
    }
  }

  private async findCollection(identifier: string) {
    const query: Record<string, string>[] = [{ slug: identifier }, { name: identifier }];
    if (identifier.match(/^[a-f\d]{24}$/i)) query.unshift({ _id: identifier });

    const collection = await this.collectionModel.findOne({ $or: query }).lean();
    if (!collection) throw new BadRequestException('Collection not found');

    return collection;
  }

  private detectorName(value: string, fallback: DetectorName): DetectorName {
    const normalized = value.trim().toLowerCase();
    return normalized === 'tiny' ? 'tiny' : normalized === 'ssd' ? 'ssd' : fallback;
  }

  private tinyInputSize(value: number) {
    const bounded = Math.max(128, Math.min(1024, Math.round(value)));
    return Math.max(128, Math.round(bounded / 32) * 32);
  }

  private configNumber(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const raw = this.configService.get<string>(key);
    const value = raw === undefined || raw === null || raw.trim() === ''
      ? fallback
      : Number(raw);

    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  private configBoolean(key: string, fallback: boolean) {
    const raw = this.configService.get<string>(key)?.trim().toLowerCase();
    if (!raw) return fallback;
    if (['true', '1', 'yes', 'on'].includes(raw)) return true;
    if (['false', '0', 'no', 'off'].includes(raw)) return false;
    return fallback;
  }

  private pointId(value: string) {
    const hex = createHash('sha1').update(value).digest('hex').slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private pointVector(point: unknown) {
    const typed = point as { vector?: number[] | Record<string, unknown> };

    if (Array.isArray(typed.vector)) return typed.vector;

    if (typed.vector && typeof typed.vector === 'object') {
      const values = Object.values(typed.vector).find((item) => Array.isArray(item));
      return values as number[] | undefined;
    }

    return undefined;
  }

  private euclidean(a: number[], b: number[]) {
    let sum = 0;
    const length = Math.min(a.length, b.length);

    for (let index = 0; index < length; index += 1) {
      const difference = a[index] - b[index];
      sum += difference * difference;
    }

    return Math.sqrt(sum);
  }

  private intersectionOverUnion(a: PixelBox, b: PixelBox) {
    const left = Math.max(a.x, b.x);
    const top = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);

    const intersectionWidth = Math.max(0, right - left);
    const intersectionHeight = Math.max(0, bottom - top);
    const intersection = intersectionWidth * intersectionHeight;
    if (!intersection) return 0;

    const union = a.width * a.height + b.width * b.height - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private isInsideImage(box: PixelBox, width: number, height: number) {
    return (
      Number.isFinite(box.x) &&
      Number.isFinite(box.y) &&
      Number.isFinite(box.width) &&
      Number.isFinite(box.height) &&
      box.x >= 0 &&
      box.y >= 0 &&
      box.width > 0 &&
      box.height > 0 &&
      box.x + box.width <= width + 1 &&
      box.y + box.height <= height + 1
    );
  }

  private asPercent(value: number, total: number) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, (value / total) * 100));
  }
}
