type BackendRequestInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

const unavailable = "Service temporarily unavailable. Please try again shortly.";
const transientStatuses = new Set([502, 503, 504]);

export class BackendRequestError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "BackendRequestError";
    this.statusCode = statusCode;
  }
}

function publicMessage(payload: unknown, status: number) {
  const value = payload && typeof payload === "object" && "message" in payload ? payload.message : null;
  const message = Array.isArray(value) ? value.find((item) => typeof item === "string") : value;
  if (typeof message === "string" && message.trim() && !/[<>]/.test(message)) return message.trim().slice(0, 500);
  return transientStatuses.has(status) ? unavailable : `Request could not be completed (${status}). Please try again.`;
}

/** Retry transient read failures only. Mutations must never be replayed. */
export async function fetchBackendJson<T>(url: string, init: BackendRequestInit = {}): Promise<T> {
  const readOnly = ["GET", "HEAD"].includes((init.method || "GET").toUpperCase());
  for (let attempt = 0; ; attempt++) {
    try {
      init.signal?.throwIfAborted();
      const signal = readOnly
        ? AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(15_000)])
        : init.signal;
      const response = await fetch(url, { ...init, signal });
      if (response.status === 204) return null as T;
      const json = /\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get("content-type") || "");
      if (!json) {
        await response.body?.cancel();
        throw new BackendRequestError(response.ok ? 502 : response.status, publicMessage(null, response.ok ? 502 : response.status));
      }
      const payload: unknown = await response.json().catch(() => {
        throw new BackendRequestError(response.ok ? 502 : response.status, publicMessage(null, response.ok ? 502 : response.status));
      });
      if (!response.ok) throw new BackendRequestError(response.status, publicMessage(payload, response.status));
      return payload as T;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      const failure = error instanceof BackendRequestError ? error : new BackendRequestError(503, unavailable);
      if (!readOnly || attempt >= 2 || !transientStatuses.has(failure.statusCode)) throw failure;
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : 750));
    }
  }
}
