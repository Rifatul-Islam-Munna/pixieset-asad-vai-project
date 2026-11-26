import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Interval } from '@nestjs/schedule';
import { createHash, randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { backgroundWorkerEnabled } from 'src/lib/runtime-role';
import { ImagorService, type ImagorWatermark } from 'src/lib/imagor.service';
import { FaceIdentity, FaceIdentityDocument } from './entities/face-identity.entity';
import { FacePerson, FacePersonDocument } from './entities/face-person.entity';

type IndexedImage = Pick<
  CollectionImage,
  | 'userId'
  | 'collectionId'
  | 'url'
  | 'thumbnailUrl'
  | 'originalObjectKey'
  | 'metadata'
  | 'width'
  | 'height'
> & { _id?: unknown };
type FacePoint = {
  id: string | number;
  score?: number;
  vector?: number[];
  payload?: {
    collectionId?: string;
    imageId?: string;
    url?: string;
    personId?: string;
    identityKey?: string;
    faceIndex?: number;
    referenceVersion?: string;
    box?: { x: number; y: number; width: number; height: number };
  };
};
type DetectedFace = {
  vector: number[];
  box: { x: number; y: number; width: number; height: number };
};
type AssignedFace = DetectedFace & { personId: string; identityKey: string };
type FaceGroup = {
  representative: FacePoint;
  points: FacePoint[];
  centroid: number[];
  personId?: string;
};

const INSIGHT_VECTOR_SIZE = 512;
const DEFAULT_INSIGHT_COLLECTION = 'album_faces_insightface';
// v9 forces one slow background rebuild of older face rows so images that
// were incorrectly marked complete during an image-model/Qdrant outage are retried.
const FACE_INDEX_VERSION = 9;
const MIN_SIDEBAR_PHOTOS = 2;
const FACE_SEARCH_POLICY_VERSION = 2;
const DEFAULT_FACE_REINDEX_COOLDOWN_HOURS = 24;

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
  private readonly reindexingCollections = new Set<string>();
  private readonly backfillingUsers = new Set<string>();
  private readonly backfilledUsers = new Set<string>();
  private readonly identityCache = new Map<string, { expiresAt: number; items: any[] }>();
  private readonly faceSidebarCache = new Map<
    string,
    { expiresAt: number; payload: Record<string, any> }
  >();
  private faceIndexTail: Promise<void> = Promise.resolve();
  private nextFaceIndexAt = 0;
  private readinessRefresh?: Promise<boolean>;
  private nextReadinessRefreshAt = 0;
  private backgroundSweepRunning = false;
  private nextBackgroundSweepAt = 0;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(FaceIdentity.name) private readonly faceIdentityModel: Model<FaceIdentityDocument>,
    @InjectModel(FacePerson.name) private readonly facePersonModel: Model<FacePersonDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly imagorService: ImagorService,
  ) {}

  async onModuleInit() {
    this.logger.log(
      `Face search boot: external image model=${this.imageModelUrl() || 'not configured'}; qdrant collection=${this.vectorCollection()}; vectorSize=${this.vectorSize()}; searchPolicy=${FACE_SEARCH_POLICY_VERSION}; similarityThreshold=${this.matchSimilarity()}`,
    );
    await this.refreshReadiness();
  }

  @Interval(250)
  async processBackgroundFaceIndexTick() {
    if (
      !backgroundWorkerEnabled() ||
      this.backgroundSweepRunning ||
      Date.now() < this.nextBackgroundSweepAt
    )
      return;
    this.backgroundSweepRunning = true;
    try {
      if (!(await this.ensureReady())) {
        this.nextBackgroundSweepAt = Date.now() + 2_000;
        return;
      }

      const now = new Date();
      const pendingFilter = {
        mediaType: { $ne: 'video' },
        $and: [
          {
            $or: [
              { faceIndexedAt: { $exists: false } },
              { faceIndexVersion: { $ne: FACE_INDEX_VERSION } },
            ],
          },
          {
            $or: [
              { faceIndexNextAttemptAt: { $exists: false } },
              { faceIndexNextAttemptAt: { $lte: now } },
            ],
          },
        ],
      } as Record<string, unknown>;

      // Give recently opened face panels priority without increasing
      // concurrency. This is important for old galleries: they no longer sit
      // behind months of unrelated global backlog while the visitor waits.
      const recentCollections = await this.collectionModel
        .find({
          faceIndexPriorityAt: {
            $gte: new Date(now.getTime() - 10 * 60 * 1000),
          },
        })
        .sort({ faceIndexPriorityAt: -1 })
        .limit(12)
        .select('_id')
        .lean();
      const recentCollectionIds = recentCollections.map((item) =>
        String(item._id),
      );

      let image = recentCollectionIds.length
        ? await this.imageModel
            .findOne({
              ...pendingFilter,
              collectionId: { $in: recentCollectionIds },
            })
            .sort({ faceIndexNextAttemptAt: 1, createdAt: 1 })
            .select('+originalObjectKey')
            .lean()
        : null;

      if (!image) {
        image = await this.imageModel
          .findOne(pendingFilter)
          .sort({ faceIndexNextAttemptAt: 1, createdAt: 1 })
          .select('+originalObjectKey')
          .lean();
      }

      if (!image) {
        await this.finishCompletedReindexCollections();
        // Empty queues should stay very cheap. The 250 ms timer only makes the
        // worker react quickly while work exists; it does not poll MongoDB four
        // times per second forever.
        this.nextBackgroundSweepAt = Date.now() + 5_000;
        return;
      }

      const collectionId = String(image.collectionId);
      if (
        (image as any).faceIndexedAt &&
        Number((image as any).faceIndexVersion ?? 0) !== FACE_INDEX_VERSION
      ) {
        await this.deleteCollectionFaces(collectionId);
        await this.imageModel.updateMany(
          { collectionId, mediaType: { $ne: 'video' } },
          {
            $set: { faceCount: 0, faceIndexAttempts: 0, faceIndexLastError: '' },
            $unset: {
              faceIndexedAt: 1,
              faceIndexVersion: 1,
              faceIndexNextAttemptAt: 1,
            },
          },
        );
      }

      await this.collectionModel.updateOne(
        { _id: image.collectionId, faceReindexStatus: 'queued' },
        { $set: { faceReindexStatus: 'processing' } },
      );
      await this.indexImage(
        image as IndexedImage,
        recentCollectionIds.includes(collectionId),
      );
      await this.finishCompletedReindexCollections(String(image.collectionId));
    } catch (error) {
      this.nextBackgroundSweepAt = Date.now() + 2_000;
      this.logger.warn(
        `Background face index tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.backgroundSweepRunning = false;
    }
  }

  private async ensureReady() {
    if (this.ready && this.qdrant) return true;
    if (Date.now() < this.nextReadinessRefreshAt) return false;
    return this.refreshReadiness();
  }

  private async refreshReadiness() {
    if (this.readinessRefresh) return this.readinessRefresh;
    this.readinessRefresh = (async () => {
      this.ready = false;
      await this.initQdrant();
      await this.checkImageModel();
      const ready = Boolean(this.ready && this.qdrant);
      this.nextReadinessRefreshAt = ready ? 0 : Date.now() + 30_000;
      return ready;
    })().finally(() => {
      this.readinessRefresh = undefined;
    });
    return this.readinessRefresh;
  }

  async indexImage(image: IndexedImage, priority = false) {
    const run = this.faceIndexTail.then(
      () => this.runQueuedFaceIndex(image, priority),
      () => this.runQueuedFaceIndex(image, priority),
    );
    this.faceIndexTail = run.then(() => undefined, () => undefined);
    return run;
  }

  private async runQueuedFaceIndex(image: IndexedImage, priority = false) {
    const waitMs = Math.max(0, this.nextFaceIndexAt - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    try {
      return await this.indexImageNow(image);
    } finally {
      this.nextFaceIndexAt =
        Date.now() + this.faceIndexGapMs(priority);
    }
  }

  private async indexImageNow(image: IndexedImage) {
    if (!(await this.ensureReady())) return 0;

    const imageId = image._id?.toString();
    const collectionId = String(image.collectionId ?? '');
    if (!imageId || !image.url || !collectionId) return 0;

    const sourceUrl = this.faceIndexImageUrl(image);

    let faces: DetectedFace[] | undefined;
    try {
      // Fast path: the image-model downloads the thumbnail itself. This avoids
      // R2/Imagor -> Nest -> image-model byte relaying and keeps large batches
      // out of the API process RAM.
      faces = await this.extractFacesFromImageUrl(sourceUrl);
    } catch (error) {
      this.logger.warn(
        `Direct face-model URL scan failed for ${imageId}; falling back to byte upload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (faces === undefined) {
      let buffer: Buffer | null = null;
      try {
        buffer = await this.readImage(sourceUrl);
      } catch (error) {
        await this.markFaceIndexFailure(
          imageId,
          `image download failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return 0;
      }
      if (!buffer) {
        await this.markFaceIndexFailure(imageId, 'image download failed');
        return 0;
      }

      try {
        faces = await this.extractFaces(buffer);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Face indexing failed for ${imageId}: ${message}`);
        await this.markFaceIndexFailure(imageId, message);
        return 0;
      }
    }

    // A failed inference must not remove the existing searchable faces.
    await this.deleteImageFaces(collectionId, imageId);
    if (!faces.length) {
      await this.markFaceIndexSuccess(imageId, 0);
      return 0;
    }

    const assignedFaces = await this.assignPersonIds(
      String(image.userId),
      collectionId,
      imageId,
      image.url,
      faces,
    );

    const referenceVersion = randomUUID();
    try {
      await this.qdrant!.upsert(this.vectorCollection(), {
        wait: true,
        points: assignedFaces.map((face, index) => ({
          id: this.pointId(`${collectionId}-${imageId}-${index}`),
          vector: face.vector,
          payload: {
            collectionId,
            imageId,
            url: image.url,
            personId: face.personId,
            identityKey: face.identityKey,
            faceIndex: index,
            referenceVersion,
            box: face.box,
          },
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Qdrant upsert failed for ${imageId}: ${message}`);
      this.ready = false;

      // Person counters were already updated while assigning IDs. Reset this
      // collection and let the slow background sweep rebuild it cleanly instead
      // of counting the same face again on the next retry.
      await this.deleteCollectionFaces(collectionId).catch(() => undefined);
      await this.imageModel
        .updateMany(
          { collectionId, mediaType: { $ne: 'video' } },
          {
            $unset: { faceIndexedAt: 1, faceIndexVersion: 1 },
            $set: { faceCount: 0 },
          },
        )
        .catch(() => undefined);
      await this.markFaceIndexFailure(imageId, `vector store failed: ${message}`);
      return 0;
    }

    await this.markFaceIndexSuccess(imageId, faces.length);
    this.faceSidebarCache.delete(collectionId);
    return assignedFaces.length;
  }

  private async markFaceIndexSuccess(imageId: string, faceCount: number) {
    await this.imageModel.updateOne(
      { _id: imageId },
      {
        $set: {
          faceIndexedAt: new Date(),
          faceCount,
          faceIndexVersion: FACE_INDEX_VERSION,
          faceIndexAttempts: 0,
          faceIndexLastError: '',
        },
        $unset: { faceIndexNextAttemptAt: 1 },
      },
    );
  }

  private async markFaceIndexFailure(imageId: string, reason: string) {
    await this.imageModel.updateOne(
      { _id: imageId },
      {
        $inc: { faceIndexAttempts: 1 },
        $set: {
          faceIndexLastError: String(reason || 'Face indexing failed').slice(0, 500),
          faceIndexNextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      },
    );
  }

  async deleteImageFaces(collectionId: string, imageId: string) {
    this.faceSidebarCache.delete(collectionId);
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

  async deleteCollectionFaces(collectionId: string, strict = false) {
    if (strict && (!this.ready || !this.qdrant)) throw new BadRequestException('Face search is not ready');
    this.faceSidebarCache.delete(collectionId);
    if (this.ready && this.qdrant) {
      await this.qdrant
        .delete(this.vectorCollection(), {
          wait: true,
          filter: {
            must: [{ key: 'collectionId', match: { value: collectionId } }],
          },
        })
        .catch((error) => {
          this.logger.warn(`Qdrant collection face delete failed: ${error?.message ?? error}`);
          if (strict) throw error;
        });
    }

    const [owner, linkedPeople] = await Promise.all([
      this.collectionModel.findById(collectionId).select('userId').lean(),
      this.facePersonModel.find({ collectionId }).select('identityKey faceCount imageCount').lean(),
    ]);
    await this.facePersonModel.deleteMany({ collectionId }).catch((error) => { if (strict) throw error; });

    if (owner?.userId && linkedPeople.length) {
      const totals = new Map<string, { faces: number; images: number }>();
      for (const person of linkedPeople) {
        const key = String(person.identityKey ?? '');
        if (!key) continue;
        const current = totals.get(key) ?? { faces: 0, images: 0 };
        current.faces += Math.max(0, Number(person.faceCount || 0));
        current.images += Math.max(0, Number(person.imageCount || 0));
        totals.set(key, current);
      }
      await Promise.all([...totals.entries()].map(([identityKey, totalsForPerson]) =>
        this.faceIdentityModel.updateOne(
          { userId: String(owner.userId), identityKey },
          {
            $pull: { collectionIds: collectionId },
            $inc: { faceCount: -totalsForPerson.faces, imageCount: -totalsForPerson.images },
          },
        ),
      ));
      this.identityCache.delete(String(owner.userId));
    }
  }

  async reindexCollectionFaces(collectionId: string) {
    if (!(await this.ensureReady())) {
      throw new BadRequestException('Face search is not ready');
    }

    await this.deleteCollectionFaces(collectionId);

    let imageCount = 0;
    let faces = 0;
    const cursor = this.imageModel
      .find({ collectionId, mediaType: { $ne: 'video' } })
      .select('+originalObjectKey')
      .lean()
      .cursor();
    for await (const image of cursor) {
      // Stream rows instead of holding a whole large collection in RAM.
      faces += await this.indexImage(image as IndexedImage);
      imageCount += 1;
    }

    return { collectionId, images: imageCount, faces };
  }

  async requestCollectionFaceReindex(userId: string, collectionId: string) {
    const collection = await this.collectionModel
      .findOne({ _id: collectionId, userId })
      .select('_id userId faceReindexRequestedAt faceReindexCompletedAt faceReindexStatus')
      .lean();
    if (!collection) throw new NotFoundException('Collection not found');

    await this.assertCollectionFeature(
      collectionId,
      'advancedFaceSearch',
      'Advanced Face Search',
    );

    // Do not clear face groups or consume the reindex cooldown if the model
    // or vector database cannot accept work.
    if (!(await this.ensureReady()) || !this.qdrant) {
      throw new BadRequestException('Face search is not ready. Retry when the model and vector database are online.');
    }

    const cooldownHours = this.configNumber(
      'FACE_REINDEX_COOLDOWN_HOURS',
      DEFAULT_FACE_REINDEX_COOLDOWN_HOURS,
      24,
      30,
    );
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - cooldownMs);

    const reserved = await this.collectionModel
      .findOneAndUpdate(
        {
          _id: collectionId,
          userId,
          $or: [
            { faceReindexRequestedAt: { $exists: false } },
            { faceReindexRequestedAt: { $lte: cutoff } },
          ],
        },
        {
          $set: {
            faceReindexRequestedAt: now,
            faceReindexStatus: 'queued',
          },
          $unset: { faceReindexCompletedAt: 1 },
        },
        { returnDocument: 'after' },
      )
      .lean();

    if (!reserved) {
      const latest = await this.collectionModel
        .findOne({ _id: collectionId, userId })
        .select('faceReindexRequestedAt')
        .lean();
      const last = latest?.faceReindexRequestedAt
        ? new Date(latest.faceReindexRequestedAt).getTime()
        : now.getTime();
      const nextAllowedAt = new Date(last + cooldownMs);
      throw new HttpException(
        {
          message: `Face re-index can be requested again after ${nextAllowedAt.toISOString()}.`,
          nextAllowedAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // A failed vector cleanup must not silently start a mixed old/new index.
    try {
      await this.deleteCollectionFaces(collectionId, true);
    } catch (error) {
      const $set: Record<string, any> = {};
      const $unset: Record<string, 1> = {};
      for (const key of ['faceReindexRequestedAt', 'faceReindexCompletedAt', 'faceReindexStatus'] as const) {
        if (collection[key] === undefined) $unset[key] = 1;
        else $set[key] = collection[key];
      }
      await this.collectionModel.updateOne({ _id: collectionId, userId, faceReindexRequestedAt: now }, { $set, $unset });
      this.logger.warn(`Face re-index cleanup failed for ${collectionId}: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException('Face re-index could not be prepared. Please retry.');
    }

    const reset = await this.imageModel.updateMany(
      { collectionId, mediaType: { $ne: 'video' } },
      {
        $set: {
          faceCount: 0,
          faceIndexAttempts: 0,
          faceIndexLastError: '',
        },
        $unset: {
          faceIndexedAt: 1,
          faceIndexVersion: 1,
          faceIndexNextAttemptAt: 1,
        },
      },
    );

    return {
      collectionId,
      queued: true,
      images: Number(reset.modifiedCount ?? 0),
      requestedAt: now,
      nextAllowedAt: new Date(now.getTime() + cooldownMs),
      ready: Boolean(this.ready && this.qdrant),
    };
  }

  private async finishCompletedReindexCollections(collectionId?: string) {
    const collections = await this.collectionModel
      .find({
        ...(collectionId ? { _id: collectionId } : {}),
        faceReindexStatus: { $in: ['queued', 'processing'] },
      })
      .select('_id')
      .limit(collectionId ? 1 : 20)
      .lean();

    for (const collection of collections) {
      const pending = await this.imageModel.exists({
        collectionId: String(collection._id),
        mediaType: { $ne: 'video' },
        $or: [
          { faceIndexedAt: { $exists: false } },
          { faceIndexVersion: { $ne: FACE_INDEX_VERSION } },
        ],
      });
      if (pending) continue;

      await this.collectionModel.updateOne(
        { _id: collection._id },
        {
          $set: {
            faceReindexStatus: 'completed',
            faceReindexCompletedAt: new Date(),
          },
        },
      );
    }
  }

  async searchCollection(collectionIdOrSlug: string, file?: Express.Multer.File) {
    const collection = await this.assertCollectionFeature(
      collectionIdOrSlug,
      'aiFaceSearch',
      'AI Face Search',
    );
    if (!file?.buffer?.length) {
      throw new BadRequestException('Face image is required');
    }
    if (!this.ready || !this.qdrant) {
      throw new BadRequestException('Face search is not ready');
    }

    const faces = await this.extractFaces(file.buffer);

    if (!faces.length) {
      throw new BadRequestException('No usable face found in uploaded image');
    }
    if (faces.length !== 1) {
      throw new BadRequestException('Upload a photo with just the person you want to find.');
    }

    return this.searchByVectors(
      collection._id.toString(),
      faces.map((face) => face.vector),
      collection,
    );
  }

  private async assignPersonIds(
    userId: string,
    collectionId: string,
    imageId: string,
    imageUrl: string,
    faces: DetectedFace[],
  ): Promise<AssignedFace[]> {
    // Migrate older per-collection people before matching a new upload, so
    // existing identities are reusable even if the owner never opened Settings.
    await this.backfillLegacyFacePersons(userId);
    const persons = await this.facePersonModel.find({ collectionId }).lean();
    const working = persons.map((person) => ({
      personKey: person.personKey,
      identityKey: person.identityKey,
      centroid: this.normalizeVector(person.centroid) ?? person.centroid,
      faceCount: Number(person.faceCount || 0),
      imageCount: Number(person.imageCount || 0),
      representativeArea: this.boxArea(person.representativeBox),
    }));
    const globalPeople = (await this.loadUserIdentities(userId)).map((identity) => ({
      identityKey: String(identity.identityKey),
      name: String(identity.name ?? ''),
      centroid: this.normalizeVector(identity.centroid) ?? identity.centroid,
      faceCount: Number(identity.faceCount || 0),
      imageCount: Number(identity.imageCount || 0),
      representativeArea: Number(identity.representativeArea ?? this.boxArea(identity.representativeBox)),
      collectionIds: [...(identity.collectionIds ?? [])].map(String),
    }));
    const minSimilarity = this.personSimilarity();
    const usedPersonIds = new Set<string>();
    const usedIdentityKeys = new Set<string>();
    const assigned: AssignedFace[] = [];

    for (const [index, face] of faces.entries()) {
      const vector = this.normalizeVector(face.vector);
      if (!vector) continue;

      const match = this.unambiguousMatch(
        working.filter(person => !usedPersonIds.has(person.personKey)),
        vector, minSimilarity,
      );

      const personKey = match?.personKey ?? this.newPersonKey(collectionId, imageId, index);
      const globalMatch = this.unambiguousMatch(
        globalPeople.filter(person => !usedIdentityKeys.has(person.identityKey)),
        vector, this.globalPersonSimilarity(),
      );
      const identityKey = globalMatch?.identityKey ?? this.newIdentityKey(userId, personKey);
      const area = this.boxArea(face.box);
      const oldRepresentativeArea = match?.representativeArea ?? 0;
      const isNewPerson = !match;
      const nextFaceCount = (match?.faceCount ?? 0) + 1;
      const nextCentroid = match
        ? this.normalizeVector(match.centroid.map((value, vectorIndex) =>
          ((value * match.faceCount) + vector[vectorIndex]) / nextFaceCount)) ?? vector
        : vector;

      if (match) {
        match.centroid = nextCentroid;
        match.faceCount = nextFaceCount;
        match.identityKey = identityKey;
        if (!usedPersonIds.has(personKey)) match.imageCount += 1;
        if (area > match.representativeArea) match.representativeArea = area;
      } else {
        working.push({
          personKey,
          identityKey,
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
            userId,
            collectionId,
            personKey,
            identityKey,
            centroid: nextCentroid,
            ...(isNewPerson || area >= oldRepresentativeArea
              ? {
                representativeImageId: imageId,
                representativeFaceId: String(this.pointId(collectionId + '-' + imageId + '-' + index)),
                representativeUrl: imageUrl,
                representativeBox: face.box,
              }
              : {}),
          },
          $addToSet: { imageIds: imageId },
          $inc: {
            faceCount: 1,
            imageCount: usedPersonIds.has(personKey) ? 0 : 1,
          },
        },
        { upsert: true },
      );

      const globalFaceCount = (globalMatch?.faceCount ?? 0) + 1;
      const globalCentroid = globalMatch
        ? this.normalizeVector(globalMatch.centroid.map((value, vectorIndex) =>
          ((value * globalMatch.faceCount) + vector[vectorIndex]) / globalFaceCount)) ?? vector
        : vector;
      const globalRepresentativeArea = globalMatch?.representativeArea ?? 0;

      await this.faceIdentityModel.updateOne(
        { userId, identityKey },
        {
          $set: {
            userId,
            identityKey,
            centroid: globalCentroid,
            lastSeenAt: new Date(),
            ...(!globalMatch || area >= globalRepresentativeArea
              ? {
                representativeImageId: imageId,
                representativeFaceId: String(this.pointId(collectionId + '-' + imageId + '-' + index)),
                representativeUrl: imageUrl,
                representativeBox: face.box,
              }
              : {}),
          },
          $addToSet: { collectionIds: collectionId },
          $inc: {
            faceCount: 1,
            imageCount: usedIdentityKeys.has(identityKey) ? 0 : 1,
          },
        },
        { upsert: true },
      );

      if (globalMatch) {
        globalMatch.centroid = globalCentroid;
        globalMatch.faceCount = globalFaceCount;
        if (!usedIdentityKeys.has(identityKey)) globalMatch.imageCount += 1;
        if (!globalMatch.collectionIds.includes(collectionId)) globalMatch.collectionIds.push(collectionId);
        if (area > globalMatch.representativeArea) globalMatch.representativeArea = area;
      } else {
        globalPeople.push({
          identityKey,
          name: '',
          centroid: globalCentroid,
          faceCount: 1,
          imageCount: 1,
          representativeArea: area,
          collectionIds: [collectionId],
        });
      }

      usedPersonIds.add(personKey);
      usedIdentityKeys.add(identityKey);
      assigned.push({ ...face, personId: personKey, identityKey });
    }

    this.identityCache.set(userId, { expiresAt: Date.now() + 60_000, items: globalPeople });
    return assigned;
  }

  async listUserFaceIdentities(
    userId: string,
    options: { page?: number; limit?: number; search?: string } = {},
  ) {
    await this.backfillLegacyFacePersons(userId);
    const page = Math.max(1, Math.floor(Number(options.page) || 1));
    const limit = Math.max(1, Math.min(60, Math.floor(Number(options.limit) || 20)));
    const search = String(options.search ?? '').trim().slice(0, 100);
    const filter: Record<string, any> = { userId };

    if (search) {
      const escaped = [...search].map((char) => '\\^$.*+?()[]{}|'.includes(char) ? `\\${char}` : char).join('');
      const regex = new RegExp(escaped, 'i');
      const collectionMatches = await this.collectionModel
        .find({ userId, name: regex })
        .select('_id')
        .limit(100)
        .lean();
      const collectionIds = collectionMatches.map((item) => item._id.toString());
      filter.$or = [
        { name: regex },
        { identityKey: regex },
        ...(collectionIds.length ? [{ collectionIds: { $in: collectionIds } }] : []),
      ];
    }

    const [total, allTotal, identities] = await Promise.all([
      this.faceIdentityModel.countDocuments(filter),
      search ? this.faceIdentityModel.countDocuments({ userId }) : Promise.resolve(0),
      this.faceIdentityModel
        .find(filter)
        // Empty/missing names sort before strings; named people then sort A-Z.
        .sort({ name: 1, lastSeenAt: -1, updatedAt: -1 })
        .collation({ locale: 'en', strength: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    const pageCollectionIds = [
      ...new Set(identities.flatMap((identity) => (identity.collectionIds ?? []).map(String))),
    ];
    const collections = pageCollectionIds.length
      ? await this.collectionModel
          .find({ userId, _id: { $in: pageCollectionIds } })
          .select('_id name')
          .lean()
      : [];
    const collectionMap = new Map(collections.map((item) => [item._id.toString(), item.name]));
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: identities.map((identity) => {
        const collectionIds = [...new Set((identity.collectionIds ?? []).map(String))];
        return {
          identityKey: identity.identityKey,
          name: identity.name ?? '',
          representativeImageId: identity.representativeImageId,
          representativeFaceId: identity.representativeFaceId,
          representativeUrl: identity.representativeUrl,
          representativeBox: identity.representativeBox,
          faceCount: Number(identity.faceCount || 0),
          imageCount: Number(identity.imageCount || 0),
          collectionCount: collectionIds.length,
          collectionIds,
          collections: collectionIds.map((id) => ({ id, name: collectionMap.get(id) ?? 'Deleted collection' })),
          lastSeenAt: identity.lastSeenAt,
        };
      }),
      page,
      limit,
      total,
      allTotal: search ? allTotal : total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async renameUserFaceIdentity(userId: string, identityKey: string, value?: string) {
    const name = String(value ?? '').trim();
    if (name.length > 80) throw new BadRequestException('Person name must be 80 characters or fewer.');
    const update = name ? { $set: { name } } : { $unset: { name: 1 } };
    const identity = await this.faceIdentityModel
      .findOneAndUpdate(
        { userId, identityKey },
        update,
        { returnDocument: 'after' },
      )
      .lean();
    if (!identity) throw new BadRequestException('Face identity not found.');
    this.identityCache.delete(userId);
    return { identityKey: identity.identityKey, name: identity.name ?? '' };
  }

  private async loadUserIdentities(userId: string) {
    const cached = this.identityCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.items;
    const items = await this.faceIdentityModel.find({ userId }).lean();
    this.identityCache.set(userId, { expiresAt: Date.now() + 60_000, items });
    return items;
  }

  private async backfillLegacyFacePersons(userId: string) {
    if (this.backfilledUsers.has(userId) || this.backfillingUsers.has(userId)) return;
    this.backfillingUsers.add(userId);
    try {
      const collections = await this.collectionModel.find({ userId }).select('_id').lean();
      const collectionIds = collections.map((item) => item._id.toString());
      if (!collectionIds.length) {
        this.backfilledUsers.add(userId);
        return;
      }
      const legacy = await this.facePersonModel.find({
        collectionId: { $in: collectionIds },
        $or: [{ identityKey: { $exists: false } }, { identityKey: '' }],
      }).lean();
      if (!legacy.length) {
        this.backfilledUsers.add(userId);
        return;
      }

      const globals = (await this.loadUserIdentities(userId)).map((identity) => ({
        identityKey: String(identity.identityKey),
        centroid: this.normalizeVector(identity.centroid) ?? identity.centroid,
        faceCount: Number(identity.faceCount || 0),
        imageCount: Number(identity.imageCount || 0),
        representativeArea: Number(identity.representativeArea ?? this.boxArea(identity.representativeBox)),
        collectionIds: [...(identity.collectionIds ?? [])].map(String),
      }));

      for (const person of legacy) {
        const vector = this.normalizeVector(person.centroid);
        if (!vector) continue;
        const collectionId = String(person.collectionId);
        const match = globals
          .map((identity) => ({ identity, score: this.cosine(vector, identity.centroid) }))
          .filter(({ score }) => score >= this.globalPersonSimilarity())
          .sort((left, right) => right.score - left.score)[0]?.identity;
        const identityKey = match?.identityKey ?? this.newIdentityKey(userId, person.personKey);
        const faceWeight = Math.max(1, Number(person.faceCount || 1));
        const imageWeight = Math.max(1, Number(person.imageCount || 1));
        const nextFaceCount = (match?.faceCount ?? 0) + faceWeight;
        const centroid = match
          ? this.normalizeVector(match.centroid.map((value, index) =>
            ((value * match.faceCount) + (vector[index] * faceWeight)) / nextFaceCount)) ?? vector
          : vector;
        const area = this.boxArea(person.representativeBox);

        await this.faceIdentityModel.updateOne(
          { userId, identityKey },
          {
            $set: {
              userId,
              identityKey,
              centroid,
              lastSeenAt: new Date(),
              ...(!match || area >= match.representativeArea ? {
                representativeImageId: person.representativeImageId,
                representativeFaceId: person.representativeFaceId,
                representativeUrl: person.representativeUrl,
                representativeBox: person.representativeBox,
              } : {}),
            },
            $addToSet: { collectionIds: collectionId },
            $inc: { faceCount: faceWeight, imageCount: imageWeight },
          },
          { upsert: true },
        );
        await this.facePersonModel.updateOne(
          { _id: person._id },
          { $set: { userId, identityKey } },
        );

        if (match) {
          match.centroid = centroid;
          match.faceCount = nextFaceCount;
          match.imageCount += imageWeight;
          if (!match.collectionIds.includes(collectionId)) match.collectionIds.push(collectionId);
          if (area > match.representativeArea) match.representativeArea = area;
        } else {
          globals.push({ identityKey, centroid, faceCount: faceWeight, imageCount: imageWeight,
            representativeArea: area, collectionIds: [collectionId] });
        }
      }
      this.identityCache.delete(userId);
      this.backfilledUsers.add(userId);
    } finally {
      this.backfillingUsers.delete(userId);
    }
  }

  private async collectionFaceIndexProgress(collectionId: string) {
    // This endpoint is polled by the public face drawer. Do not run an
    // aggregation over every gallery image on every poll. Four indexed counts
    // stay cheap even for very large galleries and, unlike the old $group
    // pipeline, cannot monopolize the Node process while indexing is busy.
    const now = new Date();
    const base: Record<string, any> = {
      collectionId,
      mediaType: { $ne: 'video' },
    };
    const indexed: Record<string, any> = {
      ...base,
      faceIndexVersion: FACE_INDEX_VERSION,
      faceIndexedAt: { $exists: true },
    };
    const pending = {
      ...base,
      $or: [
        { faceIndexedAt: { $exists: false } },
        { faceIndexVersion: { $ne: FACE_INDEX_VERSION } },
      ],
    };

    const safeCount = async (filter: Record<string, any>) =>
      this.imageModel
        .countDocuments(filter)
        .maxTimeMS(1500)
        .catch(() => 0);

    const [totalImages, indexedImages, retryingImages, failedImages, latest] =
      await Promise.all([
        safeCount(base),
        safeCount(indexed),
        safeCount({
          ...pending,
          faceIndexNextAttemptAt: { $gt: now },
        }),
        safeCount({
          ...pending,
          faceIndexAttempts: { $gt: 0 },
        }),
        this.imageModel
          .findOne(indexed)
          .sort({ faceIndexedAt: -1 })
          .select('faceIndexedAt')
          .maxTimeMS(1500)
          .lean()
          .catch(() => null),
      ]);

    const total = Math.max(0, Number(totalImages || 0));
    const done = Math.min(total, Math.max(0, Number(indexedImages || 0)));
    return {
      totalImages: total,
      indexedImages: done,
      missingImages: Math.max(0, total - done),
      retryingImages: Math.max(0, Number(retryingImages || 0)),
      failedImages: Math.max(0, Number(failedImages || 0)),
      lastIndexedAt: latest?.faceIndexedAt,
    };
  }

  private cacheFaceSidebar(
    collectionId: string,
    payload: Record<string, any>,
  ) {
    this.faceSidebarCache.set(collectionId, {
      expiresAt: Date.now() + 5_000,
      payload,
    });
    return payload;
  }

  async listCollectionFaces(collectionIdOrSlug: string) {
    const collection = await this.assertCollectionFeature(
      collectionIdOrSlug, 'advancedFaceSearch', 'Advanced Face Search',
    );
    const collectionId = collection._id.toString();
    void this.collectionModel.updateOne(
      { _id: collection._id }, { $set: { faceIndexPriorityAt: new Date() } },
    ).catch(() => undefined);

    const cached = this.faceSidebarCache.get(collectionId);
    if (cached && cached.expiresAt > Date.now()) return cached.payload;

    const progress = await this.collectionFaceIndexProgress(collectionId);
    if (!(await this.ensureReady()) || !this.qdrant) {
      return { collectionId, ...progress, count: 0, ready: false, indexing: true, faces: [] };
    }

    const people = await this.facePersonModel.find({ collectionId })
      .sort({ imageCount: -1, faceCount: -1 })
      .select('personKey representativeImageId representativeFaceId imageCount imageIds')
      .maxTimeMS(3000).lean();

    let representatives = people.map(person => ({
      id: String(person.representativeFaceId ?? ''),
      personId: String(person.personKey ?? ''),
      imageId: String(person.representativeImageId ?? ''),
      // Use unique photo membership rather than a potentially inflated scan count.
      photoCount: person.imageIds?.length
        ? new Set(person.imageIds.filter(Boolean).map(String)).size
        : Math.max(0, Number(person.imageCount || 0)),
    })).filter(person => person.photoCount >= MIN_SIDEBAR_PHOTOS)
      .sort((a, b) => b.photoCount - a.photoCount);
    let points: FacePoint[] = [];
    if (people.length) {
      // Verify representatives against the authoritative point payload. Old
      // person rows may refer to a different box or to a deleted face.
      const ids = [...new Set(representatives.map(person => person.id).filter(Boolean))];
      for (let offset = 0; offset < ids.length; offset += 128) {
        points.push(...(await this.qdrant.retrieve(this.vectorCollection(), {
          ids: ids.slice(offset, offset + 128), with_payload: true, with_vector: false,
        }) as FacePoint[]));
      }
    } else {
      // Older galleries can have Qdrant points but no person rows. Read the
      // payload in bounded pages rather than loading all face vectors.
      const grouped = new Map<string, { point: FacePoint; imageIds: Set<string> }>();
      let offset: string | number | undefined;
      let scanned = 0;
      const scanLimit = Math.floor(this.configNumber('FACE_SEARCH_SCAN_LIMIT', 100000, 1, 100000));
      do {
        const page = await this.qdrant.scroll(this.vectorCollection(), {
          limit: Math.min(512, scanLimit - scanned), offset, with_payload: true, with_vector: false,
          filter: { must: [{ key: 'collectionId', match: { value: collectionId } }] },
        });
        for (const point of page.points as FacePoint[]) {
          const personId = String(point.payload?.personId ?? '');
          const imageId = String(point.payload?.imageId ?? '');
          if (!personId || !imageId || !this.faceReference(point)) continue;
          const group = grouped.get(personId);
          if (group) group.imageIds.add(imageId);
          else grouped.set(personId, { point, imageIds: new Set([imageId]) });
        }
        scanned += page.points.length;
        const next = page.next_page_offset ?? undefined;
        if (!page.points.length || scanned >= scanLimit || next === offset) break;
        offset = next as string | number | undefined;
      } while (offset !== undefined);
      representatives = [...grouped.values()].map(({ point, imageIds }) => ({
        id: String(point.id), personId: String(point.payload!.personId),
        imageId: String(point.payload!.imageId), photoCount: imageIds.size,
      })).filter(person => person.photoCount >= MIN_SIDEBAR_PHOTOS)
        .sort((a, b) => b.photoCount - a.photoCount);
      points = representatives.map(person => grouped.get(person.personId)!.point);
    }

    const faces = await this.verifiedSidebarFaces(collection, representatives, points);
    return this.cacheFaceSidebar(collectionId, {
      collectionId, ...progress, count: faces.length, ready: true,
      indexing: progress.missingImages > 0, faces,
    });
  }

  private faceReference(point: FacePoint) {
    const payload = point.payload;
    const box = payload?.box;
    if (!payload?.collectionId || !payload.imageId || !box ||
        ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
        box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0 ||
        box.x + box.width > 100.001 || box.y + box.height > 100.001) return undefined;
    // This is a reference revision, not a biometric identifier. A re-indexed
    // face can reuse its point ID; the old card must not select a new point.
    return createHash('sha256').update(JSON.stringify([
      String(point.id), payload.collectionId, payload.imageId,
      box.x, box.y, box.width, box.height, payload.referenceVersion ?? '',
    ])).digest('hex').slice(0, 32);
  }

  private async verifiedSidebarFaces(
    collection: any,
    representatives: Array<{ id: string; personId: string; imageId: string; photoCount: number }>,
    points: FacePoint[],
  ) {
    const collectionId = collection._id.toString();
    const byId = new Map(points.map(point => [String(point.id), point]));
    const valid = representatives.flatMap(person => {
      if (!Number.isFinite(person.photoCount) || person.photoCount < MIN_SIDEBAR_PHOTOS) return [];
      const point = byId.get(person.id);
      const payload = point?.payload;
      if (!point || !payload || payload.collectionId !== collectionId ||
          payload.imageId !== person.imageId || payload.personId !== person.personId) return [];
      const reference = this.faceReference(point);
      if (!reference || !payload.box) return [];
      return [{ ...person, box: payload.box, reference }];
    });
    const imageIds = [...new Set(valid.map(person => person.imageId))];
    const images = imageIds.length ? await this.imageModel.find({
      _id: { $in: imageIds }, collectionId, mediaType: { $ne: 'video' },
    }).select('+originalObjectKey _id url thumbnailUrl metadata width height mediaType watermarked')
      .lean() : [];
    const byImageId = new Map(images.map(image => [String(image._id), image]));
    return valid.flatMap((person, index) => {
      const image = byImageId.get(person.imageId);
      if (!image) return [];
      const delivery = this.publicFaceResultImage(image, collection);
      // Fit-in gallery derivatives retain the whole image coordinate space.
      // Small faces get a sharper existing derivative; no original is exposed.
      const imageUrl = Math.min(person.box.width, person.box.height) >= 12
        ? delivery.responsive?.small || delivery.url : delivery.url;
      if (!imageUrl) return [];
      return [{ ...person, imageUrl, label: `Face ${index + 1}` }];
    });
  }

  async searchCollectionByFaceId(collectionIdOrSlug: string, faceId: string, reference?: string) {
    const collection = await this.assertCollectionFeature(
      collectionIdOrSlug, 'advancedFaceSearch', 'Advanced Face Search',
    );
    const collectionId = collection._id.toString();
    if (!(await this.ensureReady()) || !this.qdrant) {
      throw new BadRequestException('Face search is not ready');
    }

    // A cached person/identity membership is not proof of a face match.
    // Always verify against the exact face selected in this gallery.
    const points = await this.qdrant.retrieve(this.vectorCollection(), {
      ids: [faceId], with_vector: true, with_payload: true,
    });
    const target = points[0] as FacePoint | undefined;
    const vector = target ? this.pointVector(target) : undefined;
    if (!target || String(target.id) !== faceId || target.payload?.collectionId !== collectionId ||
        !vector || vector.length !== INSIGHT_VECTOR_SIZE || !this.normalizeVector(vector) || !this.faceReference(target)) {
      throw new BadRequestException('Face not found. Refresh the face list and try again.');
    }

    if (reference !== undefined && reference !== this.faceReference(target)) {
      throw new HttpException('Face reference changed. Refresh the face list and select it again.', HttpStatus.CONFLICT);
    }
    const result = await this.searchByVectors(
      collectionId, [vector], collection, target.payload?.imageId,
    );
    if (!result.images.some(image => String(image._id) === target.payload?.imageId)) {
      throw new HttpException('Face reference changed. Refresh the face list and select it again.', HttpStatus.CONFLICT);
    }
    return { ...result, cacheHit: false };
  }

  private async assertCollectionFeature(
    collectionIdOrSlug: string,
    feature: string,
    label: string,
  ) {
    const collection = await this.findCollection(collectionIdOrSlug);
    const owner = await this.userModel
      .findById(collection.userId)
      .select('planFeatures')
      .lean();
    if (!owner?.planFeatures?.[feature]) {
      throw new BadRequestException(`Current plan does not allow ${label}.`);
    }
    return collection;
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

  private scheduleCollectionReindex(collectionId: string, images: IndexedImage[], fullReindex: boolean) {
    if (this.reindexingCollections.has(collectionId)) return;
    this.reindexingCollections.add(collectionId);

    setTimeout(() => {
      const work = fullReindex ? this.reindexCollectionFaces(collectionId) : this.indexMissingFaces(images);
      void work.finally(() => this.reindexingCollections.delete(collectionId));
    }, this.configNumber('FACE_BACKGROUND_START_DELAY_MS', 10000, 0, 60000));
  }

  private publicFaceResultImage(image: any, collection: any) {
    const metadata = (image?.metadata ?? {}) as Record<string, any>;
    const sourceObjectKey =
      String(image?.originalObjectKey ?? '').trim() ||
      String(metadata.directUploadObjectKey ?? '').trim();
    const watermark =
      (metadata.imagorWatermark ??
        metadata.imgproxyWatermark) as ImagorWatermark | undefined;
    const imagorUrls =
      sourceObjectKey && this.imagorService.isEnabled() && image?.mediaType !== 'video'
        ? this.imagorService.imageUrls(
            sourceObjectKey,
            watermark,
            {
              width: Number(image?.width) || undefined,
              height: Number(image?.height) || undefined,
            },
          )
        : null;

    const imageCache = (metadata.imageCache ?? {}) as Record<string, any>;
    const cacheUrls = (imageCache.urls ?? {}) as Record<string, any>;
    const collectionCacheVersion = Number(collection?.imageCacheVersion ?? 0);
    const directCacheReady =
      collection?.imageCacheStatus === 'ready' &&
      collectionCacheVersion > 0 &&
      Number(imageCache.version ?? 0) === collectionCacheVersion &&
      imageCache.status === 'ready' &&
      String(cacheUrls.view ?? '').trim() &&
      String(cacheUrls.small ?? '').trim();

    const directView = String(cacheUrls.view ?? '').trim();
    const directSmall = String(cacheUrls.small ?? '').trim();
    const url = directCacheReady
      ? directView
      : String(imagorUrls?.url || image?.url || '').trim();
    const thumbnailUrl = directCacheReady
      ? String(imagorUrls?.thumbnailUrl || directSmall || image?.thumbnailUrl || url)
      : String(imagorUrls?.thumbnailUrl || image?.thumbnailUrl || url);
    const responsive = directCacheReady
      ? {
          small: directSmall,
          medium: directView,
          large: directView,
        }
      : imagorUrls?.responsive;

    // Public face-search responses expose only gallery-safe fields. Originals
    // remain private; purchased/downloaded originals still use the dedicated
    // original-delivery endpoint.
    const storedUrl = String(image?.url ?? '').trim();
    const storedThumbnailUrl = String(image?.thumbnailUrl ?? '').trim();
    const hasWatermark = this.imagorService.hasWatermark(watermark);

    return {
      _id: image?._id,
      setId: image?.setId,
      url,
      thumbnailUrl,
      fallbackUrl:
        !directCacheReady && storedUrl && storedUrl !== url
          ? storedUrl
          : undefined,
      fallbackThumbnailUrl:
        !directCacheReady &&
        storedThumbnailUrl &&
        storedThumbnailUrl !== thumbnailUrl
          ? storedThumbnailUrl
          : undefined,
      fallbackWatermarked: Boolean(image?.watermarked),
      blurDataUrl: image?.blurDataUrl,
      originalName: image?.originalName,
      filename: image?.filename,
      mimetype: image?.mimetype,
      mediaType: image?.mediaType,
      width: image?.width,
      height: image?.height,
      order: image?.order,
      responsive,
      watermarked: hasWatermark,
      watermark: hasWatermark ? watermark : undefined,
      cacheDelivery: directCacheReady ? 'imagor-r2-result' : 'imagor',
      metadata: {
        filename: metadata.filename,
        fileTitle: metadata.fileTitle,
        title: metadata.title,
        description: metadata.description,
        caption: metadata.caption,
      },
    };
  }

  private matchSimilarity() {
    return this.faceThreshold('FACE_MATCH_SIMILARITY', 'FACE_MATCH_DISTANCE', 0.60);
  }

  private async searchByVectors(
    collectionId: string, vectors: number[][], collection?: any, selectedImageId?: string,
  ) {
    if (!this.qdrant) throw new BadRequestException('Face search is not ready');
    const minSimilarity = this.matchSimilarity();
    const exact = !['false','0','off','no'].includes(String(
      this.configService.get<string>('FACE_SEARCH_EXACT') ?? 'true',
    ).trim().toLowerCase());
    const matching = {
      policyVersion: FACE_SEARCH_POLICY_VERSION,
      similarityThreshold: minSimilarity,
      metric: 'cosine' as const,
      verifiedVectors: true,
      exact,
    };
    const queries = vectors.filter(vector => vector.length === INSIGHT_VECTOR_SIZE)
      .map(vector => this.normalizeVector(vector))
      .filter((vector): vector is number[] => Boolean(vector));
    if (!queries.length) return { collectionId, count: 0, images: [], truncated: false, matching };

    const maxResults = Math.floor(this.configNumber('FACE_SEARCH_SCAN_LIMIT', 100000, 1, 100000));
    const similarityMap = new Map<string, number>();
    let truncated = false;
    // The selected point itself is a verified reference from this gallery.
    if (selectedImageId) similarityMap.set(String(selectedImageId), 1);

    for (const vector of queries) {
      let limit = Math.min(512, maxResults);
      let offset = 0;
      while (true) {
        const results = await this.qdrant.search(this.vectorCollection(), {
          vector, limit, score_threshold: minSimilarity,
          ...(exact && offset > 0 ? { offset } : {}),
          params: exact ? { exact: true } : { hnsw_ef: 128 },
          with_payload: ['collectionId', 'imageId', 'box'],
          with_vector: true,
          filter: { must: [{ key: 'collectionId', match: { value: collectionId } }] },
        });
        for (const item of results) {
          const point = item as FacePoint;
          const payload = point.payload;
          const imageId = String(payload?.imageId ?? '');
          // Native search is candidate retrieval, not the final acceptance check.
          // Refuse malformed points and recompute the same metric using the actual vector.
          if (!imageId || payload?.collectionId !== collectionId || !this.faceReference(point) ||
              !Number.isFinite(item.score) || item.score < minSimilarity) continue;
          const raw = this.pointVector(point);
          const candidate = raw.length === INSIGHT_VECTOR_SIZE ? this.normalizeVector(raw) : undefined;
          if (!candidate) continue;
          const score = Number(Math.min(1, this.cosine(vector, candidate)).toFixed(6));
          if (!Number.isFinite(score) || score < minSimilarity) continue;
          similarityMap.set(imageId, Math.max(similarityMap.get(imageId) ?? 0, score));
        }
        if (results.length < limit) break;
        if (exact) {
          // Keep vector transfer bounded. Exact queries support stable offset
          // pagination; do not send an unbounded 100,000-vector response.
          offset += results.length;
          if (offset >= maxResults) { truncated = true; break; }
          limit = Math.min(512, maxResults - offset);
        } else {
          // Approximate rankings can shift between offset pages.
          if (limit >= maxResults) { truncated = true; break; }
          limit = Math.min(maxResults, limit * 4);
        }
      }
    }

    const imageIds = [...similarityMap.keys()];
    const images = imageIds.length ? await this.imageModel
      .find({ _id: { $in: imageIds }, collectionId })
      .select('+originalObjectKey userId collectionId setId url thumbnailUrl blurDataUrl originalName filename mimetype mediaType width height watermarked order metadata')
      .lean() : [];
    const resolvedCollection = collection ?? await this.findCollection(collectionId);
    const matchedImages = images.filter(image =>
      image.mediaType !== 'video' && similarityMap.has(image._id.toString()),
    ).map(image => ({
      ...this.publicFaceResultImage(image, resolvedCollection),
      faceScore: similarityMap.get(image._id.toString())!,
    })).sort((left, right) => right.faceScore - left.faceScore);
    return { collectionId, count: matchedImages.length, truncated, matching, images: matchedImages };
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
    const minSimilarity = this.faceThreshold('FACE_CLUSTER_SIMILARITY', 'FACE_CLUSTER_DISTANCE', 0.60);
    const minPairSimilarity = this.faceThreshold('FACE_CLUSTER_PAIR_SIMILARITY', 'FACE_CLUSTER_DISTANCE', 0.55);

    const uniquePoints = this.dedupeSameImageFaces(points);
    let groups = this.personIdGroups(uniquePoints);
    const groupedPointIds = new Set(groups.flatMap((group) => group.points.map((point) => String(point.id))));
    const ungroupedPoints = uniquePoints.filter((point) => !groupedPointIds.has(String(point.id)));
    groups.push(...this.vectorConnectedGroups(ungroupedPoints, minPairSimilarity));

    groups = this.mergeFaceGroups(groups, minSimilarity, minPairSimilarity);
    this.absorbSmallGroups(groups, minSimilarity, minPairSimilarity);
    groups = this.mergeFaceGroups(groups, minSimilarity, minPairSimilarity);

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

  private visibleFaceGroups(groups: FaceGroup[]) {
    const sortedGroups = [...groups].sort((a, b) => this.groupPhotoCount(b) - this.groupPhotoCount(a));
    const duplicateSimilarity = this.configNumber('FACE_SIDEBAR_DUPLICATE_SIMILARITY', 0.72, 0.1, 0.99);
    const conflictDuplicateSimilarity = this.configNumber('FACE_SIDEBAR_CONFLICT_DUPLICATE_SIMILARITY', 0.95, 0.1, 0.99);
    const visible: FaceGroup[] = [];

    for (const group of sortedGroups) {
      const photoCount = this.groupPhotoCount(group);
      const duplicateOfLargerGroup = visible.some((candidate) => {
        if (this.groupPhotoCount(candidate) < photoCount) return false;
        const score = this.bestGroupPairSimilarity(group, candidate);
        const threshold = this.groupsConflictInSameImage(group, candidate)
          ? conflictDuplicateSimilarity
          : duplicateSimilarity;
        return score >= threshold;
      });

      if (!duplicateOfLargerGroup) visible.push(group);
    }

    return visible;
  }

  private groupPhotoCount(group: FaceGroup) {
    return new Set(group.points.map((point) => point.payload?.imageId).filter(Boolean)).size;
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
          if (conflict) continue;
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

    return best;
  }

  private unambiguousMatch<T extends { centroid: number[] }>(candidates: T[], vector: number[], threshold: number): T | undefined {
    const gap = this.configNumber('FACE_MATCH_MARGIN', 0.06, 0, 0.3);
    const ranked = candidates.filter(candidate => candidate.centroid.length === vector.length)
      .map(candidate => ({ candidate, score: this.cosine(vector, candidate.centroid) }))
      .filter(entry => Number.isFinite(entry.score))
      .sort((a,b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < threshold || (ranked[1] && best.score - ranked[1].score < gap)) return undefined;
    return best.candidate;
  }

  private conflictMergeSimilarity() {
    return this.configNumber('FACE_CLUSTER_CONFLICT_SIMILARITY', 0.80, 0.1, 0.99);
  }

  private personSimilarity() {
    return this.configNumber('FACE_PERSON_SIMILARITY', 0.58, 0.1, 0.99);
  }

  private globalPersonSimilarity() {
    return this.configNumber('FACE_GLOBAL_PERSON_SIMILARITY', 0.62, 0.1, 0.99);
  }

  private faceIndexGapMs(priority = false) {
    if (priority) {
      return this.configNumber(
        'FACE_ACTIVE_BACKGROUND_GAP_MS',
        50,
        0,
        5000,
      );
    }
    return this.configNumber('FACE_BACKGROUND_GAP_MS', 150, 0, 30000);
  }

  private faceIndexImageUrl(image: IndexedImage) {
    const metadata = (image.metadata ?? {}) as Record<string, any>;
    const originalObjectKey = String(image.originalObjectKey ?? '').trim() ||
      String(metadata.directUploadObjectKey ?? '').trim();
    const useThumbnail = !['0', 'false', 'no', 'off'].includes(String(
      this.configService.get<string>('FACE_INDEX_USE_THUMBNAIL') ?? 'false',
    ).trim().toLowerCase());
    // Use the existing full-frame, higher-resolution gallery derivative.
    // Do not crop, replace or publish an unwatermarked copy of the original.
    if (originalObjectKey && this.imagorService.isEnabled()) {
      const watermark = (metadata.imagorWatermark ?? metadata.imgproxyWatermark) as ImagorWatermark | undefined;
      const urls = this.imagorService.imageUrls(originalObjectKey, watermark, {
        width: Number(image.width) || undefined, height: Number(image.height) || undefined,
      });
      const source = useThumbnail ? urls?.responsive?.small : urls?.url;
      if (source) return source;
    }
    return useThumbnail && image.thumbnailUrl ? image.thumbnailUrl : image.url;
  }

  private newPersonKey(collectionId: string, imageId: string, faceIndex: number) {
    return `person_${createHash('sha1')
      .update(`${collectionId}:${imageId}:${faceIndex}:${Date.now()}:${Math.random()}`)
      .digest('hex')
      .slice(0, 16)}`;
  }

  private newIdentityKey(userId: string, personKey: string) {
    return 'identity_' + createHash('sha1')
      .update(userId + ':' + personKey)
      .digest('hex')
      .slice(0, 20);
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
      const created = await this.qdrant
        .createCollection(collection, {
          vectors: { size: this.vectorSize(), distance: 'Cosine' },
        })
        .then(() => true)
        .catch(async (error) => {
          // PM2 workers may race on the very first boot. If another worker
          // created the collection first, treat that as success.
          const after = await this.qdrant
            ?.collectionExists(collection)
            .catch(() => null);
          if (after?.exists) return true;
          this.logger.error(
            `Qdrant collection create failed: ${error?.message ?? error}`,
          );
          return false;
        });
      if (!created) {
        this.qdrant = undefined;
        return;
      }

    }

    // Existing collections may have been created with different vector settings.
    // Never interpret distances from another metric as cosine similarity.
    const info = await this.qdrant.getCollection(collection).catch(() => null);
    if (!this.isCompatibleVectorSchema(info?.config?.params?.vectors)) {
      this.logger.error('Face index must use a single 512-dimensional Cosine vector. No data was changed; configure a compatible face index.');
      this.qdrant = undefined;
      this.ready = false;
      return;
    }

    // Keep payload filters fast even for an existing Qdrant collection. Older
    // deployments only indexed collectionId, which made personId-based clicks
    // degrade into payload scans on large galleries.
    await Promise.all(
      ['collectionId', 'personId', 'imageId', 'identityKey'].map((field_name) =>
        this.qdrant!
          .createPayloadIndex(collection, {
            field_name,
            field_schema: 'keyword',
            wait: true,
          })
          .catch(() => undefined),
      ),
    );

    this.logger.log(`Qdrant connected; collection ready: ${collection}`);
  }

  private isCompatibleVectorSchema(schema: unknown): boolean {
    if (!schema || typeof schema !== 'object') return false;
    const vector = schema as { size?: unknown; distance?: unknown };
    return vector.size === INSIGHT_VECTOR_SIZE && vector.distance === 'Cosine';
  }

  private expectedImageModelName() {
    return this.configService.get<string>('FACE_MODEL_EXPECTED_NAME')?.trim() || 'buffalo_s';
  }

  private async checkImageModel() {
    const url = this.imageModelUrl();
    if (!url) {
      this.ready = false;
      this.logger.error('IMAGE_MODEL_URL not found. Face search disabled.');
      return;
    }

    this.logger.log(`Checking external image model health: ${url}/health`);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.configNumber('FACE_MODEL_HEALTH_TIMEOUT_MS', 5000, 1000, 15000),
    );
    const response = await fetch(`${url.replace(/\/$/, '')}/health`, {
      signal: controller.signal,
    }).catch((error) => {
      this.logger.error(`Image model connection failed: ${error?.message ?? error}`);
      return null;
    }).finally(() => clearTimeout(timeout));

    if (!response?.ok) {
      this.ready = false;
      this.logger.error(`Image model health check failed${response ? `: HTTP ${response.status}` : ''}`);
      return;
    }

    const health = await response.json().catch(() => null);
    const expectedModel = this.expectedImageModelName();
    if (!health?.ok || health.model !== expectedModel) {
      this.ready = false;
      this.logger.error(`Face model mismatch or unhealthy model; expected ${expectedModel}. Use the existing embedding model until a separate index has been rebuilt.`);
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
    // The Python service already handles decode/orientation/downscaling. Avoid a
    // second full-resolution Sharp decode in Nest, which was a major RAM/CPU spike.
    return this.extractFacesWithImageModel(buffer);
  }

  private imageModelHeaders(contentType?: string) {
    const headers: Record<string, string> = {};
    const apiKey = (
      this.configService.get<string>('IMAGE_MODEL_API_KEY')?.trim()
      || this.configService.get<string>('INSIGHTFACE_API_KEY')?.trim()
    );
    if (apiKey) headers['x-api-key'] = apiKey;
    if (contentType) headers['content-type'] = contentType;
    return headers;
  }

  private detectedFacesFromPayload(payload: any): DetectedFace[] {
    if (!Array.isArray(payload?.faces)) throw new Error('Invalid face model response');
    // Older model deployments omit this response field, but must still pass
    // the model-name check at /health. New deployments verify every response.
    if (payload.model && payload.model !== this.expectedImageModelName()) {
      this.ready = false;
      throw new Error('Face embedding model changed; do not mix incompatible vectors');
    }
    const faces = payload.faces;
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
      .map((face: DetectedFace) => {
        const vector = face.vector.length === INSIGHT_VECTOR_SIZE ? this.normalizeVector(face.vector) : undefined;
        if (!vector || !Object.values(face.box).every(Number.isFinite) || face.box.width <= 0 || face.box.height <= 0) {
          throw new Error('Invalid face embedding or box; retry the image instead of dropping faces');
        }
        return { ...face, vector };
      });
  }

  private async extractFacesFromImageUrl(
    sourceUrl: string,
  ): Promise<DetectedFace[] | undefined> {
    const url = this.imageModelUrl();
    if (!url || !sourceUrl) return undefined;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.configNumber('FACE_MODEL_SCAN_TIMEOUT_MS', 60000, 5000, 120000),
    );

    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/v1/faces/url`, {
        method: 'POST',
        headers: this.imageModelHeaders('application/json'),
        body: JSON.stringify({ url: sourceUrl }),
        signal: controller.signal,
      });
      if (response.status === 404 || response.status === 405) return undefined;
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.detail ??
            payload?.message ??
            `Image model URL scan HTTP ${response.status}`,
        );
      }
      return this.detectedFacesFromPayload(payload);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async extractFacesWithImageModel(buffer: Buffer): Promise<DetectedFace[]> {
    const url = this.imageModelUrl();
    if (!url) return [];

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)]), 'image.jpg');

    const response = await fetch(`${url.replace(/\/$/, '')}/v1/faces`, {
      method: 'POST',
      headers: this.imageModelHeaders(),
      body: form,
      signal: AbortSignal.timeout(this.configNumber('FACE_MODEL_SCAN_TIMEOUT_MS', 120000, 5000, 120000)),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail ?? payload?.message ?? `Image model HTTP ${response.status}`);
    }

    return this.detectedFacesFromPayload(payload);
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

    const collection = await this.collectionModel
      .findOne({ $or: query })
      .select('_id userId imageCacheStatus imageCacheVersion')
      .maxTimeMS(1500)
      .lean();
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
    for (const value of vector) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
      sum += value * value;
    }
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
          if (conflict) continue;

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

    if (conflict) return false;
    if (this.cosine(left.centroid, right.centroid) < minSimilarity) return false;
    if (bestPairScore >= minPairSimilarity) return true;

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
