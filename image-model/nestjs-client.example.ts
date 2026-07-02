/* Node 18+ / NestJS example: call the local Docker service from your existing FaceSearchService. */

type InsightFaceResponse = {
  faceCount: number;
  embeddingDimension: number | null;
  faces: Array<{
    score: number;
    boxPercent: { x: number; y: number; width: number; height: number };
    embedding: number[];
  }>;
};

export async function extractFacesWithInsightFace(
  buffer: Buffer,
  contentType = 'image/jpeg',
): Promise<Array<{ vector: number[]; box: { x: number; y: number; width: number; height: number } }>> {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType }), 'image.jpg');

  const response = await fetch(`${process.env.INSIGHTFACE_URL ?? 'http://127.0.0.1:8010'}/v1/faces`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.INSIGHTFACE_API_KEY ?? '',
    },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`InsightFace API failed (${response.status}): ${await response.text()}`);
  }

  const result = (await response.json()) as InsightFaceResponse;
  return result.faces.map((face) => ({
    vector: face.embedding,
    box: face.boxPercent,
  }));
}
