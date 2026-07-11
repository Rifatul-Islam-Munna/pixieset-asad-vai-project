export type DirectUploadTicket = { objectKey: string; uploadUrl: string; expiresInSeconds: number };
export type CompletedDirectUpload = { objectKey: string; name: string; type: string; size: number };

export async function uploadFilesDirectlyToS3(files: File[], tickets: DirectUploadTicket[], onProgress?: (percent: number) => void, concurrency = 3) {
  if (files.length !== tickets.length) throw new Error("Upload authorization mismatch");
  const loaded = files.map(() => 0);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const completed = new Array<CompletedDirectUpload>(files.length);
  let nextIndex = 0;
  const report = () => onProgress?.(total ? Math.min(100, Math.round((loaded.reduce((sum, value) => sum + value, 0) / total) * 100)) : 100);
  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      await putFile(files[index], tickets[index].uploadUrl, (bytes) => { loaded[index] = bytes; report(); });
      loaded[index] = files[index].size;
      completed[index] = { objectKey: tickets[index].objectKey, name: files[index].name, type: files[index].type, size: files[index].size };
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), files.length) }, worker));
  onProgress?.(100);
  return completed;
}

function putFile(file: File, uploadUrl: string, onProgress: (bytes: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`S3 upload failed (${request.status})`));
    request.onerror = () => reject(new Error("Could not connect to S3"));
    request.onabort = () => reject(new Error("S3 upload cancelled"));
    request.send(file);
  });
}

export const directUploadMetadata = (files: File[]) => files.map((file) => ({ name: file.name, type: file.type, size: file.size }));
export function batches<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
