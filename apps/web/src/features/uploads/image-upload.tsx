'use client';

import {
  UPLOAD_MAX_BYTES,
  attachBusinessImageResponseSchema,
  attachStaffPhotoResponseSchema,
  attachUploadRequestSchema,
  createUploadRequestSchema,
  createUploadResponseSchema,
  type UploadKind,
} from '@najme/contracts';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type ReactElement } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';
import { cn } from '@/lib/utils';

import { downscaleImageFile } from './downscale-image';
import { uploadPresignedPost } from './presigned-post';

export type ImageUploadProps = {
  businessId: string;
  kind: UploadKind;
  /** Required when `kind` is `STAFF_PHOTO`. */
  staffId?: string;
  currentUrl: string | null;
  /** Visual framing: square logo vs 16:9 cover (staff uses square). */
  frame: 'square' | 'wide';
  readOnly?: boolean;
  disabled?: boolean;
  onChanged: (urls: {
    logoUrl?: string | null;
    coverUrl?: string | null;
    photoUrl?: string | null;
  }) => void;
};

function attachPath(businessId: string, kind: UploadKind, staffId?: string): string {
  if (kind === 'LOGO') return `/businesses/${businessId}/logo`;
  if (kind === 'COVER') return `/businesses/${businessId}/cover`;
  if (!staffId) {
    throw new Error('staffId is required for STAFF_PHOTO');
  }
  return `/businesses/${businessId}/staff/${staffId}/photo`;
}

/**
 * Presigned image upload with client checks, canvas downscale, progress, replace and remove.
 * Uses plain `<img>` (no next/image) because storage hosts differ per environment.
 */
export function ImageUpload({
  businessId,
  kind,
  staffId,
  currentUrl,
  frame,
  readOnly = false,
  disabled = false,
  onChanged,
}: ImageUploadProps): ReactElement {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const canEdit = !readOnly && !disabled;

  async function runUpload(file: File): Promise<void> {
    setBusy(true);
    setProgress(0);
    try {
      const prepared = await downscaleImageFile(file);
      const createBody = createUploadRequestSchema.parse({
        kind,
        contentType: prepared.contentType,
        contentLength: prepared.blob.size,
      });
      const rawPresign = await apiRequest<unknown>(`/businesses/${businessId}/uploads`, {
        method: 'POST',
        body: createBody,
      });
      const presign = createUploadResponseSchema.parse(rawPresign);
      await uploadPresignedPost(
        presign.url,
        presign.fields,
        prepared.blob,
        prepared.fileName,
        setProgress,
      );
      const attachBody = attachUploadRequestSchema.parse({ key: presign.key });
      const rawAttach = await apiRequest<unknown>(attachPath(businessId, kind, staffId), {
        method: 'PUT',
        body: attachBody,
      });
      if (kind === 'STAFF_PHOTO') {
        const attached = attachStaffPhotoResponseSchema.parse(rawAttach);
        onChanged({ photoUrl: attached.photoUrl });
      } else {
        const attached = attachBusinessImageResponseSchema.parse(rawAttach);
        onChanged({ logoUrl: attached.logoUrl, coverUrl: attached.coverUrl });
      }
      toast.success(t('upload.success'));
    } catch (err) {
      if (err instanceof Error && err.message === 'UPLOAD_TYPE') {
        toast.error(t('upload.invalidType'));
      } else if (err instanceof Error && err.message === 'UPLOAD_SIZE') {
        toast.error(
          t('upload.invalidSize', { maxMb: Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024)) }),
        );
      } else if (err instanceof ApiError) {
        toast.error(errorMessage(tErrors, err.code));
      } else {
        toast.error(errorMessage(tErrors, 'INTERNAL_ERROR'));
      }
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  async function removeImage(): Promise<void> {
    setBusy(true);
    try {
      await apiRequest<unknown>(attachPath(businessId, kind, staffId), {
        method: 'DELETE',
      });
      if (kind === 'LOGO') {
        onChanged({ logoUrl: null });
      } else if (kind === 'COVER') {
        onChanged({ coverUrl: null });
      } else {
        onChanged({ photoUrl: null });
      }
      toast.success(t('upload.removed'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setBusy(false);
    }
  }

  const label =
    kind === 'LOGO' ? t('upload.logo') : kind === 'COVER' ? t('upload.cover') : t('upload.photo');

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-foreground">{label}</p>
      <div
        className={cn(
          'relative overflow-hidden rounded-md border border-border bg-muted',
          frame === 'square' ? 'aspect-square max-w-40' : 'aspect-video w-full max-w-xl',
        )}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage host varies per env (ADR-0014)
          <img src={currentUrl} alt={label} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            {t('upload.empty')}
          </div>
        )}
        {progress !== null ? (
          <div
            className="absolute inset-x-0 bottom-0 h-1 bg-primary/20"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('upload.progress')}
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void runUpload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy && progress !== null
              ? t('upload.uploading', { percent: progress })
              : currentUrl
                ? t('upload.replace')
                : t('upload.choose')}
          </Button>
          {currentUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void removeImage()}
            >
              {t('upload.remove')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('upload.hint')}</p>
    </div>
  );
}
