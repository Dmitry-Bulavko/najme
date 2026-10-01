import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageUpload } from './image-upload';

const apiRequest = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status = 500) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

vi.mock('./downscale-image', () => ({
  downscaleImageFile: async (file: File) => ({
    blob: file,
    contentType: 'image/jpeg' as const,
    fileName: 'upload.jpg',
  }),
  assertUploadableImage: () => 'image/jpeg',
}));

vi.mock('./presigned-post', () => ({
  uploadPresignedPost: vi.fn(
    async (_url, _fields, _file, _name, onProgress: (n: number) => void) => {
      onProgress(100);
    },
  ),
}));

const messages = {
  ...catalogs.en.common,
  errors: catalogs.en.errors,
  business: catalogs.en.business,
};

const businessId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ImageUpload', () => {
  it('presigns, attaches, and notifies on choose', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
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

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImageUpload
          businessId={businessId}
          kind="LOGO"
          currentUrl={null}
          frame="square"
          onChanged={onChanged}
        />
      </NextIntlClientProvider>,
    );

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
  });

  it('removes the current image', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    apiRequest.mockResolvedValue(undefined);
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImageUpload
          businessId={businessId}
          kind="COVER"
          currentUrl="https://cdn.example/cover.jpg"
          frame="wide"
          onChanged={onChanged}
        />
      </NextIntlClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: catalogs.en.business.upload.remove }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(`/businesses/${businessId}/cover`, {
        method: 'DELETE',
      });
    });
    expect(onChanged).toHaveBeenCalledWith({ coverUrl: null });
  });

  it('hides controls when read-only', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImageUpload
          businessId={businessId}
          kind="LOGO"
          currentUrl={null}
          frame="square"
          readOnly
          onChanged={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('button', { name: catalogs.en.business.upload.choose })).toBeNull();
  });
});
