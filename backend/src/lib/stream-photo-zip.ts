import { once } from 'node:events';
import { Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type PhotoZipEntry = {
  name: string;
  open: (signal: AbortSignal) => Promise<Readable>;
};

/** One upstream at a time; backpressure extends all the way to object storage. */
export async function streamPhotoZip(
  entries: AsyncIterable<PhotoZipEntry>,
  destination: Writable,
  signal: AbortSignal,
  idleTimeoutMs = 60_000,
) {
  const { ZipArchive } = await import('archiver');
  signal.throwIfAborted();
  const archive = new ZipArchive({ store: true, forceZip64: true, highWaterMark: 64 * 1024, statConcurrency: 1 });
  const controller = new AbortController();
  let source: Readable | undefined;
  let entryController: AbortController | undefined;
  let idleTimer: NodeJS.Timeout | undefined;
  const cancel = () => {
    controller.abort(signal.reason || new Error('Download cancelled'));
    entryController?.abort(controller.signal.reason);
    source?.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const output = pipeline(archive, destination, { signal: controller.signal });
  // Handle rejection immediately, including while awaiting a storage response.
  void output.catch((error) => {
    controller.abort(error);
    entryController?.abort(error);
    source?.destroy();
  });
  try {
    for await (const entry of entries) {
      controller.signal.throwIfAborted();
      entryController = new AbortController();
      const entrySignal = AbortSignal.any([controller.signal, entryController.signal]);
      const armTimeout = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          const error = new Error('Photo download stalled');
          entryController?.abort(error);
          source?.destroy(error);
        }, idleTimeoutMs);
        idleTimer.unref();
      };
      armTimeout();
      source = await entry.open(entrySignal);
      const current = source;
      current.once('error', (error) => archive.destroy(error));
      entrySignal.throwIfAborted();
      const input = Readable.from((async function* () {
        for await (const chunk of current) {
          entrySignal.throwIfAborted();
          armTimeout();
          yield chunk;
        }
        entrySignal.throwIfAborted();
      })(), { objectMode: false, highWaterMark: 64 * 1024 });
      input.once('error', (error) => archive.destroy(error));
      const appended = once(archive, 'entry', { signal: controller.signal });
      archive.append(input, { name: entry.name });
      await appended;
      if (idleTimer) clearTimeout(idleTimer);
      source.destroy();
      source = undefined;
    }
    await archive.finalize();
    await output;
  } catch (error) {
    controller.abort(error);
    entryController?.abort(error);
    source?.destroy();
    archive.abort();
    archive.destroy();
    await output.catch(() => undefined);
    throw error;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    signal.removeEventListener('abort', cancel);
  }
}
