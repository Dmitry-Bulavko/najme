/** Default stall timeout for the storage POST (progress can still update within this window). */
export const PRESIGNED_POST_TIMEOUT_MS = 60_000;

/**
 * Posts a file to an S3-compatible presigned POST URL with upload progress (0–100).
 * Fields are appended before `file` (S3 requirement). Rejects on non-2xx / network / abort.
 */
export function uploadPresignedPost(
  url: string,
  fields: Record<string, string>,
  file: Blob,
  fileName: string,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
  timeoutMs: number = PRESIGNED_POST_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('UPLOAD_ABORTED'));
      return;
    }

    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    // `file` must be last for S3-compatible POST policies.
    form.append('file', file, fileName);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = timeoutMs;

    const onAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener('abort', onAbort);

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      // 4xx/5xx from storage (e.g. policy violation) — not a connectivity failure.
      reject(new Error('UPLOAD_STORAGE'));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('UPLOAD_NETWORK'));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error('UPLOAD_NETWORK'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error('UPLOAD_ABORTED'));
    };
    xhr.send(form);
  });
}
