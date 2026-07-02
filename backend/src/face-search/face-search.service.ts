import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import Module from 'module';
import { Model } from 'mongoose';
import { dirname, join } from 'path';
import { cwd } from 'process';
import sharp from 'sharp';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';

type FaceApiModule = typeof import('@vladmandic/face-api');
type IndexedImage = CollectionImage & { _id?: unknown };
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
type DetectedFace = {
  vector: number[];
  box: { x: number; y: number; width: number; height: number };
};

const VECTOR_SIZE = 128;
const COLLECTION = 'album_faces';

@Injectable()
export class FaceSearchService implements OnModuleInit {
  private readonly logger = new Logger(FaceSearchService.name);
  private readonly modelDir = join(cwd(), 'models', 'face-api');
  private faceApi?: FaceApiModule;
  private qdrant?: QdrantClient;
  private ready = false;

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
    if (!buffer) return 0;

    const faces = await this.extractFaces(buffer).catch((error) => {
      this.logger.warn(`Face indexing skipped for ${imageId}: ${error?.message ?? error}`);
      return [];
    });
    if (!faces.length) return 0;

    await this.qdrant.upsert(COLLECTION, {
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
    }).catch((error) => this.logger.warn(`Qdrant upsert failed: ${error?.message ?? error}`));
    return faces.length;
  }

  async deleteImageFaces(collectionId: string, imageId: string) {
    if (!this.ready || !this.qdrant) return;
    await this.qdrant.delete(COLLECTION, {
      wait: true,
      filter: {
        must: [
          { key: 'collectionId', match: { value: collectionId } },
          { key: 'imageId', match: { value: imageId } },
        ],
      },
    }).catch((error) => this.logger.warn(`Qdrant face delete failed: ${error?.message ?? error}`));
  }

  async deleteCollectionFaces(collectionId: string) {
    if (!this.ready || !this.qdrant) return;
    await this.qdrant.delete(COLLECTION, {
      wait: true,
      filter: {
        must: [
          { key: 'collectionId', match: { value: collectionId } },
        ],
      },
    }).catch((error) => this.logger.warn(`Qdrant collection face delete failed: ${error?.message ?? error}`));
  }

  async reindexCollectionFaces(collectionId: string) {
    if (!this.ready || !this.qdrant) throw new BadRequestException('Face search is not ready');
    const images = await this.imageModel.find({ collectionId }).lean();
    await this.deleteCollectionFaces(collectionId);
    let faces = 0;
    for (const image of images) {
      faces += await this.indexImage(image as IndexedImage);
    }
    return { collectionId, images: images.length, faces };
  }

  async searchCollection(collectionIdOrSlug: string, file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Face image is required');
    if (!this.ready || !this.qdrant) throw new BadRequestException('Face search is not ready');

    const collection = await this.findCollection(collectionIdOrSlug);
    const faces = await this.extractFaces(file.buffer);
    if (!faces.length) throw new BadRequestException('No face found in uploaded image');

    return this.searchByVectors(collection._id.toString(), faces.map((face) => face.vector));
  }

  async listCollectionFaces(collectionIdOrSlug: string) {
    if (!this.ready || !this.qdrant) throw new BadRequestException('Face search is not ready');
    const collection = await this.findCollection(collectionIdOrSlug);
    const collectionId = collection._id.toString();
    const response = await this.qdrant.scroll(COLLECTION, {
      limit: 10000,
      with_payload: true,
      with_vector: true,
      filter: {
        must: [
          { key: 'collectionId', match: { value: collectionId } },
        ],
      },
    });
    const points = (response.points ?? []) as FacePoint[];
    const groups: { representative: FacePoint; points: FacePoint[] }[] = [];
    const maxDistance = Number(
      this.configService.get<string>('FACE_CLUSTER_DISTANCE')
        ?? this.configService.get<string>('FACE_CLUSTER_THRESHOLD')
        ?? 0.55,
    );

    for (const point of points) {
      const vector = this.pointVector(point);
      if (!vector) continue;
      const match = groups.find((group) => {
        return group.points.some((groupPoint) => {
          const groupVector = this.pointVector(groupPoint);
          return groupVector ? this.euclidean(vector, groupVector) <= maxDistance : false;
        });
      });
      if (match) match.points.push(point);
      else groups.push({ representative: point, points: [point] });
    }

    return {
      collectionId,
      count: groups.length,
      faces: groups.map((group, index) => ({
        id: String(group.representative.id),
        label: `Face ${index + 1}`,
        imageId: group.representative.payload?.imageId,
        imageUrl: group.representative.payload?.url,
        box: group.representative.payload?.box,
        photoCount: new Set(group.points.map((point) => point.payload?.imageId).filter(Boolean)).size,
      })),
    };
  }

  async searchCollectionByFaceId(collectionIdOrSlug: string, faceId: string) {
    if (!this.ready || !this.qdrant) throw new BadRequestException('Face search is not ready');
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

  private async searchByVectors(collectionId: string, vectors: number[][]) {
    if (!this.qdrant) throw new BadRequestException('Face search is not ready');
    const response = await this.qdrant.scroll(COLLECTION, {
      limit: Number(this.configService.get<string>('FACE_SEARCH_SCAN_LIMIT') ?? 10000),
      with_payload: true,
      with_vector: true,
      filter: {
        must: [
          { key: 'collectionId', match: { value: collectionId } },
        ],
      },
    });
    const points = (response.points ?? []) as FacePoint[];
    const maxDistance = Number(this.configService.get<string>('FACE_MATCH_DISTANCE') ?? 0.95);
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

    const imageIds = [...new Set(matched.map(({ item }) => String(item.payload?.imageId)).filter(Boolean))];
    const images = imageIds.length
      ? await this.imageModel.find({ _id: { $in: imageIds }, collectionId }).lean()
      : [];
    const distanceMap = new Map<string, number>();
    for (const { item, distance } of matched) {
      const imageId = String(item.payload?.imageId);
      if (!imageId) continue;
      distanceMap.set(imageId, Math.min(distanceMap.get(imageId) ?? Number.POSITIVE_INFINITY, distance));
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
    this.logger.log(url)
    if (!url) {
      this.logger.error('QDRANT_URL not found. Face search disabled until QDRANT_URL is set.');
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
      await this.qdrant.createPayloadIndex(COLLECTION, {
        field_name: 'collectionId',
        field_schema: 'keyword',
        wait: true,
      }).catch(() => undefined);
    }
    this.logger.log(`Qdrant connected: ${url}; collection ready: ${COLLECTION}`);
  }

  private async initFaceApi() {
    try {
      this.installTfjsFallback();
      this.faceApi = await import('@vladmandic/face-api');
      const tf = this.faceApi.tf as unknown as {
        setBackend: (backend: string) => Promise<boolean>;
        ready: () => Promise<void>;
      };
      await tf.setBackend('cpu');
      await tf.ready();
      await this.faceApi.nets.ssdMobilenetv1.loadFromDisk(this.modelDir);
      await this.faceApi.nets.tinyFaceDetector.loadFromDisk(this.modelDir);
      await this.faceApi.nets.faceLandmark68TinyNet.loadFromDisk(this.modelDir);
      await this.faceApi.nets.faceRecognitionNet.loadFromDisk(this.modelDir);
      this.ready = Boolean(this.qdrant);
      this.logger.log(`Face models loaded from ${this.modelDir}`);
      if (!this.ready) this.logger.error('Face models loaded, but Qdrant is not connected.');
    } catch (error) {
      this.ready = false;
      this.logger.error(`Face search disabled: ${error?.message ?? error}`);
    }
  }

  private installTfjsFallback() {
    const loader = Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
    const originalLoad = loader._load;
    loader._load = (request: string, parent: unknown, isMain: boolean) => {
      if (request !== '@tensorflow/tfjs-node') return originalLoad(request, parent, isMain);
      try {
        return originalLoad(request, parent, isMain);
      } catch (error) {
        this.logger.warn('Native @tensorflow/tfjs-node not available; using slower pure JS CPU fallback.');
        return originalLoad('@tensorflow/tfjs', parent, isMain);
      }
    };
  }

  private async ensureModels() {
    mkdirSync(this.modelDir, { recursive: true });
    const sourceDir = join(dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
    const needed = [
      'tiny_face_detector_model-weights_manifest.json',
      'tiny_face_detector_model.bin',
      'ssd_mobilenetv1_model-weights_manifest.json',
      'ssd_mobilenetv1_model.bin',
      'face_landmark_68_tiny_model-weights_manifest.json',
      'face_landmark_68_tiny_model.bin',
      'face_recognition_model-weights_manifest.json',
      'face_recognition_model.bin',
    ];
    for (const file of needed) {
      const target = join(this.modelDir, file);
      if (!existsSync(target)) copyFileSync(join(sourceDir, file), target);
    }
    const missing = needed.filter((file) => !existsSync(join(this.modelDir, file)));
    if (missing.length || !readdirSync(this.modelDir).length) {
      throw new Error(`Missing face model files in ${this.modelDir}: ${missing.join(', ')}`);
    }
    this.logger.log(`Face model files found in ${this.modelDir}`);
  }

  private async extractFaces(buffer: Buffer): Promise<DetectedFace[]> {
    if (!this.faceApi) return [];

    const { input, width, height } = await this.imageTensor(buffer);

    try {
      const detector = (this.configService.get<string>('FACE_DETECTOR_MODEL') ?? 'ssd')
        .trim()
        .toLowerCase();
      const options = detector === 'tiny'
        ? new this.faceApi.TinyFaceDetectorOptions({
          inputSize: Number(this.configService.get<string>('FACE_DETECTOR_INPUT_SIZE') ?? 608),
          scoreThreshold: Number(this.configService.get<string>('FACE_DETECTOR_SCORE_THRESHOLD') ?? 0.15),
        })
        : new this.faceApi.SsdMobilenetv1Options({
          minConfidence: Number(
            this.configService.get<string>('FACE_DETECTOR_MIN_CONFIDENCE')
              ?? this.configService.get<string>('FACE_DETECTOR_SCORE_THRESHOLD')
              ?? 0.10,
          ),
          maxResults: Number(this.configService.get<string>('FACE_DETECTOR_MAX_RESULTS') ?? 100),
        });

      const detections = await this.faceApi
        .detectAllFaces(input, options)
        .withFaceLandmarks(true)
        .withFaceDescriptors();

      this.logger.log(
        `Detected ${detections.length} face(s) from ${width}x${height} image using ${detector}`,
      );

      return detections.map((item) => ({
        vector: Array.from(item.descriptor),
        box: {
          x: (item.detection.box.x / width) * 100,
          y: (item.detection.box.y / height) * 100,
          width: (item.detection.box.width / width) * 100,
          height: (item.detection.box.height / height) * 100,
        },
      }));
    } finally {
      input.dispose();
    }
  }

  private async imageTensor(buffer: Buffer) {
    if (!this.faceApi) throw new Error('Face API not ready');
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({
        width: Number(this.configService.get<string>('FACE_IMAGE_MAX_SIZE') ?? 1280),
        height: Number(this.configService.get<string>('FACE_IMAGE_MAX_SIZE') ?? 1280),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return {
      input: this.faceApi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels], 'int32'),
      width: info.width,
      height: info.height,
    };
  }

  private async readImage(url: string) {
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  private async findCollection(identifier: string) {
    const query: Record<string, string>[] = [{ slug: identifier }, { name: identifier }];
    if (identifier.match(/^[a-f\d]{24}$/i)) query.unshift({ _id: identifier });
    const collection = await this.collectionModel.findOne({ $or: query }).lean();
    if (!collection) throw new BadRequestException('Collection not found');
    return collection;
  }

  private pointId(value: string) {
    const hex = createHash('sha1').update(value).digest('hex').slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private pointVector(point: any) {
    if (Array.isArray(point.vector)) return point.vector;
    if (point.vector && typeof point.vector === 'object') {
      const values = Object.values(point.vector).find((item) => Array.isArray(item));
      return values as number[] | undefined;
    }
    return undefined;
  }

  private euclidean(a: number[], b: number[]) {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}
