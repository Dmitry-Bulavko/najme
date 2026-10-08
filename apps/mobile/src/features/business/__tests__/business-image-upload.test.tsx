import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UPLOAD_MAX_BYTES } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  BusinessImageUpload,
  uploadPresignedPost,
} from '@/features/business/business-image-upload';
import { apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const baseBusinessId = '11111111-1111-4111-8111-111111111111';
const mockConfirm = jest.fn<(options: unknown) => Promise<boolean>>();

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

jest.mock('@/components/ui/confirm', () => ({
  confirm: (options: unknown) => mockConfirm(options),
}));

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
  mockConfirm.mockReset();
  mockConfirm.mockResolvedValue(true);
  jest.mocked(apiRequest).mockReset();
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockReset();
  jest.mocked(ImageManipulator.manipulate).mockClear();
});

describe('BusinessImageUpload', () => {
  const chooseLabel = catalogs.en.business.upload.chooseNamed.replace(
    '{label}',
    catalogs.en.business.upload.logo,
  );

  function setPlatformOs(value: string): () => void {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value });
    return () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
    };
  }

  function installXhr(Impl: new () => unknown): () => void {
    const previous = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      configurable: true,
      writable: true,
      value: Impl,
    });
    return () => {
      if (previous === undefined) {
        Reflect.deleteProperty(globalThis, 'XMLHttpRequest');
      } else {
        Object.defineProperty(globalThis, 'XMLHttpRequest', {
          configurable: true,
          writable: true,
          value: previous,
        });
      }
    };
  }

  it('keeps preview on web but hides edit buttons', async () => {
    const restore = setPlatformOs('web');
    try {
      const screen = await renderWithI18n(
        <BusinessImageUpload
          businessId={baseBusinessId}
          kind="LOGO"
          currentUrl="https://cdn.example/logo.jpg"
          frame="square"
          onChanged={jest.fn()}
        />,
      );
      expect(screen.getByTestId('upload-logo')).toBeTruthy();
      expect(screen.queryByLabelText(chooseLabel)).toBeNull();
      expect(
        screen.queryByLabelText(
          catalogs.en.business.upload.replaceNamed.replace(
            '{label}',
            catalogs.en.business.upload.logo,
          ),
        ),
      ).toBeNull();
      screen.unmount();
    } finally {
      restore();
    }
  });

  it('uploads via resize, presign, multipart fields-before-file, then attach', async () => {
    const restoreOs = setPlatformOs('ios');
    const appendKeys: string[] = [];
    const appendSpy = jest.spyOn(FormData.prototype, 'append').mockImplementation(function append(
      this: FormData,
      key: string,
    ) {
      appendKeys.push(key);
    });

    class MockXHR {
      status = 204;
      upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      open = jest.fn();
      send = jest.fn(() => {
        queueMicrotask(() => this.onload?.());
      });
    }
    const restoreXhr = installXhr(MockXHR);

    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///photo.jpg',
          width: 3200,
          height: 2400,
          fileSize: 2 * 1024 * 1024,
        },
      ],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      blob: async () => ({ size: 400_000 }),
    } as Response);

    const onChanged = jest.fn();
    jest.mocked(apiRequest).mockImplementation(((
      path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (path.endsWith('/uploads') && init?.method === 'POST') {
        expect(init.body).toEqual({
          kind: 'LOGO',
          contentType: 'image/jpeg',
          contentLength: 400_000,
        });
        return Promise.resolve({
          key: 'uploads/logo.jpg',
          url: 'https://storage.example/post',
          fields: { key: 'uploads/logo.jpg', Policy: 'p', 'X-Amz-Signature': 's' },
          expiresAt: '2026-06-15T12:10:00.000Z',
        });
      }
      if (path.endsWith('/logo') && init?.method === 'PUT') {
        return Promise.resolve({
          logoUrl: 'https://cdn.example/logo.jpg',
          coverUrl: null,
        });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    try {
      const screen = await renderWithI18n(
        <BusinessImageUpload
          businessId={baseBusinessId}
          kind="LOGO"
          currentUrl={null}
          frame="square"
          onChanged={onChanged}
        />,
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText(chooseLabel));
      });

      await waitFor(() => {
        expect(ImageManipulator.manipulate).toHaveBeenCalled();
        const ctx = jest.mocked(ImageManipulator.manipulate).mock.results[0]?.value as {
          resize: { mock: { calls: unknown[] } };
        };
        expect(ctx.resize.mock.calls.length).toBeGreaterThan(0);
        expect(onChanged).toHaveBeenCalledWith({
          logoUrl: 'https://cdn.example/logo.jpg',
          coverUrl: null,
        });
      });

      const fileIndex = appendKeys.indexOf('file');
      expect(fileIndex).toBeGreaterThan(0);
      expect(appendKeys.slice(0, fileIndex)).toEqual(
        expect.arrayContaining(['key', 'Policy', 'X-Amz-Signature']),
      );

      screen.unmount();
    } finally {
      appendSpy.mockRestore();
      fetchSpy.mockRestore();
      restoreXhr();
      restoreOs();
    }
  });

  it('rejects inputs over 25 MB', async () => {
    const restoreOs = setPlatformOs('android');
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///huge.jpg',
          width: 100,
          height: 100,
          fileSize: 26 * 1024 * 1024,
        },
      ],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    try {
      const screen = await renderWithI18n(
        <BusinessImageUpload
          businessId={baseBusinessId}
          kind="LOGO"
          currentUrl={null}
          frame="square"
          onChanged={jest.fn()}
        />,
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText(chooseLabel));
      });

      await waitFor(() => {
        expect(
          screen.getByText(catalogs.en.business.upload.invalidSize.replace('{maxMb}', '25')),
        ).toBeTruthy();
      });
      expect(apiRequest).not.toHaveBeenCalled();
      screen.unmount();
    } finally {
      restoreOs();
    }
  });

  it('maps storage failure to UPLOAD_INVALID', async () => {
    const restoreOs = setPlatformOs('ios');
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.jpg', width: 800, height: 600, fileSize: 1000 }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      blob: async () => ({ size: 1000 }),
    } as Response);

    jest.mocked(apiRequest).mockResolvedValue({
      key: 'k',
      url: 'https://storage.example/post',
      fields: { key: 'k' },
      expiresAt: '2026-06-15T12:10:00.000Z',
    });

    class FailXHR {
      status = 403;
      upload = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      open = jest.fn();
      send = jest.fn(() => {
        queueMicrotask(() => this.onload?.());
      });
    }
    const restoreXhr = installXhr(FailXHR);

    try {
      const screen = await renderWithI18n(
        <BusinessImageUpload
          businessId={baseBusinessId}
          kind="LOGO"
          currentUrl={null}
          frame="square"
          onChanged={jest.fn()}
        />,
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText(chooseLabel));
      });

      await waitFor(() => {
        expect(screen.getByText(catalogs.en.errors.UPLOAD_INVALID)).toBeTruthy();
      });
      screen.unmount();
    } finally {
      fetchSpy.mockRestore();
      restoreXhr();
      restoreOs();
    }
  });

  it('re-compresses when result exceeds UPLOAD_MAX_BYTES', async () => {
    const restoreOs = setPlatformOs('ios');
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.jpg', width: 800, height: 600, fileSize: 1000 }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    let probe = 0;
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      probe += 1;
      const size = probe === 1 ? UPLOAD_MAX_BYTES + 1 : 100_000;
      return { blob: async () => ({ size }) } as Response;
    });

    class OkXHR {
      status = 204;
      upload = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      open = jest.fn();
      send = jest.fn(() => {
        queueMicrotask(() => this.onload?.());
      });
    }
    const restoreXhr = installXhr(OkXHR);

    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/uploads')) {
        return Promise.resolve({
          key: 'k',
          url: 'https://storage.example/post',
          fields: { key: 'k' },
          expiresAt: '2026-06-15T12:10:00.000Z',
        });
      }
      if (path.endsWith('/logo') && init?.method === 'PUT') {
        return Promise.resolve({ logoUrl: 'https://cdn.example/x.jpg', coverUrl: null });
      }
      return Promise.reject(new Error(path));
    }) as typeof apiRequest);

    try {
      const screen = await renderWithI18n(
        <BusinessImageUpload
          businessId={baseBusinessId}
          kind="LOGO"
          currentUrl={null}
          frame="square"
          onChanged={jest.fn()}
        />,
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText(chooseLabel));
      });

      await waitFor(() => {
        expect(jest.mocked(ImageManipulator.manipulate).mock.calls.length).toBeGreaterThanOrEqual(
          2,
        );
      });
      screen.unmount();
    } finally {
      fetchSpy.mockRestore();
      restoreXhr();
      restoreOs();
    }
  });

  it('uploadPresignedPost appends fields before file', async () => {
    const keys: string[] = [];
    const appendSpy = jest.spyOn(FormData.prototype, 'append').mockImplementation(function append(
      _key: string,
    ) {
      keys.push(String(_key));
    });
    class OkXHR {
      status = 204;
      upload = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      open = jest.fn();
      send = jest.fn(() => {
        queueMicrotask(() => this.onload?.());
      });
    }
    const restoreXhr = installXhr(OkXHR);

    try {
      await uploadPresignedPost(
        'https://storage.example/post',
        { a: '1', b: '2' },
        { uri: 'file:///x.jpg', name: 'upload.jpg', type: 'image/jpeg' },
        () => undefined,
      );
      expect(keys).toEqual(['a', 'b', 'file']);
    } finally {
      appendSpy.mockRestore();
      restoreXhr();
    }
  });

  it('clears logoUrl after DELETE 204 without parsing a body', async () => {
    const restoreOs = setPlatformOs('ios');
    const removeLabel = catalogs.en.business.upload.removeNamed.replace(
      '{label}',
      catalogs.en.business.upload.logo,
    );
    const onChanged = jest.fn();
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/logo') && init?.method === 'DELETE') {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    try {
      const screen = await renderWithI18n(
        <BusinessImageUpload
          businessId={baseBusinessId}
          kind="LOGO"
          currentUrl="https://cdn.example/logo.jpg"
          frame="square"
          onChanged={onChanged}
        />,
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText(removeLabel));
      });

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
        expect(onChanged).toHaveBeenCalledWith({ logoUrl: null });
      });
      expect(screen.getByText(catalogs.en.business.upload.removed)).toBeTruthy();
      screen.unmount();
    } finally {
      restoreOs();
    }
  });

  it('clears coverUrl after DELETE 204 without parsing a body', async () => {
    const restoreOs = setPlatformOs('ios');
    const removeLabel = catalogs.en.business.upload.removeNamed.replace(
      '{label}',
      catalogs.en.business.upload.cover,
    );
    const onChanged = jest.fn();
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/cover') && init?.method === 'DELETE') {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    try {
      const screen = await renderWithI18n(
        <BusinessImageUpload
          businessId={baseBusinessId}
          kind="COVER"
          currentUrl="https://cdn.example/cover.jpg"
          frame="wide"
          onChanged={onChanged}
        />,
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText(removeLabel));
      });

      await waitFor(() => {
        expect(onChanged).toHaveBeenCalledWith({ coverUrl: null });
      });
      screen.unmount();
    } finally {
      restoreOs();
    }
  });

  it('attaches STAFF_PHOTO via /staff/:id/photo and reports photoUrl', async () => {
    const restoreOs = setPlatformOs('ios');
    const staffId = '33333333-3333-4333-8333-333333333333';
    const choosePhotoLabel = catalogs.en.business.upload.chooseNamed.replace(
      '{label}',
      catalogs.en.business.upload.photo,
    );

    class MockXHR {
      status = 204;
      upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      open = jest.fn();
      send = jest.fn(() => {
        queueMicrotask(() => this.onload?.());
      });
    }
    const restoreXhr = installXhr(MockXHR);
    jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);

    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///staff.jpg',
          width: 800,
          height: 800,
          fileSize: 100_000,
        },
      ],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      blob: async () => ({ size: 80_000 }),
    } as Response);

    const onChanged = jest.fn();
    jest.mocked(apiRequest).mockImplementation(((
      path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (path.endsWith('/uploads') && init?.method === 'POST') {
        expect(init.body).toEqual({
          kind: 'STAFF_PHOTO',
          contentType: 'image/jpeg',
          contentLength: 80_000,
        });
        return Promise.resolve({
          key: 'uploads/staff.jpg',
          url: 'https://storage.example/post',
          fields: { key: 'uploads/staff.jpg' },
          expiresAt: '2026-06-15T12:10:00.000Z',
        });
      }
      if (path.endsWith(`/staff/${staffId}/photo`) && init?.method === 'PUT') {
        return Promise.resolve({ photoUrl: 'https://cdn.example/staff.jpg' });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    try {
      const screen = await renderWithI18n(
        <BusinessImageUpload
          businessId={baseBusinessId}
          kind="STAFF_PHOTO"
          staffId={staffId}
          currentUrl={null}
          frame="square"
          onChanged={onChanged}
        />,
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText(choosePhotoLabel));
      });

      await waitFor(() => {
        expect(onChanged).toHaveBeenCalledWith({ photoUrl: 'https://cdn.example/staff.jpg' });
      });
      expect(screen.getByTestId('upload-staff_photo')).toBeTruthy();
      screen.unmount();
    } finally {
      fetchSpy.mockRestore();
      restoreXhr();
      restoreOs();
      jest.restoreAllMocks();
    }
  });
});
