import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';

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

const INSIGHT_VECTOR_SIZE = 512;
const DEFAULT_INSIGHT_COLLECTION = 'album_faces_insightface';

/**
 * Face indexing/search service.
 * Detection is delegated to the Python image-model service so Nest does not run
 * the old CPU face-api pipeline.
 */
@Injectable()
export class FaceSearchService implements OnModuleInit {
  private readonly logger = new Logger(FaceSearchService.name);
  private qdrant?: QdrantClient;
  private ready = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
  ) {}

  async onModuleInit() {
    this.logger.log(
      `Face search boot: external image model=${this.imageModelUrl() || 'not configured'}; qdrant collection=${this.vectorCollection()}; vectorSize=${this.vectorSize()}`,
    );
    await this.initQdrant();
    await this.checkImageModel();
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
      .upsert(this.vectorCollection(), {
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
      .delete(this.vectorCollection(), {
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
      .delete(this.vectorCollection(), {
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

    const response = await this.qdrant.scroll(this.vectorCollection(), {
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
      this.configNumber('FACE_CLUSTER_THRESHOLD', 0.95, 0.1, 2),
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
    const points = await this.qdrant.retrieve(this.vectorCollection(), {
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

    const response = await this.qdrant.scroll(this.vectorCollection(), {
      limit: this.configNumber('FACE_SEARCH_SCAN_LIMIT', 10000, 1, 100000),
      with_payload: true,
      with_vector: true,
      filter: {
        must: [{ key: 'collectionId', match: { value: collectionId } }],
      },
    });

    const points = (response.points ?? []) as FacePoint[];
    const maxDistance = this.configNumber('FACE_MATCH_DISTANCE', 0.95, 0.1, 2);

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

  private vectorCollection() {
    return this.configService.get<string>('IMAGE_MODEL_QDRANT_COLLECTION')?.trim() || DEFAULT_INSIGHT_COLLECTION;
  }

  private vectorSize() {
    return INSIGHT_VECTOR_SIZE;
  }

  private imageModelUrl() {
    return (
      this.configService.get<string>('IMAGE_MODEL_URL')?.trim()
      || this.configService.get<string>('INSIGHTFACE_URL')?.trim()
    );
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

    const collection = this.vectorCollection();
    const exists = await this.qdrant.collectionExists(collection).catch((error) => {
      this.qdrant = undefined;
      this.logger.error(`Qdrant connection failed: ${error?.message ?? error}`);
      return null;
    });

    if (!exists) return;

    if (!exists.exists) {
      await this.qdrant.createCollection(collection, {
        vectors: { size: this.vectorSize(), distance: 'Cosine' },
      });

      await this.qdrant
        .createPayloadIndex(collection, {
          field_name: 'collectionId',
          field_schema: 'keyword',
          wait: true,
        })
        .catch(() => undefined);
    }

    this.logger.log(`Qdrant connected; collection ready: ${collection}`);
  }

  private async checkImageModel() {
    const url = this.imageModelUrl();
    if (!url) {
      this.ready = false;
      this.logger.error('IMAGE_MODEL_URL not found. Face search disabled.');
      return;
    }

    this.logger.log(`Checking external image model health: ${url}/health`);
    const response = await fetch(`${url.replace(/\/$/, '')}/health`).catch((error) => {
      this.logger.error(`Image model connection failed: ${error?.message ?? error}`);
      return null;
    });

    if (!response?.ok) {
      this.ready = false;
      this.logger.error(`Image model health check failed${response ? `: HTTP ${response.status}` : ''}`);
      return;
    }

    this.ready = Boolean(this.qdrant);
    if (this.ready) {
      this.logger.log(`External image model connected: ${url}; qdrant collection=${this.vectorCollection()}`);
    } else {
      this.logger.error('External image model connected, but Qdrant is not ready. Face search disabled.');
    }
  }

  private async extractFaces(buffer: Buffer): Promise<DetectedFace[]> {
    return this.extractFacesWithImageModel(buffer);
  }

  private async extractFacesWithImageModel(buffer: Buffer): Promise<DetectedFace[]> {
    const url = this.imageModelUrl();
    if (!url) return [];
    const startedAt = Date.now();

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)]), 'image.jpg');
    const headers: Record<string, string> = {};
    const apiKey = (
      this.configService.get<string>('IMAGE_MODEL_API_KEY')?.trim()
      || this.configService.get<string>('INSIGHTFACE_API_KEY')?.trim()
    );
    if (apiKey) headers['x-api-key'] = apiKey;

    const response = await fetch(`${url.replace(/\/$/, '')}/v1/faces`, {
      method: 'POST',
      headers,
      body: form,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail ?? payload?.message ?? `Image model HTTP ${response.status}`);
    }

    const faces = Array.isArray(payload?.faces) ? payload.faces : [];
    this.logger.log(
      `External image model scan ok: faces=${faces.length}; embeddingDim=${payload?.embeddingDimension ?? 'unknown'}; elapsedMs=${Date.now() - startedAt}`,
    );
    return faces
      .map((face: any) => ({
        vector: Array.isArray(face.embedding) ? face.embedding.map(Number) : [],
        box: {
          x: Number(face.boxPercent?.x ?? 0),
          y: Number(face.boxPercent?.y ?? 0),
          width: Number(face.boxPercent?.width ?? 0),
          height: Number(face.boxPercent?.height ?? 0),
        },
      }))
      .filter((face: DetectedFace) => face.vector.length === INSIGHT_VECTOR_SIZE);
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

}
