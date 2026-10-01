/**
 * Posts a file to an S3-compatible presigned POST URL with upload progress (0–100).
 * Rejects on non-2xx / network failure.
 */
export function uploadPresignedPost(
  url: string,
  fields: Record<string, string>,
  file: Blob,
  fileName: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    form.append('file', file, fileName);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(`PRESIGN_HTTP_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('PRESIGN_NETWORK'));
    xhr.send(form);
  });
}
