export type DirectUploadPartTicket = { partNumber: number; url: string };
export type DirectUploadTicket = {
  objectKey: string;
  strategy?: "single" | "multipart";
  uploadUrl?: string;
  uploadId?: string;
  partSize?: number;
  parts?: DirectUploadPartTicket[];
  expiresInSeconds: number;
};
export type DirectUploadMetadata = {
  name: string;
  type: string;
  size: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
};
export type CompletedDirectUpload = DirectUploadMetadata & {
  objectKey: string;
  uploadId?: string;
  parts?: Array<{ partNumber: number; etag: string }>;
};

type UploadParallelism = {
  fileConcurrency: number;
  multipartConcurrency: number;
  requestConcurrency: number;
};

type NetworkRunner = <T>(task: () => Promise<T>) => Promise<T>;

const DEFAULT_FILE_CONCURRENCY = 4;
const DEFAULT_MULTIPART_CONCURRENCY = 6;
const DEFAULT_REQUEST_CONCURRENCY = 10;
const METADATA_CONCURRENCY = 2;
const PROGRESS_INTERVAL_MS = 100;

export async function uploadFilesDirectlyToS3(
  files: File[],
  tickets: DirectUploadTicket[],
  onProgress?: (percent: number) => void,
  concurrency?: number,
) {
  if (files.length !== tickets.length) throw new Error("Upload authorization mismatch");

  const parallelism = getUploadParallelism(tickets, concurrency);
  const runWithNetworkSlot = createConcurrencyLimiter(
    parallelism.requestConcurrency,
  );
  const loaded = files.map(() => 0);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const completed = new Array<CompletedDirectUpload>(files.length);
  let nextIndex = 0;
  const progress = createThrottledProgressReporter(onProgress);

  const report = () => {
    const percent = total
      ? Math.min(
          100,
          Math.round(
            (loaded.reduce((sum, value) => sum + value, 0) / total) * 100,
          ),
        )
      : 100;
    progress.update(percent);
  };

  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      const file = files[index];
      const ticket = tickets[index];

      if (ticket.strategy === "multipart") {
        const multipart = await putMultipartFile(
          file,
          ticket,
          parallelism.multipartConcurrency,
          runWithNetworkSlot,
          (bytes) => {
            loaded[index] = bytes;
            report();
          },
        );
        completed[index] = {
          objectKey: ticket.objectKey,
          ...(await fileUploadMetadata(file)),
          uploadId: ticket.uploadId,
          parts: multipart,
        };
      } else {
        if (!ticket.uploadUrl) throw new Error("Missing direct upload URL");
        await runWithNetworkSlot(() =>
          putBlob(file, ticket.uploadUrl!, file.type, (bytes) => {
            loaded[index] = bytes;
            report();
          }),
        );
        completed[index] = {
          objectKey: ticket.objectKey,
          ...(await fileUploadMetadata(file)),
        };
      }

      loaded[index] = file.size;
      report();
    }
  };

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          parallelism.fileConcurrency,
          Math.max(1, files.length),
        ),
      },
      worker,
    ),
  );

  progress.finish();
  return completed;
}
function getUploadParallelism(
  _tickets: DirectUploadTicket[],
  requestedFileConcurrency?: number,
): UploadParallelism {
  return {
    fileConcurrency: requestedFileConcurrency ?? DEFAULT_FILE_CONCURRENCY,
    multipartConcurrency: DEFAULT_MULTIPART_CONCURRENCY,
    requestConcurrency: DEFAULT_REQUEST_CONCURRENCY,
  };
}

function createThrottledProgressReporter(
  onProgress?: (percent: number) => void,
) {
  let pendingPercent = 0;
  let emittedPercent = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const emit = () => {
    timer = undefined;
    if (!onProgress || pendingPercent <= emittedPercent) return;
    emittedPercent = pendingPercent;
    onProgress(emittedPercent);
  };

  return {
    update(percent: number) {
      pendingPercent = Math.max(pendingPercent, Math.min(100, percent));
      if (!onProgress || timer) return;
      timer = setTimeout(emit, PROGRESS_INTERVAL_MS);
    },
    finish() {
      pendingPercent = 100;
      if (timer) clearTimeout(timer);
      timer = undefined;
      emit();
    },
  };
}

function createConcurrencyLimiter(limit: number): NetworkRunner {
  const max = Math.max(1, Math.floor(limit));
  let active = 0;
  const queue: Array<() => void> = [];

  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < max) {
        active += 1;
        resolve();
        return;
      }
      queue.push(() => {
        active += 1;
        resolve();
      });
    });

  const release = () => {
    active = Math.max(0, active - 1);
    queue.shift()?.();
  };

  return async <T>(task: () => Promise<T>) => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
}
async function putMultipartFile(
  file: File,
  ticket: DirectUploadTicket,
  multipartConcurrency: number,
  runWithNetworkSlot: NetworkRunner,
  onProgress: (bytes: number) => void,
) {
  if (!ticket.uploadId || !ticket.partSize || !ticket.parts?.length) {
    throw new Error("Invalid multipart upload authorization");
  }

  const partLoaded = ticket.parts.map(() => 0);
  const completed = new Array<{ partNumber: number; etag: string }>(
    ticket.parts.length,
  );
  let nextPart = 0;

  const report = () =>
    onProgress(
      Math.min(
        file.size,
        partLoaded.reduce((sum, value) => sum + value, 0),
      ),
    );

  const worker = async () => {
    while (nextPart < ticket.parts!.length) {
      const index = nextPart++;
      const part = ticket.parts![index];
      const start = index * ticket.partSize!;
      const end = Math.min(file.size, start + ticket.partSize!);
      const blob = file.slice(start, end);

      const etag = await runWithNetworkSlot(() =>
        putBlob(blob, part.url, undefined, (bytes) => {
          partLoaded[index] = bytes;
          report();
        }),
      );

      partLoaded[index] = blob.size;
      completed[index] = { partNumber: part.partNumber, etag };
      report();
    }
  };

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          Math.max(1, multipartConcurrency),
          ticket.parts.length,
        ),
      },
      worker,
    ),
  );

  return completed;
}

function putBlob(
  blob: Blob,
  uploadUrl: string,
  contentType: string | undefined,
  onProgress: (bytes: number) => void,
) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    if (contentType) request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        const etag = request.getResponseHeader("ETag");
        if (!etag && blob.size > 0) {
          reject(new Error("Storage did not expose the multipart ETag"));
          return;
        }
        resolve(etag || "");
        return;
      }
      reject(new Error(`S3 upload failed (${request.status})`));
    };
    request.onerror = () => reject(new Error("Could not connect to S3"));
    request.onabort = () => reject(new Error("S3 upload cancelled"));
    request.send(blob);
  });
}

export async function directUploadMetadata(files: File[]) {
  const metadata = new Array<DirectUploadMetadata>(files.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      metadata[index] = await fileUploadMetadata(files[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(METADATA_CONCURRENCY, Math.max(1, files.length)) },
      worker,
    ),
  );
  return metadata;
}

async function fileUploadMetadata(file: File): Promise<DirectUploadMetadata> {
  const base = { name: file.name, type: file.type, size: file.size };
  if (!file.type.startsWith("video/")) return base;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const cleanup = () => URL.revokeObjectURL(url);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const metadata = {
        ...base,
        durationSeconds: Number.isFinite(video.duration)
          ? Math.ceil(video.duration)
          : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      };
      cleanup();
      resolve(metadata);
    };
    video.onerror = () => {
      cleanup();
      resolve(base);
    };
    video.src = url;
  });
}

export function batches<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
