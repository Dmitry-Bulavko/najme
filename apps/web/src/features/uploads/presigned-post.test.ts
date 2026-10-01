import { afterEach, describe, expect, it, vi } from 'vitest';

import { uploadPresignedPost } from './presigned-post';

type XhrHandlers = {
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  status: number;
  upload: { onprogress: ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
};

let lastXhr: XhrHandlers | null = null;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  lastXhr = null;
});

function installXhr(): void {
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      open = vi.fn();
      send = vi.fn();
      abort = vi.fn();
      status = 0;
      upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      constructor() {
        lastXhr = this as unknown as XhrHandlers;
      }
    },
  );
}

describe('uploadPresignedPost', () => {
  it('appends policy fields before file and reports progress', async () => {
    installXhr();
    const append = vi.spyOn(FormData.prototype, 'append');
    const onProgress = vi.fn();
    const pending = uploadPresignedPost(
      'https://storage.example/upload',
      { key: 'businesses/x/logo.jpg', policy: 'abc' },
      new Blob([new Uint8Array(4)], { type: 'image/jpeg' }),
      'upload.jpg',
      onProgress,
    );
    expect(lastXhr).not.toBeNull();
    lastXhr!.upload.onprogress?.({
      lengthComputable: true,
      loaded: 50,
      total: 100,
    } as ProgressEvent);
    lastXhr!.status = 204;
    lastXhr!.onload?.();

    await pending;

    expect(lastXhr!.open).toHaveBeenCalledWith('POST', 'https://storage.example/upload');
    const keys = append.mock.calls.map((call) => call[0]);
    expect(keys.indexOf('key')).toBeLessThan(keys.indexOf('file'));
    expect(keys.indexOf('policy')).toBeLessThan(keys.indexOf('file'));
    expect(keys.at(-1)).toBe('file');
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it('rejects non-2xx responses as UPLOAD_STORAGE', async () => {
    installXhr();
    const pending = uploadPresignedPost(
      'https://storage.example/upload',
      { key: 'k' },
      new Blob([new Uint8Array(1)]),
      'upload.jpg',
      vi.fn(),
    );
    lastXhr!.status = 403;
    lastXhr!.onload?.();
    await expect(pending).rejects.toThrow('UPLOAD_STORAGE');
  });

  it('rejects network errors as UPLOAD_STORAGE', async () => {
    installXhr();
    const pending = uploadPresignedPost(
      'https://storage.example/upload',
      { key: 'k' },
      new Blob([new Uint8Array(1)]),
      'upload.jpg',
      vi.fn(),
    );
    lastXhr!.onerror?.();
    await expect(pending).rejects.toThrow('UPLOAD_STORAGE');
  });

  it('aborts when the signal fires', async () => {
    installXhr();
    const controller = new AbortController();
    const pending = uploadPresignedPost(
      'https://storage.example/upload',
      { key: 'k' },
      new Blob([new Uint8Array(1)]),
      'upload.jpg',
      vi.fn(),
      controller.signal,
    );
    lastXhr!.abort.mockImplementation(() => {
      lastXhr!.onabort?.();
    });
    controller.abort();
    await expect(pending).rejects.toThrow('UPLOAD_ABORTED');
    expect(lastXhr!.abort).toHaveBeenCalled();
  });
});
