import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ImageUpload, type ImageUploadProps } from './image-upload';

const apiRequest = vi.fn();
const downscaleImageFile = vi.fn();
const uploadPresignedPost = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toast.success(...args),
    error: (...args: unknown[]) => toast.error(...args),
  },
}));

vi.mock('@/lib/api/client', () => {
  class MockApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status = 500) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  return {
    ApiError: MockApiError,
    apiRequest: (...args: unknown[]) => apiRequest(...args),
  };
});

vi.mock('./downscale-image', async () => {
  const actual = await vi.importActual<typeof import('./downscale-image')>('./downscale-image');
  return {
    ...actual,
    downscaleImageFile: (...args: unknown[]) => downscaleImageFile(...args),
  };
});

vi.mock('./presigned-post', () => ({
  uploadPresignedPost: (...args: unknown[]) => uploadPresignedPost(...args),
}));

const messages = {
  ...catalogs.en.common,
  errors: catalogs.en.errors,
  business: catalogs.en.business,
};

const businessId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  apiRequest.mockReset();
  downscaleImageFile.mockReset();
  uploadPresignedPost.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  downscaleImageFile.mockResolvedValue({
    blob: new Blob([new Uint8Array(3)], { type: 'image/jpeg' }),
    contentType: 'image/jpeg',
    fileName: 'upload.jpg',
  });
  uploadPresignedPost.mockImplementation(
    async (
      _url: string,
      _fields: Record<string, string>,
      _file: Blob,
      _name: string,
      onProgress: (n: number) => void,
    ) => {
      onProgress(100);
    },
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderUpload(props: Partial<ImageUploadProps> = {}) {
  const onChanged = (props.onChanged ?? vi.fn()) as Mock;
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ImageUpload
        businessId={businessId}
        kind="LOGO"
        currentUrl={null}
        frame="square"
        onChanged={onChanged}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onChanged };
}

describe('ImageUpload', () => {
  it('presigns, attaches, and notifies on choose', async () => {
    const user = userEvent.setup();
    const { onChanged } = renderUpload();
    apiRequest
      .mockResolvedValueOnce({
        key: 'businesses/x/logo/y.jpg',
        url: 'https://storage.example/upload',
        fields: { key: 'businesses/x/logo/y.jpg' },
        expiresAt: '2026-10-01T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        logoUrl: 'https://cdn.example/logo.jpg',
        coverUrl: null,
      });

    const file = new File([new Uint8Array([1, 2, 3])], 'logo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${businessId}/uploads`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledWith({
        logoUrl: 'https://cdn.example/logo.jpg',
        coverUrl: null,
      });
    });
    expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.upload.success);
  });

  it('removes the current image and notifies with null', async () => {
    const user = userEvent.setup();
    const { onChanged } = renderUpload({
      kind: 'COVER',
      currentUrl: 'https://cdn.example/cover.jpg',
      frame: 'wide',
    });
    apiRequest.mockResolvedValue(undefined);
    await user.click(
      screen.getByRole('button', {
        name: catalogs.en.business.upload.removeNamed.replace(
          '{label}',
          catalogs.en.business.upload.cover,
        ),
      }),
    );
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(`/businesses/${businessId}/cover`, {
        method: 'DELETE',
      });
    });
    expect(onChanged).toHaveBeenCalledWith({ coverUrl: null });
    expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.upload.removed);
  });

  it('hides controls and hint when read-only', () => {
    renderUpload({ readOnly: true });
    expect(
      screen.queryByRole('button', {
        name: catalogs.en.business.upload.chooseNamed.replace(
          '{label}',
          catalogs.en.business.upload.logo,
        ),
      }),
    ).toBeNull();
    expect(screen.queryByText(catalogs.en.business.upload.hint)).toBeNull();
  });

  it('toasts invalidType for UPLOAD_TYPE', async () => {
    const user = userEvent.setup();
    downscaleImageFile.mockRejectedValue(new Error('UPLOAD_TYPE'));
    renderUpload();
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([new Uint8Array([1])], 'x.jpg', { type: 'image/jpeg' }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(catalogs.en.business.upload.invalidType);
    });
  });

  it('toasts invalidSize for UPLOAD_SIZE', async () => {
    const user = userEvent.setup();
    downscaleImageFile.mockRejectedValue(new Error('UPLOAD_SIZE'));
    renderUpload();
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([new Uint8Array([1])], 'x.jpg', { type: 'image/jpeg' }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        catalogs.en.business.upload.invalidSize.replace('{maxMb}', '5'),
      );
    });
  });

  it('toasts UPLOAD_INVALID for storage failures', async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValueOnce({
      key: 'businesses/x/logo/y.jpg',
      url: 'https://storage.example/upload',
      fields: { key: 'businesses/x/logo/y.jpg' },
      expiresAt: '2026-10-01T12:00:00.000Z',
    });
    uploadPresignedPost.mockRejectedValue(new Error('UPLOAD_STORAGE'));
    renderUpload();
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([new Uint8Array([1])], 'x.jpg', { type: 'image/jpeg' }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(catalogs.en.errors.UPLOAD_INVALID);
    });
  });

  it('toasts UPLOAD_INVALID from attach API errors', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api/client');
    apiRequest
      .mockResolvedValueOnce({
        key: 'businesses/x/logo/y.jpg',
        url: 'https://storage.example/upload',
        fields: { key: 'businesses/x/logo/y.jpg' },
        expiresAt: '2026-10-01T12:00:00.000Z',
      })
      .mockRejectedValueOnce(new ApiError('UPLOAD_INVALID', 'bad key', 400));
    renderUpload();
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([new Uint8Array([1])], 'x.jpg', { type: 'image/jpeg' }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(catalogs.en.errors.UPLOAD_INVALID);
    });
  });
});
