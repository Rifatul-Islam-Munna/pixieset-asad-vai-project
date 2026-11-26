import { FaceSearchService } from './face-search.service';

const galleryId = 'gallery-a';
const basis = (first = 1, second = 0) => {
  const result = Array<number>(512).fill(0);
  result[0] = first;
  result[1] = second;
  return result;
};
const unitWithScore = (score: number) => basis(score, Math.sqrt(1 - score * score));
const box = { x: 10, y: 10, width: 15, height: 15 };
const hit = (imageId: string, score: number, collectionId = galleryId) => ({
  id: imageId + '-face', score, payload: { collectionId, imageId },
});

function setup(settings: Record<string, string> = {}) {
  const config = { get: jest.fn((key: string) => settings[key]) };
  const imageModel = {
    find: jest.fn((filter: any) => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(
          (filter._id.$in as string[]).map(id => ({
            _id: id, collectionId: filter.collectionId,
            url: 'https://example.test/full/' + id + '.jpg',
            thumbnailUrl: 'https://example.test/thumb/' + id + '.jpg',
            width: 2400, height: 1600, metadata: {},
          })),
        ),
      }),
    })),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const facePersonModel = { find: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) };
  const faceIdentityModel = { updateOne: jest.fn().mockResolvedValue({}) };
  const imagor = { isEnabled: jest.fn().mockReturnValue(false), hasWatermark: jest.fn().mockReturnValue(false), imageUrls: jest.fn() };
  const service = new FaceSearchService(config as any, {} as any, imageModel as any, faceIdentityModel as any, facePersonModel as any, {} as any, imagor as any);
  const internals = service as any;
  const qdrant = { retrieve: jest.fn(), search: jest.fn(), scroll: jest.fn() };
  internals.ready = true;
  internals.qdrant = qdrant;
  jest.spyOn(internals, 'assertCollectionFeature').mockResolvedValue({ _id: galleryId, userId: 'owner-a' });
  jest.spyOn(internals, 'ensureReady').mockResolvedValue(true);
  return { service, internals, qdrant, imageModel, facePersonModel, faceIdentityModel, imagor };
}

describe('Face-search accuracy safeguards', () => {
  it('uses the selected face, includes its source photo, filters low scores and other galleries, and deduplicates full-frame results', async () => {
    const { service, qdrant, imageModel, facePersonModel } = setup();
    qdrant.retrieve.mockResolvedValue([{ id: 'chosen-face', vector: basis(), payload: { collectionId: galleryId, imageId: 'chosen-photo', box } }]);
    qdrant.search.mockResolvedValue([hit('same-person', .83), hit('same-person', .77), hit('additional-match', .50), hit('borderline', .49), hit('wrong-person', .31), hit('other-gallery', .99, 'gallery-b')]);

    const result = await service.searchCollectionByFaceId(galleryId, 'chosen-face');

    expect(result.images.map(image => [image._id, image.faceScore])).toEqual([['chosen-photo', 1], ['same-person', .83], ['additional-match', .50]]);
    expect(result.images[0]).toMatchObject({ url: 'https://example.test/full/chosen-photo.jpg', width: 2400, height: 1600 });
    expect(qdrant.retrieve).toHaveBeenCalledWith(expect.any(String), { ids: ['chosen-face'], with_vector: true, with_payload: true });
    expect(qdrant.search).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      score_threshold: .50, params: { exact: true }, filter: { must: [{ key: 'collectionId', match: { value: galleryId } }] }, with_vector: false,
    }));
    expect(imageModel.find).toHaveBeenCalledWith({ collectionId: galleryId, _id: { $in: ['chosen-photo', 'same-person', 'additional-match'] } });
    expect(facePersonModel.find).not.toHaveBeenCalled();
  });

  it('uses authoritative point boxes for sidebar previews and rejects mismatched, deleted, or invalid representatives', async () => {
    const { internals } = setup();
    const valid = { id: 'chosen-face', payload: { collectionId: galleryId, imageId: 'chosen-photo', personId: 'person-a', box, referenceVersion: 'new' } };
    const representatives = [
      { id: 'chosen-face', imageId: 'chosen-photo', personId: 'person-a', photoCount: 12 },
      { id: 'wrong-face', imageId: 'chosen-photo', personId: 'person-a', photoCount: 5 },
      { id: 'missing-face', imageId: 'gone-photo', personId: 'person-b', photoCount: 4 },
      { id: 'invalid-face', imageId: 'chosen-photo', personId: 'person-c', photoCount: 3 },
    ];
    const faces = await internals.verifiedSidebarFaces({ _id: galleryId }, representatives, [
      valid,
      { id: 'wrong-face', payload: { ...valid.payload, personId: 'person-b' } },
      { id: 'invalid-face', payload: { ...valid.payload, personId: 'person-c', box: { ...box, width: 0 } } },
    ]);
    expect(faces).toEqual([expect.objectContaining({
      id: 'chosen-face', imageId: 'chosen-photo', box,
      reference: internals.faceReference(valid),
      imageUrl: 'https://example.test/full/chosen-photo.jpg',
    })]);
  });

  it('shows only groups indexed in at least two distinct photos, without rescanning single-photo groups', async () => {
    const { service, internals, qdrant, facePersonModel } = setup();
    internals.collectionModel.updateOne = jest.fn().mockResolvedValue({});
    jest.spyOn(internals, 'collectionFaceIndexProgress').mockResolvedValue({ totalImages: 3, indexedImages: 3, missingImages: 0 });
    const group = (key: string, imageIds: string[], imageCount: number) => ({
      personKey: key, representativeFaceId: key + '-face',
      representativeImageId: imageIds[0], imageIds, imageCount,
    });
    const people = [
      group('single', ['photo-1'], 1),
      group('repeated-index', ['photo-2', 'photo-2'], 8),
      group('pair', ['photo-1', 'photo-3'], 2),
    ];
    const query = { sort: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), maxTimeMS: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(people) };
    facePersonModel.find.mockReturnValue(query);
    qdrant.retrieve.mockResolvedValue([{ id: 'pair-face', payload: { collectionId: galleryId, imageId: 'photo-1', personId: 'pair', box } }]);
    qdrant.scroll = jest.fn();
    const result = await service.listCollectionFaces(galleryId);
    expect(result.faces).toEqual([expect.objectContaining({ id: 'pair-face', photoCount: 2 })]);
    expect(result.count).toBe(1);
    expect(qdrant.retrieve).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ ids: ['pair-face'] }));
    expect(qdrant.scroll).not.toHaveBeenCalled();

    internals.faceSidebarCache.clear();
    query.lean.mockResolvedValue(people.slice(0, 2));
    qdrant.retrieve.mockClear();
    const empty = await service.listCollectionFaces(galleryId);
    expect(empty.faces).toEqual([]);
    expect(qdrant.retrieve).not.toHaveBeenCalled();
    expect(qdrant.scroll).not.toHaveBeenCalled();
  });

  it('applies the same minimum of two distinct photos to legacy vector groups', async () => {
    const { service, internals, qdrant, facePersonModel } = setup();
    internals.collectionModel.updateOne = jest.fn().mockResolvedValue({});
    jest.spyOn(internals, 'collectionFaceIndexProgress').mockResolvedValue({ totalImages: 3, indexedImages: 3, missingImages: 0 });
    facePersonModel.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), maxTimeMS: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) });
    const point = (id: string, personId: string, imageId: string) => ({ id, payload: { collectionId: galleryId, imageId, personId, box } });
    qdrant.scroll = jest.fn().mockResolvedValue({ points: [
      point('one-a', 'one', 'photo-1'), point('one-b', 'one', 'photo-1'),
      point('pair-a', 'pair', 'photo-2'), point('pair-b', 'pair', 'photo-3'),
    ] });
    const result = await service.listCollectionFaces(galleryId);
    expect(result.faces).toEqual([expect.objectContaining({ id: 'pair-a', photoCount: 2 })]);
    expect(result.count).toBe(1);
  });

  it('rejects a previously displayed face reference after its point was replaced', async () => {
    const { service, internals, qdrant } = setup();
    const point = { id: 'chosen-face', vector: basis(), payload: { collectionId: galleryId, imageId: 'chosen-photo', box, referenceVersion: 'old' } };
    const reference = internals.faceReference(point);
    qdrant.retrieve.mockResolvedValue([{ ...point, payload: { ...point.payload, referenceVersion: 'new' } }]);
    await expect(service.searchCollectionByFaceId(galleryId, point.id, reference)).rejects.toThrow('Face reference changed');
    expect(qdrant.search).not.toHaveBeenCalled();
  });

  it('rejects a stale face reference whose box changed', async () => {
    const { service, internals, qdrant } = setup();
    const point = { id: 'chosen-face', vector: basis(), payload: { collectionId: galleryId, imageId: 'chosen-photo', box } };
    const reference = internals.faceReference(point);
    qdrant.retrieve.mockResolvedValue([{ ...point, payload: { ...point.payload, box: { ...box, x: 65 } } }]);
    await expect(service.searchCollectionByFaceId(galleryId, point.id, reference)).rejects.toThrow('Face reference changed');
    expect(qdrant.search).not.toHaveBeenCalled();
  });

  it('does not accept a reindex request when the required services are unavailable', async () => {
    const { service, internals } = setup();
    internals.collectionModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: galleryId, userId: 'owner-a' }) }),
    });
    internals.collectionModel.findOneAndUpdate = jest.fn();
    jest.spyOn(internals, 'ensureReady').mockResolvedValue(false);
    const cleanup = jest.spyOn(internals, 'deleteCollectionFaces');
    await expect(service.requestCollectionFaceReindex('owner-a', galleryId)).rejects.toThrow('Face search is not ready');
    expect(internals.collectionModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('rejects a face reference from another gallery', async () => {
    const { service, qdrant } = setup();
    qdrant.retrieve.mockResolvedValue([{ id: 'foreign-face', vector: basis(), payload: { collectionId: 'gallery-b', imageId: 'foreign' } }]);
    await expect(service.searchCollectionByFaceId(galleryId, 'foreign-face')).rejects.toThrow('Face not found');
    expect(qdrant.search).not.toHaveBeenCalled();
  });

  it('expands a full result window instead of silently cutting matching photos at 512', async () => {
    const { internals, qdrant } = setup();
    const hits = Array.from({ length: 513 }, (_, i) => hit('photo-' + i, .8));
    qdrant.search.mockResolvedValueOnce(hits.slice(0, 512)).mockResolvedValueOnce(hits);
    const result = await internals.searchByVectors(galleryId, [basis()], { _id: galleryId });
    expect(result.count).toBe(513);
    expect(result.truncated).toBe(false);
    expect(qdrant.search.mock.calls.map(call => call[1].limit)).toEqual([512, 2048]);
  });

  it('reports when the configured safety ceiling is reached', async () => {
    const { internals, qdrant } = setup({ FACE_SEARCH_SCAN_LIMIT: '2' });
    qdrant.search.mockResolvedValue([hit('one', .8), hit('two', .7)]);
    const result = await internals.searchByVectors(galleryId, [basis()], { _id: galleryId });
    expect(result.count).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it('does not assign an ambiguous face to an existing person group', () => {
    const { internals } = setup();
    expect(internals.unambiguousMatch([{ centroid: unitWithScore(.8) }, { centroid: unitWithScore(.77) }], basis(), .58)).toBeUndefined();
    const clear = { centroid: unitWithScore(.9) };
    expect(internals.unambiguousMatch([clear, { centroid: unitWithScore(.6) }], basis(), .58)).toBe(clear);
    expect(internals.unambiguousMatch([{ centroid: unitWithScore(.4) }], basis(), .58)).toBeUndefined();
  });

  it('never groups two different face positions in one photo under the same person or global identity', async () => {
    const { internals, facePersonModel } = setup();
    const person = { personKey: 'existing-person', identityKey: 'existing-identity', centroid: basis(), faceCount: 2, imageCount: 2, representativeBox: box };
    facePersonModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([person]) });
    jest.spyOn(internals, 'backfillLegacyFacePersons').mockResolvedValue(undefined);
    jest.spyOn(internals, 'loadUserIdentities').mockResolvedValue([{ ...person, collectionIds: [galleryId] }]);
    const assigned = await internals.assignPersonIds('owner-a', galleryId, 'group-photo', 'https://example.test/group.jpg', [
      { vector: basis(), box },
      { vector: basis(), box: { ...box, x: 50 } },
    ]);
    expect(assigned).toHaveLength(2);
    expect(assigned[0].personId).toBe('existing-person');
    expect(assigned[0].identityKey).toBe('existing-identity');
    expect(assigned[1].personId).not.toBe(assigned[0].personId);
    expect(assigned[1].identityKey).not.toBe(assigned[0].identityKey);
  });

  it('rejects a multi-face search upload rather than returning a union of different people', async () => {
    const { service, internals, qdrant } = setup();
    jest.spyOn(internals, 'extractFaces').mockResolvedValue([{ vector: basis(), box }, { vector: basis(0, 1), box: { ...box, x: 50 } }]);
    await expect(service.searchCollection(galleryId, { buffer: Buffer.from('synthetic') } as any)).rejects.toThrow('just the person');
    expect(qdrant.search).not.toHaveBeenCalled();
  });

  it('uses the higher-resolution existing full-frame derivative and preserves the watermark settings', () => {
    const { internals, imagor } = setup();
    imagor.isEnabled.mockReturnValue(true);
    imagor.imageUrls.mockReturnValue({ url: 'https://example.test/view', responsive: { small: 'https://example.test/small' } });
    const watermark = { text: 'Example', opacity: 25 };
    const source = internals.faceIndexImageUrl({ originalObjectKey: 'original.jpg', url: 'https://example.test/gallery', width: 2400, height: 1600, metadata: { imagorWatermark: watermark } });
    expect(source).toBe('https://example.test/view');
    expect(imagor.imageUrls).toHaveBeenCalledWith('original.jpg', watermark, { width: 2400, height: 1600 });
  });

  it('rejects incompatible model responses and invalid embeddings, instead of silently marking zero faces', () => {
    const { internals } = setup({ FACE_MODEL_EXPECTED_NAME: 'buffalo_s' });
    expect(() => internals.detectedFacesFromPayload({ model: 'buffalo_l', faces: [] })).toThrow('model changed');
    expect(internals.ready).toBe(false);
    expect(() => internals.detectedFacesFromPayload({})).toThrow('Invalid face model response');
    expect(() => internals.detectedFacesFromPayload({ faces: [{ embedding: [1, 2], boxPercent: box }] })).toThrow('Invalid face embedding');
    expect(internals.detectedFacesFromPayload({ model: 'buffalo_s', faces: [{ embedding: basis(2, 0), boxPercent: box }] })[0].vector).toEqual(basis());
  });

  it('retains existing face points if inference and image fallback fail', async () => {
    const { internals } = setup();
    jest.spyOn(internals, 'extractFacesFromImageUrl').mockRejectedValue(new Error('temporary inference outage'));
    jest.spyOn(internals, 'readImage').mockResolvedValue(null);
    const remove = jest.spyOn(internals, 'deleteImageFaces').mockResolvedValue(undefined);
    const failed = jest.spyOn(internals, 'markFaceIndexFailure').mockResolvedValue(undefined);
    await internals.indexImageNow({ _id: 'photo-1', collectionId: galleryId, userId: 'owner-a', url: 'https://example.test/photo.jpg' });
    expect(remove).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalled();
  });
});
