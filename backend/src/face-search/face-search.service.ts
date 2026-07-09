import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { FacePerson, FacePersonDocument } from './entities/face-person.entity';

type IndexedImage = CollectionImage & { _id?: unknown };
type FacePoint = {
  id: string | number;
  score?: number;
  vector?: number[];
  payload?: {
    collectionId?: string;
    imageId?: string;
    url?: string;
    personId?: string;
    faceIndex?: number;
    box?: { x: number; y: number; width: number; height: number };
  };
};
type DetectedFace = {
  vector: number[];
  box: { x: number; y: number; width: number; height: number };
};
type AssignedFace = DetectedFace & { personId: string };
type FaceGroup = {
  representative: FacePoint;
  points: FacePoint[];
  centroid: number[];
  personId?: string;
};

const INSIGHT_VECTOR_SIZE = 512;
const DEFAULT_INSIGHT_COLLECTION = 'album_faces_insightface';
const FACE_INDEX_VERSION = 5;

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
    @InjectModel(FacePerson.name) private readonly facePersonModel: Model<FacePersonDocument>,
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

    await this.deleteImageFaces(String(image.collectionId), imageId);

    const faces = await this.extractFaces(buffer).catch((error) => {
      this.logger.warn(`Face indexing skipped for ${imageId}: ${error?.message ?? error}`);
      return [];
    });

    if (!faces.length) {
      await this.imageModel
        .updateOne(
          { _id: imageId },
          { $set: { faceIndexedAt: new Date(), faceCount: 0, faceIndexVersion: FACE_INDEX_VERSION } },
        )
        .catch(() => undefined);
      return 0;
    }

    const assignedFaces = await this.assignPersonIds(String(image.collectionId), imageId, image.url, faces);

    await this.qdrant
      .upsert(this.vectorCollection(), {
        // Face points are eventually visible; the Mongo record is still updated
        // immediately so the image is not needlessly reprocessed.
        wait: false,
        points: assignedFaces.map((face, index) => ({
          id: this.pointId(`${image.collectionId}-${imageId}-${index}`),
          vector: face.vector,
          payload: {
            collectionId: image.collectionId,
            imageId,
            url: image.url,
            personId: face.personId,
            faceIndex: index,
            box: face.box,
          },
        })),
      })
      .catch((error) => this.logger.warn(`Qdrant upsert failed: ${error?.message ?? error}`));

    await this.imageModel
      .updateOne(
        { _id: imageId },
        { $set: { faceIndexedAt: new Date(), faceCount: faces.length, faceIndexVersion: FACE_INDEX_VERSION } },
      )
      .catch(() => undefined);

    return assignedFaces.length;
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

    await this.facePersonModel.deleteMany({ collectionId }).catch(() => undefined);
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

  private async assignPersonIds(
    collectionId: string,
    imageId: string,
    imageUrl: string,
    faces: DetectedFace[],
  ): Promise<AssignedFace[]> {
    const persons = await this.facePersonModel.find({ collectionId }).lean();
    const working = persons.map((person) => ({
      personKey: person.personKey,
      centroid: this.normalizeVector(person.centroid) ?? person.centroid,
      faceCount: Number(person.faceCount || 0),
      imageCount: Number(person.imageCount || 0),
      representativeArea: this.boxArea(person.representativeBox),
    }));
    const minSimilarity = this.personSimilarity();
    const usedPersonIds = new Set<string>();
    const assigned: AssignedFace[] = [];

    for (const [index, face] of faces.entries()) {
      const vector = this.normalizeVector(face.vector);
      if (!vector) continue;

      const match = working
        .map((person) => ({ person, score: this.cosine(vector, person.centroid) }))
        .filter(({ person, score }) =>
          score >= minSimilarity
          && (!usedPersonIds.has(person.personKey) || score >= this.conflictMergeSimilarity()),
        )
        .sort((left, right) => right.score - left.score)[0]?.person;

      const personKey = match?.personKey ?? this.newPersonKey(collectionId, imageId, index);
      const area = this.boxArea(face.box);
      const oldRepresentativeArea = match?.representativeArea ?? 0;
      const isNewPerson = !match;
      const nextFaceCount = (match?.faceCount ?? 0) + 1;
      const nextCentroid = match
        ? this.normalizeVector(
          match.centroid.map((value, vectorIndex) =>
            ((value * match.faceCount) + vector[vectorIndex]) / nextFaceCount,
          ),
        ) ?? vector
        : vector;

      if (match) {
        match.centroid = nextCentroid;
        match.faceCount = nextFaceCount;
        if (!usedPersonIds.has(personKey)) match.imageCount += 1;
        if (area > match.representativeArea) match.representativeArea = area;
      } else {
        working.push({
          personKey,
          centroid: nextCentroid,
          faceCount: 1,
          imageCount: 1,
          representativeArea: area,
        });
      }

      await this.facePersonModel.updateOne(
        { collectionId, personKey },
        {
          $set: {
            collectionId,
            personKey,
            centroid: nextCentroid,
            ...(isNewPerson || area >= oldRepresentativeArea
              ? {
                representativeImageId: imageId,
                representativeFaceId: String(this.pointId(`${collectionId}-${imageId}-${index}`)),
                representativeUrl: imageUrl,
                representativeBox: face.box,
              }
              : {}),
          },
          $inc: {
            faceCount: 1,
            imageCount: usedPersonIds.has(personKey) ? 0 : 1,
          },
        },
        { upsert: true },
      );

      usedPersonIds.add(personKey);
      assigned.push({ ...face, personId: personKey });
    }

    return assigned;
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
    const staleImages = await this.imageModel
      .find({
        collectionId,
        $or: [
          { faceIndexedAt: { $exists: false } },
          { faceIndexVersion: { $ne: FACE_INDEX_VERSION } },
        ],
      })
      .limit(200)
      .lean();

    if (staleImages.length) {
      setTimeout(() => {
        void this.indexMissingFaces(staleImages as IndexedImage[]);
      }, 250);
    }

    // Cluster all face points: same person → 1 group.
    // Works for all photo types:
    //   • Solo portrait (1 face) — creates or joins 1 cluster
    //   • Duo photo (2 faces) — each face creates/joins its own cluster
    //   • Group photo (many faces) — each detected face creates/joins clusters
    const clusteredGroups = this.clusterPoints(points);

    this.logger.log(
      `Face clustering: collection=${collectionId} points=${points.length} ` +
      `groups=${clusteredGroups.length} staleImages=${staleImages.length}`,
    );

    // Sort by photo count descending so the most prominent people come first.
    const sortedGroups = clusteredGroups.sort((a, b) => {
      const aPhotos = new Set(a.points.map((p) => p.payload?.imageId).filter(Boolean)).size;
      const bPhotos = new Set(b.points.map((p) => p.payload?.imageId).filter(Boolean)).size;
      return bPhotos - aPhotos;
    });

    return {
      collectionId,
      count: sortedGroups.length,
      indexing: staleImages.length > 0,
      missingImages: staleImages.length,
      faces: sortedGroups.map((group, index) => ({
        id: String(group.representative.id),
        personId: group.personId,
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
    const collectionId = collection._id.toString();

    // Retrieve the target face point to confirm it exists and belongs to this collection.
    const retrievedPoints = await this.qdrant.retrieve(this.vectorCollection(), {
      ids: [faceId],
      with_vector: true,
      with_payload: true,
    });
    const targetPoint = retrievedPoints[0] as FacePoint | undefined;
    const targetVector = targetPoint ? this.pointVector(targetPoint) : undefined;

    if (!targetVector || targetPoint?.payload?.collectionId !== collectionId) {
      throw new BadRequestException('Face not found');
    }

    // Keep click-search anchored to the selected face. If a sidebar group is
    // accidentally polluted, using all group vectors can pull another person.
    const queryVectors = [targetVector];

    return this.searchByVectors(collectionId, queryVectors);
  }

  private async indexMissingFaces(images: IndexedImage[]) {
    for (const image of images) {
      await this.indexImage(image).catch((error) => {
        this.logger.warn(`Missing face index failed: ${error?.message ?? error}`);
      });

      // Yield to the event loop between images so public requests can still run.
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
    const minSimilarity = this.faceThreshold('FACE_MATCH_SIMILARITY', 'FACE_MATCH_DISTANCE', 0.40);
    const normalizedQueries = vectors
      .map((vector) => this.normalizeVector(vector))
      .filter((vector): vector is number[] => Boolean(vector));
    if (!normalizedQueries.length) {
      return { collectionId, count: 0, images: [] };
    }

    const matched = points
      .map((item) => {
        const candidate = this.pointVector(item);
        const normalizedCandidate = candidate ? this.normalizeVector(candidate) : undefined;
        const similarity = normalizedCandidate
          ? Math.max(...normalizedQueries.map((vector) => this.cosine(vector, normalizedCandidate)))
          : Number.NEGATIVE_INFINITY;

        return { item, similarity };
      })
      .filter(({ similarity }) => similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity);

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

    const similarityMap = new Map<string, number>();
    for (const { item, similarity } of matched) {
      const imageId = String(item.payload?.imageId ?? '');
      if (!imageId) continue;
      similarityMap.set(
        imageId,
        Math.max(similarityMap.get(imageId) ?? Number.NEGATIVE_INFINITY, similarity),
      );
    }

    this.logger.log(
      `Face match scan collection=${collectionId} queryFaces=${vectors.length} indexedFaces=${points.length} matchedFaces=${matched.length} matchedImages=${images.length} minSimilarity=${minSimilarity}`,
    );

    return {
      collectionId,
      count: images.length,
      images: images
        .map((image) => ({
          ...image,
          faceScore: Math.max(0, similarityMap.get(image._id.toString()) ?? 0),
        }))
        .sort((a, b) => b.faceScore - a.faceScore),
    };
  }

  /**
   * Core clustering pipeline — groups face points by person identity.
   *
   * Handles all photo types uniformly:
   *   • Solo portrait (1 face per image) — creates or joins 1 cluster
   *   • Duo photo (2 faces per image) — each face creates/joins its own cluster
   *   • Group photo (many faces per image) — each face creates/joins clusters
   *
   * Pipeline:
   *   Pass 1: Greedy assignment (quality-sorted, largest faces seed clusters first)
   *   Pass 2: Standard merge at 75% threshold
   *   Pass 3: Confident absorption (same threshold but requires confidence gap)
   *   Pass 4: Final merge to catch groups that became similar after absorption
   */
  private clusterPoints(points: FacePoint[]): FaceGroup[] {
    const minSimilarity = this.faceThreshold('FACE_CLUSTER_SIMILARITY', 'FACE_CLUSTER_DISTANCE', 0.16);
    const minPairSimilarity = this.faceThreshold('FACE_CLUSTER_PAIR_SIMILARITY', 'FACE_CLUSTER_DISTANCE', 0.16);

    const uniquePoints = this.dedupeSameImageFaces(points);
    let groups = this.personIdGroups(uniquePoints);
    const groupedPointIds = new Set(groups.flatMap((group) => group.points.map((point) => String(point.id))));
    const ungroupedPoints = uniquePoints.filter((point) => !groupedPointIds.has(String(point.id)));
    groups.push(...this.vectorConnectedGroups(ungroupedPoints, minPairSimilarity));

    groups = this.mergeFaceGroups(groups, minSimilarity, minPairSimilarity);
    this.absorbSmallGroups(groups, minSimilarity, minPairSimilarity);
    groups = this.mergeFaceGroups(groups, minSimilarity, minPairSimilarity);

    this.logger.log(
      `CLUSTER_DEBUG input=${points.length} unique=${uniquePoints.length} groups=${groups.length} `
      + `minSimilarity=${minSimilarity} minPairSimilarity=${minPairSimilarity}`,
    );

    return groups;
  }

  private personIdGroups(points: FacePoint[]): FaceGroup[] {
    const byPerson = new Map<string, FacePoint[]>();
    for (const point of points) {
      const personId = String(point.payload?.personId ?? '');
      if (!personId) continue;
      byPerson.set(personId, [...(byPerson.get(personId) ?? []), point]);
    }

    return [...byPerson.entries()]
      .map(([personId, personPoints]) => ({
        personId,
        points: personPoints,
        representative: this.bestRepresentative(personPoints),
        centroid: this.centroid(personPoints),
      }))
      .filter((group) => group.centroid.length > 0);
  }

  private dedupeSameImageFaces(points: FacePoint[]) {
    const byImage = new Map<string, FacePoint[]>();
    for (const point of points) {
      const imageId = String(point.payload?.imageId ?? '');
      byImage.set(imageId || String(point.id), [...(byImage.get(imageId || String(point.id)) ?? []), point]);
    }

    const unique: FacePoint[] = [];
    for (const imagePoints of byImage.values()) {
      const accepted: FacePoint[] = [];
      for (const point of this.sortFacePointsByQuality(imagePoints)) {
        const duplicate = accepted.some((existing) => this.samePhysicalFacePoint(existing, point));
        if (!duplicate) accepted.push(point);
      }
      unique.push(...accepted);
    }

    return unique;
  }

  private sortFacePointsByQuality(points: FacePoint[]) {
    return [...points].sort((left, right) => {
      const leftBox = left.payload?.box;
      const rightBox = right.payload?.box;
      const leftArea = Number(leftBox?.width ?? 0) * Number(leftBox?.height ?? 0);
      const rightArea = Number(rightBox?.width ?? 0) * Number(rightBox?.height ?? 0);
      return rightArea - leftArea;
    });
  }

  private vectorConnectedGroups(points: FacePoint[], minPairSimilarity: number) {
    const groups: FaceGroup[] = this.sortFacePointsByQuality(points)
      .map((point) => {
        const vector = this.pointVector(point);
        const normalized = vector ? this.normalizeVector(vector) : undefined;
        return normalized ? { representative: point, points: [point], centroid: normalized } : null;
      })
      .filter((group): group is FaceGroup => Boolean(group));

    let changed = true;
    while (changed) {
      changed = false;
      for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
          const left = groups[leftIndex];
          const right = groups[rightIndex];
          const bestScore = this.bestGroupPairSimilarity(left, right);
          const conflict = this.groupsConflictInSameImage(left, right);
          if (bestScore < minPairSimilarity) continue;
          if (conflict && bestScore < this.conflictMergeSimilarity()) continue;
          left.points.push(...right.points);
          left.centroid = this.centroid(left.points);
          left.representative = this.bestRepresentative(left.points);
          groups.splice(rightIndex, 1);
          changed = true;
          rightIndex -= 1;
        }
      }
    }

    return groups;
  }

  private bestGroupPairSimilarity(left: FaceGroup, right: FaceGroup) {
    let best = Number.NEGATIVE_INFINITY;
    for (const leftPoint of left.points) {
      for (const rightPoint of right.points) {
        const score = this.samePointSimilarity(leftPoint, rightPoint);
        best = Math.max(best, score);
      }
    }

    if (best >= 0.10) {
      this.logger.log(
        `PAIR_SCORE best=${best.toFixed(4)} `
        + `leftPhotos=${new Set(left.points.map((point) => point.payload?.imageId).filter(Boolean)).size} `
        + `rightPhotos=${new Set(right.points.map((point) => point.payload?.imageId).filter(Boolean)).size} `
        + `conflict=${this.groupsConflictInSameImage(left, right)}`,
      );
    }

    return best;
  }

  private conflictMergeSimilarity() {
    return this.configNumber('FACE_CLUSTER_CONFLICT_SIMILARITY', 0.30, 0.1, 0.99);
  }

  private personSimilarity() {
    return this.configNumber('FACE_PERSON_SIMILARITY', 0.28, 0.1, 0.99);
  }

  private newPersonKey(collectionId: string, imageId: string, faceIndex: number) {
    return `person_${createHash('sha1')
      .update(`${collectionId}:${imageId}:${faceIndex}:${Date.now()}:${Math.random()}`)
      .digest('hex')
      .slice(0, 16)}`;
  }

  private boxArea(box?: { width: number; height: number }) {
    return Math.max(0, Number(box?.width ?? 0)) * Math.max(0, Number(box?.height ?? 0));
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
      return Array.isArray(values) ? values as number[] : [];
    }

    return [];
  }

  private normalizeVector(vector: number[]) {
    let sum = 0;
    for (const value of vector) sum += value * value;
    const norm = Math.sqrt(sum);
    if (!Number.isFinite(norm) || norm <= 0) return undefined;
    return vector.map((value) => value / norm);
  }

  private centroid(points: FacePoint[]) {
    const entries = points
      .map((point) => {
        const vector = this.pointVector(point);
        const normalized = vector ? this.normalizeVector(vector) : undefined;
        // Weight by face area: larger faces produce better embeddings.
        const box = point.payload?.box;
        const area = Number(box?.width ?? 0) * Number(box?.height ?? 0);
        const weight = Math.max(area, 0.01); // avoid zero weight
        return normalized ? { vector: normalized, weight } : undefined;
      })
      .filter((entry): entry is { vector: number[]; weight: number } => Boolean(entry));

    if (!entries.length) return [];

    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    const length = entries[0].vector.length;
    const centroid = Array.from({ length }, (_, index) =>
      entries.reduce((sum, entry) => sum + entry.vector[index] * entry.weight, 0) / totalWeight,
    );
    return this.normalizeVector(centroid) ?? centroid;
  }

  private mergeFaceGroups(groups: FaceGroup[], minSimilarity: number, minPairSimilarity: number) {
    const merged = [...groups];
    let changed = true;

    while (changed) {
      changed = false;
      for (let leftIndex = 0; leftIndex < merged.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < merged.length; rightIndex += 1) {
          if (!this.groupsMatch(merged[leftIndex], merged[rightIndex], minSimilarity, minPairSimilarity)) continue;
          merged[leftIndex].points.push(...merged[rightIndex].points);
          merged[leftIndex].centroid = this.centroid(merged[leftIndex].points);
          merged[leftIndex].representative = this.bestRepresentative(merged[leftIndex].points);
          merged.splice(rightIndex, 1);
          changed = true;
          rightIndex -= 1;
        }
      }
    }

    return merged;
  }

  /**
   * Confident singleton absorption pass.
   *
   * Small groups (≤2 face points) try to merge into a larger group, but ONLY
   * if the match is unambiguous — the best-matching group must score
   * significantly higher than the second-best.  This prevents a face from
   * being absorbed into the WRONG person's group (which would make that
   * person disappear from the face sheet entirely).
   *
   * Key rule: it's better to leave a duplicate than to lose a face.
   */
  private absorbSmallGroups(groups: FaceGroup[], minSimilarity: number, minPairSimilarity: number) {
    const maxSmallGroupSize = 2;
    const minConfidenceGap = 0.08; // best match must beat second-best by this much
    let changed = true;

    while (changed) {
      changed = false;
      for (let index = groups.length - 1; index >= 0; index -= 1) {
        const small = groups[index];
        if (small.points.length > maxSmallGroupSize) continue;

        // Score every other group and track the top two.
        const scores: Array<{ target: FaceGroup; score: number }> = [];

        for (const candidate of groups) {
          if (candidate === small) continue;

          let bestCandidateScore = Number.NEGATIVE_INFINITY;

          // Check centroid similarity.
          const centroidScore = this.cosine(small.centroid, candidate.centroid);
          if (centroidScore > bestCandidateScore) bestCandidateScore = centroidScore;

          // Check best pairwise match.
          for (const smallPoint of small.points) {
            const smallVector = this.pointVector(smallPoint);
            const normalizedSmall = smallVector ? this.normalizeVector(smallVector) : undefined;
            if (!normalizedSmall) continue;
            for (const candidatePoint of candidate.points) {
              const candidateVector = this.pointVector(candidatePoint);
              const normalizedCandidate = candidateVector ? this.normalizeVector(candidateVector) : undefined;
              if (!normalizedCandidate) continue;
              const pairScore = this.cosine(normalizedSmall, normalizedCandidate);
              if (pairScore > bestCandidateScore) bestCandidateScore = pairScore;
            }
          }

          const conflict = this.groupsConflictInSameImage(small, candidate);
          if (conflict && bestCandidateScore < this.conflictMergeSimilarity()) continue;

          scores.push({ target: candidate, score: bestCandidateScore });
        }

        // Sort by score descending.
        scores.sort((a, b) => b.score - a.score);
        const best = scores[0];
        const secondBest = scores[1];

        if (!best || best.score < minSimilarity) continue;

        // Only absorb if there's a clear winner (confidence gap).
        // If two groups score similarly, we can't tell which is correct,
        // so we leave the small group alone — better a duplicate than a missing face.
        const gap = secondBest ? best.score - secondBest.score : 1.0;
        if (gap < minConfidenceGap) continue;

        best.target.points.push(...small.points);
        best.target.centroid = this.centroid(best.target.points);
        best.target.representative = this.bestRepresentative(best.target.points);
        groups.splice(index, 1);
        changed = true;
      }
    }
  }

  private groupsMatch(left: FaceGroup, right: FaceGroup, minSimilarity: number, minPairSimilarity: number) {
    const bestPairScore = this.bestGroupPairSimilarity(left, right);
    const conflict = this.groupsConflictInSameImage(left, right);

    if (conflict && bestPairScore < this.conflictMergeSimilarity()) return false;
    if (bestPairScore >= minPairSimilarity) return true;
    if (this.cosine(left.centroid, right.centroid) >= minSimilarity) return true;

    // Collect all cross-pair similarities to check both best-pair and average.
    const pairSimilarities: number[] = [];
    for (const leftPoint of left.points) {
      const leftVector = this.pointVector(leftPoint);
      const normalizedLeft = leftVector ? this.normalizeVector(leftVector) : undefined;
      if (!normalizedLeft) continue;
      for (const rightPoint of right.points) {
        const rightVector = this.pointVector(rightPoint);
        const normalizedRight = rightVector ? this.normalizeVector(rightVector) : undefined;
        if (!normalizedRight) continue;
        const similarity = this.cosine(normalizedLeft, normalizedRight);
        if (similarity >= minPairSimilarity) return true;
        pairSimilarities.push(similarity);
      }
    }

    // If the average cross-pair similarity exceeds the centroid threshold,
    // groups likely belong to the same person even though no single pair
    // exceeded the stricter pair threshold.
    if (pairSimilarities.length > 0) {
      const avgSimilarity = pairSimilarities.reduce((sum, score) => sum + score, 0) / pairSimilarities.length;
      if (avgSimilarity >= minSimilarity) return true;
    }

    return false;
  }

  private groupsConflictInSameImage(left: FaceGroup, right: FaceGroup) {
    for (const leftPoint of left.points) {
      const leftImageId = String(leftPoint.payload?.imageId ?? '');
      if (!leftImageId) continue;
      for (const rightPoint of right.points) {
        if (String(rightPoint.payload?.imageId ?? '') !== leftImageId) continue;
        if (this.samePhysicalFacePoint(leftPoint, rightPoint)) continue;
        return true;
      }
    }
    return false;
  }

  private samePointSimilarity(left: FacePoint, right: FacePoint) {
    const leftVector = this.pointVector(left);
    const rightVector = this.pointVector(right);
    const normalizedLeft = leftVector ? this.normalizeVector(leftVector) : undefined;
    const normalizedRight = rightVector ? this.normalizeVector(rightVector) : undefined;
    return normalizedLeft && normalizedRight ? this.cosine(normalizedLeft, normalizedRight) : Number.NEGATIVE_INFINITY;
  }

  private samePhysicalFacePoint(left: FacePoint, right: FacePoint) {
    if (this.sameFaceBox(left.payload?.box, right.payload?.box)) return true;
    if (!this.faceBoxesClose(left.payload?.box, right.payload?.box, 1.25)) return false;
    return this.samePointSimilarity(left, right) >= 0.78;
  }

  private sameFaceBox(
    left?: { x: number; y: number; width: number; height: number },
    right?: { x: number; y: number; width: number; height: number },
  ) {
    if (!left || !right) return false;
    const iou = this.boxIou(left, right);
    if (iou >= 0.22) return true;

    const leftCenter = { x: left.x + left.width / 2, y: left.y + left.height / 2 };
    const rightCenter = { x: right.x + right.width / 2, y: right.y + right.height / 2 };
    const distance = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
    const faceSize = Math.max(left.width, left.height, right.width, right.height, 1);
    return distance <= faceSize * 0.45;
  }

  private faceBoxesClose(
    left?: { x: number; y: number; width: number; height: number },
    right?: { x: number; y: number; width: number; height: number },
    multiplier = 1,
  ) {
    if (!left || !right) return false;
    const leftCenter = { x: left.x + left.width / 2, y: left.y + left.height / 2 };
    const rightCenter = { x: right.x + right.width / 2, y: right.y + right.height / 2 };
    const distance = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
    const faceSize = Math.max(left.width, left.height, right.width, right.height, 1);
    return distance <= faceSize * multiplier;
  }

  private boxIou(
    left: { x: number; y: number; width: number; height: number },
    right: { x: number; y: number; width: number; height: number },
  ) {
    const leftX2 = left.x + left.width;
    const leftY2 = left.y + left.height;
    const rightX2 = right.x + right.width;
    const rightY2 = right.y + right.height;
    const intersectionWidth = Math.max(0, Math.min(leftX2, rightX2) - Math.max(left.x, right.x));
    const intersectionHeight = Math.max(0, Math.min(leftY2, rightY2) - Math.max(left.y, right.y));
    const intersection = intersectionWidth * intersectionHeight;
    const union = left.width * left.height + right.width * right.height - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private bestRepresentative(points: FacePoint[]) {
    return [...points].sort((left, right) => {
      const leftBox = left.payload?.box;
      const rightBox = right.payload?.box;
      const leftArea = Number(leftBox?.width ?? 0) * Number(leftBox?.height ?? 0);
      const rightArea = Number(rightBox?.width ?? 0) * Number(rightBox?.height ?? 0);
      return rightArea - leftArea;
    })[0] ?? points[0];
  }

  private cosine(a: number[], b: number[]) {
    let sum = 0;
    const length = Math.min(a.length, b.length);

    for (let index = 0; index < length; index += 1) {
      sum += a[index] * b[index];
    }

    return sum;
  }

  private faceThreshold(similarityKey: string, distanceKey: string, fallback: number) {
    const similarityRaw = this.configService.get<string>(similarityKey);
    if (similarityRaw !== undefined && similarityRaw !== null && similarityRaw.trim() !== '') {
      return this.configNumber(similarityKey, fallback, 0.1, 0.99);
    }

    const distanceRaw = this.configService.get<string>(distanceKey);
    if (distanceRaw !== undefined && distanceRaw !== null && distanceRaw.trim() !== '') {
      const distance = Number(distanceRaw);
      if (Number.isFinite(distance)) {
        // Historical env used "distance" as a loose threshold. Qdrant uses cosine similarity here.
        // 0.95 old distance maps to a sane similarity floor instead of merging every person.
        if (distance >= 0.9) return fallback;
        return Math.min(0.99, Math.max(0.1, 1 - distance));
      }
    }

    return fallback;
  }

}
